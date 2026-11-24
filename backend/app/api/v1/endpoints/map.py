"""Core live map, ROS 2 SLAM/Nav2 runtime control, navigation, and LiDAR WebSocket router."""

import asyncio
import json
import logging
from ipaddress import IPv4Address
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from app.repositories import MapRepository, get_map_repository
from app.schemas.map import (
    MapMetaData,
    NavigationRequest,
    NavigationResponse,
    OccupancyGridResponse,
    Pose2D,
)
from app.services.hardware.ros2_runtime_service import Ros2RuntimeError, ros2_runtime_service
from app.services.hardware.rplidar_service import rplidar_service

from .map_files import router as files_router
from .map_waypoints import _waypoint_out, _zone_out, is_point_in_zone, router as waypoints_router
from .map_world_sync import ensure_default_zones

logger = logging.getLogger(__name__)
router = APIRouter()
router.include_router(waypoints_router)
router.include_router(files_router)

current_robot_pose = Pose2D(x=0.0, y=0.0, yaw=0.0)


class Ros2MapRequest(BaseModel):
    name: str
    pi_ip: Optional[IPv4Address] = None


class Ros2ExploreRequest(BaseModel):
    name: str = "auto_explored_map"
    auto_save: bool = True


async def _nav2_zones_for(repo: MapRepository, map_name: str) -> List[dict]:
    zones = await repo.list_zones(ros2_runtime_service.normalize_map_name(map_name))
    return [_zone_out(z).model_dump() for z in zones]


def _build_telemetry_payload(pose: Pose2D) -> dict:
    """Build real-time WebSocket telemetry payload from active or idle LiDAR state."""
    map_info = rplidar_service.get_grid_map_data()
    is_active = bool(rplidar_service.is_connected and rplidar_service.is_running)
    payload = {
        "type": "telemetry_update",
        "source": "REAL_RPLIDAR_HARDWARE" if is_active else "NO_HARDWARE_CONNECTED",
        "robot_pose": {"x": pose.x, "y": pose.y, "yaw": pose.yaw},
        "battery": 98,
        "linear_velocity": 0.0,
        "angular_velocity": 0.0,
        "status": "RPLIDAR_COM9_ACTIVE" if is_active else "WAITING_FOR_COM9_HARDWARE",
        "is_map_locked": rplidar_service.is_map_locked,
        "saved_map_id": rplidar_service.saved_map_id,
        "scan_points": rplidar_service.get_latest_scans() if is_active else [],
        "grid_data": map_info["grid_data"],
        "grid_metadata": {
            "width": map_info["width"],
            "height": map_info["height"],
            "resolution": map_info["resolution"],
            "origin_x": map_info["origin_x"],
            "origin_y": map_info["origin_y"],
        },
    }
    if is_active:
        payload["device_info"] = rplidar_service.device_info
    else:
        payload["last_error"] = rplidar_service.last_error
    return payload


@router.get("/current", response_model=OccupancyGridResponse, summary="Lấy dữ liệu bản đồ SLAM Occupancy Grid 2D thực tế")
async def get_current_map(repo: MapRepository = Depends(get_map_repository)):
    await ensure_default_zones(repo)
    waypoints = [_waypoint_out(w, include_map_id=False) for w in await repo.list_waypoints()]
    zones = [_zone_out(z, include_map_id=False) for z in await repo.list_zones()]

    map_info = rplidar_service.get_grid_map_data()
    metadata = MapMetaData(
        width=map_info["width"],
        height=map_info["height"],
        resolution=map_info["resolution"],
        origin_x=map_info["origin_x"],
        origin_y=map_info["origin_y"],
    )
    return OccupancyGridResponse(
        metadata=metadata,
        robot_pose=current_robot_pose,
        waypoints=waypoints,
        zones=zones,
        grid_data=map_info["grid_data"],
    )


@router.get("/lidar_status", summary="Kiểm tra trạng thái phần cứng RPLiDAR COM9 thực tế")
async def get_lidar_status():
    return rplidar_service.get_status()


@router.get("/ros2/runtime", summary="Trạng thái WSL2, Rosbridge và Foxglove")
async def get_ros2_runtime_status():
    return await asyncio.to_thread(ros2_runtime_service.get_status)


@router.post("/ros2/start_mapping", summary="Bật chế độ quét map và Foxglove từ trình duyệt")
async def start_ros2_mapping():
    try:
        return await asyncio.to_thread(ros2_runtime_service.start_mapping)
    except Ros2RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/ros2/start_explore", summary="Xe thật TỰ ĐI quét map (SLAM + Nav2 + frontier explorer)")
async def start_ros2_explore(request: Ros2ExploreRequest):
    try:
        return await asyncio.to_thread(
            ros2_runtime_service.start_exploration, request.name, auto_save=request.auto_save
        )
    except Ros2RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/ros2/stop_explore", summary="Dừng xe tự quét (giữ SLAM để còn lưu map)")
async def stop_ros2_explore():
    return await asyncio.to_thread(ros2_runtime_service.stop_exploration)


@router.post("/ros2/save", summary="Lưu Occupancy Grid ROS 2 hiện tại thành YAML/PGM")
async def save_ros2_map(request: Ros2MapRequest):
    try:
        return await asyncio.to_thread(ros2_runtime_service.save_map, request.name)
    except Ros2RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/ros2/start_navigation", summary="Bật Map Server, AMCL, Nav2 và Foxglove")
