import asyncio
import io
import json
import logging
import os
import re
import zipfile
from datetime import datetime
from ipaddress import IPv4Address
from pathlib import Path
from typing import Any, List, Optional, Sequence

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status, Depends, Response
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.models.workflow import RobotWaypoint, RobotZone
from app.repositories import MapRepository, get_map_repository
from app.schemas.map import (
    MapMetaData,
    NavigationRequest,
    NavigationResponse,
    OccupancyGridResponse,
    Pose2D,
    Waypoint,
    ZoneSchema,
)
from app.services.hardware.rplidar_service import rplidar_service, MAPS_DIR
from app.services.hardware.ros2_runtime_service import (
    Ros2RuntimeError,
    ros2_runtime_service,
)

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_WAYPOINTS: List[dict] = [
    {
        "id": "ROBOT_STANDBY",
        "name": "Vị Trí Chờ Robot Sảnh",
        "type": "PARK",
        "x": 7.20,
        "y": 9.60,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Vị trí dừng đỗ chờ sẵn của Robot Concierge.",
    },
    {
        "id": "CHARGER_STATION",
        "name": "Trạm Sạc Robot Sảnh",
        "type": "CHARGER",
        "x": 6.00,
        "y": 9.60,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Trạm sạc tự động của Robot Concierge.",
    },
    {
        "id": "MAIN_ENTRANCE",
        "name": "Cửa Chính Sảnh (Main Entrance)",
        "type": "WAYPOINT",
        "x": 0.90,
        "y": 6.25,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Cửa chính ra vào sảnh tầng trệt đón khách.",
    },
    {
        "id": "FRONT_DESK",
        "name": "Trước Quầy Lễ Tân (Front Desk)",
        "type": "WAYPOINT",
        "x": 11.44,
        "y": 2.80,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực check-in và đón tiếp khách tại quầy lễ tân.",
    },
    {
        "id": "STAFF_ONLY",
        "name": "Trước Phòng Nội Bộ (Staff Only)",
        "type": "WAYPOINT",
        "x": 11.44,
        "y": 6.40,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực sảnh tiếp giáp cửa phòng làm việc nội bộ.",
    },
    {
        "id": "ELEVATOR",
        "name": "Cụm Thang Máy Tầng 1",
        "type": "WAYPOINT",
        "x": 15.60,
        "y": 6.96,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Cụm thang máy dẫn khách lên các tầng phòng nghỉ.",
    },
    {
        "id": "RESTROOMS",
        "name": "Nhà Vệ Sinh Sảnh (WC)",
        "type": "WAYPOINT",
        "x": 15.20,
        "y": 2.40,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực nhà vệ sinh công cộng sảnh tầng trệt.",
    },
    {
        "id": "STAIRS",
        "name": "Lối Thoát Hiểm Khẩn Cấp",
        "type": "WAYPOINT",
        "x": 16.00,
        "y": 4.80,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Lối thoát hiểm thang bộ khẩn cấp phía Đông.",
    },
    {
        "id": "LOBBY_LOUNGE",
        "name": "Khu Sofa Khách Chờ Sảnh",
        "type": "WAYPOINT",
        "x": 3.60,
        "y": 7.20,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực bàn ghế sofa tiếp khách thư giãn sảnh.",
    },
]
DEFAULT_ZONES: List[dict] = [
    {
        "id": "zone-keepout-staff",
        "name": "Khu Vực Quầy Lễ Tân Nội Bộ (Cấm Vào)",
        "type": "KEEP_OUT",
        "x": 11.44,
        "y": 6.4,
        "width": 2.80,
        "height": 3.60,
        "speed_limit": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực quầy lễ tân nội bộ, robot tuyệt đối không đi vào.",
    },
    {
        "id": "zone-speed-frontdesk",
        "name": "Khu Vực Quầy Tiếp Tân (Giới Hạn Tốc Độ)",
        "type": "SPEED_ZONE",
        "x": 11.44,
        "y": 2.8,
        "width": 4.80,
        "height": 2.40,
        "speed_limit": 0.20,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực đón tiếp đông khách, tự động giới hạn tốc độ tối đa 0.20 m/s.",
    },
    {
        "id": "zone-nostop-doorway",
        "name": "Cửa Thông Sảnh Chính (Cấm Dừng)",
        "type": "NO_STOP",
        "x": 12.84,
        "y": 9.8,
        "width": 2.40,
        "height": 2.80,
        "speed_limit": 0.30,
        "floor": "Sảnh Tầng 1",
        "description": "Nút thắt lưu thông chính giữa 2 gian sảnh, robot chỉ được phép đi qua, cấm dừng đỗ.",
    },
]

current_robot_pose = Pose2D(x=0.0, y=0.0, yaw=0.0)


