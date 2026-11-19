"""Exercise real SQL constraints and runtime transitions without starting ROS."""
from datetime import datetime, timezone
import asyncio
import json
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models.workflow import RobotWorkflow
from app.models.workflow_run import WorkflowRun
from app.models.map import Zone
from app.repositories.workflow_repository import WorkflowRepository
from app.services.workflow_runtime import WorkflowRuntime, due_slot, atomic_json
from app.services.workflow_plan import physical_plan


class AsyncSessionAdapter:
    """Use a real SQLite Session through the same async interface as production."""
    def __init__(self, engine):
        self.session = Session(engine, expire_on_commit=False)
    async def __aenter__(self): return self
    async def __aexit__(self, *args): self.session.close()
    def add(self, obj): self.session.add(obj)
    async def execute(self, stmt): return self.session.execute(stmt)
    async def scalar(self, stmt): return self.session.scalar(stmt)
    async def scalars(self, stmt): return self.session.scalars(stmt)
    async def get(self, model, key): return self.session.get(model, key)
    async def commit(self): self.session.commit()
    async def rollback(self): self.session.rollback()


def workflow():
    return RobotWorkflow(id='patrol', name='Patrol', is_active=True, trigger_type='SCHEDULE',
                         execution_config={'execution_mode': 'ROBOT', 'schedules': [
                             {'time': '08:00', 'days': [0], 'timezone': 'Asia/Ho_Chi_Minh'}]},
                         steps=[{'step_id': 'a', 'type': 'MOVE', 'title': 'A', 'params': {
                             'map_id': 'room', 'target_x': 1, 'target_y': 2}}])


@pytest.fixture
def runtime(tmp_path):
    engine = create_engine(f'sqlite:///{tmp_path / "runs.sqlite"}')
    for model in (RobotWorkflow, WorkflowRun, Zone):
        model.__table__.create(engine)
    with Session(engine) as db:
        db.add(workflow())
        db.commit()
    runtime = WorkflowRuntime(lambda: AsyncSessionAdapter(engine), tmp_path)
    runtime.directory.mkdir(parents=True)
    yield runtime
    engine.dispose()


async def enqueue(runtime, slot=None):
    async with runtime.sessions() as db:
        repo = WorkflowRepository(db)
        return await runtime.enqueue(await repo.get_by_id('patrol'), repo, slot=slot)


def supervised_item(runtime):
    process = Mock()
    process.poll.return_value = None
    return dict(process=process, control=runtime.directory / 'heartbeat.control.json',
                db_confirmed_at=time.monotonic(), cancel_requested=False)


def test_atomic_control_renewal_retries_windows_wsl_sharing_conflict(tmp_path, monkeypatch):
    import app.services.workflow_runtime as module
    path = tmp_path / 'control.json'
    atomic_json(path, {'expires_at': 1})
    original = Path.replace
    attempts = []
    def replace(temporary, target):
        attempts.append(target)
        if len(attempts) < 3:
            raise PermissionError('Windows reader still holds the previous file')
        return original(temporary, target)
    monkeypatch.setattr(Path, 'replace', replace)
    monkeypatch.setattr(module.time, 'sleep', Mock())
    atomic_json(path, {'expires_at': 2})
    assert len(attempts) == 3
    assert json.loads(path.read_text(encoding='utf-8')) == {'expires_at': 2}


def test_permanent_control_write_failure_does_not_corrupt_or_extend_old_lease(tmp_path, monkeypatch):
    import app.services.workflow_runtime as module
    path = tmp_path / 'control.json'
    atomic_json(path, {'expires_at': 1})
    replace = Mock(side_effect=PermissionError('still locked'))
    monkeypatch.setattr(Path, 'replace', replace)
    monkeypatch.setattr(module.time, 'sleep', Mock())
    with pytest.raises(PermissionError):
        atomic_json(path, {'expires_at': 2})
    assert replace.call_count == 20
    assert json.loads(path.read_text(encoding='utf-8')) == {'expires_at': 1}


@pytest.mark.asyncio
async def test_control_keeps_renewing_while_scheduler_waits_on_slow_database(runtime, monkeypatch):
    import app.services.workflow_runtime as module
    monkeypatch.setattr(module, 'CONTROL_INTERVAL_SECONDS', .01)
    entered = asyncio.Event()
    never_finished_query = asyncio.Event()
    async def slow_tick():
        entered.set()
        await never_finished_query.wait()
    runtime.tick = slow_tick
    item = supervised_item(runtime)
    runtime.running['run'] = item
    runtime.start()
    try:
        await asyncio.wait_for(entered.wait(), 1)
        for _ in range(50):
            await asyncio.sleep(.01)
            if item.get('control_sequence', 0) >= 3:
                break
        data = json.loads(item['control'].read_text(encoding='utf-8'))
        assert data['sequence'] >= 3
        assert data['cancel'] is False
        assert data['expires_at'] > time.time() + 9
        assert not never_finished_query.is_set()
    finally:
        await runtime.close()
    assert json.loads(item['control'].read_text(encoding='utf-8'))['cancel'] is True


