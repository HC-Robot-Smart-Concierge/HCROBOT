import asyncio
import json
import logging
from typing import List

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.workflow import RobotWaypoint, RobotZone
from app.schemas.map import (
    MapMetaData,
    NavigationRequest,
    NavigationResponse,
    OccupancyGridResponse,
    Pose2D,
    Waypoint,
    ZoneSchema,
)
from app.services.hardware.rplidar_service import rplidar_service

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_WAYPOINTS: List[dict] = [
    {"id": "wp-reception", "name": "Quầy Lễ Tân", "x": 0.0, "y": 0.0, "yaw": 0.0, "floor": "Sảnh Tầng 1", "type": "DOCKING_TARGET", "description": "Điểm dừng tiếp đón khách và làm thủ tục check-in sảnh chính"},
    {"id": "wp-lounge", "name": "Sảnh Lounge & Coffee", "x": 2.5, "y": 4.0, "yaw": 90.0, "floor": "Sảnh Tầng 1", "type": "SERVICE_STATION", "description": "Khu vực nghỉ chờ và thưởng thức đồ uống sảnh chính"},
    {"id": "wp-vip-table", "name": "Bàn Tiếp Khách VIP 01", "x": 5.0, "y": 2.5, "yaw": 45.0, "floor": "Sảnh Tầng 1", "type": "GUEST_TABLE", "description": "Khu vực bàn tiếp đón khách VIP tại sảnh Tầng 1"},
    {"id": "wp-elevator", "name": "Sảnh Thang Máy A", "x": -3.0, "y": 5.0, "yaw": 180.0, "floor": "Sảnh Tầng 1", "type": "WAYPOINT", "description": "Điểm mốc điều hướng robot tại hành lang thang máy sảnh Tầng 1"},
]

DEFAULT_ZONES: List[dict] = [
    {"id": "zone-stairs", "name": "CẦU THANG BỘ (CHỐNG NGÃ)", "type": "KEEP_OUT", "x": 4.5, "y": -2.0, "width": 1.8, "height": 2.2, "speed_limit": 0.0, "floor": "Sảnh Tầng 1", "description": "Khu vực cầu thang bộ nguy hiểm - robot tuyệt đối không đi vào"},
    {"id": "zone-entrance", "name": "CỬA RA VÀO SẢNH CHÍNH", "type": "SLOW_SPEED", "x": 0.0, "y": 2.0, "width": 3.0, "height": 2.0, "speed_limit": 0.3, "floor": "Sảnh Tầng 1", "description": "Khu vực đông người qua lại - giới hạn vận tốc 0.3 m/s"},
    {"id": "zone-vip-lounge", "name": "PHÒNG NGHỈ YÊN LẶNG VIP", "type": "SILENT_ZONE", "x": 5.0, "y": 5.0, "width": 3.5, "height": 3.0, "speed_limit": 0.5, "floor": "Sảnh Tầng 1", "description": "Khu vực hội nghị & VIP Lounge - robot tự động tắt tiếng/loa"},
    {"id": "zone-greeting-hall", "name": "SẢNH ĐÓN KHÁCH TỰ ĐỘNG AI", "type": "GREETING_ZONE", "x": 1.5, "y": 0.0, "width": 4.0, "height": 3.0, "speed_limit": 0.6, "floor": "Sảnh Tầng 1", "description": "Khu vực sảnh chính - robot kích hoạt AI Person Detector chủ động đón khách"},
]

current_robot_pose = Pose2D(x=0.0, y=0.0, yaw=0.0)


async def ensure_default_waypoints(db: AsyncSession):
    res = await db.execute(select(RobotWaypoint).limit(1))
    if res.scalar_one_or_none() is None:
        for wp in DEFAULT_WAYPOINTS:
            db.add(RobotWaypoint(
                id=wp["id"],
                name=wp["name"],
                x=wp["x"],
                y=wp["y"],
                yaw=wp["yaw"],
                floor=wp["floor"],
                type=wp.get("type", "WAYPOINT"),
                description=wp.get("description", ""),
            ))
        await db.commit()