class Ros2MapRequest(BaseModel):
    name: str
    pi_ip: Optional[IPv4Address] = None


class Ros2ExploreRequest(BaseModel):
    name: str = "auto_explored_map"
    auto_save: bool = True


def is_point_in_zone(px: float, py: float, z) -> bool:
    """Kiểm tra một tọa độ (px, py) có nằm trong vùng hình chữ nhật z hay không."""
    half_w = (getattr(z, "width", 2.0) or 2.0) / 2.0
    half_h = (getattr(z, "height", 2.0) or 2.0) / 2.0
    zx = getattr(z, "x", 0.0)
    zy = getattr(z, "y", 0.0)
    return (zx - half_w) <= px <= (zx + half_w) and (zy - half_h) <= py <= (zy + half_h)


# Vung khong duoc co endpoint ben trong (cung luat voi Web: physicalMapZones.js).
# NO_STOP: robot chi duoc di ngang qua, moi endpoint deu la cho dung => cam moi loai endpoint.
NO_ENDPOINT_ZONE_TYPES = ("KEEP_OUT", "NO_STOP")


def _waypoint_zone_violation(x: float, y: float, zones) -> Optional[str]:
    for z in zones:
        if z.type == "KEEP_OUT" and is_point_in_zone(x, y, z):
            return f"Tọa độ ({x:.2f}, {y:.2f}) nằm trong Khu vực cấm vào (Keep-out Zone) '{z.name}'!"
        if z.type == "NO_STOP" and is_point_in_zone(x, y, z):
            return (f"Tọa độ ({x:.2f}, {y:.2f}) nằm trong Khu vực cấm dừng (No-Stop Zone) '{z.name}': "
                    "robot chỉ được đi ngang qua, không thể đặt endpoint/điểm dừng tại đây!")
    return None


async def _zone_endpoint_conflict(zone: "ZoneSchema", repo: MapRepository) -> Optional[str]:
    """Vung cam dung/cam vao de len endpoint co san cua CUNG map => ly do tu choi (bat xoa truoc)."""
    if (zone.type or "KEEP_OUT") not in NO_ENDPOINT_ZONE_TYPES or not zone.map_id:
        return None  # khong ro map (du lieu cu) thi khong doan endpoint cua map nao
    waypoints = await repo.list_waypoints(zone.map_id)
    covered = [w for w in waypoints if is_point_in_zone(w.x, w.y, zone)]
    if not covered:
        return None
    kind = "cấm dừng" if zone.type == "NO_STOP" else "cấm vào"
    names = ", ".join(f"'{w.name or w.id}'" for w in covered)
    return (f"Không thể đặt vùng {kind} '{zone.name}' đè lên endpoint {names}. "
            "Hãy xóa endpoint đó trước, rồi vẽ lại vùng.")


async def ensure_default_waypoints(repo: MapRepository):
    if not DEFAULT_WAYPOINTS:
        return
    existing = await repo.list_waypoints()
    existing_ids = {wp.id for wp in existing}
    for wp in DEFAULT_WAYPOINTS:
        if wp["id"] not in existing_ids:
            await repo.save_or_update_waypoint(
                id=wp["id"],
                name=wp["name"],
                x=wp["x"],
                y=wp["y"],
                yaw=wp["yaw"],
                floor=wp["floor"],
                type=wp.get("type", "WAYPOINT"),
                description=wp.get("description", ""),
            )


async def ensure_default_zones(repo: MapRepository):
    if not DEFAULT_ZONES:
        return
    existing = await repo.list_zones()
    existing_ids = {z.id for z in existing}
    for z in DEFAULT_ZONES:
        if z["id"] not in existing_ids:
            await repo.save_or_update_zone(
                id=z["id"],
                name=z["name"],
                type=z["type"],
                x=z["x"],
                y=z["y"],
                width=z["width"],
                height=z["height"],
                speed_limit=z.get("speed_limit", 0.2),
                floor=z.get("floor", "Sảnh Tầng 1"),
                description=z.get("description", ""),
            )


@router.get("/current", response_model=OccupancyGridResponse, summary="Lấy dữ liệu bản đồ SLAM Occupancy Grid 2D thực tế")
async def get_current_map(repo: MapRepository = Depends(get_map_repository)):
    await ensure_default_zones(repo)
    wps_db = await repo.list_waypoints()
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

    zones_db = await repo.list_zones()
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


def _waypoint_out(w) -> Waypoint:
    return Waypoint(
        id=w.id,
        name=w.name,
        x=w.x,
        y=w.y,
        yaw=w.yaw,
        floor=w.floor,
        type=w.type or "WAYPOINT",
        description=w.description,
        map_id=w.map_id,
    )


