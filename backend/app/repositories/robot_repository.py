import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.job import Job, JobEvent, JobStep
from app.models.robot import Robot, RobotMaintenanceSchedule
from app.repositories.base import BaseRepository

DEFAULT_ROBOT_ID = "RC-001"


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _to_naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class RobotRepository(BaseRepository[Robot]):
    """Repository quản lý hồ sơ Robot RC-001, lịch sử Job thực thi và lịch bảo trì."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, Robot)

    async def get_by_id_or_code(self, identifier: str = DEFAULT_ROBOT_ID) -> Optional[Robot]:
        stmt = select(Robot).where((Robot.id == identifier) | (Robot.code == identifier))
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def ensure_default_robot(self) -> Robot:
        """Đảm bảo bản ghi robot mặc định RC-001 luôn tồn tại trong DB."""
        existing = await self.get_by_id_or_code(DEFAULT_ROBOT_ID)
        if existing:
            return existing

        now = _utc_now_naive()
        robot = Robot(
            id=DEFAULT_ROBOT_ID,
            code=DEFAULT_ROBOT_ID,
            name="Aurora Concierge Unit 01",
            model_type="Differential Drive Concierge",
            serial_number="SN-HCR-2026-001",
            firmware_version="v2.4.0-ros2",
            status="IDLE",
            battery_level=100,
            current_location="Main Lobby",
            is_online=True,
            ip_address="100.99.72.51",
            last_heartbeat=now,
            notes="Robot lễ tân & giao vận tự hành đơn vị chính tại sảnh Aurora Grand.",
        )
        self.db.add(robot)
        await self.db.commit()
        await self.db.refresh(robot)
        return robot

    async def list_robots(self) -> Sequence[Robot]:
        await self.ensure_default_robot()
        stmt = select(Robot).order_by(Robot.code.asc())
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_summary_counts(self, robot_id: str = DEFAULT_ROBOT_ID) -> Dict[str, int]:
        await self.refresh_overdue_maintenance(robot_id)

        total_jobs_res = await self.db.execute(
            select(func.count(Job.id)).where(Job.robot_id == robot_id)
        )
        completed_jobs_res = await self.db.execute(
            select(func.count(Job.id)).where(Job.robot_id == robot_id, Job.status == "COMPLETED")
        )
        upcoming_maint_res = await self.db.execute(
            select(func.count(RobotMaintenanceSchedule.id)).where(
                RobotMaintenanceSchedule.robot_id == robot_id,
                RobotMaintenanceSchedule.status.in_(["Scheduled", "In Progress"]),
            )
        )
        overdue_maint_res = await self.db.execute(
            select(func.count(RobotMaintenanceSchedule.id)).where(
                RobotMaintenanceSchedule.robot_id == robot_id,
                RobotMaintenanceSchedule.status == "Overdue",
            )
        )
        return {
            "total_jobs": total_jobs_res.scalar() or 0,
            "completed_jobs": completed_jobs_res.scalar() or 0,
            "upcoming_maintenance": upcoming_maint_res.scalar() or 0,
            "overdue_maintenance": overdue_maint_res.scalar() or 0,
        }

    # ------------------------------------------------------------------
    # Robot Job History
    # ------------------------------------------------------------------

    async def list_jobs(
        self,
        robot_id: str = DEFAULT_ROBOT_ID,
        status: Optional[str] = None,
        trigger_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[Sequence[Job], Dict[str, int]]:
        base_filter = [Job.robot_id == robot_id]
        if status and status.upper() != "ALL":
            base_filter.append(Job.status == status.upper())
        if trigger_type and trigger_type.upper() != "ALL":
            base_filter.append(Job.trigger_type == trigger_type.upper())

        stmt = (
            select(Job)
            .where(*base_filter)
            .order_by(desc(Job.created_at))
            .offset(offset)
            .limit(limit)
        )
        items = (await self.db.execute(stmt)).scalars().all()

        all_statuses = (
            await self.db.execute(select(Job.status).where(Job.robot_id == robot_id))
        ).scalars().all()
        stats = {
            "total": len(all_statuses),
            "completed": sum(1 for s in all_statuses if (s or "").upper() == "COMPLETED"),
            "running": sum(1 for s in all_statuses if (s or "").upper() in ("RUNNING", "PENDING", "PAUSED")),
            "failed": sum(1 for s in all_statuses if (s or "").upper() in ("FAILED", "CANCELLED")),
        }
        return items, stats

    async def get_job_detail(self, job_id: str) -> Optional[Job]:
        stmt = (
            select(Job)
            .options(selectinload(Job.job_steps), selectinload(Job.job_events))
            .where((Job.id == job_id) | (Job.job_code == job_id))
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_job_record(
        self,
        robot_id: str,
        title: str,
        workflow_id: Optional[str] = None,
        trigger_type: str = "MANUAL",
        status: str = "COMPLETED",
        current_step_index: int = 0,
        total_steps: int = 0,
        error_message: Optional[str] = None,
        steps: Optional[List[Dict[str, Any]]] = None,
        events: Optional[List[Dict[str, Any]]] = None,
    ) -> Job:
        robot = await self.get_by_id_or_code(robot_id)
        if not robot:
            robot = await self.ensure_default_robot()

        now = _utc_now_naive()
        step_list = steps or []
        norm_status = status.upper()
        job = Job(
            job_code=f"JOB-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:5].upper()}",
            title=title,
            workflow_id=workflow_id,
            robot_id=robot.id,
            trigger_type=trigger_type.upper(),
            status=norm_status,
            current_step_index=current_step_index or len(step_list),
            total_steps=total_steps or len(step_list),
            started_at=now,
            completed_at=now if norm_status in ("COMPLETED", "FAILED", "CANCELLED") else None,
            error_message=error_message,
        )
        self.db.add(job)
        await self.db.flush()

        for idx, step in enumerate(step_list):
            raw_type = str(step.get("type") or step.get("step_type") or "STEP")
            step_status = str(step.get("status") or ("COMPLETED" if norm_status == "COMPLETED" else "PENDING"))
            self.db.add(
                JobStep(
                    job_id=job.id,
                    step_index=idx,
                    step_type=raw_type[:50],
                    params=step.get("params") if isinstance(step.get("params"), dict) else {},
                    status=step_status,
                    started_at=now,
                    completed_at=now if step_status == "COMPLETED" else None,
                    result_payload=step.get("result_payload") if isinstance(step.get("result_payload"), dict) else None,
                )
            )

        event_list = events or [
            {
                "event_type": "JOB_COMPLETED" if norm_status == "COMPLETED" else f"JOB_{norm_status}",
                "message": f"Robot {robot.code} thực thi '{title}' ({len(step_list)} bước)",
                "severity": "ERROR" if norm_status == "FAILED" else "INFO",
            }
        ]
        for ev in event_list:
            self.db.add(
                JobEvent(
                    job_id=job.id,
                    event_type=str(ev.get("event_type") or "JOB_EVENT")[:100],
                    message=str(ev.get("message") or title),
                    severity=str(ev.get("severity") or "INFO")[:20],
                    metadata_payload=ev.get("metadata_payload") if isinstance(ev.get("metadata_payload"), dict) else {},
                )
            )

        robot.last_heartbeat = now
        await self.db.commit()
        detailed = await self.get_job_detail(job.id)
        return detailed or job

    # ------------------------------------------------------------------
    # Robot Maintenance Schedules
    # ------------------------------------------------------------------

    async def refresh_overdue_maintenance(self, robot_id: str = DEFAULT_ROBOT_ID) -> None:
        now = _utc_now_naive()
        stmt = select(RobotMaintenanceSchedule).where(
            RobotMaintenanceSchedule.robot_id == robot_id,
            RobotMaintenanceSchedule.status == "Scheduled",
            RobotMaintenanceSchedule.scheduled_date < now,
        )
        overdue_items = (await self.db.execute(stmt)).scalars().all()
        if overdue_items:
            for item in overdue_items:
                item.status = "Overdue"
                item.updated_at = now
            await self.db.commit()

    async def list_maintenance_schedules(
        self,
        robot_id: str = DEFAULT_ROBOT_ID,
        status: Optional[str] = None,
        component: Optional[str] = None,
    ) -> Tuple[Sequence[RobotMaintenanceSchedule], Dict[str, int]]:
        await self.ensure_default_robot()
        await self.refresh_overdue_maintenance(robot_id)

        filters = [RobotMaintenanceSchedule.robot_id == robot_id]
        if status and status.lower() != "all":
            filters.append(RobotMaintenanceSchedule.status == status)
        if component and component.lower() != "all":
            filters.append(RobotMaintenanceSchedule.component == component.lower())

        stmt = (
            select(RobotMaintenanceSchedule)
            .where(*filters)
            .order_by(RobotMaintenanceSchedule.scheduled_date.asc())
        )
        items = (await self.db.execute(stmt)).scalars().all()

        all_statuses = (
            await self.db.execute(
                select(RobotMaintenanceSchedule.status).where(
                    RobotMaintenanceSchedule.robot_id == robot_id
                )
            )
        ).scalars().all()
        stats = {
            "total": len(all_statuses),
            "scheduled": sum(1 for s in all_statuses if s == "Scheduled"),
            "in_progress": sum(1 for s in all_statuses if s == "In Progress"),
            "completed": sum(1 for s in all_statuses if s == "Completed"),
            "overdue": sum(1 for s in all_statuses if s == "Overdue"),
        }
        return items, stats

    async def get_maintenance_by_id(self, schedule_id: str) -> Optional[RobotMaintenanceSchedule]:
        return await self.db.get(RobotMaintenanceSchedule, schedule_id)

    async def create_maintenance_schedule(
        self,
        robot_id: str,
        title: str,
        maintenance_type: str,
        component: str,
        priority: str,
        status: str,
        scheduled_date: datetime,
        interval_days: Optional[int] = None,
        assigned_technician: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> RobotMaintenanceSchedule:
        robot = await self.get_by_id_or_code(robot_id)
        if not robot:
            robot = await self.ensure_default_robot()

        sched_dt = _to_naive_utc(scheduled_date)
        now = _utc_now_naive()
        eff_status = status
        if eff_status == "Scheduled" and sched_dt < now:
            eff_status = "Overdue"

        item = RobotMaintenanceSchedule(
            robot_id=robot.id,
            title=title.strip(),
            maintenance_type=maintenance_type.strip().lower(),
            component=component.strip().lower(),
            priority=priority,
            status=eff_status,
            scheduled_date=sched_dt,
            completed_date=now if eff_status == "Completed" else None,
            interval_days=interval_days,
            assigned_technician=assigned_technician,
            notes=notes,
        )
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def update_maintenance_schedule(
        self,
        item: RobotMaintenanceSchedule,
        updates: Dict[str, Any],
        auto_schedule_next: bool = True,
    ) -> RobotMaintenanceSchedule:
        prev_status = item.status
        now = _utc_now_naive()

        for field, value in updates.items():
            if field == "scheduled_date" and value is not None:
                setattr(item, field, _to_naive_utc(value))
            elif field == "completed_date" and value is not None:
                setattr(item, field, _to_naive_utc(value))
            elif field in ("maintenance_type", "component") and isinstance(value, str):
                setattr(item, field, value.strip().lower())
            else:
                setattr(item, field, value)

        if item.status == "Completed" and prev_status != "Completed":
            if not item.completed_date:
                item.completed_date = now
            # Tự động lên lịch kỳ bảo trì tiếp theo nếu có chu kỳ định kỳ
            if auto_schedule_next and item.interval_days and item.interval_days > 0:
                next_due = now + timedelta(days=item.interval_days)
                next_item = RobotMaintenanceSchedule(
                    robot_id=item.robot_id,
                    title=item.title,
                    maintenance_type=item.maintenance_type,
                    component=item.component,
                    priority=item.priority,
                    status="Scheduled",
                    scheduled_date=next_due,
                    interval_days=item.interval_days,
                    assigned_technician=item.assigned_technician,
                    notes=item.notes,
                )
                self.db.add(next_item)
        elif item.status == "Scheduled" and item.scheduled_date < now:
            item.status = "Overdue"

        item.updated_at = now
        await self.db.commit()
        await self.db.refresh(item)
        return item