def test_database_ownership_timeout_cannot_keep_renewing_motion_forever(runtime):
    item = supervised_item(runtime)
    item['db_confirmed_at'] = time.monotonic() - 21
    runtime.refresh_control(item)
    data = json.loads(item['control'].read_text(encoding='utf-8'))
    assert data['cancel'] is True
    assert data['expires_at'] <= time.time()
    assert 'quyền quản lý' in data['stop_reason']


def test_control_deadline_stops_before_database_can_reassign_a_stale_run(runtime):
    item = supervised_item(runtime)
    item['db_confirmed_at'] = time.monotonic() - 17
    now = time.time()
    runtime.refresh_control(item)
    data = json.loads(item['control'].read_text(encoding='utf-8'))
    assert data['cancel'] is False
    assert now + 2 < data['expires_at'] <= now + 3.1


@pytest.mark.asyncio
async def test_user_stop_reaches_worker_even_if_database_access_fails(runtime):
    item = supervised_item(runtime)
    runtime.running['run'] = item
    runtime.sessions = Mock(side_effect=RuntimeError('database unavailable'))
    with pytest.raises(RuntimeError, match='database unavailable'):
        await runtime.cancel('run')
    assert json.loads(item['control'].read_text(encoding='utf-8'))['cancel'] is True


def test_schedule_is_timezone_correct_and_screen_mode_cannot_move_robot():
    wf = workflow()
    now = datetime(2026, 11, 16, 1, 0, tzinfo=timezone.utc)  # Monday 08:00 VN
    assert due_slot(wf, now) == 'patrol:20261116T0100'
    assert due_slot(wf, now.replace(minute=1)) is None
    wf.execution_config = {'execution_mode': 'SCREEN'}
    assert due_slot(wf, now) is None
    wf.is_active = False
    assert due_slot(wf, now) is None


@pytest.mark.asyncio
async def test_manual_run_reserves_robot_and_cancel_releases_pending(runtime):
    first = await enqueue(runtime)
    assert first['status'] == 'PENDING'
    with pytest.raises(ValueError, match='lượt chạy khác'):
        await enqueue(runtime)
    assert (await runtime.cancel(first['id']))['status'] == 'CANCELLED'
    assert (await enqueue(runtime))['status'] == 'PENDING'


@pytest.mark.asyncio
async def test_schedule_slot_is_persistent_deduplicated_and_busy_slot_skipped(runtime):
    first = await enqueue(runtime, 'patrol:slot1')
    assert await enqueue(runtime, 'patrol:slot1') is None
    skipped = await enqueue(runtime, 'patrol:slot2')
    assert skipped['status'] == 'SKIPPED'
    await runtime.cancel(first['id'])
    assert await enqueue(runtime, 'patrol:slot2') is None
    assert len(await runtime.list_runs()) == 2


@pytest.mark.asyncio
async def test_second_worker_cannot_claim_a_running_run(runtime):
    run = await enqueue(runtime)
    runtime.launch = AsyncMock()
    await runtime.tick()
    runtime.launch.assert_awaited_once()
    other = WorkflowRuntime(runtime.sessions, runtime.root)
    other.launch = AsyncMock()
    await other.tick()
    other.launch.assert_not_awaited()
    cancelled = await runtime.cancel(run['id'])
    assert cancelled['status'] == 'CANCELLING'
    with pytest.raises(ValueError):
        await enqueue(runtime)  # keep reservation until worker confirms it stopped


@pytest.mark.asyncio
async def test_events_are_not_completed_until_worker_exits_and_success_is_correlated(runtime):
    view = await enqueue(runtime)
    async with runtime.sessions() as db:
        run = await db.get(WorkflowRun, view['id'])
        run.status, run.owner = 'RUNNING', runtime.owner
        await db.commit()
    events = runtime.directory / 'events.jsonl'
    events.write_text('{"type":"STEP_COMPLETED","step_index":0,"round_index":0}\n', encoding='utf-8')
    process = Mock()
    process.poll.return_value = None
    runtime.running[view['id']] = dict(process=process, events=events,
                                      control=runtime.directory / 'control.json', offset=0, terminal=None)
    await runtime.monitor(view['id'])
    state = (await runtime.list_runs())[0]
    assert state['completed_steps'] == 1 and state['status'] == 'RUNNING'
    with events.open('a', encoding='utf-8') as out:
        out.write('{"type":"COMPLETED","round_index":1}\n')
    process.poll.return_value = 0
    await runtime.monitor(view['id'])
    assert (await runtime.list_runs())[0]['status'] == 'COMPLETED'
    assert (await enqueue(runtime))['status'] == 'PENDING'