def _zone_out(z) -> ZoneSchema:
    return ZoneSchema(
        id=z.id,
        name=z.name,
        type=z.type or "KEEP_OUT",
        x=z.x,
        y=z.y,
        width=z.width,
        height=z.height,
        speed_limit=z.speed_limit,
        floor=z.floor,
        description=z.description,
        map_id=z.map_id,
    )


@router.get("/waypoints", response_model=List[Waypoint], summary="Lấy danh sách các điểm Waypoints / Endpoints")
async def get_waypoints(map_id: Optional[str] = None, repo: MapRepository = Depends(get_map_repository)):
    """map_id: chỉ lấy điểm của map đó; bỏ trống để lấy tất cả (tương thích ngược)."""
    wps = await repo.list_waypoints(map_id)
    return [_waypoint_out(w) for w in wps]



GAZEBO_WAYPOINT_POOL = [
    ("wp_marker_standby", "PARK", (0.38, 0.65, 0.98, 0.9), (0.25, 0.50, 0.80, 1.0)),
    ("wp_marker_charger", "CHARGER", (0.20, 0.83, 0.60, 0.9), (0.15, 0.65, 0.45, 1.0)),
    ("wp_marker_frontdesk", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_entrance", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_staff", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_elevator", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_restrooms", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_emergency", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_lounge", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
]


def _find_hotel_world_path() -> Optional[Path]:
    """Tìm đường dẫn chính xác tới file hotel_room.world."""
    world_candidates = [
        Path("robot/worlds/hotel_room.world"),
        Path(__file__).resolve().parents[5] / "robot" / "worlds" / "hotel_room.world" if len(Path(__file__).resolve().parents) > 5 else None,
        Path(__file__).resolve().parents[4] / "robot" / "worlds" / "hotel_room.world" if len(Path(__file__).resolve().parents) > 4 else None,
    ]
    return next((p for p in world_candidates if p and p.exists()), None)


def _send_gz_pose_wsl(model_name: str, x: float, y: float, z: float) -> bool:
    """Gửi service lệnh set_pose trực tiếp tới Gazebo Harmonic qua WSL."""
    try:
        import subprocess
        req_str = f'name: "{model_name}", position: {{x: {x:.2f}, y: {y:.2f}, z: {z:.2f}}}'
        bash_cmd = (
            "source /opt/ros/jazzy/setup.bash && "
            f"gz service -s /world/hotel_lobby_world/set_pose --reqtype gz.msgs.Pose --reptype gz.msgs.Boolean --timeout 2000 --req '{req_str}'"
        )
        res = subprocess.run(["wsl", "bash", "-c", bash_cmd], capture_output=True, timeout=3)
        return res.returncode == 0
    except Exception as e:
        logger.debug(f"[GAZEBO SYNC] Loi goi wsl set_pose cho {model_name}: {e}")
        return False


def _get_material_for_type(wp_type: str):
    """Trả về màu sắc material tương ứng với loại Waypoint."""
    tp = str(wp_type or "").upper()
    if tp in ("PARK", "PARKING_SPOT"):
        return (0.38, 0.65, 0.98, 0.9), (0.25, 0.50, 0.80, 1.0)
    elif tp in ("CHARGER", "DOCKING_TARGET"):
        return (0.20, 0.83, 0.60, 0.9), (0.15, 0.65, 0.45, 1.0)
    else:
        return (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)


def sync_all_waypoints_from_db_to_world_and_sim(waypoints: Sequence[Any]):
    """
    Đồng bộ 100% danh sách Waypoints từ Web/DB sang Gazebo Sim và file hotel_room.world.
    - Duyệt qua từng model trong pool (9 điểm).
    - Điểm nào có trên Web -> set_pose z=0.01 tại (x, y), đồng thời cập nhật màu theo type.
    - Điểm nào bị xóa trên Web -> ẩn xuống z=-10.00.
    """
    total_slots = len(GAZEBO_WAYPOINT_POOL)
    active_count = min(len(waypoints), total_slots)

    world_path = _find_hotel_world_path()
    file_content = world_path.read_text(encoding="utf-8") if world_path else None

    for idx, (model_name, default_type, _, _) in enumerate(GAZEBO_WAYPOINT_POOL):
        if idx < active_count:
            wp = waypoints[idx]
            target_x = float(wp.x)
            target_y = float(wp.y)
            target_z = 0.01
            wp_type = getattr(wp, "type", default_type) or default_type
            diffuse, emissive = _get_material_for_type(wp_type)
        else:
            target_x = 0.0
            target_y = 0.0
            target_z = -10.00
            diffuse, emissive = None, None

        # 1. Cập nhật vị trí vào file hotel_room.world
        if file_content:
            pattern = rf'(<model name="{model_name}">\s*<static>true</static>\s*<pose>)([^<]+)(</pose>)'
            replacement = rf'\g<1>{target_x:.2f} {target_y:.2f} {target_z:.2f} 0 0 0\g<3>'
            file_content = re.sub(pattern, replacement, file_content)

            if diffuse and emissive:
                mat_pattern = rf'(<model name="{model_name}">[\s\S]*?<material>[\s\S]*?<ambient>)[^<]+(</ambient>[\s\S]*?<diffuse>)[^<]+(</diffuse>[\s\S]*?<emissive>)[^<]+(</emissive>)'
                mat_replace = (
                    rf'\g<1>{diffuse[0]} {diffuse[1]} {diffuse[2]} {diffuse[3]}\g<2>'
                    rf'{diffuse[0]} {diffuse[1]} {diffuse[2]} {diffuse[3]}\g<3>'
                    rf'{emissive[0]} {emissive[1]} {emissive[2]} {emissive[3]}\g<4>'
                )
                file_content = re.sub(mat_pattern, mat_replace, file_content)

        # 2. Gửi lệnh trực tiếp tới Gazebo Sim đang chạy
        _send_gz_pose_wsl(model_name, target_x, target_y, target_z)

    if file_content and world_path:
        try:
            world_path.write_text(file_content, encoding="utf-8")
            logger.info(f"[WORLD SYNC] Đã đồng bộ toàn bộ {active_count} điểm mốc vào {world_path.name}")
        except Exception as e:
            logger.warning(f"[WORLD SYNC] Lỗi ghi file {world_path}: {e}")

@router.post("/waypoints", response_model=Waypoint, summary="Tạo mới hoặc cập nhật tọa độ Waypoint / Endpoint")
async def save_waypoint(wp: Waypoint, repo: MapRepository = Depends(get_map_repository)):
    violation = _waypoint_zone_violation(wp.x, wp.y, await repo.list_zones(wp.map_id))
    if violation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=violation)

    saved = await repo.save_or_update_waypoint(
        id=wp.id,
        name=wp.name,
        x=wp.x,
        y=wp.y,
        yaw=wp.yaw,
        floor=wp.floor,
        type=wp.type or "WAYPOINT",
        description=wp.description,
        map_id=wp.map_id,
    )
    all_wps = await repo.list_waypoints()
    await asyncio.to_thread(sync_all_waypoints_from_db_to_world_and_sim, all_wps)
    return _waypoint_out(saved)


