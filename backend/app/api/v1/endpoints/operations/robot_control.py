import socket
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.interceptors import RouteInterceptor, audit_action, measure_performance
from app.repositories import RobotRepository, get_robot_repository
from app.repositories.robot_repository import DEFAULT_ROBOT_ID
from app.schemas.robot import (
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

DEFAULT_ROBOT_ALIASES = (DEFAULT_ROBOT_ID, "hc_pi5_01")


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
    if not robot and robot_id in DEFAULT_ROBOT_ALIASES:
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
    if not robot and robot_id in DEFAULT_ROBOT_ALIASES:
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


from .robot_jobs_and_maintenance import router as robot_jobs_and_maintenance_router

router.include_router(robot_jobs_and_maintenance_router)


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
            spd_val = max(20, min(100, cmd.speed))
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


class WebRTCOfferRequest(BaseModel):
    sdp: str
    type: str = "offer"
    target_ip: Optional[str] = "100.99.72.51"
    port: Optional[int] = 8554


@router.post(
    "/robot/camera/webrtc-offer",
    tags=TAG_OPS,
    summary="Signaling WebRTC Offer từ trình duyệt tới Camera Streamer Pi 5",
)
async def exchange_camera_webrtc_offer(
    payload: WebRTCOfferRequest,
):
    """
    Chuyển tiếp SDP Offer từ Web Frontend tới WebRTC Server trên Pi 5 (port 8554/offer)
    và trả về SDP Answer từ Pi 5 để thiết lập kết nối WebRTC P2P siêu mượt không độ trễ.
    """
    target_host = payload.target_ip or "100.99.72.51"
    target_port = payload.port or 8554
    pi_offer_url = f"http://{target_host}:{target_port}/offer"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=12.0, write=5.0, pool=5.0)) as client:
            resp = await client.post(
                pi_offer_url,
                json={"sdp": payload.sdp, "type": payload.type},
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code == 200:
                return resp.json()
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"Camera WebRTC streamer returned HTTP {resp.status_code}: {resp.text}",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Không thể kết nối tới WebRTC Streamer trên Pi 5 ({pi_offer_url}): {exc}",
        )


@router.api_route(
    "/robot/pi5/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE"],
    tags=TAG_OPS,
    summary="Reverse Proxy các request điều khiển phần cứng Pi 5 (tránh Mixed Content trên HTTPS)",
)
async def proxy_pi5_hardware_api(request: Request, path: str):
    target_url = f"http://100.99.72.51:8000/api/v1/{path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        body = await request.body()

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.request(
                method=request.method,
                url=target_url,
                content=body,
                headers={"Content-Type": request.headers.get("content-type", "application/json")},
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("content-type", "application/json"),
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Không thể kết nối tới Pi 5 API ({target_url}): {exc}",
        )