@pytest.mark.asyncio
async def test_worker_crash_cannot_fabricate_completion(runtime):
    view = await enqueue(runtime)
    async with runtime.sessions() as db:
        run = await db.get(WorkflowRun, view['id'])
        run.status, run.owner = 'RUNNING', runtime.owner
        await db.commit()
    process = Mock()
    process.poll.return_value = 1
    runtime.running[view['id']] = dict(process=process, events=runtime.directory / 'missing',
                                      control=runtime.directory / 'control.json', offset=0, terminal=None)
    await runtime.monitor(view['id'])
    assert (await runtime.list_runs())[0]['status'] == 'FAILED'


@pytest.mark.asyncio
async def test_keepout_and_no_stop_rejected_before_reserving_robot(runtime):
    async with runtime.sessions() as db:
        db.add(Zone(id='blocked', map_id='room', name='Door', type='NO_STOP', x=1, y=2, width=2, height=2))
        await db.commit()
    with pytest.raises(ValueError, match='NO_STOP'):
        await enqueue(runtime)
    assert await runtime.list_runs() == []


@pytest.mark.asyncio
@pytest.mark.parametrize('patch', [
    {'type': 'GREET'},
    {'params': {'target_x': 1, 'target_y': 2}},
    {'params': {'map_id': 'room', 'target_x': float('nan'), 'target_y': 2}},
    {'params': {'map_id': 'room', 'target_x': 1, 'target_y': 2, 'next_step_id': 'missing'}},
])
async def test_bad_physical_steps_are_rejected(patch):
    wf = workflow()
    wf.steps[0].update(patch)
    with pytest.raises(ValueError):
        await physical_plan(wf, SimpleNamespace())


@pytest.mark.asyncio
async def test_api_reports_pending_instead_of_completed_and_exposes_cancel(runtime, monkeypatch):
    from fastapi import FastAPI
    from httpx import AsyncClient, ASGITransport
    from app.api.v1.endpoints.workflows import router, get_workflow_repository
    import app.services.workflow_runtime as module
    monkeypatch.setattr(module, 'workflow_runtime', runtime)
    async with runtime.sessions() as db:
        app = FastAPI()
        app.include_router(router, prefix='/workflows')
        app.dependency_overrides[get_workflow_repository] = lambda: WorkflowRepository(db)
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            response = await client.post('/workflows/patrol/execute', json={})
            assert response.status_code == 200, response.text
            data = response.json()
            assert data['status'] == 'PENDING' and data['executed_steps'] == 0
            duplicate = await client.post('/workflows/patrol/execute', json={})
            assert duplicate.status_code == 409
            history = await client.get('/workflows/runs/recent')
            assert history.status_code == 200
            assert history.json()[0]['status'] == 'PENDING'
            cancelled = await client.post(f'/workflows/runs/{data["run_id"]}/cancel')
            assert cancelled.json()['status'] == 'CANCELLED'


@pytest.mark.asyncio
async def test_screen_dispatch_is_not_written_as_successful_physical_job(runtime, monkeypatch):
    from fastapi import FastAPI
    from httpx import AsyncClient, ASGITransport
    from app.api.v1.endpoints.workflows import router, get_workflow_repository, notification_manager
    monkeypatch.setattr(notification_manager, 'broadcast_to_department', AsyncMock())
    async with runtime.sessions() as db:
        wf = await db.get(RobotWorkflow, 'patrol')
        wf.execution_config = {'execution_mode': 'SCREEN'}
        await db.commit()
        app = FastAPI()
        app.include_router(router, prefix='/workflows')
        app.dependency_overrides[get_workflow_repository] = lambda: WorkflowRepository(db)
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            response = await client.post('/workflows/patrol/execute', json={})
            assert response.json()['status'] == 'DISPATCHED'
            assert response.json()['executed_steps'] == 0
    assert await runtime.list_runs() == []


def test_run_migration_is_additive_and_matches_model(tmp_path):
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import inspect
    path = Path(__file__).parents[1] / 'alembic/versions/c93d28e215fa_workflow_runs.py'
    spec = importlib.util.spec_from_file_location('workflow_runs_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine('sqlite://')
    with engine.begin() as connection:
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        migration.upgrade()
        assert {c['name'] for c in inspect(connection).get_columns('workflow_runs')} == set(WorkflowRun.__table__.columns.keys())
        constraints = inspect(connection).get_unique_constraints('workflow_runs')
        assert {'active_robot_id', 'schedule_slot'} <= {c['column_names'][0] for c in constraints}
    engine.dispose()