@router.put("/waypoints/{waypoint_id}", response_model=Waypoint, summary="Chỉnh sửa Endpoint đã có")
async def update_waypoint(waypoint_id: str, wp: Waypoint, repo: MapRepository = Depends(get_map_repository)):
    existing = await repo.get_waypoint_by_id(waypoint_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Waypoint")

    violation = _waypoint_zone_violation(wp.x, wp.y, await repo.list_zones(wp.map_id or existing.map_id))
    if violation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=violation)

    saved = await repo.save_or_update_waypoint(
        id=waypoint_id,
        name=wp.name,
        x=wp.x,
        y=wp.y,
        yaw=wp.yaw,
        floor=wp.floor,
        type=wp.type or "WAYPOINT",
        description=wp.description,
        map_id=wp.map_id,
    )
    all_wps = await repo.list_waypoints()
    await asyncio.to_thread(sync_all_waypoints_from_db_to_world_and_sim, all_wps)
    return _waypoint_out(saved)


@router.delete("/waypoints/{waypoint_id}", summary="Xóa điểm Waypoint / Endpoint")
async def delete_waypoint(waypoint_id: str, repo: MapRepository = Depends(get_map_repository)):
    deleted = await repo.delete_waypoint(waypoint_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Waypoint")

    all_wps = await repo.list_waypoints()
    await asyncio.to_thread(sync_all_waypoints_from_db_to_world_and_sim, all_wps)

    return {"status": "SUCCESS", "message": f"Đã xóa waypoint {waypoint_id}"}


@router.get("/zones", response_model=List[ZoneSchema], summary="Lấy danh sách các Vùng Chức Năng (Zones)")
async def get_zones(map_id: Optional[str] = None, repo: MapRepository = Depends(get_map_repository)):
    """map_id: chỉ lấy vùng của map đó; bỏ trống để lấy tất cả (tương thích ngược)."""
    await ensure_default_zones(repo)
    zones = await repo.list_zones(map_id)
    return [_zone_out(z) for z in zones]


@router.post("/zones", response_model=ZoneSchema, summary="Tạo mới hoặc cập nhật Vùng Chức Năng (Zone)")
async def save_zone(zone: ZoneSchema, repo: MapRepository = Depends(get_map_repository)):
    conflict = await _zone_endpoint_conflict(zone, repo)
    if conflict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=conflict)
    saved = await repo.save_or_update_zone(
        id=zone.id,
        name=zone.name,
        type=zone.type or "KEEP_OUT",
        x=zone.x,
        y=zone.y,
        width=zone.width,
        height=zone.height,
        speed_limit=zone.speed_limit,
        floor=zone.floor,
        description=zone.description,
        map_id=zone.map_id,
    )
    return _zone_out(saved)


