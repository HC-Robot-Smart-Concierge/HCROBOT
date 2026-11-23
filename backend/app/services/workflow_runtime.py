"""Persistent scheduling and supervised ROS worker lifecycle. No browser owns motion."""
import asyncio
import json
import logging
import os
from pathlib import Path
import subprocess
import time
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from app.models.workflow import RobotWorkflow
from app.models.workflow_run import WorkflowRun
from app.repositories.workflow_repository import WorkflowRepository
from app.schemas.workflow import WorkflowExecutionConfig
from app.services.workflow_guest_hold import (
    apply_guest_report, clear_guest_hold, guest_control_fields, new_guest_state, run_phase, status_payload,
)
from app.services.workflow_plan import physical_plan
from app.services.workflow_schedule import ZONE_OFFSETS

logger = logging.getLogger(__name__)
TERMINAL = {"COMPLETED", "FAILED", "CANCELLED", "SKIPPED"}
LEASE_SECONDS = 10.0
CONTROL_INTERVAL_SECONDS = 1.0
# Stop before the database's 25 s stale-owner recovery can release the robot.
DATABASE_AUTHORIZATION_SECONDS = 20.0
STATUS_REFRESH_SECONDS = 10.0


def due_slot(workflow, now):
    if not workflow.is_active or workflow.trigger_type != "SCHEDULE":
        return None
    config = WorkflowExecutionConfig.model_validate(workflow.execution_config or {})
    if config.execution_mode != "ROBOT" or config.route:
        return None
    for item in config.schedules:
        local = now.astimezone(timezone(timedelta(hours=ZONE_OFFSETS[item.timezone])))
        if item.enabled and local.weekday() in item.days and local.strftime("%H:%M") == item.time:
            return f"{workflow.id}:{now.astimezone(timezone.utc).strftime('%Y%m%dT%H%M')}"
    return None


def run_view(run):
    return {key: getattr(run, key) for key in (
        "id", "workflow_id", "name", "robot_id", "status", "current_step_index",
        "completed_steps", "round_index", "total_steps", "error", "events",
        "created_at", "started_at", "completed_at",
    )}


