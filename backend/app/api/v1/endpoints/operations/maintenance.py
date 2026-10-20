import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Staff, SupportRequest
from app.schemas.operations import (
    MaintenanceRequestCreate,
    MaintenanceRequestStatusUpdate,
    MaintenanceRequestResponse,
    MaintenanceDashboardResponse,
)
from app.repositories import (
    SupportRequestRepository,
    get_support_request_repository,
    StaffRepository,
    get_staff_repository,
)
from .shared import TAG_MNT, create_department_notification

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
async def get_maintenance_dashboard(
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    staff_repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn bảng điều khiển của bộ phận **Kỹ thuật & Bảo trì (Facility Maintenance)**.
    Dữ liệu được truy vấn trực tiếp từ bảng chuẩn hóa `support_requests` có `service_type_id = 'ST-MAINTENANCE'` hoặc `department_id = 'DEP-MAINTENANCE'`.
    """
    requests = await sr_repo.get_recent_by_department(
        department_ids=["DEP-MAINTENANCE"],
        service_type_ids=["ST-MAINTENANCE"],
        limit=100,
    )

    pending_count = sum(1 for r in requests if r.status in ["Pending", "Unassigned"])
    in_prog_count = sum(1 for r in requests if r.status == "In Progress")
    completed_count = sum(1 for r in requests if r.status == "Completed")

    maint_staff = await staff_repo.list_staff(department="Maintenance")

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
async def create_maintenance_request(
    req_in: MaintenanceRequestCreate,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    db: AsyncSession = Depends(get_db),
):
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
    )
    await sr_repo.create(new_req)
    await create_department_notification(
        db=db,
        department="Maintenance",
        title=f"Yêu cầu Kỹ thuật mới: {req_in.title}",
        description=f"{req_in.location}: {req_in.description or 'Cần bảo trì kỹ thuật'}",
        request_id=new_req.id,
        request_type="maintenance",
        type="Request",
    )
    await sr_repo.commit()
    await sr_repo.refresh(new_req)
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
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết một sự cố hoặc yêu cầu kỹ thuật theo `request_id` (ID hệ thống hoặc mã `ticket_code` như `MN-101`).
    """
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu kỹ thuật")
    return req