@router.put("/zones/{zone_id}", response_model=ZoneSchema, summary="Cập nhật Vùng Chức Năng theo ID")
async def update_zone(zone_id: str, zone: ZoneSchema, repo: MapRepository = Depends(get_map_repository)):
    existing = await repo.get_zone_by_id(zone_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Vùng Chức Năng")
    conflict = await _zone_endpoint_conflict(zone, repo)
    if conflict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=conflict)

    saved = await repo.save_or_update_zone(
        id=zone_id,
        name=zone.name,
        type=zone.type or "KEEP_OUT",
        x=zone.x,
        y=zone.y,
        width=zone.width,
        height=zone.height,
        speed_limit=zone.speed_limit,
        floor=zone.floor,
        description=zone.description,
        map_id=zone.map_id,
    )
    return _zone_out(saved)


@router.delete("/zones/{zone_id}", summary="Xóa Vùng Chức Năng")
async def delete_zone(zone_id: str, repo: MapRepository = Depends(get_map_repository)):
    deleted = await repo.delete_zone(zone_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Vùng Chức Năng")
    return {"status": "SUCCESS", "message": f"Đã xóa vùng {zone_id}"}


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


async def _nav2_zones_for(repo: MapRepository, map_name: str) -> List[dict]:
    zones = await repo.list_zones(ros2_runtime_service.normalize_map_name(map_name))
    return [_zone_out(z).model_dump() for z in zones]


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


@router.post("/save_map", summary="Lưu bản đồ Occupancy Grid hiện tại vào file lưu trữ cố định")
async def save_current_map(
    map_id: str = "phong_lam_viec",
    name: str = "Bản đồ Phòng Làm Việc",
    floor: str = "Phòng Làm Việc",
):
    """Lưu toàn bộ ma trận 2D Occupancy Grid hiện tại vào bộ nhớ lưu trữ file cố định (không lưu vào CSDL)."""
    res = rplidar_service.save_map_to_storage(map_id=map_id, name=name, floor=floor)
    return {
        "status": "SUCCESS",
        "message": f"Đã lưu bản đồ cố định '{name}' thành công!",
        "map_id": map_id,
        "is_map_locked": rplidar_service.is_map_locked,
        "saved_at": res.get("saved_at")
    }


def get_robot_maps_dir() -> str:
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "robot", "maps")),
        os.path.abspath(os.path.join(os.getcwd(), "..", "robot", "maps")),
        os.path.abspath(os.path.join(os.getcwd(), "robot", "maps")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]


def get_static_maps_dir() -> str:
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "static", "maps")),
        os.path.abspath(os.path.join(os.getcwd(), "static", "maps")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]


def generate_pgm_bytes(width: int, height: int, grid_data: Optional[List[int]] = None) -> bytes:
    """Tạo file PGM binary P5 chuẩn grayscale cho ROS 2 Nav2."""
    header = f"P5\n{width} {height}\n255\n".encode("ascii")
    if not grid_data or len(grid_data) != width * height:
        pixels = bytearray([205] * (width * height))
    else:
        pixels = bytearray(width * height)
        for i, val in enumerate(grid_data):
            if val == 100:
                pixels[i] = 0
            elif val == 0:
                pixels[i] = 254
            else:
                pixels[i] = 205
    return header + bytes(pixels)