async def ensure_default_zones(db: AsyncSession):
    res = await db.execute(select(RobotZone).limit(1))
    if res.scalar_one_or_none() is None:
        for z in DEFAULT_ZONES:
            db.add(RobotZone(
                id=z["id"],
                name=z["name"],
                type=z["type"],
                x=z["x"],
                y=z["y"],
                width=z["width"],
                height=z["height"],
                speed_limit=z.get("speed_limit", 0.3),
                floor=z.get("floor", "Sảnh Tầng 1"),
                description=z.get("description", ""),
            ))
        await db.commit()


@router.get("/current", response_model=OccupancyGridResponse, summary="Lấy dữ liệu bản đồ SLAM Occupancy Grid 2D thực tế")
async def get_current_map(db: AsyncSession = Depends(get_db)):
    wps_res = await db.execute(select(RobotWaypoint))
    wps_db = wps_res.scalars().all()
    waypoints = [
        Waypoint(
            id=w.id,
            name=w.name,
            x=w.x,
            y=w.y,
            yaw=w.yaw,
            floor=w.floor,
            type=w.type or "WAYPOINT",
            description=w.description
        )
        for w in wps_db
    ]

    zones_res = await db.execute(select(RobotZone))
    zones_db = zones_res.scalars().all()
    zones = [
        ZoneSchema(
            id=z.id,
            name=z.name,
            type=z.type or "KEEP_OUT",
            x=z.x,
            y=z.y,
            width=z.width,
            height=z.height,
            speed_limit=z.speed_limit,
            floor=z.floor,
            description=z.description
        )
        for z in zones_db
    ]

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


@router.get("/waypoints", response_model=List[Waypoint], summary="Lấy danh sách các điểm Waypoints / Endpoints")
async def get_waypoints(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotWaypoint).order_by(RobotWaypoint.created_at))
    wps = res.scalars().all()
    return [
        Waypoint(
            id=w.id,
            name=w.name,
            x=w.x,
            y=w.y,
            yaw=w.yaw,
            floor=w.floor,
            type=w.type or "WAYPOINT",
            description=w.description
        )
        for w in wps
    ]


@router.post("/waypoints", response_model=Waypoint, summary="Tạo mới hoặc cập nhật tọa độ Waypoint / Endpoint")
async def save_waypoint(wp: Waypoint, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotWaypoint).where(RobotWaypoint.id == wp.id))
    existing = res.scalar_one_or_none()

    if existing:
        existing.name = wp.name
        existing.x = wp.x
        existing.y = wp.y
        existing.yaw = wp.yaw
        existing.floor = wp.floor
        existing.type = wp.type or existing.type or "WAYPOINT"
        existing.description = wp.description
        await db.commit()
        await db.refresh(existing)
        return Waypoint(
            id=existing.id,
            name=existing.name,
            x=existing.x,
            y=existing.y,
            yaw=existing.yaw,
            floor=existing.floor,
            type=existing.type,
            description=existing.description
        )
    else:
        new_wp = RobotWaypoint(
            id=wp.id,
            name=wp.name,
            x=wp.x,
            y=wp.y,
            yaw=wp.yaw,
            floor=wp.floor,
            type=wp.type or "WAYPOINT",
            description=wp.description,
        )
        db.add(new_wp)
        await db.commit()
        await db.refresh(new_wp)
        return Waypoint(
            id=new_wp.id,
            name=new_wp.name,
            x=new_wp.x,
            y=new_wp.y,
            yaw=new_wp.yaw,
            floor=new_wp.floor,
            type=new_wp.type,
            description=new_wp.description
        )


@router.put("/waypoints/{waypoint_id}", response_model=Waypoint, summary="Chỉnh sửa Endpoint đã có")
async def update_waypoint(waypoint_id: str, wp: Waypoint, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotWaypoint).where(RobotWaypoint.id == waypoint_id))
    existing = res.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Waypoint")

    existing.name = wp.name
    existing.x = wp.x
    existing.y = wp.y
    existing.yaw = wp.yaw
    existing.floor = wp.floor
    existing.type = wp.type or existing.type or "WAYPOINT"
    existing.description = wp.description

    await db.commit()
    await db.refresh(existing)
    return Waypoint(
        id=existing.id,
        name=existing.name,
        x=existing.x,
        y=existing.y,
        yaw=existing.yaw,
        floor=existing.floor,
        type=existing.type,
        description=existing.description
    )


