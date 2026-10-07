import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_

from app.core.database import get_db
from app.models import Staff, SupportRequest, ManagementDirective
from app.schemas.operations import (
    MaintenanceRequestCreate,
    MaintenanceRequestStatusUpdate,
    MaintenanceRequestResponse,
    MaintenanceDashboardResponse,
    DirectiveCreate,
    DirectiveResponse,
)
from .shared import TAG_MNT, TAG_OPS, create_department_notification

router = APIRouter()


# =====================================================================
# 4. MAINTENANCE DASHBOARD & REQUESTS (KỸ THUẬT & BẢO TRÌ)
# =====================================================================

@router.get(
    "/dashboard/maintenance",
    response_model=MaintenanceDashboardResponse,
    tags=TAG_MNT,
    summary="Dashboard vận hành bộ phận Kỹ thuật & Bảo trì",
    responses={
        200: {"description": "Lấy dữ liệu Dashboard Kỹ thuật kèm KPI sự cố, kỹ thuật viên trực và bản đồ khu vực."}
    },
)
async def get_maintenance_dashboard(db: AsyncSession = Depends(get_db)):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn bảng điều khiển của bộ phận **Kỹ thuật & Bảo trì (Facility Maintenance)**.
    Dữ liệu được truy vấn trực tiếp từ bảng chuẩn hóa `support_requests` có `service_type_id = 'ST-MAINTENANCE'` hoặc `department_id = 'DEP-MAINTENANCE'`.
    """
    stmt = (
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-MAINTENANCE",
                SupportRequest.service_type_id == "ST-MAINTENANCE",
            )
        )
        .order_by(desc(SupportRequest.created_at))
    )
    res = await db.execute(stmt)

    requests = res.scalars().all()

    pending_count = sum(1 for r in requests if r.status in ["Pending", "Unassigned"])
    in_prog_count = sum(1 for r in requests if r.status == "In Progress")
    completed_count = sum(1 for r in requests if r.status == "Completed")

    staff_res = await db.execute(
        select(Staff).where(
            or_(Staff.department_id == "DEP-MAINTENANCE", Staff.department == "Maintenance"),
            Staff.is_active == True,

        )
    )
    maint_staff = staff_res.scalars().all()

    staff_availability = [
        {
            "id": s.id,
            "name": s.full_name,
            "role": s.role,
            "status": "Available" if s.status == "available" else "Busy",
            "statusClass": "text-emerald-600" if s.status == "available" else "text-amber-600",
        }
        for s in maint_staff
    ] or [
        {"id": "MNT", "name": "Nhân viên Kỹ thuật & Bảo trì", "role": "Maintenance Technician", "status": "Available", "statusClass": "text-emerald-600"}
    ]
    if not staff_availability:
        staff_availability = [
            {"id": "MNT", "name": "James Doe", "role": "HVAC Tech & Maintenance", "status": "Available", "statusClass": "text-emerald-600"}
        ]


    active_techs_count = sum(1 for s in staff_availability if s.get("status") == "Available")

    kpis = {
        "availableTechs": {"count": active_techs_count, "delta": "+0", "status": "good"},
        "pendingRequests": pending_count,
        "inProgress": in_prog_count,
        "completedToday": {"count": completed_count, "delta": "+0", "status": "good"},
    }

    facility_map = {
        "zone": "Zone Status",
        "description": "View active requests and technician locations on the floor plan.",
        "thumbnail": "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&auto=format&fit=crop&q=80",
    }

    return {
        "kpis": kpis,
        "requests": requests,
        "staff_availability": staff_availability,
        "facility_map": facility_map,
    }


@router.get(
    "/maintenance/requests",
    response_model=List[MaintenanceRequestResponse],
    tags=TAG_MNT,
    summary="Danh sách toàn bộ yêu cầu Kỹ thuật & Bảo trì",
)
async def list_maintenance_requests(
    status: Optional[str] = Query(None, description="Lọc theo trạng thái yêu cầu"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các sự cố kỹ thuật và bảo trì."""
    stmt = (
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-MAINTENANCE",
                SupportRequest.service_type_id == "ST-MAINTENANCE",
            )
        )
        .order_by(desc(SupportRequest.created_at))
    )
    if status and status not in ("All", ""):
        stmt = stmt.where(SupportRequest.status == status)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post(
    "/maintenance/requests",
    response_model=MaintenanceRequestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_MNT,
    summary="Tạo mới yêu cầu xử lý sự cố kỹ thuật",
    responses={
        201: {"description": "Tạo ticket sự cố kỹ thuật thành công và lưu vào bảng support_requests."}
    },
)
async def create_maintenance_request(req_in: MaintenanceRequestCreate, db: AsyncSession = Depends(get_db)):
    """
    ### Mô tả nghiệp vụ:
    Tiếp nhận sự cố kỹ thuật (điều hòa hỏng, chập điện, rò rỉ nước, khóa cửa phòng).
    Bản ghi được tự động lưu vào bảng `support_requests` với `department_id = 'DEP-MAINTENANCE'` và `service_type_id = 'ST-MAINTENANCE'`.
    """
    ticket_code = f"MN-{random.randint(404, 9999)}"
    new_req = SupportRequest(
        ticket_code=ticket_code,
        title=req_in.title,
        room_number=req_in.location,
        description=req_in.description,
        source=req_in.source or "Staff / Guest",
        department_id="DEP-MAINTENANCE",
        service_type_id="ST-MAINTENANCE",

        status="Pending",
        priority="NORMAL",
    )
    db.add(new_req)
    await create_department_notification(
        db=db,
        department="Maintenance",
        title=f"Yêu cầu Kỹ thuật mới: {req_in.title}",
        description=f"{req_in.location}: {req_in.description or 'Cần bảo trì kỹ thuật'}",
        request_id=new_req.id,
        request_type="maintenance",
        type="Request",
    )
    await db.commit()
    await db.refresh(new_req)
    return new_req