def atomic_json(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    # DrvFS readers in WSL can briefly hold a Windows handle without delete
    # sharing. Retain atomic replacement, retrying that short sharing conflict.
    for attempt in range(20):
        try:
            temporary.replace(path)
            return
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(.01)


class WorkflowRuntime:
    def __init__(self, sessions=None, root=None):
        if sessions is None:
            from app.core.database import AsyncSessionLocal
            sessions = AsyncSessionLocal
        self.sessions = sessions
        self.root = root or Path(__file__).resolve().parents[3]
        self.directory = self.root / 'output/runtime/workflow-runs'
        self.owner = uuid.uuid4().hex
        self.running = {}
        self.task = None
        self.control_task = None

    async def enqueue(self, workflow, repo, robot_id='RC-001', slot=None):
        plan = await physical_plan(workflow, repo)
        from app.repositories.map_repository import MapRepository
        from app.services.zone_geometry import point_in_zone
        zones = await MapRepository(repo.db).list_zones(plan['map_id'])
        for step in plan['steps']:
            if step['type'] != 'MOVE':
                continue
            for zone in zones:
                if zone.type in {'KEEP_OUT', 'NO_STOP'} and point_in_zone(
                    step['params']['target_x'], step['params']['target_y'], zone
                ):
                    raise ValueError(f"Điểm đến nằm trong vùng {zone.name} ({zone.type}).")
        if robot_id != plan['config']['robot_id']:
            raise ValueError("Robot được chọn không khớp cấu hình workflow.")
        async with self.sessions() as db:
            if slot and await db.scalar(select(WorkflowRun.id).where(WorkflowRun.schedule_slot == slot)):
                return None
            run = WorkflowRun(id=f"RUN-{uuid.uuid4().hex[:16]}", workflow_id=workflow.id,
                              name=workflow.name, robot_id=robot_id, active_robot_id=robot_id,
                              schedule_slot=slot, status='PENDING', payload=plan,
                              total_steps=len(plan['steps']), events=[])
            db.add(run)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                if not slot:
                    raise ValueError("Robot đang có lượt chạy khác. Dừng hoặc chờ lượt đó hoàn tất.")
                # A busy scheduled slot is skipped, never unexpectedly replayed later.
                if await db.scalar(select(WorkflowRun.id).where(WorkflowRun.schedule_slot == slot)):
                    return None
                run = WorkflowRun(id=f"RUN-{uuid.uuid4().hex[:16]}", workflow_id=workflow.id,
                                  name=workflow.name, robot_id=robot_id, schedule_slot=slot,
                                  status='SKIPPED', payload=plan, total_steps=len(plan['steps']),
                                  events=[], error='Robot đang bận tại giờ chạy.', completed_at=datetime.utcnow())
                db.add(run)
                try:
                    await db.commit()
                except IntegrityError:
                    await db.rollback()
                    return None
            return run_view(run)

    async def list_runs(self, workflow_id=None):
        async with self.sessions() as db:
            query = select(WorkflowRun).order_by(WorkflowRun.created_at.desc()).limit(50)
            if workflow_id:
                query = query.where(WorkflowRun.workflow_id == workflow_id)
            return [run_view(r) for r in (await db.scalars(query)).all()]

    async def cancel(self, run_id):
        item = self.running.get(run_id)
        if item is not None:
            # An explicit stop must not wait for a database round trip.
            item['cancel_requested'] = True
            self.refresh_control(item)
        async with self.sessions() as db:
            # Conditional updates prevent a simultaneous worker claim from losing cancellation.
            await db.execute(update(WorkflowRun).where(WorkflowRun.id == run_id, WorkflowRun.status == 'PENDING')
                             .values(status='CANCELLED', active_robot_id=None, completed_at=datetime.utcnow()))
            await db.execute(update(WorkflowRun).where(WorkflowRun.id == run_id, WorkflowRun.status == 'RUNNING')
                             .values(status='CANCELLING'))
            await db.commit()
            run = await db.get(WorkflowRun, run_id)
            return run_view(run) if run else None

    def start(self):
        self.directory.mkdir(parents=True, exist_ok=True)
        self.control_task = asyncio.create_task(self.control_loop())
        self.task = asyncio.create_task(self.loop())

    async def close(self):
        tasks = [task for task in (self.task, self.control_task) if task is not None]
        for task in tasks:
            task.cancel()
        for task in tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass
        # Do not release the DB reservation before the ROS worker has stopped.
        # Its lease also expires after 10 s if the backend is killed abruptly.
        for item in self.running.values():
            item['cancel_requested'] = True
            self.refresh_control(item)

    def refresh_control(self, item):
        now = time.time()
        # The local heartbeat is independent of scheduler/DB latency, but it
        # cannot keep authorizing motion indefinitely if DB ownership is lost.
        confirmed = item.get('db_confirmed_at')
        authorization_left = (0.0 if confirmed is None else
                              DATABASE_AUTHORIZATION_SECONDS - (time.monotonic() - confirmed))
        if authorization_left <= 0:
            item['cancel_requested'] = True
            item['stop_reason'] = 'Backend không xác nhận được quyền quản lý lượt chạy trong 20 giây.'
        item['control_sequence'] = item.get('control_sequence', 0) + 1
        control = {
            'cancel': bool(item.get('cancel_requested')),
            'expires_at': now + max(0.0, min(LEASE_SECONDS, authorization_left)),
            'issued_at': now, 'sequence': item['control_sequence'],
            'stop_reason': item.get('stop_reason'),
        }
        if item.get('parallel'):
            control.update(guest_control_fields(item['guest']))
        atomic_json(item['control'], control)

    def report_guest(self, robot_id, state, idle_ms):
        """Robot screen: REQUEST stops the vehicle, ENGAGED renews the hold, DONE releases it."""
        found = next(((run_id, item) for run_id, item in self.running.items()
                      if item.get('parallel') and item.get('robot_id') == robot_id
                      and item['process'].poll() is None), None)
        if found is None:
            return {'accepted': False, 'run_id': None}
        run_id, item = found
        accepted = apply_guest_report(item['guest'], item.get('phase'), state, idle_ms,
                                      item['parallel'].get('no_interaction_sec', 20), time.time())
        if accepted:
            self.refresh_control(item)
        return {'accepted': accepted, 'run_id': run_id}

    async def publish_status(self, run, item, force=False):
        """Tell the robot screen on a phase change, and every 10 s so a reopened screen catches up."""
        if not item.get('parallel'):
            return
        now = time.monotonic()
        if not force and item.get('phase_sent') == item.get('phase') \
                and now - item.get('status_sent_at', -STATUS_REFRESH_SECONDS) < STATUS_REFRESH_SECONDS:
            return
        item['phase_sent'], item['status_sent_at'] = item.get('phase'), now
        try:
            from app.services.notification_manager import notification_manager
            await notification_manager.broadcast_to_department(None, status_payload(run, item))
        except Exception:
            logger.exception('Cannot publish workflow run status %s', run.id)

    async def control_loop(self):
        while True:
            for run_id, item in list(self.running.items()):
                if item['process'].poll() is not None:
                    continue
                try:
                    self.refresh_control(item)
                except OSError:
                    # Failed file writes do not extend the worker's previous lease.
                    logger.exception('Cannot renew workflow control %s', run_id)
            await asyncio.sleep(CONTROL_INTERVAL_SECONDS)

    async def loop(self):
        while True:
            try:
                await self.tick()
            except Exception:
                logger.exception('Workflow scheduler tick failed')
            await asyncio.sleep(1)

    async def tick(self):
        now = datetime.utcnow()
        async with self.sessions() as db:
            await db.execute(update(WorkflowRun).where(
                WorkflowRun.status.in_(['RUNNING', 'CANCELLING']),
                WorkflowRun.heartbeat_at < now - timedelta(seconds=25),
            ).values(status='FAILED', active_robot_id=None, completed_at=now,
                     error='Bộ thực thi mất kết nối; lượt chạy không được tự tiếp tục.'))
            await db.commit()
            workflows = (await db.scalars(select(RobotWorkflow).where(
                RobotWorkflow.is_active.is_(True), RobotWorkflow.trigger_type == 'SCHEDULE'))).all()
            repo = WorkflowRepository(db)
            for workflow in workflows:
                try:
                    slot = due_slot(workflow, datetime.now(timezone.utc))
                    if slot:
                        await self.enqueue(workflow, repo, slot=slot)
                except ValueError as exc:
                    logger.warning('Invalid scheduled workflow %s: %s', workflow.id, exc)
            pending = (await db.scalars(select(WorkflowRun).where(WorkflowRun.status == 'PENDING'))).all()
            for run in pending:
                claimed = await db.execute(update(WorkflowRun).where(
                    WorkflowRun.id == run.id, WorkflowRun.status == 'PENDING'
                ).values(status='RUNNING', owner=self.owner, heartbeat_at=now, started_at=now))
                await db.commit()
                if claimed.rowcount:
                    await self.launch(run)
        for run_id in list(self.running):
            await self.monitor(run_id)

    async def launch(self, run):
        request = self.directory / f'{run.id}.json'
        control = self.directory / f'{run.id}.control.json'
        events = self.directory / f'{run.id}.events.jsonl'
        atomic_json(request, run.payload)
        atomic_json(control, {'cancel': False, 'expires_at': time.time() + LEASE_SECONDS})
        from app.services.hardware.ros2_runtime_service import ros2_runtime_service
        args = [str(request), str(control), str(events)]
        if os.name == 'nt':
            args = [ros2_runtime_service._to_wsl_path(Path(p)) for p in args]
            command = ros2_runtime_service._wsl_command('run_workflow.sh', *args)
        else:
            command = ['bash', str(self.root / 'robot/ros2_configs/run_workflow.sh'), *args]
        try:
            log = open(self.directory / f'{run.id}.log', 'ab')
            try:
                process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                                           creationflags=int(getattr(subprocess, 'CREATE_NO_WINDOW', 0)))
            finally:
                log.close()
            parallel = (run.payload.get('config') or {}).get('parallel')
            parallel = parallel if parallel and parallel.get('enabled') else None
            self.running[run.id] = dict(process=process, control=control, events=events, offset=0, terminal=None,
                                       db_confirmed_at=time.monotonic(), cancel_requested=False,
                                       robot_id=run.robot_id, parallel=parallel, lanes=run.payload.get('lanes'),
                                       phase='MOVING', guest=new_guest_state())
        except OSError as exc:
            await self.finish(run.id, 'FAILED', str(exc))

    async def finish(self, run_id, status, error=None):
        async with self.sessions() as db:
            await db.execute(update(WorkflowRun).where(WorkflowRun.id == run_id, WorkflowRun.owner == self.owner,
                                                     WorkflowRun.status.in_(['RUNNING', 'CANCELLING']))
                             .values(status=status, error=error, active_robot_id=None, completed_at=datetime.utcnow()))
            await db.commit()

    async def monitor(self, run_id):
        item = self.running[run_id]
        async with self.sessions() as db:
            run = await db.get(WorkflowRun, run_id)
            cancel = run is None or run.status != 'RUNNING' or run.owner != self.owner
            if cancel:
                item['cancel_requested'] = True
            else:
                item['db_confirmed_at'] = time.monotonic()
            self.refresh_control(item)
            if run and run.owner == self.owner and run.status in {'RUNNING', 'CANCELLING'}:
                run.heartbeat_at = datetime.utcnow()
                if item['events'].exists():
                    with item['events'].open(encoding='utf-8') as stream:
                        stream.seek(item['offset'])
                        while True:
                            line = stream.readline()
                            if not line or not line.endswith('\n'):
                                break
                            event = json.loads(line)
                            item['offset'] = stream.tell()
                            run.events = [*(run.events or [])[-99:], event]
                            run.current_step_index = event.get('step_index', run.current_step_index)
                            run.round_index = event.get('round_index', run.round_index)
                            item['phase'] = run_phase(item.get('phase'), event['type'])
                            if event['type'] == 'STEP_STARTED':
                                item['step_title'] = event.get('message')
                            if event['type'] == 'GUEST_RESUME' and item.get('guest'):
                                clear_guest_hold(item['guest'])
                                if item.get('parallel'):
                                    self.refresh_control(item)
                            if event['type'] == 'STEP_COMPLETED':
                                run.completed_steps += 1
                            if event['type'] in {'COMPLETED', 'FAILED', 'CANCELLED'}:
                                item['terminal'] = event
                await db.commit()
                await self.publish_status(run, item)
        if item['process'].poll() is not None:
            event = item['terminal'] or {'type': 'FAILED', 'message': 'ROS worker dừng mà chưa xác nhận kết quả.'}
            await self.finish(run_id, event['type'], event.get('message') if event['type'] != 'COMPLETED' else None)
            if run is not None:
                item['phase'] = 'DONE'
                run.status = event['type']
                await self.publish_status(run, item, force=True)
            del self.running[run_id]


workflow_runtime = WorkflowRuntime()
