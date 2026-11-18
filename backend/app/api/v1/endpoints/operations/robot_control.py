"""Robot fleet, profile, job execution history, and maintenance schedule routes."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.interceptors import RouteInterceptor, audit_action
from app.repositories import RobotRepository, get_robot_repository
from app.repositories.robot_repository import DEFAULT_ROBOT_ID
from app.schemas.robot import (
    RobotJobCreate,
    RobotJobDetailResponse,
    RobotJobHistoryListResponse,
    RobotJobResponse,
    RobotMaintenanceListResponse,
    RobotMaintenanceScheduleCreate,
    RobotMaintenanceScheduleResponse,
    RobotMaintenanceScheduleUpdate,
    RobotProfileResponse,
    RobotProfileUpdate,
)
from .robot_hardware import router as hardware_router
from .shared import TAG_OPS

router = APIRouter(route_class=RouteInterceptor)
router.include_router(hardware_router)


def _get_live_hardware_status() -> Optional[str]:
    try:
        from app.services.hardware.rplidar_service import rplidar_service

        if rplidar_service.is_connected and rplidar_service.is_running:
            return "RPLIDAR_ACTIVE"
        if rplidar_service.is_connected:
            return "RPLIDAR_CONNECTED"
        return "HARDWARE_STANDBY"
    except Exception:
        return None


def _build_profile_payload(robot: Any, counts: Dict[str, int]) -> Dict[str, Any]:
    return {
        "id": robot.id,
        "code": robot.code,
        "name": robot.name,
        "model_type": robot.model_type,
        "serial_number": getattr(robot, "serial_number", None),
        "firmware_version": getattr(robot, "firmware_version", None),
        "status": robot.status,
        "battery_level": robot.battery_level,
        "current_location": robot.current_location,
        "is_online": robot.is_online,
        "ip_address": robot.ip_address,
        "last_heartbeat": robot.last_heartbeat,
        "notes": getattr(robot, "notes", None),
        "created_at": robot.created_at,
        "updated_at": robot.updated_at,
        "total_jobs": counts.get("total_jobs", 0),
        "completed_jobs": counts.get("completed_jobs", 0),
        "upcoming_maintenance": counts.get("upcoming_maintenance", 0),
        "overdue_maintenance": counts.get("overdue_maintenance", 0),
        "hardware_status": _get_live_hardware_status(),
    }


async def _get_or_ensure_robot(
    repo: RobotRepository,
    robot_id: str,
    *,
    ensure_aliases: Tuple[str, ...] = (DEFAULT_ROBOT_ID,),
):
    robot = await repo.get_by_id_or_code(robot_id)
    if not robot and robot_id in ensure_aliases:
        robot = await repo.ensure_default_robot()
    return robot


@router.get(
    "/fleet",
    response_model=List[Dict[str, Any]],
    tags=TAG_OPS,
    summary="Danh sách trạng thái đội Robot HCRobot",
)
async def get_robot_fleet(repo: RobotRepository = Depends(get_robot_repository)):
    """Trả về hồ sơ & trạng thái hiện tại của Robot RC-001 từ cơ sở dữ liệu."""
    robots = await repo.list_robots()
    fleet: List[Dict[str, Any]] = []
    for r in robots:
        counts = await repo.get_summary_counts(r.id)
        fleet.append(
            {
                "id": r.id,
                "code": r.code,
                "name": r.name,
                "model_type": r.model_type,
                "status": r.status,
                "battery_level": r.battery_level,
                "battery": f"{r.battery_level}%",
                "current_location": r.current_location,
                "is_online": r.is_online,
                "ip_address": r.ip_address,
                "last_heartbeat": r.last_heartbeat.isoformat() if r.last_heartbeat else None,
                "total_jobs": counts["total_jobs"],
                "upcoming_maintenance": counts["upcoming_maintenance"],
                "overdue_maintenance": counts["overdue_maintenance"],
            }
        )
    return fleet


@router.get(
    "/robot/profile",
    response_model=RobotProfileResponse,
    tags=TAG_OPS,
    summary="Lấy hồ sơ và trạng thái vận hành của Robot RC-001",
)
async def get_robot_profile(
    robot_id: str = Query(DEFAULT_ROBOT_ID, description="Mã hoặc ID robot (mặc định RC-001)"),
    repo: RobotRepository = Depends(get_robot_repository),
):
    robot = await _get_or_ensure_robot(repo, robot_id, ensure_aliases=(DEFAULT_ROBOT_ID, "hc_pi5_01"))
    if not robot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy hồ sơ robot '{robot_id}'")

    counts = await repo.get_summary_counts(robot.id)
    return _build_profile_payload(robot, counts)


@router.put(
    "/robot/profile",
    response_model=RobotProfileResponse,
    tags=TAG_OPS,
    summary="Cập nhật hồ sơ & trạng thái vận hành của Robot RC-001",
)
@audit_action(action="UPDATE", resource_type="ROBOT_PROFILE", default_actor_id="admin")
async def update_robot_profile(
    payload: RobotProfileUpdate,
    robot_id: str = Query(DEFAULT_ROBOT_ID, description="Mã hoặc ID robot (mặc định RC-001)"),
    repo: RobotRepository = Depends(get_robot_repository),
):
    robot = await _get_or_ensure_robot(repo, robot_id, ensure_aliases=(DEFAULT_ROBOT_ID, "hc_pi5_01"))
    if not robot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy hồ sơ robot '{robot_id}'")

    updates = payload.model_dump(exclude_unset=True)
    for field, val in updates.items():
        if field == "status" and isinstance(val, str):
            setattr(robot, field, val.strip().upper())
        else:
            setattr(robot, field, val)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    robot.last_heartbeat = now
    robot.updated_at = now
    await repo.commit()
    await repo.refresh(robot)

    counts = await repo.get_summary_counts(robot.id)
    return _build_profile_payload(robot, counts)


@router.get(
    "/robot/jobs",
    response_model=RobotJobHistoryListResponse,
    tags=TAG_OPS,
    summary="Lịch sử thực thi Job của Robot RC-001",
)
async def list_robot_jobs(
    robot_id: str = Query(DEFAULT_ROBOT_ID, description="Mã robot (mặc định RC-001)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Lọc trạng thái Job (COMPLETED, RUNNING, FAILED...)"),
    trigger_type: Optional[str] = Query(None, description="Lọc nguồn kích hoạt (MANUAL, SCHEDULE, AUTO_DETECT, VOICE...)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    repo: RobotRepository = Depends(get_robot_repository),
):
    robot = await _get_or_ensure_robot(repo, robot_id)
    target_id = robot.id if robot else robot_id

    items, stats = await repo.list_jobs(
        robot_id=target_id,
        status=status_filter,
        trigger_type=trigger_type,
        limit=limit,
        offset=offset,
    )
    return RobotJobHistoryListResponse(
        robot_id=target_id,
        total=stats["total"],
        completed=stats["completed"],
        running=stats["running"],
        failed=stats["failed"],
        items=[RobotJobResponse.model_validate(item) for item in items],
    )


@router.post(
    "/robot/jobs",
    response_model=RobotJobDetailResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_OPS,
    summary="Ghi nhận một lượt chạy Job thực tế của Robot",
)
async def create_robot_job(
    payload: RobotJobCreate,
    repo: RobotRepository = Depends(get_robot_repository),
):
    job = await repo.create_job_record(
        robot_id=payload.robot_id,
        title=payload.title,
        workflow_id=payload.workflow_id,
        trigger_type=payload.trigger_type,
        status=payload.status,
        current_step_index=payload.current_step_index,
        total_steps=payload.total_steps,
        error_message=payload.error_message,
        steps=payload.steps,
        events=payload.events,
    )
    return RobotJobDetailResponse.model_validate(job)


@router.get(
    "/robot/jobs/{job_id}",
    response_model=RobotJobDetailResponse,
    tags=TAG_OPS,
    summary="Chi tiết các bước và sự kiện của một Job Robot",
)
async def get_robot_job_detail(
    job_id: str,
    repo: RobotRepository = Depends(get_robot_repository),
):
    job = await repo.get_job_detail(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy Job '{job_id}'")
    return RobotJobDetailResponse.model_validate(job)


@router.get(
    "/robot/maintenance",
    response_model=RobotMaintenanceListResponse,
    tags=TAG_OPS,
    summary="Danh sách lịch bảo trì định kỳ của Robot RC-001",
)
async def list_robot_maintenance(
    robot_id: str = Query(DEFAULT_ROBOT_ID, description="Mã robot (mặc định RC-001)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Lọc theo trạng thái (Scheduled, In Progress, Completed, Overdue)"),
    component: Optional[str] = Query(None, description="Lọc theo bộ phận (lidar, battery, motors, camera, chassis, software, general)"),
    repo: RobotRepository = Depends(get_robot_repository),
):
    robot = await _get_or_ensure_robot(repo, robot_id)
    target_id = robot.id if robot else robot_id

    items, stats = await repo.list_maintenance_schedules(
        robot_id=target_id,
        status=status_filter,
        component=component,
    )
    return RobotMaintenanceListResponse(
        robot_id=target_id,
        total=stats["total"],
        scheduled=stats["scheduled"],
        in_progress=stats["in_progress"],
        completed=stats["completed"],
        overdue=stats["overdue"],
        items=[RobotMaintenanceScheduleResponse.model_validate(it) for it in items],
    )


@router.post(
    "/robot/maintenance",
    response_model=RobotMaintenanceScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_OPS,
    summary="Tạo mới lịch bảo trì cho Robot RC-001",
)
@audit_action(action="CREATE", resource_type="ROBOT_MAINTENANCE", default_actor_id="admin")
async def create_robot_maintenance(
    payload: RobotMaintenanceScheduleCreate,
    repo: RobotRepository = Depends(get_robot_repository),
):
    item = await repo.create_maintenance_schedule(
        robot_id=payload.robot_id,
        title=payload.title,
        maintenance_type=payload.maintenance_type,
        component=payload.component,
        priority=payload.priority,
        status=payload.status,
        scheduled_date=payload.scheduled_date,
        interval_days=payload.interval_days,
        assigned_technician=payload.assigned_technician,
        notes=payload.notes,
    )
    return RobotMaintenanceScheduleResponse.model_validate(item)


@router.put(
    "/robot/maintenance/{schedule_id}",
    response_model=RobotMaintenanceScheduleResponse,
    tags=TAG_OPS,
    summary="Cập nhật lịch bảo trì Robot",
)
@router.patch(
    "/robot/maintenance/{schedule_id}",
    response_model=RobotMaintenanceScheduleResponse,
    tags=TAG_OPS,
    include_in_schema=False,
)
@audit_action(action="UPDATE", resource_type="ROBOT_MAINTENANCE", default_actor_id="admin")
async def update_robot_maintenance(
    schedule_id: str,
    payload: RobotMaintenanceScheduleUpdate,
    repo: RobotRepository = Depends(get_robot_repository),
):
    item = await repo.get_maintenance_by_id(schedule_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy lịch bảo trì '{schedule_id}'")

    updates = payload.model_dump(exclude_unset=True, exclude={"auto_schedule_next"})
    updated = await repo.update_maintenance_schedule(
        item,
        updates=updates,
        auto_schedule_next=payload.auto_schedule_next,
    )
    return RobotMaintenanceScheduleResponse.model_validate(updated)


@router.delete(
    "/robot/maintenance/{schedule_id}",
    tags=TAG_OPS,
    summary="Xóa lịch bảo trì Robot",
)
@audit_action(action="DELETE", resource_type="ROBOT_MAINTENANCE", default_actor_id="admin")
async def delete_robot_maintenance(
    schedule_id: str,
    repo: RobotRepository = Depends(get_robot_repository),
):
    item = await repo.get_maintenance_by_id(schedule_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy lịch bảo trì '{schedule_id}'")

    await repo.delete(item, autocommit=True)
    return {"success": True, "id": schedule_id, "message": "Đã xóa lịch bảo trì robot"}