@router.get(
    "/maintenance/requests/{request_id}",
    response_model=MaintenanceRequestResponse,
    tags=TAG_MNT,
    summary="Xem chi tiết một yêu cầu Kỹ thuật & Bảo trì",
    responses={
        200: {"description": "Lấy chi tiết yêu cầu sự cố kỹ thuật thành công."},
        404: {"description": "Không tìm thấy yêu cầu kỹ thuật."},
    },
)
async def get_maintenance_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết một sự cố hoặc yêu cầu kỹ thuật theo `request_id` (ID hệ thống hoặc mã `ticket_code` như `MN-101`).
    """
    clean_id = request_id.replace("REQ-", "").replace("MN-", "").strip()
    res = await db.execute(
        select(SupportRequest).where(
            or_(
                SupportRequest.id == request_id,
                SupportRequest.ticket_code == request_id,
                SupportRequest.id == clean_id,
                SupportRequest.ticket_code == clean_id,
                SupportRequest.ticket_code == f"MN-{clean_id}",
            )
        )
    )
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu kỹ thuật")
    return req


@router.patch(
    "/maintenance/requests/{request_id}/status",
    response_model=MaintenanceRequestResponse,
    tags=TAG_MNT,
    summary="Cập nhật trạng thái xử lý sự cố kỹ thuật",
    responses={
        200: {"description": "Cập nhật trạng thái sự cố kỹ thuật thành công."},
        404: {"description": "Không tìm thấy yêu cầu kỹ thuật."}
    },
)
@router.patch(
    "/maintenance/requests/{request_id}",
    response_model=MaintenanceRequestResponse,
    tags=TAG_MNT,
    include_in_schema=False,
)
async def update_maintenance_request_status(
    request_id: str,
    status: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    update_in: Optional[MaintenanceRequestStatusUpdate] = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Kỹ thuật viên cập nhật tiến độ sửa chữa: `In Progress`, `Completed`, `Cancelled`.
    """
    clean_id = request_id.replace("REQ-", "").replace("MN-", "").strip()
    res = await db.execute(
        select(SupportRequest).where(
            or_(
                SupportRequest.id == request_id,
                SupportRequest.ticket_code == request_id,
                SupportRequest.id == clean_id,
                SupportRequest.ticket_code == clean_id,
                SupportRequest.ticket_code == f"MN-{clean_id}",
            )
        )
    )
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu Kỹ thuật")

    target_status = status
    target_assigned = assigned_to
    if update_in:
        if update_in.status:
            target_status = update_in.status
        target_assigned = update_in.assigned_to or update_in.assigned_technician or target_assigned

    if target_status:
        req.status = target_status
    if target_assigned:
        req.assigned_staff_name = target_assigned
    req.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(req)
    return req


# =====================================================================
# 5. OPERATIONAL DIRECTIVES & INVENTORY (CHỈ THỊ QUẢN LÝ & KHO)
# =====================================================================

@router.post(
    "/directives",
    response_model=DirectiveResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_OPS,
    summary="Phát chỉ thị điều hành quản lý liên bộ phận",
)
async def create_operational_directive(dir_in: DirectiveCreate, db: AsyncSession = Depends(get_db)):
    """Phát hành chỉ thị điều phối đặc biệt từ Ban Quản lý Khách sạn."""
    code = f"OP-{random.randint(104, 999)}"
    new_dir = ManagementDirective(
        code=code,
        title=dir_in.title,
        department=dir_in.department,
        priority=dir_in.priority,
        location=dir_in.location,
        reported_time_label="Directive Just Issued",
        description=dir_in.description,
        status="Unassigned",
        type=dir_in.type,
        created_by="System Administrator",
    )
    db.add(new_dir)
    await db.commit()
    await db.refresh(new_dir)
    return new_dir

