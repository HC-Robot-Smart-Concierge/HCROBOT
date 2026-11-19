"""Waypoints and functional zones CRUD routes plus zone conflict validation helpers."""

import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.repositories import MapRepository, get_map_repository
from app.schemas.map import Waypoint, ZoneSchema
from app.services.zone_geometry import point_in_zone

from .map_world_sync import ensure_default_zones, sync_all_waypoints_from_db_to_world_and_sim

router = APIRouter()

# Vung khong duoc co endpoint ben trong (cung luat voi Web: physicalMapZones.js).
# NO_STOP: robot chi duoc di ngang qua, moi endpoint deu la cho dung => cam moi loai endpoint.
NO_ENDPOINT_ZONE_TYPES = ("KEEP_OUT", "NO_STOP")


def is_point_in_zone(px: float, py: float, z) -> bool:
    """Delegate point-in-zone check to the shared geometry helper."""
    return point_in_zone(px, py, z)


def _waypoint_zone_violation(x: float, y: float, zones) -> Optional[str]:
    for z in zones:
        if z.type == "KEEP_OUT" and is_point_in_zone(x, y, z):
            return f"Tọa độ ({x:.2f}, {y:.2f}) nằm trong Khu vực cấm vào (Keep-out Zone) '{z.name}'!"
        if z.type == "NO_STOP" and is_point_in_zone(x, y, z):
            return (
                f"Tọa độ ({x:.2f}, {y:.2f}) nằm trong Khu vực cấm dừng (No-Stop Zone) '{z.name}': "
                "robot chỉ được đi ngang qua, không thể đặt endpoint/điểm dừng tại đây!"
            )
    return None


async def _zone_endpoint_conflict(zone: ZoneSchema, repo: MapRepository) -> Optional[str]:
    """Vung cam dung/cam vao de len endpoint co san cua CUNG map => ly do tu choi (bat xoa truoc)."""
    if (zone.type or "KEEP_OUT") not in NO_ENDPOINT_ZONE_TYPES or not zone.map_id:
        return None  # khong ro map (du lieu cu) thi khong doan endpoint cua map nao
    waypoints = await repo.list_waypoints(zone.map_id)
    covered = [w for w in waypoints if is_point_in_zone(w.x, w.y, zone)]
    if not covered:
        return None
    kind = "cấm dừng" if zone.type == "NO_STOP" else "cấm vào"
    names = ", ".join(f"'{w.name or w.id}'" for w in covered)
    return (
        f"Không thể đặt vùng {kind} '{zone.name}' đè lên endpoint {names}. "
        "Hãy xóa endpoint đó trước, rồi vẽ lại vùng."
    )


def _waypoint_out(w, *, include_map_id: bool = True) -> Waypoint:
    extra = {"map_id": w.map_id} if include_map_id else {}
    return Waypoint(
        id=w.id,
        name=w.name,
        x=w.x,
        y=w.y,
        yaw=w.yaw,
        floor=w.floor,
        type=w.type or "WAYPOINT",
        description=w.description,
        **extra,
    )


def _zone_out(z, *, include_map_id: bool = True) -> ZoneSchema:
    extra = {"map_id": z.map_id} if include_map_id else {}
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
        **extra,
    )


async def _save_waypoint_and_sync(
    waypoint_id: str,
    wp: Waypoint,
    zones_map_id: Optional[str],
    repo: MapRepository,
) -> Waypoint:
    violation = _waypoint_zone_violation(wp.x, wp.y, await repo.list_zones(zones_map_id))
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


async def _save_zone_record(zone_id: str, zone: ZoneSchema, repo: MapRepository) -> ZoneSchema:
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


@router.get("/waypoints", response_model=List[Waypoint], summary="Lấy danh sách các điểm Waypoints / Endpoints")
async def get_waypoints(map_id: Optional[str] = None, repo: MapRepository = Depends(get_map_repository)):
    """map_id: chỉ lấy điểm của map đó; bỏ trống để lấy tất cả (tương thích ngược)."""
    wps = await repo.list_waypoints(map_id)
    return [_waypoint_out(w) for w in wps]


@router.post("/waypoints", response_model=Waypoint, summary="Tạo mới hoặc cập nhật tọa độ Waypoint / Endpoint")
async def save_waypoint(wp: Waypoint, repo: MapRepository = Depends(get_map_repository)):
    return await _save_waypoint_and_sync(wp.id, wp, wp.map_id, repo)


@router.put("/waypoints/{waypoint_id}", response_model=Waypoint, summary="Chỉnh sửa Endpoint đã có")
async def update_waypoint(waypoint_id: str, wp: Waypoint, repo: MapRepository = Depends(get_map_repository)):
    existing = await repo.get_waypoint_by_id(waypoint_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Waypoint")
    return await _save_waypoint_and_sync(waypoint_id, wp, wp.map_id or existing.map_id, repo)


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
    return await _save_zone_record(zone.id, zone, repo)


@router.put("/zones/{zone_id}", response_model=ZoneSchema, summary="Cập nhật Vùng Chức Năng theo ID")
async def update_zone(zone_id: str, zone: ZoneSchema, repo: MapRepository = Depends(get_map_repository)):
    existing = await repo.get_zone_by_id(zone_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Vùng Chức Năng")
    return await _save_zone_record(zone_id, zone, repo)


@router.delete("/zones/{zone_id}", summary="Xóa Vùng Chức Năng")
async def delete_zone(zone_id: str, repo: MapRepository = Depends(get_map_repository)):
    deleted = await repo.delete_zone(zone_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Vùng Chức Năng")
    return {"status": "SUCCESS", "message": f"Đã xóa vùng {zone_id}"}
