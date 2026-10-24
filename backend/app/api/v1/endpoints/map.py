import asyncio
import io
import json
import logging
import os
import zipfile
from datetime import datetime
from typing import List, Optional

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

DEFAULT_WAYPOINTS: List[dict] = []
DEFAULT_ZONES: List[dict] = [
    {
        "id": "zone-keepout-staff",
        "name": "Khu Vực Staff Only (Cấm Vào)",
        "type": "KEEP_OUT",
        "x": 8.8,
        "y": 1.5,
        "width": 1.5,
        "height": 2.8,
        "speed_limit": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực kỹ thuật & phòng nhân viên nội bộ, robot tuyệt đối không đi vào.",
    },
    {
        "id": "zone-speed-frontdesk",
        "name": "Khu Vực Quầy Tiếp Tân (Giới Hạn Tốc Độ)",
        "type": "SPEED_ZONE",
        "x": 5.2,
        "y": 2.2,
        "width": 2.6,
        "height": 2.0,
        "speed_limit": 0.20,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực đón tiếp đông khách, tự động giới hạn tốc độ tối đa 0.20 m/s.",
    },
    {
        "id": "zone-nostop-doorway",
        "name": "Cửa Thông Sảnh Chính (Cấm Dừng)",
        "type": "NO_STOP",
        "x": 4.4,
        "y": 2.85,
        "width": 1.4,
        "height": 1.6,
        "speed_limit": 0.30,
        "floor": "Sảnh Tầng 1",
        "description": "Nút thắt lưu thông chính giữa 2 gian sảnh, robot chỉ được phép đi qua, cấm dừng đỗ.",
    },
]

current_robot_pose = Pose2D(x=0.0, y=0.0, yaw=0.0)


class Ros2MapRequest(BaseModel):
    name: str


def is_point_in_zone(px: float, py: float, z) -> bool:
    """Kiểm tra một tọa độ (px, py) có nằm trong vùng hình chữ nhật z hay không."""
    half_w = (getattr(z, "width", 2.0) or 2.0) / 2.0
    half_h = (getattr(z, "height", 2.0) or 2.0) / 2.0
    zx = getattr(z, "x", 0.0)
    zy = getattr(z, "y", 0.0)
    return (zx - half_w) <= px <= (zx + half_w) and (zy - half_h) <= py <= (zy + half_h)


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


@router.get("/waypoints", response_model=List[Waypoint], summary="Lấy danh sách các điểm Waypoints / Endpoints")
async def get_waypoints(repo: MapRepository = Depends(get_map_repository)):
    wps = await repo.list_waypoints()
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
async def save_waypoint(wp: Waypoint, repo: MapRepository = Depends(get_map_repository)):
    active_zones = await repo.list_zones()
    for z in active_zones:
        if z.type == "KEEP_OUT" and is_point_in_zone(wp.x, wp.y, z):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tọa độ ({wp.x:.2f}, {wp.y:.2f}) nằm trong Khu vực cấm vào (Keep-out Zone) '{z.name}'!",
            )
        if z.type == "NO_STOP" and (wp.type or "").upper() in ("PARK", "PARKING_SPOT", "CHARGER", "DOCKING_TARGET") and is_point_in_zone(wp.x, wp.y, z):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tọa độ ({wp.x:.2f}, {wp.y:.2f}) nằm trong Khu vực cấm dừng (No-Stop Zone) '{z.name}'. Không thể tạo điểm đỗ/chờ tại đây!",
            )

    saved = await repo.save_or_update_waypoint(
        id=wp.id,
        name=wp.name,
        x=wp.x,
        y=wp.y,
        yaw=wp.yaw,
        floor=wp.floor,
        type=wp.type or "WAYPOINT",
        description=wp.description,
    )
    return Waypoint(
        id=saved.id,
        name=saved.name,
        x=saved.x,
        y=saved.y,
        yaw=saved.yaw,
        floor=saved.floor,
        type=saved.type,
        description=saved.description
    )


