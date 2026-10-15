import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Staff, SupportRequest, ManagementDirective
from app.schemas.operations import (
    HousekeepingRequestCreate,
    HousekeepingAssignRequest,
    HousekeepingRequestResponse,
    HousekeepingDashboardResponse,
)
from app.repositories import (
    SupportRequestRepository,
    get_support_request_repository,
    DirectiveRepository,
    get_directive_repository,
    StaffRepository,
    get_staff_repository,
)
from .shared import TAG_HK, create_department_notification

router = APIRouter()


# =====================================================================
# 2. HOUSEKEEPING DASHBOARD & REQUESTS (BUỒNG PHÒNG)
# =====================================================================

@router.get(
    "/dashboard/housekeeping",
    response_model=HousekeepingDashboardResponse,
    tags=TAG_HK,
    summary="Dashboard vận hành bộ phận Buồng phòng",
    responses={
        200: {"description": "Lấy dữ liệu Dashboard Buồng phòng kèm KPI, danh sách yêu cầu, chỉ thị và nhân sự trực."}
    },
)
async def get_housekeeping_dashboard(
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    dir_repo: DirectiveRepository = Depends(get_directive_repository),
    staff_repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn bảng điều khiển của bộ phận **Buồng phòng (Housekeeping)**.
    Dữ liệu được truy vấn trực tiếp từ bảng chuẩn hóa `support_requests` có `service_type_id = 'ST-HOUSEKEEPING'` hoặc `department_id = 'DEP-HOUSEKEEPING'`.
    """
    hk_list = await sr_repo.get_recent_by_department(
        department_ids=["DEP-HOUSEKEEPING"],
        service_type_ids=["ST-HOUSEKEEPING"],
        limit=100,
    )
    dir_list = await dir_repo.list_by_department(department="Housekeeping")
    available_staff = await staff_repo.list_staff(department="Housekeeping")

    unified_hk = []
    for h in hk_list:
        unified_hk.append(
            HousekeepingRequestResponse(
                id=f"REQ-{h.ticket_code}" if not str(h.ticket_code).startswith("REQ-") else h.ticket_code,
                ticket_code=h.ticket_code,
                source=h.source or "From HCRobot",
                time_label=getattr(h, "time_label", None) or (h.created_at.strftime("%H:%M") if hasattr(h, "created_at") and h.created_at else "Recent"),
                title=h.title,
                room_number=h.room_number or "Room 000",
                description=h.description,
                guest_name=h.guest_name or "Guest",
                status=h.status,
                assigned_staff_name=h.assigned_staff_name,
                created_at=h.created_at,
            )
        )

    for d in dir_list:
        room_num = d.location.replace("ROOM ", "").replace("Room ", "").replace("Phòng ", "").strip()
        unified_hk.append(
            HousekeepingRequestResponse(
                id=f"REQ-{d.code}" if not str(d.code).startswith("REQ-") else d.code,
                ticket_code=d.code,
                source="Operations Directive",
                time_label=d.reported_time_label or "Today",
                title=d.title,
                room_number=room_num or "Main Floor",
                description=d.description,
                guest_name="Operations Admin",
                status=d.status,
                assigned_staff_name=d.assigned_staff_name,
                created_at=d.created_at,
            )
        )

    pending_count = sum(1 for r in unified_hk if r.status in ["Unassigned", "Pending"])
    in_prog_count = sum(1 for r in unified_hk if r.status == "In Progress")
    completed_count = sum(1 for r in unified_hk if r.status == "Completed")
    staff_on_duty_count = len(available_staff)

    kpis = {
        "pendingRequests": pending_count,
        "inProgress": in_prog_count,
        "completedToday": completed_count,
        "staffOnDuty": staff_on_duty_count,
    }

    floor_status = {
        "activeFloor": "FLOOR 5 - ACTIVE",
        "roomsCleaned": 45,
        "totalRooms": 120,
    }

    return {
        "kpis": kpis,
        "requests": unified_hk,
        "floor_status": floor_status,
        "available_staff": available_staff,
    }


@router.post(
    "/housekeeping/requests",
    response_model=HousekeepingRequestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_HK,
    summary="Tạo mới yêu cầu dịch vụ buồng phòng",
    responses={
        201: {"description": "Tạo ticket buồng phòng thành công và lưu vào bảng support_requests."}
    },
)
async def create_housekeeping_request(
    req_in: HousekeepingRequestCreate,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Tiếp nhận yêu cầu dọn phòng, giặt ủi, cấp thêm khăn/nước.
    Bản ghi được tự động lưu vào bảng `support_requests` với `department_id = 'DEP-HOUSEKEEPING'` và `service_type_id = 'ST-HOUSEKEEPING'`.
    """
    ticket_code = f"HK-{random.randint(1044, 9999)}"
    new_req = SupportRequest(
        ticket_code=ticket_code,
        source=req_in.source or "From HCRobot",
        title=req_in.title,
        room_number=req_in.room_number,
        description=req_in.description,
        guest_name=req_in.guest_name or "Hotel Guest",
        department_id="DEP-HOUSEKEEPING",
        service_type_id="ST-HOUSEKEEPING",
        status="Unassigned",
        priority="NORMAL",
    )
    await sr_repo.create(new_req)
    await create_department_notification(
        db=db,
        department="Housekeeping",
        title=f"Yêu cầu Buồng phòng mới #{ticket_code}",
        description=f"Phòng {req_in.room_number}: {req_in.title} - {req_in.description or 'Yêu cầu dọn dẹp'}",
        request_id=new_req.id,
        request_type="housekeeping",
        type="Request",
    )
    await sr_repo.commit()
    await sr_repo.refresh(new_req)
    return new_req


@router.get(
    "/housekeeping/requests/{request_id}",
    response_model=HousekeepingRequestResponse,
    tags=TAG_HK,
    summary="Xem chi tiết một yêu cầu Buồng phòng",
    responses={
        200: {"description": "Lấy chi tiết yêu cầu buồng phòng thành công."},
        404: {"description": "Không tìm thấy yêu cầu buồng phòng."},
    },
)
async def get_housekeeping_request(
    request_id: str,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết một yêu cầu dịch vụ buồng phòng theo `request_id` (ID hệ thống hoặc mã `ticket_code` như `HK-1044`).
    """
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu Buồng phòng")
    return HousekeepingRequestResponse(
        id=f"REQ-{req.ticket_code}" if not str(req.ticket_code).startswith("REQ-") else req.ticket_code,
        ticket_code=req.ticket_code,
        source=req.source or "From HCRobot",
        time_label=req.created_at.strftime("%H:%M") if req.created_at else "Recent",
        title=req.title,
        room_number=req.room_number or "Room 000",
        description=req.description,
        guest_name=req.guest_name or "Guest",
        status=req.status,
        assigned_staff_name=req.assigned_staff_name,
        created_at=req.created_at,
    )