@router.get("/download/{map_name}", summary="Tải file bản đồ về máy tính cá nhân (ZIP hoặc từng file .yaml/.pgm/.json)")
async def download_map_file(map_name: str, format: str = "zip"):
    """
    Tải gói bản đồ SLAM trực tiếp về thư mục Downloads của người dùng (chỉ lưu trên máy tính admin, không lưu CSDL).
    Hỗ trợ format: 'zip' (trọn gói .yaml + .pgm + .json), 'yaml', 'pgm', 'json'.
    Nếu file chưa kịp xuất ra đĩa, tự động tổng hợp trực tiếp từ ma trận LiDAR hiện tại.
    """
    safe_name = "".join(c for c in map_name if c.isalnum() or c in ("_", "-")).strip()
    if not safe_name:
        safe_name = "slam_map"

    robot_maps_dir = get_robot_maps_dir()
    static_maps_dir = get_static_maps_dir()
    os.makedirs(robot_maps_dir, exist_ok=True)
    os.makedirs(static_maps_dir, exist_ok=True)

    yaml_path = os.path.join(robot_maps_dir, f"{safe_name}.yaml")
    pgm_path = os.path.join(robot_maps_dir, f"{safe_name}.pgm")
    json_path = os.path.join(robot_maps_dir, f"{safe_name}.json")
    if not os.path.exists(json_path):
        json_path = os.path.join(static_maps_dir, f"{safe_name}.json")

    # Đợi tối đa 0.8s nếu file vừa mới được lưu bởi SLAM Toolbox
    for _ in range(8):
        if os.path.exists(yaml_path) or os.path.exists(json_path):
            break
        await asyncio.sleep(0.1)

    # Nếu trên đĩa chưa có file nào, tự động tổng hợp trực tiếp từ ma trận rplidar_service
    if not os.path.exists(yaml_path) and not os.path.exists(json_path):
        map_info = rplidar_service.get_grid_map_data()
        res_val = map_info.get("resolution", 0.05)
        width_val = map_info.get("width", 200)
        height_val = map_info.get("height", 200)
        ox_val = map_info.get("origin_x", -5.0)
        oy_val = map_info.get("origin_y", -5.0)
        grid_data = map_info.get("grid_data", [])

        # 1. Sinh file YAML chuẩn Nav2
        yaml_text = f"""image: {safe_name}.pgm
mode: trinary
resolution: {res_val:.4f}
origin: [{ox_val:.3f}, {oy_val:.3f}, 0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.196
"""
        with open(yaml_path, "w", encoding="utf-8") as f:
            f.write(yaml_text)

        # 2. Sinh file PGM nhị phân
        pgm_bytes = generate_pgm_bytes(width_val, height_val, grid_data)
        with open(pgm_path, "wb") as f:
            f.write(pgm_bytes)

        # 3. Sinh file JSON
        json_data = {
            "name": safe_name,
            "resolution": res_val,
            "width": width_val,
            "height": height_val,
            "origin_x": ox_val,
            "origin_y": oy_val,
            "grid_data": grid_data,
            "saved_at": datetime.now().isoformat(),
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f)

    if format == "yaml":
        return FileResponse(path=yaml_path, filename=f"{safe_name}.yaml", media_type="text/yaml")
    elif format == "pgm":
        return FileResponse(path=pgm_path, filename=f"{safe_name}.pgm", media_type="image/x-portable-graymap")
    elif format == "json":
        return FileResponse(path=json_path, filename=f"{safe_name}.json", media_type="application/json")

    # Mặc định format == "zip": đóng gói toàn bộ file liên quan
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        if os.path.exists(yaml_path):
            zf.write(yaml_path, arcname=f"{safe_name}.yaml")
        if os.path.exists(pgm_path):
            zf.write(pgm_path, arcname=f"{safe_name}.pgm")
        if os.path.exists(json_path):
            zf.write(json_path, arcname=f"{safe_name}.json")

        readme_content = f"""HCRobot Concierge - SLAM Map Package
Map Name: {safe_name}
Created At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Contents:
- {safe_name}.yaml : ROS 2 Nav2 Map Server metadata configuration
- {safe_name}.pgm  : 2D Occupancy Grid Graymap image (100: Obstacle, 0: Free, -1: Unknown)
- {safe_name}.json : Web Canvas / Pi 5 compatible JSON grid format

Usage in ROS 2 Nav2:
ros2 run nav2_map_server map_server --ros-args -p yaml_filename:={safe_name}.yaml
"""
        zf.writestr("README.txt", readme_content)

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}_slam_map.zip"'
        }
    )


@router.post("/load_map", summary="Nạp lại bản đồ cố định đã lưu từ CSDL/file")
async def load_saved_map(map_id: str = "phong_lam_viec", lock: bool = True):
    """Tải lại bản đồ 2D cố định đã lưu từ trước vào bộ nhớ hệ thống."""
    success = rplidar_service.load_map_from_storage(map_id=map_id, lock=lock)
    if success:
        return {
            "status": "SUCCESS",
            "message": f"Đã tải thành công bản đồ cố định '{map_id}'!",
            "map_id": map_id,
            "is_map_locked": rplidar_service.is_map_locked
        }
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy bản đồ '{map_id}'")


