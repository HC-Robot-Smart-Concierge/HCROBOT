import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_

from app.core.database import get_db
from app.models import Staff, SupportRequest, ManagementDirective
from app.schemas.operations import (
    HousekeepingRequestCreate,
    HousekeepingAssignRequest,
    HousekeepingRequestResponse,
    HousekeepingDashboardResponse,
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
async def get_housekeeping_dashboard(db: AsyncSession = Depends(get_db)):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn bảng điều khiển của bộ phận **Buồng phòng (Housekeeping)**.
    Dữ liệu được truy vấn trực tiếp từ bảng chuẩn hóa `support_requests` có `service_type_id = 'ST-HOUSEKEEPING'` hoặc `department_id = 'DEP-HOUSEKEEPING'`.
    """
    stmt = (
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-HOUSEKEEPING",
                SupportRequest.service_type_id == "ST-HOUSEKEEPING",
            )
        )
        .order_by(desc(SupportRequest.created_at))
    )
    req_res = await db.execute(stmt)

    hk_list = req_res.scalars().all()

    dir_res = await db.execute(
        select(ManagementDirective).where(
            ManagementDirective.department == "Housekeeping"
        ).order_by(desc(ManagementDirective.created_at))
    )
    dir_list = dir_res.scalars().all()

    staff_res = await db.execute(
        select(Staff).where(
            or_(Staff.department_id == "DEP-HOUSEKEEPING", Staff.department == "Housekeeping"),
            Staff.status != "off_shift",
            Staff.is_active == True,
        )
    )
    available_staff = staff_res.scalars().all()

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


@router.get(
    "/housekeeping/requests",
    response_model=List[HousekeepingRequestResponse],
    tags=TAG_HK,
    summary="Danh sách toàn bộ yêu cầu Buồng phòng",
)
async def list_housekeeping_requests(
    status: Optional[str] = Query(None, description="Lọc theo trạng thái yêu cầu"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các yêu cầu dịch vụ buồng phòng."""
    stmt = (
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-HOUSEKEEPING",
                SupportRequest.service_type_id == "ST-HOUSEKEEPING",
            )
        )
        .order_by(desc(SupportRequest.created_at))
    )
    if status and status not in ("All", ""):
        stmt = stmt.where(SupportRequest.status == status)
    res = await db.execute(stmt)
    reqs = res.scalars().all()
    return [
        HousekeepingRequestResponse(
            id=f"REQ-{h.ticket_code}" if not str(h.ticket_code).startswith("REQ-") else h.ticket_code,
            ticket_code=h.ticket_code,
            source=h.source or "From HCRobot",
            time_label=h.created_at.strftime("%H:%M") if h.created_at else "Recent",
            title=h.title,
            room_number=h.room_number or "Room 000",
            description=h.description,
            guest_name=h.guest_name or "Guest",
            status=h.status,
            assigned_staff_name=h.assigned_staff_name,
            created_at=h.created_at,
        )
        for h in reqs
    ]


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
async def create_housekeeping_request(req_in: HousekeepingRequestCreate, db: AsyncSession = Depends(get_db)):
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
    db.add(new_req)
    await create_department_notification(
        db=db,
        department="Housekeeping",
        title=f"Yêu cầu Buồng phòng mới #{ticket_code}",
        description=f"Phòng {req_in.room_number}: {req_in.title} - {req_in.description or 'Yêu cầu dọn dẹp'}",
        request_id=new_req.id,
        request_type="housekeeping",
        type="Request",
    )
    await db.commit()
    await db.refresh(new_req)
    return new_req


@router.patch(
    "/housekeeping/requests/{request_id}/assign",
    response_model=HousekeepingRequestResponse,
    tags=TAG_HK,
    summary="Phân công nhân viên xử lý yêu cầu buồng phòng",
    responses={
        200: {"description": "Phân công hoặc cập nhật tiến độ công việc buồng phòng thành công."},
        404: {"description": "Không tìm thấy yêu cầu buồng phòng."}
    },
)
@router.patch(
    "/housekeeping/requests/{request_id}",
    response_model=HousekeepingRequestResponse,
    tags=TAG_HK,
    include_in_schema=False,
)
async def assign_housekeeping_request(
    request_id: str,
    assign_in: HousekeepingAssignRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Điều phối viên hoặc nhân viên Buồng phòng bấm **Nhận việc / Phân công nhân viên** xử lý yêu cầu.
    """
    clean_id = request_id.replace("REQ-", "").replace("HK-", "").strip()
    res = await db.execute(
        select(SupportRequest).where(
            or_(
                SupportRequest.id == request_id,
                SupportRequest.ticket_code == request_id,
                SupportRequest.id == clean_id,
                SupportRequest.ticket_code == clean_id,
                SupportRequest.ticket_code == f"HK-{clean_id}",
            )
        )
    )
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu Buồng phòng")

    staff_name = assign_in.assigned_staff_name or assign_in.assigned_staff
    if assign_in.status:
        req.status = assign_in.status
    if staff_name:
        req.assigned_staff_name = staff_name

    staff_identifier = assign_in.assigned_staff_id or staff_name
    if staff_identifier:
        staff_check = await db.execute(
            select(Staff).where(
                or_(
                    Staff.id == staff_identifier,
                    Staff.username == staff_identifier,
                    Staff.full_name == assign_in.assigned_staff_name,
                )
            )
        )
        found_staff = staff_check.scalar_one_or_none()
        req.account_id = found_staff.id if found_staff else None
    else:
        req.account_id = None

    req.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(req)
    return req
