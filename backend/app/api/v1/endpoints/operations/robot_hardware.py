"""Robot teleop movement, Pi 5 camera/WebRTC signaling, and hardware API proxy routes."""

import json
import socket
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.interceptors import RouteInterceptor, audit_action, measure_performance
from .shared import TAG_OPS

router = APIRouter(route_class=RouteInterceptor)

_MOTION_MAP = {
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


class RobotMoveCommand(BaseModel):
    command: str
    target_ip: Optional[str] = "100.93.152.7"
    port: Optional[int] = 9999
    speed: Optional[int] = None


class WebRTCOfferRequest(BaseModel):
    sdp: str
    type: str = "offer"
    target_ip: Optional[str] = "100.93.152.7"
    port: Optional[int] = 8554


class GuestPerceptionSync(BaseModel):
    emotion: Optional[str] = None
    gender: Optional[str] = None
    age_group: Optional[str] = None
    confidence: Optional[float] = None
    is_face_detected: Optional[bool] = None


@router.post(
    "/robot/guest-perception",
    tags=TAG_OPS,
    summary="Đồng bộ kết quả nhận diện khuôn mặt & biểu cảm từ Camera Pi 5 tới Robot",
)
async def sync_guest_perception(payload: GuestPerceptionSync):
    """
    Nhận kết quả AI nhận diện (biểu cảm khó chịu, giới tính, độ tuổi) từ camera Pi 5 / Admin
    và phát sóng WebSocket tới màn hình điện thoại Robot để hiển thị hỗ trợ hoặc gợi ý dịch vụ.
    """
    from app.services.notification_manager import notification_manager

    event_data = {
        "type": "GUEST_PERCEPTION_UPDATE",
        "emotion": payload.emotion,
        "gender": payload.gender,
        "age_group": payload.age_group,
        "confidence": payload.confidence,
        "is_face_detected": payload.is_face_detected,
    }
    await notification_manager.broadcast_to_department("All", event_data)
    return {"status": "ok", "synced": event_data}


@router.post("/robot/control", tags=TAG_OPS, summary="Điều khiển di chuyển HCRobot (UDP Remote)")
@audit_action(action="ROBOT_MOVE", resource_type="ROBOT", default_actor_id="operator")
@measure_performance(action_name="control_robot_movement", slow_threshold_ms=300.0)
async def control_robot_movement(cmd: RobotMoveCommand):
    """Gửi lệnh di chuyển qua UDP tới Raspberry Pi 5 tích hợp fail-safe siêu âm và PWM speed."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.5)
        target_host = cmd.target_ip or "100.93.152.7"
        target_port = cmd.port or 9999

        raw_cmd = cmd.command.lower().strip()
        if cmd.speed is not None:
            spd_val = max(20, min(100, int(cmd.speed)))
            sock.sendto(f"speed:{spd_val}".encode("utf-8"), (target_host, target_port))

        if raw_cmd.startswith("speed:") or raw_cmd.startswith("speed_"):
            sock.sendto(raw_cmd.encode("utf-8"), (target_host, target_port))
            sock.close()
            return {"status": "ok", "speed_set": raw_cmd, "target": f"{target_host}:{target_port}"}

        cmd_str = _MOTION_MAP.get(raw_cmd, "stop")
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


@router.get(
    "/robot/camera/stream",
    tags=TAG_OPS,
    summary="Reverse Proxy MJPEG Camera Stream từ Raspberry Pi 5 sang HTTPS",
)
async def proxy_camera_stream(
    target_ip: Optional[str] = "100.93.152.7",
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
    target_ip: Optional[str] = "100.93.152.7",
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


@router.post(
    "/robot/camera/webrtc-offer",
    tags=TAG_OPS,
    summary="Signaling WebRTC Offer từ trình duyệt tới Camera Streamer Pi 5",
)
async def exchange_camera_webrtc_offer(payload: WebRTCOfferRequest):
    """
    Chuyển tiếp SDP Offer từ Web Frontend tới WebRTC Server trên Pi 5 (port 8554/offer)
    và trả về SDP Answer từ Pi 5 để thiết lập kết nối WebRTC P2P siêu mượt không độ trễ.
    """
    target_host = payload.target_ip or "100.93.152.7"
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
    target_url = f"http://100.93.152.7:8000/api/v1/{path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    body = await request.body() if request.method in ["POST", "PUT", "PATCH"] else None

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
        # Graceful fallback cho telemetry / status endpoint khi Pi 5 ngoai tuyen de tranh spam loi 503 tren browser console
        if request.method == "GET" and any(k in path.lower() for k in ["system/power", "system/battery"]):
            fallback_payload = {
                "status": "offline",
                "online": False,
                "power": None,
                "battery": None,
                "detail": f"Pi 5 ngoai tuyen hoac khong the ket noi ({target_url}): {exc}",
            }
            return Response(content=json.dumps(fallback_payload), status_code=200, media_type="application/json")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Không thể kết nối tới Pi 5 API ({target_url}): {exc}",
        )