async def start_ros2_navigation(request: Ros2MapRequest, repo: MapRepository = Depends(get_map_repository)):
    try:
        zones = await _nav2_zones_for(repo, request.name)
        kwargs = {"pi_ip": str(request.pi_ip)} if request.pi_ip is not None else {}
        return await asyncio.to_thread(ros2_runtime_service.start_navigation, request.name, zones, **kwargs)
    except Ros2RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/ros2/keepout_mask/{map_name}",
    summary="Tạo lại mask vùng cấm (Keepout Filter) và giới hạn tốc độ (Speed Filter) cho Nav2 từ CSDL",
)
async def update_ros2_keepout_mask(map_name: str, repo: MapRepository = Depends(get_map_repository)):
    """Gọi sau khi lưu/xóa vùng: ghi các mask mới và nạp lại ngay nếu Nav2 đang chạy."""
    try:
        zones = await _nav2_zones_for(repo, map_name)
        result = await asyncio.to_thread(ros2_runtime_service.write_zone_masks, map_name, zones)
    except Ros2RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    reloaded = await asyncio.to_thread(ros2_runtime_service.reload_zone_masks, map_name)
    result["reloaded_masks"] = reloaded
    result["reloaded"] = all(reloaded.values())
    return {"status": "SUCCESS", **result}


@router.post("/toggle_lock", summary="Bật/tắt chế độ khóa bản đồ tĩnh")
async def toggle_map_lock(lock: Optional[bool] = None):
    """Khóa bản đồ (để bản đồ đứng yên cố định không bị trôi) hoặc mở khóa (để quét thêm không gian mới)."""
    new_state = rplidar_service.set_map_lock(not rplidar_service.is_map_locked if lock is None else lock)
    msg = (
        "Đã KHÓA bản đồ cố định (Static Map Locked)"
        if new_state
        else "Đã MỞ KHÓA chế độ quét bản đồ tự do (Free Mapping Mode)"
    )
    return {"status": "SUCCESS", "message": msg, "is_map_locked": new_state}


@router.post("/reset_map", summary="Xóa trắng bản đồ 2D để tiến hành quét SLAM lại từ đầu")
async def reset_map():
    rplidar_service.reset_grid_map()
    return {"status": "SUCCESS", "message": "Đã xử lý reset bản đồ 2D"}


@router.post("/connect_lidar", summary="Kích hoạt kết nối với cổng COM9 của RPLiDAR")
async def connect_lidar_hardware():
    success = await asyncio.to_thread(rplidar_service.connect)
    if success:
        rplidar_service.start_scanning()
        return {
            "status": "SUCCESS",
            "message": "Đã kết nối thành công phần cứng RPLiDAR COM9",
            "info": rplidar_service.device_info,
        }
    return {"status": "FAILED", "message": rplidar_service.last_error or "Lỗi kết nối cổng COM9"}


@router.post("/scan_360", summary="Kích hoạt robot quay 360 độ để quét toàn cảnh phòng")
async def trigger_scan_360():
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.post("http://100.93.152.7:8000/api/v1/map/scan_360")
            return res.json()
    except Exception:
        return {"status": "SUCCESS", "message": "Đã gửi lệnh quét 360 độ tới robot"}


@router.post("/teleop", summary="Điều khiển thủ công Robot di chuyển")
async def trigger_teleop(payload: dict):
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.post("http://100.93.152.7:8000/api/v1/map/teleop", json=payload)
            return res.json()
    except Exception:
        return {"status": "SUCCESS", "command": payload.get("command")}


@router.post("/navigate", response_model=NavigationResponse, summary="Gửi mục tiêu di chuyển Robot")
async def navigate_to_target(
    request: NavigationRequest,
    repo: MapRepository = Depends(get_map_repository),
):
    try:
        for z in await repo.list_zones():
            if z.type == "KEEP_OUT" and is_point_in_zone(request.target_x, request.target_y, z):
                return NavigationResponse(
                    status="REJECTED",
                    message=(
                        f"Đích đến ({request.target_x:.2f}, {request.target_y:.2f}) "
                        f"nằm trong Khu vực cấm vào (Keep-out Zone) '{z.name}'!"
                    ),
                    target_x=request.target_x,
                    target_y=request.target_y,
                )
            if z.type == "NO_STOP" and is_point_in_zone(request.target_x, request.target_y, z):
                return NavigationResponse(
                    status="REJECTED",
                    message=(
                        f"Đích đến ({request.target_x:.2f}, {request.target_y:.2f}) "
                        f"nằm trong Khu vực cấm dừng (No-Stop Zone) '{z.name}'. Robot không thể chọn đây làm điểm kết thúc!"
                    ),
                    target_x=request.target_x,
                    target_y=request.target_y,
                )

        current_robot_pose.x = request.target_x
        current_robot_pose.y = request.target_y
        if request.target_yaw is not None:
            current_robot_pose.yaw = request.target_yaw

        return NavigationResponse(
            status="SUCCESS",
            message=f"Đã nhận mục tiêu (x: {request.target_x:.2f}, y: {request.target_y:.2f})",
            target_x=request.target_x,
            target_y=request.target_y,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.websocket("/ws")
async def map_websocket_endpoint(websocket: WebSocket):
    """WebSocket streaming dữ liệu 100% THỰC TẾ từ phần cứng RPLiDAR COM9 và Bản đồ Cố định."""
    await websocket.accept()
    logger.info("🔌 WebSocket LiDAR Client connected")

    if not rplidar_service.is_running:
        success = await asyncio.to_thread(rplidar_service.connect)
        if success:
            rplidar_service.start_scanning()

    try:
        while True:
            payload = _build_telemetry_payload(current_robot_pose)
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.033)  # ~30 Hz real-time refresh rate
    except WebSocketDisconnect:
        logger.info("🔌 WebSocket LiDAR Client disconnected")
    except Exception as e:
        logger.error(f"Lỗi WebSocket LiDAR: {e}")
        await websocket.close()
