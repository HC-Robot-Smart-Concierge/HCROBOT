from datetime import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import hash_password
from app.models import Staff
from app.schemas.operations import (
    StaffResponse,
    StaffCreate,
    StaffUpdate,
)
from .shared import TAG_OPS, TAG_STAFF

router = APIRouter()


@router.get("/fleet", response_model=List[dict], tags=TAG_OPS, summary="Danh sách trạng thái đội Robot HCRobot")
async def get_robot_fleet():
    """Returns status of all active HCRobot autonomous units."""
    return []


@router.get("/staff", response_model=List[StaffResponse], tags=TAG_STAFF, summary="Lấy danh sách toàn bộ nhân viên")
async def list_staff(
    department: Optional[str] = None,
    status: Optional[str] = None,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Trả về danh sách nhân viên, có thể filter theo department, status và include_inactive."""
    query = select(Staff)
    if not include_inactive:
        query = query.where(Staff.is_active == True, Staff.status != "deleted", Staff.status != "inactive")
    if department and department not in ("All", ""):
        query = query.where(Staff.department == department)
    if status and status not in ("All", ""):
        query = query.where(Staff.status == status)
    query = query.order_by(Staff.department, Staff.full_name)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/staff", response_model=StaffResponse, status_code=status.HTTP_201_CREATED, tags=TAG_STAFF, summary="Thêm nhân viên mới")
async def create_staff(
    staff_in: StaffCreate,
    db: AsyncSession = Depends(get_db),
):
    """Tạo mới một nhân viên trong hệ thống."""
    existing = await db.execute(select(Staff).where(Staff.username == staff_in.username.strip().lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tên đăng nhập (username) đã tồn tại trong hệ thống")

    # Auto-generate unique code if not provided
    code = staff_in.code
    if not code:
        parts = staff_in.full_name.strip().split()
        initials = "".join(p[0].upper() for p in parts[:2]) if parts else "ST"
        code = f"{initials}{uuid.uuid4().hex[:4].upper()}"

    new_staff = Staff(
        username=staff_in.username.strip().lower(),
        password_hash=hash_password(staff_in.password),
        code=code,
        full_name=staff_in.full_name,
        role=staff_in.role,
        department=staff_in.department,
        email=staff_in.email or f"{staff_in.username.strip().lower()}@aurora.hotel",
        phone=staff_in.phone or "+84 90 123 4567",
        shift=staff_in.shift or "Morning Shift (06:00 - 14:00)",
        location=staff_in.location,
        status=staff_in.status,
        avatar_url=staff_in.avatar_url,
        is_fallback_agent=staff_in.is_fallback_agent,
        assigned_floors=staff_in.assigned_floors or "Floor 1 - 5",
        notification_channels=staff_in.notification_channels or "Web Dashboard, Tablet Alert",
        is_active=True,
    )
    db.add(new_staff)
    try:
        await db.commit()
        await db.refresh(new_staff)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Không thể tạo nhân viên: {e}")
    return new_staff


@router.patch("/staff/{staff_id}", response_model=StaffResponse, tags=TAG_STAFF, summary="Cập nhật thông tin nhân viên")
async def update_staff(
    staff_id: str,
    update_in: StaffUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin nhân viên theo ID."""
    result = await db.execute(select(Staff).where(Staff.id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy nhân viên ID: {staff_id}")

    update_data = update_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(staff, field, value)
    staff.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(staff)
    return staff


@router.delete("/staff/{staff_id}", tags=TAG_STAFF, summary="Xóa nhân viên (soft delete)")
async def delete_staff(
    staff_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete nhân viên (đánh dấu is_active=False)."""
    result = await db.execute(select(Staff).where(Staff.id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy nhân viên ID: {staff_id}")

    staff.is_active = False
    staff.status = "inactive"
    staff.updated_at = datetime.utcnow()
    await db.commit()
    return {
        "success": True,
        "id": staff_id,
        "is_active": staff.is_active,
        "status": staff.status,
        "message": f"Đã xóa nhân viên {staff.full_name}",
    }
