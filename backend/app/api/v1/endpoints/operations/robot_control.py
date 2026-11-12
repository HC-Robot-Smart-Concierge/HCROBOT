import socket
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.interceptors import RouteInterceptor, audit_action, measure_performance
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
from .shared import TAG_OPS

router = APIRouter(route_class=RouteInterceptor)


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


@router.get(
    "/fleet",
    response_model=List[Dict[str, Any]],
    tags=TAG_OPS,
    summary="Danh sách trạng thái đội Robot HCRobot",
)
async def get_robot_fleet(
    repo: RobotRepository = Depends(get_robot_repository),
):
    """
    Trả về hồ sơ & trạng thái hiện tại của Robot RC-001 từ cơ sở dữ liệu.
    """
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


# =====================================================================
# 1. ROBOT PROFILE & OPERATING STATUS (HỒ SƠ & TRẠNG THÁI RC-001)
# =====================================================================

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
    robot = await repo.get_by_id_or_code(robot_id)
    if not robot and robot_id == DEFAULT_ROBOT_ID:
        robot = await repo.ensure_default_robot()
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
    robot = await repo.get_by_id_or_code(robot_id)
    if not robot and robot_id == DEFAULT_ROBOT_ID:
        robot = await repo.ensure_default_robot()
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


# =====================================================================
# 2. ROBOT JOB EXECUTION HISTORY (LỊCH SỬ JOB CHẠY THỰC TẾ)
# =====================================================================

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
    robot = await repo.get_by_id_or_code(robot_id)
    if not robot and robot_id == DEFAULT_ROBOT_ID:
        robot = await repo.ensure_default_robot()
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


# =====================================================================
# 3. ROBOT MAINTENANCE SCHEDULES (LỊCH BẢO TRÌ ROBOT)
# =====================================================================

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
    robot = await repo.get_by_id_or_code(robot_id)
    if not robot and robot_id == DEFAULT_ROBOT_ID:
        robot = await repo.ensure_default_robot()
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


# =====================================================================
# 4. TELEOP REMOTE MOVEMENT (UDP RASPBERRY PI 5)
# =====================================================================

class RobotMoveCommand(BaseModel):
    command: str
    target_ip: Optional[str] = "100.99.72.51"
    port: Optional[int] = 9999
    speed: Optional[int] = None


@router.post("/robot/control", tags=TAG_OPS, summary="Điều khiển di chuyển HCRobot (UDP Remote)")
@audit_action(action="ROBOT_MOVE", resource_type="ROBOT", default_actor_id="operator")
@measure_performance(action_name="control_robot_movement", slow_threshold_ms=300.0)
async def control_robot_movement(cmd: RobotMoveCommand):
    """Gửi lệnh di chuyển qua UDP tới Raspberry Pi 5 tích hợp fail-safe siêu âm và PWM speed."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.5)
        target_host = cmd.target_ip or "100.99.72.51"
        target_port = cmd.port or 9999

        raw_cmd = cmd.command.lower().strip()

        # Nếu truyền kèm tham số speed:
        if cmd.speed is not None:
            spd_val = max(20, min(100, int(cmd.speed)))
            sock.sendto(f"speed:{spd_val}".encode("utf-8"), (target_host, target_port))

        if raw_cmd.startswith("speed:") or raw_cmd.startswith("speed_"):
            sock.sendto(raw_cmd.encode("utf-8"), (target_host, target_port))
            sock.close()
            return {"status": "ok", "speed_set": raw_cmd, "target": f"{target_host}:{target_port}"}

        motion_map = {
            "forward": "w", "w": "w", "up": "w", "arrowup": "w",
            "backward": "s", "s": "s", "down": "s", "arrowdown": "s",
            "left": "a", "a": "a", "arrowleft": "a",
            "right": "d", "d": "d", "arrowright": "d",
            "forward_left": "wa", "wa": "wa", "aw": "wa", "up_left": "wa",
            "forward_right": "wd", "wd": "wd", "dw": "wd", "up_right": "wd",
            "backward_left": "sa", "sa": "sa", "as": "sa", "down_left": "sa",
            "backward_right": "sd", "sd": "sd", "ds": "sd", "down_right": "sd",
            "stop": "stop", "x": "stop", "space": "stop", "": "stop",
        }
        cmd_str = motion_map.get(raw_cmd, "stop")
        sock.sendto(cmd_str.encode("utf-8"), (target_host, target_port))
        sock.close()
        return {
            "status": "ok",
            "command_sent": cmd_str,
            "speed": cmd.speed,
            "target": f"{target_host}:{target_port}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể gửi lệnh di chuyển tới Pi 5: {e}")


# =====================================================================
# 5. CAMERA MJPEG PROXY STREAM (RASPBERRY PI 5)
# =====================================================================

@router.get(
    "/robot/camera/stream",
    tags=TAG_OPS,
    summary="Reverse Proxy MJPEG Camera Stream từ Raspberry Pi 5 sang HTTPS",
)
async def proxy_camera_stream(
    target_ip: Optional[str] = "100.99.72.51",
    port: Optional[int] = 8554,
):
    """
    Chuyển tiếp (Reverse Proxy) luồng video MJPEG từ Raspberry Pi 5
    về client qua HTTPS (Tailscale Funnel / Cloudflare).
    """
    pi_camera_url = f"http://{target_ip}:{port}/stream"

    async def stream_generator():
        client = httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=None, write=5.0, pool=5.0))
        try:
            async with client.stream("GET", pi_camera_url) as response:
                if response.status_code != 200:
                    return
                async for chunk in response.aiter_raw(chunk_size=2048):
                    yield chunk
        except Exception:
            return
        finally:
            await client.aclose()

    return StreamingResponse(
        stream_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, pre-check=0, post-check=0, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "Access-Control-Allow-Origin": "*",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/robot/camera/health",
    tags=TAG_OPS,
    summary="Kiểm tra trạng thái kết nối Camera Stream Pi 5",
)
async def check_camera_health(
    target_ip: Optional[str] = "100.99.72.51",
    port: Optional[int] = 8554,
):
    """Kiểm tra xem service camera_stream.py trên Pi 5 có đang online không."""
    pi_health_url = f"http://{target_ip}:{port}/health"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(pi_health_url)
            if resp.status_code == 200:
                return {"online": True, "details": resp.json()}
    except Exception as e:
        return {"online": False, "error": str(e)}
    return {"online": False}