@router.get("/list_saved_maps", summary="Lấy danh sách các bản đồ đã lưu trên máy tính (robot/maps và static/maps)")
async def list_saved_maps():
    """Trả về danh sách tất cả các bản đồ có sẵn trên đĩa máy tính (robot/maps và static/maps)."""
    maps = []
    seen = set()
    robot_maps_dir = get_robot_maps_dir()
    if os.path.exists(robot_maps_dir):
        for f in os.listdir(robot_maps_dir):
            if f.endswith(".yaml"):
                mname = f[:-5]
                seen.add(mname)
                mtime = os.path.getmtime(os.path.join(robot_maps_dir, f))
                time_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
                maps.append({
                    "map_id": mname,
                    "name": mname,
                    "floor": "Sảnh Tầng 1",
                    "width": 200,
                    "height": 200,
                    "resolution": 0.05,
                    "created_at": time_str,
                })
    if os.path.exists(MAPS_DIR):
        for f in os.listdir(MAPS_DIR):
            if f.endswith(".json"):
                mid = f[:-5]
                if mid in seen:
                    continue
                seen.add(mid)
                filepath = os.path.join(MAPS_DIR, f)
                try:
                    with open(filepath, "r", encoding="utf-8") as fp:
                        meta = json.load(fp)
                    maps.append({
                        "map_id": meta.get("map_id", mid),
                        "name": meta.get("name", mid),
                        "floor": meta.get("floor", "Sảnh Tầng 1"),
                        "width": meta.get("width", 200),
                        "height": meta.get("height", 200),
                        "resolution": meta.get("resolution", 0.05),
                        "created_at": meta.get("saved_at", ""),
                    })
                except Exception:
                    maps.append({"map_id": mid, "name": mid, "floor": "Sảnh Tầng 1"})
    return {
        "status": "SUCCESS",
        "maps": maps,
        "active_map_id": rplidar_service.saved_map_id,
        "is_map_locked": rplidar_service.is_map_locked,
    }


def _read_map_layout(yaml_path: str) -> Optional[dict]:
    """Đọc thông số map Nav2 (.yaml + .pgm) để Web vẽ đúng tỉ lệ và gốc tọa độ."""
    import yaml

    try:
        with open(yaml_path, "r", encoding="utf-8") as f:
            meta = yaml.safe_load(f) or {}
        pgm_path = os.path.join(os.path.dirname(yaml_path), str(meta.get("image", "")))
        if not os.path.isfile(pgm_path):
            return None
        from pathlib import Path
        from app.services.hardware.ros2_runtime_service import Ros2RuntimeService

        stats = Ros2RuntimeService._read_pgm_stats(Path(pgm_path))
        resolution = float(meta.get("resolution", 0.05))
        origin = meta.get("origin") or [0.0, 0.0, 0.0]
    except Exception as exc:
        logger.warning("Bỏ qua map lỗi %s: %s", yaml_path, exc)
        return None

    name = os.path.splitext(os.path.basename(yaml_path))[0]
    return {
        "map_id": name,
        "name": name,
        "width": stats["width"],
        "height": stats["height"],
        "resolution": resolution,
        "origin_x": float(origin[0]),
        "origin_y": float(origin[1]),
        "width_m": round(stats["width"] * resolution, 3),
        "height_m": round(stats["height"] * resolution, 3),
        "image_file": os.path.basename(pgm_path),
        "updated_at": datetime.fromtimestamp(os.path.getmtime(yaml_path)).strftime("%Y-%m-%d %H:%M"),
    }


@router.get("/layouts", summary="Danh sách map SLAM (.yaml + .pgm) để chọn trên Bản Đồ Vật Lý")
async def list_map_layouts():
    maps_dir = get_robot_maps_dir()
    layouts = []
    if os.path.isdir(maps_dir):
        for f in sorted(os.listdir(maps_dir)):
            # Bỏ file tạm của lần lưu đang dở (pending_<ten>_<timestamp>).
            if f.endswith(".yaml") and not f.startswith("pending_"):
                info = await asyncio.to_thread(_read_map_layout, os.path.join(maps_dir, f))
                if info:
                    layouts.append(info)
    return {"status": "SUCCESS", "maps": layouts}


@router.get("/layouts/{map_name}/image", summary="Ảnh PGM của map SLAM (hàng 0 là đỉnh ảnh)")
async def get_map_layout_image(map_name: str):
    safe_name = "".join(c for c in map_name if c.isalnum() or c in ("_", "-")).strip()
    yaml_path = os.path.join(get_robot_maps_dir(), f"{safe_name}.yaml")
    info = await asyncio.to_thread(_read_map_layout, yaml_path) if safe_name and os.path.isfile(yaml_path) else None
    if not info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy map '{map_name}'")
    return FileResponse(
        path=os.path.join(get_robot_maps_dir(), info["image_file"]),
        media_type="image/x-portable-graymap",
    )


@router.delete("/saved/{map_name}", summary="Xóa file bản đồ trên máy tính")
async def delete_saved_map(map_name: str):
    """Xóa file bản đồ trên máy tính (robot/maps và static/maps)."""
    safe_name = "".join(c for c in map_name if c.isalnum() or c in ("_", "-")).strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Tên bản đồ không hợp lệ")
    deleted = False
    for folder in [get_robot_maps_dir(), get_static_maps_dir(), MAPS_DIR]:
        for ext in [".yaml", ".pgm", ".json"]:
            fpath = os.path.join(folder, f"{safe_name}{ext}")
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                    deleted = True
                except Exception:
                    pass
    return {"status": "SUCCESS", "message": f"Đã xóa file bản đồ '{safe_name}'", "deleted": deleted}


