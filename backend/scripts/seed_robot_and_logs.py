"""Robot unit profile, maintenance schedules, job history, and audit log seeding steps."""

import datetime
import logging

from sqlalchemy import func, select

from app.models import (
    ActorTypeEnum,
    AuditLog,
    Job,
    JobEvent,
    JobStep,
    LogCategoryEnum,
    LogEvent,
    LogLevelEnum,
    Robot,
    RobotMaintenanceSchedule,
)

logger = logging.getLogger("seed")


async def seed_robot_unit(session):
    logger.info("🤖 [6c/7] Seeding Robot RC-001 Profile, Maintenance Schedules & Job History...")
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

    robot = (
        await session.execute(select(Robot).where((Robot.id == "RC-001") | (Robot.code == "RC-001")))
    ).scalar_one_or_none()
    if not robot:
        robot = Robot(
            id="RC-001",
            code="RC-001",
            name="Aurora Concierge Unit 01",
            model_type="Differential Drive Concierge",
            serial_number="SN-HCR-2026-001",
            firmware_version="v2.4.0-ros2",
            status="IDLE",
            battery_level=94,
            current_location="Main Lobby",
            is_online=True,
            ip_address="100.93.152.7",
            last_heartbeat=now,
            notes="Robot lễ tân & giao vận tự hành đơn vị chính tại sảnh Aurora Grand.",
        )
        session.add(robot)
        await session.flush()
    else:
        if not robot.serial_number:
            robot.serial_number = "SN-HCR-2026-001"
        if not robot.firmware_version:
            robot.firmware_version = "v2.4.0-ros2"

    existing_maint_count = (
        await session.execute(
            select(func.count(RobotMaintenanceSchedule.id)).where(RobotMaintenanceSchedule.robot_id == robot.id)
        )
    ).scalar() or 0
    if existing_maint_count == 0:
        schedules = [
            RobotMaintenanceSchedule(
                id="RMS-001-LIDAR",
                robot_id=robot.id,
                title="Vệ sinh thấu kính & kiểm tra độ lệch cảm biến RPLIDAR A1",
                maintenance_type="preventive",
                component="lidar",
                priority="High",
                status="Scheduled",
                scheduled_date=now + datetime.timedelta(days=5),
                interval_days=30,
                assigned_technician="Kỹ thuật viên Phần cứng",
                notes="Lau sạch bụi mặt kính quét 360° và kiểm tra tần số scan >= 5.5Hz.",
            ),
            RobotMaintenanceSchedule(
                id="RMS-002-BATTERY",
                robot_id=robot.id,
                title="Hiệu chỉnh nguồn Pi 5 & kiểm tra cell pin động cơ",
                maintenance_type="calibration",
                component="battery",
                priority="Normal",
                status="Scheduled",
                scheduled_date=now + datetime.timedelta(days=12),
                interval_days=30,
                assigned_technician="Kỹ thuật viên Điện tử",
                notes="Kiểm tra sụt áp dưới tải và đồng bộ minutes_per_percent thực tế.",
            ),
            RobotMaintenanceSchedule(
                id="RMS-003-MOTORS",
                robot_id=robot.id,
                title="Bảo dưỡng cụm bánh xe chủ động, encoder & bánh đa hướng",
                maintenance_type="inspection",
                component="motors",
                priority="Normal",
                status="Completed",
                scheduled_date=now - datetime.timedelta(days=7),
                completed_date=now - datetime.timedelta(days=7),
                interval_days=45,
                assigned_technician="Kỹ thuật viên Cơ khí",
                notes="Đã vệ sinh tóc/bụi trục bánh xe và test odometry 5m sai số < 2cm.",
            ),
        ]
        session.add_all(schedules)

    existing_jobs_count = (
        await session.execute(select(func.count(Job.id)).where(Job.robot_id == robot.id))
    ).scalar() or 0
    if existing_jobs_count == 0:
        sample_jobs = [
            (
                "JOB-SEED-001",
                "Đón khách sảnh & tư vấn Concierge đa ngữ",
                "AUTO_DETECT",
                "COMPLETED",
                now - datetime.timedelta(hours=3),
                [("MOVE", "COMPLETED"), ("GREET", "COMPLETED"), ("COMMUNICATE", "COMPLETED")],
                [
                    ("JOB_STARTED", "RC-001 bắt đầu phiên đón khách tại Main Lobby"),
                    ("JOB_COMPLETED", "Hoàn thành tương tác khách và quay về Standby"),
                ],
            ),
            (
                "JOB-SEED-002",
                "Tuần tra sảnh & trình chiếu quảng cáo ưu đãi",
                "SCHEDULE",
                "COMPLETED",
                now - datetime.timedelta(hours=1),
                [("MOVE", "COMPLETED"), ("SHOW", "COMPLETED"), ("MOVE", "COMPLETED")],
                [
                    ("JOB_STARTED", "Kích hoạt lịch tuần tra sảnh RC-001"),
                    ("WAYPOINT_REACHED", "Đã đến điểm trung tâm sảnh"),
                    ("JOB_COMPLETED", "Quay về trạm chờ RC-001 thành công"),
                ],
            ),
        ]
        for j_code, j_title, trig, st, ts, step_defs, ev_defs in sample_jobs:
            job = Job(
                job_code=j_code,
                title=j_title,
                robot_id=robot.id,
                trigger_type=trig,
                status=st,
                current_step_index=len(step_defs),
                total_steps=len(step_defs),
                started_at=ts,
                completed_at=ts + datetime.timedelta(minutes=4),
            )
            session.add(job)
            await session.flush()
            for idx, (s_type, s_status) in enumerate(step_defs):
                session.add(
                    JobStep(
                        job_id=job.id,
                        step_index=idx,
                        step_type=s_type,
                        params={},
                        status=s_status,
                        started_at=ts,
                        completed_at=ts + datetime.timedelta(minutes=idx + 1),
                    )
                )
            for ev_type, ev_msg in ev_defs:
                session.add(JobEvent(job_id=job.id, event_type=ev_type, message=ev_msg, severity="INFO"))

    await session.commit()
    logger.info("   ✅ Robot RC-001 seed completed.")


