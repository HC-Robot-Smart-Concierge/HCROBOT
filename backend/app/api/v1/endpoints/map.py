import asyncio
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.repositories import MapRepository, get_map_repository
from app.schemas.map import (
    MapMetaData,
    OccupancyGridResponse,
    Waypoint,
    ZoneSchema,
)
from app.services.hardware.rplidar_service import rplidar_service
from app.services.hardware.ros2_runtime_service import (
    Ros2RuntimeError,
    ros2_runtime_service,
)
from .map_defaults_gazebo import (
    DEFAULT_WAYPOINTS,
    DEFAULT_ZONES,
    GAZEBO_WAYPOINT_POOL,
    NO_ENDPOINT_ZONE_TYPES,
    Ros2ExploreRequest,
    Ros2MapRequest,
    _find_hotel_world_path,
    _get_material_for_type,
    _send_gz_pose_wsl,
    _waypoint_zone_violation,
    _zone_endpoint_conflict,
    current_robot_pose,
    ensure_default_waypoints,
    ensure_default_zones,
    is_point_in_zone,
    sync_all_waypoints_from_db_to_world_and_sim,
)
from .map_files_router import (
    _read_map_layout,
    delete_saved_map,
    download_map_file,
    generate_pgm_bytes,
    get_map_layout_image,
    get_robot_maps_dir,
    get_static_maps_dir,
    list_map_layouts,
    list_saved_maps,
    load_saved_map,
    router as map_files_router,
)
from .map_hardware_ws import (
    connect_lidar_hardware,
    map_websocket_endpoint,
    navigate_to_target,
    reset_map,
    router as map_hardware_ws_router,
    toggle_map_lock,
    trigger_scan_360,
    trigger_teleop,
)

logger = logging.getLogger(__name__)
router = APIRouter()

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
            yaw=getattr(z, "yaw", 0.0) or 0.0,
            vertices=getattr(z, "vertices", None),
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
        yaw=getattr(z, "yaw", 0.0) or 0.0,
        vertices=getattr(z, "vertices", None),
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
        yaw=zone.yaw,
        vertices=[p.model_dump() for p in zone.vertices] if zone.vertices is not None else None,
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
        yaw=zone.yaw,
        vertices=[p.model_dump() for p in zone.vertices] if zone.vertices is not None else None,
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


router.include_router(map_files_router)
router.include_router(map_hardware_ws_router)