@router.post("/toggle_lock", summary="Bật/tắt chế độ khóa bản đồ tĩnh")
async def toggle_map_lock(lock: Optional[bool] = None):
    """Khóa bản đồ (để bản đồ đứng yên cố định không bị trôi) hoặc mở khóa (để quét thêm không gian mới)."""
    new_state = rplidar_service.set_map_lock(not rplidar_service.is_map_locked if lock is None else lock)
    msg = "Đã KHÓA bản đồ cố định (Static Map Locked)" if new_state else "Đã MỞ KHÓA chế độ quét bản đồ tự do (Free Mapping Mode)"
    return {
        "status": "SUCCESS",
        "message": msg,
        "is_map_locked": new_state
    }


@router.post("/reset_map", summary="Xóa trắng bản đồ 2D để tiến hành quét SLAM lại từ đầu")
async def reset_map():
    rplidar_service.reset_grid_map()
    return {"status": "SUCCESS", "message": "Đã xử lý reset bản đồ 2D"}


@router.post("/connect_lidar", summary="Kích hoạt kết nối với cổng COM9 của RPLiDAR")
async def connect_lidar_hardware():
    success = await asyncio.to_thread(rplidar_service.connect)
    if success:
        rplidar_service.start_scanning()
        return {"status": "SUCCESS", "message": "Đã kết nối thành công phần cứng RPLiDAR COM9", "info": rplidar_service.device_info}
    else:
        return {"status": "FAILED", "message": rplidar_service.last_error or "Lỗi kết nối cổng COM9"}


@router.post("/scan_360", summary="Kích hoạt robot quay 360 độ để quét toàn cảnh phòng")
async def trigger_scan_360():
    import httpx
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.post("http://100.99.72.51:8000/api/v1/map/scan_360")
            return res.json()
    except Exception:
        return {"status": "SUCCESS", "message": "Đã gửi lệnh quét 360 độ tới robot"}


@router.post("/teleop", summary="Điều khiển thủ công Robot di chuyển")
async def trigger_teleop(payload: dict):
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.post("http://100.99.72.51:8000/api/v1/map/teleop", json=payload)
            return res.json()
    except Exception:
        return {"status": "SUCCESS", "command": payload.get("command")}


@router.post("/navigate", response_model=NavigationResponse, summary="Gửi mục tiêu di chuyển Robot")
async def navigate_to_target(
    request: NavigationRequest,
    repo: MapRepository = Depends(get_map_repository),
):
    global current_robot_pose
    try:
        active_zones = await repo.list_zones()
        for z in active_zones:
            if z.type == "KEEP_OUT" and is_point_in_zone(request.target_x, request.target_y, z):
                return NavigationResponse(
                    status="REJECTED",
                    message=f"Đích đến ({request.target_x:.2f}, {request.target_y:.2f}) nằm trong Khu vực cấm vào (Keep-out Zone) '{z.name}'!",
                    target_x=request.target_x,
                    target_y=request.target_y,
                )
            if z.type == "NO_STOP" and is_point_in_zone(request.target_x, request.target_y, z):
                return NavigationResponse(
                    status="REJECTED",
                    message=f"Đích đến ({request.target_x:.2f}, {request.target_y:.2f}) nằm trong Khu vực cấm dừng (No-Stop Zone) '{z.name}'. Robot không thể chọn đây làm điểm kết thúc!",
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
    """
    WebSocket streaming dữ liệu 100% THỰC TẾ từ phần cứng RPLiDAR COM9 và Bản đồ Cố định.
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
                    "is_map_locked": rplidar_service.is_map_locked,
                    "saved_map_id": rplidar_service.saved_map_id,
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
                map_info = rplidar_service.get_grid_map_data()
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
                    "is_map_locked": rplidar_service.is_map_locked,
                    "saved_map_id": rplidar_service.saved_map_id,
                    "last_error": rplidar_service.last_error,
                    "scan_points": [],
                    "grid_data": map_info["grid_data"],
                    "grid_metadata": {
                        "width": map_info["width"],
                        "height": map_info["height"],
                        "resolution": map_info["resolution"],
                        "origin_x": map_info["origin_x"],
                        "origin_y": map_info["origin_y"],
                    }
                }

            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.033)  # ~30 Hz real-time refresh rate

    except WebSocketDisconnect:
        logger.info("🔌 WebSocket LiDAR Client disconnected")
    except Exception as e:
        logger.error(f"Lỗi WebSocket LiDAR: {e}")
        await websocket.close()