async def seed_logs(session):
    logger.info("📊 [7/7] Seeding Operational Logs & Audit Trails...")
    now = datetime.datetime.now(datetime.timezone.utc)
    logs = [
        LogEvent(
            timestamp=now - datetime.timedelta(minutes=30),
            level=LogLevelEnum.INFO,
            category=LogCategoryEnum.AI_VOICE,
            event_type="VOICE_INTENT_DETECTED",
            module="app.services.ai.ollama",
            message="User requested extra towels in room 314",
            actor_type=ActorTypeEnum.GUEST,
            actor_id="GUEST-314",
            metadata_payload={"room": "314", "action": "housekeeping"},
        ),
        LogEvent(
            timestamp=now - datetime.timedelta(minutes=15),
            level=LogLevelEnum.INFO,
            category=LogCategoryEnum.DISPATCH,
            event_type="ORDER_ASSIGNED",
            module="app.api.v1.operations",
            message="Assigned Order #1042 to robot unit robot_01",
            actor_type=ActorTypeEnum.SYSTEM,
            actor_id="SYSTEM",
            metadata_payload={"order_id": "1042", "robot": "robot_01"},
        ),
    ]
    session.add_all(logs)

    audits = [
        AuditLog(
            timestamp=now - datetime.timedelta(minutes=45),
            actor_type=ActorTypeEnum.STAFF,
            actor_id="STF-ADMIN",
            actor_name="System Administrator",
            action="LOGIN",
            resource_type="STAFF",
            resource_id="admin",
        )
    ]
    session.add_all(audits)
    await session.commit()
    logger.info("   ✅ Operational logs seed completed.")