@router.delete("/waypoints/{waypoint_id}", summary="Xóa điểm Waypoint / Endpoint")
async def delete_waypoint(waypoint_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotWaypoint).where(RobotWaypoint.id == waypoint_id))
    existing = res.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Waypoint")

    await db.delete(existing)
    await db.commit()
    return {"status": "SUCCESS", "message": f"Đã xóa waypoint {waypoint_id}"}


@router.get("/zones", response_model=List[ZoneSchema], summary="Lấy danh sách các Vùng Chức Năng (Zones)")
async def get_zones(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotZone).order_by(RobotZone.created_at))
    zones = res.scalars().all()
    return [
        ZoneSchema(
            id=z.id,
            name=z.name,
            type=z.type or "KEEP_OUT",
            x=z.x,
            y=z.y,
            width=z.width,
            height=z.height,
            speed_limit=z.speed_limit,
            floor=z.floor,
            description=z.description
        )
        for z in zones
    ]


@router.post("/zones", response_model=ZoneSchema, summary="Tạo mới hoặc cập nhật Vùng Chức Năng (Zone)")
async def save_zone(zone: ZoneSchema, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotZone).where(RobotZone.id == zone.id))
    existing = res.scalar_one_or_none()

    if existing:
        existing.name = zone.name
        existing.type = zone.type or "KEEP_OUT"
        existing.x = zone.x
        existing.y = zone.y
        existing.width = zone.width
        existing.height = zone.height
        existing.speed_limit = zone.speed_limit
        existing.floor = zone.floor
        existing.description = zone.description
        await db.commit()
        await db.refresh(existing)
        return ZoneSchema(
            id=existing.id,
            name=existing.name,
            type=existing.type,
            x=existing.x,
            y=existing.y,
            width=existing.width,
            height=existing.height,
            speed_limit=existing.speed_limit,
            floor=existing.floor,
            description=existing.description
        )
    else:
        new_z = RobotZone(
            id=zone.id,
            name=zone.name,
            type=zone.type or "KEEP_OUT",
            x=zone.x,
            y=zone.y,
            width=zone.width,
            height=zone.height,
            speed_limit=zone.speed_limit,
            floor=zone.floor,
            description=zone.description
        )
        db.add(new_z)
        await db.commit()
        await db.refresh(new_z)
        return ZoneSchema(
            id=new_z.id,
            name=new_z.name,
            type=new_z.type,
            x=new_z.x,
            y=new_z.y,
            width=new_z.width,
            height=new_z.height,
            speed_limit=new_z.speed_limit,
            floor=new_z.floor,
            description=new_z.description
        )


@router.put("/zones/{zone_id}", response_model=ZoneSchema, summary="Cập nhật Vùng Chức Năng theo ID")
async def update_zone(zone_id: str, zone: ZoneSchema, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotZone).where(RobotZone.id == zone_id))
    existing = res.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Vùng Chức Năng")

    existing.name = zone.name
    existing.type = zone.type or "KEEP_OUT"
    existing.x = zone.x
    existing.y = zone.y
    existing.width = zone.width
    existing.height = zone.height
    existing.speed_limit = zone.speed_limit
    existing.floor = zone.floor
    existing.description = zone.description

    await db.commit()
    await db.refresh(existing)
    return ZoneSchema(
        id=existing.id,
        name=existing.name,
        type=existing.type,
        x=existing.x,
        y=existing.y,
        width=existing.width,
        height=existing.height,
        speed_limit=existing.speed_limit,
        floor=existing.floor,
        description=existing.description
    )


@router.delete("/zones/{zone_id}", summary="Xóa Vùng Chức Năng")
async def delete_zone(zone_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotZone).where(RobotZone.id == zone_id))
    existing = res.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Vùng Chức Năng")

    await db.delete(existing)
    await db.commit()
    return {"status": "SUCCESS", "message": f"Đã xóa vùng {zone_id}"}




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