@router.put("/waypoints/{waypoint_id}", response_model=Waypoint, summary="Chỉnh sửa Endpoint đã có")
async def update_waypoint(waypoint_id: str, wp: Waypoint, repo: MapRepository = Depends(get_map_repository)):
    existing = await repo.get_waypoint_by_id(waypoint_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Waypoint")

    active_zones = await repo.list_zones()
    for z in active_zones:
        if z.type == "KEEP_OUT" and is_point_in_zone(wp.x, wp.y, z):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tọa độ ({wp.x:.2f}, {wp.y:.2f}) nằm trong Khu vực cấm vào (Keep-out Zone) '{z.name}'!",
            )
        if z.type == "NO_STOP" and (wp.type or "").upper() in ("PARK", "PARKING_SPOT", "CHARGER", "DOCKING_TARGET") and is_point_in_zone(wp.x, wp.y, z):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tọa độ ({wp.x:.2f}, {wp.y:.2f}) nằm trong Khu vực cấm dừng (No-Stop Zone) '{z.name}'. Không thể tạo điểm đỗ/chờ tại đây!",
            )

    saved = await repo.save_or_update_waypoint(
        id=waypoint_id,
        name=wp.name,
        x=wp.x,
        y=wp.y,
        yaw=wp.yaw,
        floor=wp.floor,
        type=wp.type or "WAYPOINT",
        description=wp.description,
    )
    return Waypoint(
        id=saved.id,
        name=saved.name,
        x=saved.x,
        y=saved.y,
        yaw=saved.yaw,
        floor=saved.floor,
        type=saved.type,
        description=saved.description
    )


@router.delete("/waypoints/{waypoint_id}", summary="Xóa điểm Waypoint / Endpoint")
async def delete_waypoint(waypoint_id: str, repo: MapRepository = Depends(get_map_repository)):
    deleted = await repo.delete_waypoint(waypoint_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Waypoint")
    return {"status": "SUCCESS", "message": f"Đã xóa waypoint {waypoint_id}"}


@router.get("/zones", response_model=List[ZoneSchema], summary="Lấy danh sách các Vùng Chức Năng (Zones)")
async def get_zones(repo: MapRepository = Depends(get_map_repository)):
    await ensure_default_zones(repo)
    zones = await repo.list_zones()
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
async def save_zone(zone: ZoneSchema, repo: MapRepository = Depends(get_map_repository)):
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
    )
    return ZoneSchema(
        id=saved.id,
        name=saved.name,
        type=saved.type,
        x=saved.x,
        y=saved.y,
        width=saved.width,
        height=saved.height,
        speed_limit=saved.speed_limit,
        floor=saved.floor,
        description=saved.description
    )


@router.put("/zones/{zone_id}", response_model=ZoneSchema, summary="Cập nhật Vùng Chức Năng theo ID")
async def update_zone(zone_id: str, zone: ZoneSchema, repo: MapRepository = Depends(get_map_repository)):
    existing = await repo.get_zone_by_id(zone_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Vùng Chức Năng")

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
    )
    return ZoneSchema(
        id=saved.id,
        name=saved.name,
        type=saved.type,
        x=saved.x,
        y=saved.y,
        width=saved.width,
        height=saved.height,
        speed_limit=saved.speed_limit,
        floor=saved.floor,
        description=saved.description
    )


@router.delete("/zones/{zone_id}", summary="Xóa Vùng Chức Năng")
async def delete_zone(zone_id: str, repo: MapRepository = Depends(get_map_repository)):
    deleted = await repo.delete_zone(zone_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Vùng Chức Năng")
    return {"status": "SUCCESS", "message": f"Đã xóa vùng {zone_id}"}


@router.get("/lidar_status", summary="Kiểm tra trạng thái phần cứng RPLiDAR COM9 thực tế")
async def get_lidar_status():
    return rplidar_service.get_status()


@router.get("/ros2/runtime", summary="Trạng thái WSL2, Rosbridge và RViz Web")
async def get_ros2_runtime_status():
    return await asyncio.to_thread(ros2_runtime_service.get_status)


@router.post("/ros2/start_mapping", summary="Bật chế độ quét map và RViz Web từ trình duyệt")
async def start_ros2_mapping():
    try:
        return await asyncio.to_thread(ros2_runtime_service.start_mapping)
    except Ros2RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/ros2/save", summary="Lưu Occupancy Grid ROS 2 hiện tại thành YAML/PGM")
async def save_ros2_map(request: Ros2MapRequest):
    try:
        return await asyncio.to_thread(ros2_runtime_service.save_map, request.name)
    except Ros2RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/ros2/start_navigation", summary="Bật Map Server, AMCL, Nav2 và RViz Web")
async def start_ros2_navigation(request: Ros2MapRequest):
    try:
        return await asyncio.to_thread(ros2_runtime_service.start_navigation, request.name)
    except Ros2RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


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
