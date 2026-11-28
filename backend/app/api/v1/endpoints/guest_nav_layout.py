"""Layout 2D chỉ đường cho khách, vẽ chồng lên map Nav2 (toạ độ mét, frame map).

Đọc: công khai (màn hình robot). Ghi/xoá: chỉ Admin (kiểm tra ở server).
Không đọc/ghi bảng waypoint, zone hay file map của robot.
"""
import json
import math
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.models.guest_nav_layout import GuestNavLayout

router = APIRouter()

OBJECT_TYPES = {
    "room", "elevator", "stairs", "escalator", "door", "wc_male", "wc_female", "wc",
    "exit", "charger", "reception", "table_rect", "table_round", "chair", "sofa_l",
    "counter_l", "plant", "label", "destination",
    "pool", "gym", "spa_icon", "bar_icon", "coffee", "karaoke", "shop", "kitchen", "warehouse", "locker", "bed", "parking", "car", "motorbike", "double_door",
}
MAX_OBJECTS = 800
MAX_WALLS = 400
MAX_WALL_POINTS = 200
MAP_ID_RE = re.compile(r"^[\w\-. ]{1,100}$", re.UNICODE)


def _finite(v: float) -> float:
    if not math.isfinite(v):
        raise ValueError("toạ độ không hợp lệ")
    return v


class Wall(BaseModel):
    id: str = Field(max_length=60)
    points: List[List[float]]
    thickness: float = Field(default=0.08, gt=0, le=1)

    @field_validator("points")
    @classmethod
    def _pts(cls, pts):
        if not 2 <= len(pts) <= MAX_WALL_POINTS or any(len(p) != 2 for p in pts):
            raise ValueError("tường cần 2..200 điểm [x, y]")
        for p in pts:
            _finite(p[0]); _finite(p[1])
        return pts


class LayoutObject(BaseModel):
    id: str = Field(max_length=60)
    type: str
    x: float
    y: float
    w: float = Field(default=0.4, gt=0, le=100)
    h: float = Field(default=0.4, gt=0, le=100)
    rotation: float = 0
    flip: bool = False
    label: Optional[str] = Field(default=None, max_length=80)
    # Mã điểm đến có sẵn (vd: room_301, spa) cho ký hiệu "destination"
    destKey: Optional[str] = Field(default=None, max_length=60, pattern=r"^[A-Za-z0-9_]+$")

    @field_validator("type")
    @classmethod
    def _type(cls, v):
        if v not in OBJECT_TYPES:
            raise ValueError(f"loại không hỗ trợ: {v}")
        return v

    @field_validator("x", "y", "rotation")
    @classmethod
    def _num(cls, v):
        return _finite(v)


class LayoutPayload(BaseModel):
    version: int = 1
    # Kích thước tầng (mét) cho tầng khách sạn không có map Nav2 (khoá "floor-<id>")
    width: Optional[float] = Field(default=None, gt=0, le=500)
    height: Optional[float] = Field(default=None, gt=0, le=500)
    # Ô nền map Nav2 bị Admin "tẩy" (chỉ ảnh hưởng hiển thị, chỉ số ô = y * width + x)
    erased: List[int] = Field(default_factory=list, max_length=200_000)
    # Bản hiển thị cho trang QR (map.html): SVG đã quy về khung 1840x1174 + đường tính sẵn.
    # Do editor tạo lúc lưu; chỉ để hiển thị, không ảnh hưởng robot.
    guestView: Optional[Dict[str, Any]] = None

    @field_validator("guestView")
    @classmethod
    def _guest_view(cls, v):
        if v is not None and len(json.dumps(v)) > 2_000_000:
            raise ValueError("guestView quá lớn (> 2 MB)")
        return v
    walls: List[Wall] = Field(default_factory=list, max_length=MAX_WALLS)
    objects: List[LayoutObject] = Field(default_factory=list, max_length=MAX_OBJECTS)


def _require_admin(current_user=Depends(get_current_user)):
    if getattr(current_user, "default_dashboard", None) != "admin_portal":
        raise HTTPException(status_code=403, detail="Chỉ Admin được sửa layout chỉ đường")
    return current_user


def _check_map_id(map_id: str) -> str:
    if not MAP_ID_RE.match(map_id or ""):
        raise HTTPException(status_code=400, detail="map_id không hợp lệ")
    return map_id


def _serialize(row: GuestNavLayout) -> Dict[str, Any]:
    return {
        "mapId": row.map_id,
        **(row.layout or {}),
        "updatedBy": row.updated_by,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/layouts/{map_id}", summary="Layout chỉ đường của 1 map Nav2 (công khai cho robot)")
async def get_layout(map_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(GuestNavLayout, _check_map_id(map_id))
    if not row:
        raise HTTPException(status_code=404, detail="Map này chưa có layout chỉ đường")
    return _serialize(row)


@router.put("/layouts/{map_id}", summary="Lưu layout chỉ đường cho 1 map Nav2 (Admin)")
async def save_layout(
    map_id: str,
    payload: LayoutPayload,
    db: AsyncSession = Depends(get_db),
    admin=Depends(_require_admin),
):
    row = await db.get(GuestNavLayout, _check_map_id(map_id))
    if row is None:
        row = GuestNavLayout(map_id=map_id)
        db.add(row)
    row.layout = payload.model_dump()
    row.updated_by = getattr(admin, "full_name", None) or getattr(admin, "username", None)
    row.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)
    return _serialize(row)


@router.delete("/layouts/{map_id}", summary="Xoá layout chỉ đường, màn hình khách quay về map Nav2 (Admin)")
async def delete_layout(map_id: str, db: AsyncSession = Depends(get_db), admin=Depends(_require_admin)):
    row = await db.get(GuestNavLayout, _check_map_id(map_id))
    if row:
        await db.delete(row)
        await db.commit()
    return {"mapId": map_id, "deleted": bool(row)}
