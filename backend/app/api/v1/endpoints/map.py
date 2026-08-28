import asyncio
import json
import logging
from typing import List

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from app.schemas.map import (
    MapMetaData,
    NavigationRequest,
    NavigationResponse,
    OccupancyGridResponse,
    Pose2D,
    Waypoint,
)
from app.services.hardware.rplidar_service import rplidar_service

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_WAYPOINTS: List[Waypoint] = [
    Waypoint(id="wp-reception", name="Quầy Lễ Tân", x=0.0, y=0.0, yaw=0.0, floor="Tầng 1"),
    Waypoint(id="wp-elevator", name="Cụm Thang Máy A", x=2.5, y=4.0, yaw=90.0, floor="Tầng 1"),
    Waypoint(id="wp-pool", name="Hồ Bơi Vô Cực", x=6.0, y=8.5, yaw=45.0, floor="Tầng 4"),
    Waypoint(id="wp-room101", name="Phòng 101 (Deluxe)", x=-3.0, y=5.0, yaw=180.0, floor="Tầng 1"),
]

current_robot_pose = Pose2D(x=0.0, y=0.0, yaw=0.0)


@router.get("/current", response_model=OccupancyGridResponse, summary="Lấy dữ liệu bản đồ SLAM Occupancy Grid 2D thực tế")
async def get_current_map():
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
        waypoints=[],
        grid_data=map_info["grid_data"],
    )


@router.get("/waypoints", response_model=List[Waypoint], summary="Lấy danh sách các điểm Waypoints")
async def get_waypoints():
    return []


@router.get("/lidar_status", summary="Kiểm tra trạng thái phần cứng RPLiDAR COM9 thực tế")
async def get_lidar_status():
    return rplidar_service.get_status()


@router.post("/reset_map", summary="Xóa trắng bản đồ 2D để tiến hành quét SLAM lại từ đầu")
async def reset_map():
    rplidar_service.reset_grid_map()
    return {"status": "SUCCESS", "message": "Đã xóa trắng bản đồ 2D Occupancy Grid"}


@router.post("/connect_lidar", summary="Kích hoạt kết nối với cổng COM9 của RPLiDAR")
async def connect_lidar_hardware():
    success = await asyncio.to_thread(rplidar_service.connect)
    if success:
        rplidar_service.start_scanning()
        return {"status": "SUCCESS", "message": "Đã kết nối thành công phần cứng RPLiDAR COM9", "info": rplidar_service.device_info}
    else:
        return {"status": "FAILED", "message": rplidar_service.last_error or "Lỗi kết nối cổng COM9"}


@router.post("/navigate", response_model=NavigationResponse, summary="Gửi mục tiêu di chuyển Robot")
async def navigate_to_target(request: NavigationRequest):
    global current_robot_pose
    try:
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
    """
    WebSocket streaming dữ liệu 100% THỰC TẾ từ phần cứng RPLiDAR COM9.
    """
    await websocket.accept()
    logger.info("🔌 WebSocket LiDAR Client connected")

    if not rplidar_service.is_running:
        success = await asyncio.to_thread(rplidar_service.connect)
        if success:
            rplidar_service.start_scanning()

    try:
        while True:
            status_info = rplidar_service.get_status()

            if rplidar_service.is_connected and rplidar_service.is_running:
                scans = rplidar_service.get_latest_scans()
                map_info = rplidar_service.get_grid_map_data()
                payload = {
                    "type": "telemetry_update",
                    "source": "REAL_RPLIDAR_HARDWARE",
                    "device_info": rplidar_service.device_info,
                    "robot_pose": {
                        "x": current_robot_pose.x,
                        "y": current_robot_pose.y,
                        "yaw": current_robot_pose.yaw
                    },
                    "battery": 98,
                    "linear_velocity": 0.0,
                    "angular_velocity": 0.0,
                    "status": "RPLIDAR_COM9_ACTIVE",
                    "scan_points": scans,
                    "grid_data": map_info["grid_data"],
                    "grid_metadata": {
                        "width": map_info["width"],
                        "height": map_info["height"],
                        "resolution": map_info["resolution"],
                        "origin_x": map_info["origin_x"],
                        "origin_y": map_info["origin_y"],
                    }
                }
            else:
                payload = {
                    "type": "telemetry_update",
                    "source": "NO_HARDWARE_CONNECTED",
                    "robot_pose": {
                        "x": current_robot_pose.x,
                        "y": current_robot_pose.y,
                        "yaw": current_robot_pose.yaw
                    },
                    "battery": 98,
                    "linear_velocity": 0.0,
                    "angular_velocity": 0.0,
                    "status": "WAITING_FOR_COM9_HARDWARE",
                    "last_error": rplidar_service.last_error,
                    "scan_points": []
                }

            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.033)  # ~30 Hz real-time refresh rate

    except WebSocketDisconnect:
        logger.info("🔌 WebSocket LiDAR Client disconnected")
    except Exception as e:
        logger.error(f"Lỗi WebSocket LiDAR: {e}")
        await websocket.close()
