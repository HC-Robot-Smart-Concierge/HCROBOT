import random
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_

from app.core.database import get_db
from app.models import SupportRequest
from app.schemas.operations import (
    ReceptionRequestCreate,
    ReceptionRequestUpdate,
    ReceptionRequestResponse,
    ReceptionDashboardResponse,
)
from .shared import TAG_REC, create_department_notification

router = APIRouter()


# =====================================================================
# 0. RECEPTION / FRONT DESK DASHBOARD & REQUESTS (LỄ TÂN & ĐẶT PHÒNG)
# =====================================================================

@router.get(
    "/dashboard/reception",
    response_model=ReceptionDashboardResponse,
    tags=TAG_REC,
    summary="Dashboard Lễ tân: Danh sách yêu cầu đặt phòng và hỗ trợ tiền sảnh",
    responses={
        200: {"description": "Lấy thông tin yêu cầu của khách tại quầy lễ tân thành công."}
    },
)
async def get_reception_dashboard(db: AsyncSession = Depends(get_db)):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn các yêu cầu khách hàng cần Lễ tân xử lý:
    - Hỗ trợ đặt phòng (Room Booking / Reservations)
    - Thủ tục Check-in / Check-out / Gia hạn lưu trú
    - Đổi phòng và thông tin dịch vụ lưu trú
    
    Dữ liệu được truy vấn chuẩn hóa từ bảng `support_requests` có `department_id = 'DEP-RECEPTION'` hoặc `service_type_id = 'ST-RECEPTION'`.
    """
    result = await db.execute(
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-RECEPTION",
                SupportRequest.service_type_id == "ST-RECEPTION",
            )
        )
        .order_by(desc(SupportRequest.created_at))
        .limit(10)

    )
    all_reqs = result.scalars().all()
    current_req = all_reqs[0] if all_reqs else None
    return {
        "current_request": current_req,
        "recent_requests": all_reqs,
    }


@router.post(
    "/reception/requests",
    response_model=ReceptionRequestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_REC,
    summary="Tạo mới yêu cầu Lễ tân & Đặt phòng",
    responses={
        201: {"description": "Tạo yêu cầu lễ tân / đặt phòng thành công."},
        400: {"description": "Dữ liệu yêu cầu không hợp lệ."},
    },
)
async def create_reception_request(
    request_in: ReceptionRequestCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Khách hàng (qua Robot Kiosk) hoặc Nhân viên quầy tạo mới một yêu cầu Lễ tân:
    - Đặt phòng mới hoặc giữ chỗ phòng nghỉ
    - Yêu cầu check-in sớm / check-out muộn
    - Hỗ trợ thủ tục hóa đơn hoặc đổi phòng
    
    Hệ thống tự động gắn mã dịch vụ `ST-RECEPTION` và phòng ban `DEP-RECEPTION`.
    """
    code_num = random.randint(1000, 99999)
    ticket_code = f"REC-{code_num}"
    
    new_request = SupportRequest(
        ticket_code=ticket_code,
        title=request_in.title,
        description=request_in.description,
        department_id="DEP-RECEPTION",
        service_type_id="ST-RECEPTION",
        room_number=request_in.room_number or request_in.location or "Lobby Desk",
        guest_name=request_in.guest_name or "Hotel Guest",
        source=request_in.source or "Front Desk / Robot Kiosk",
        priority=request_in.priority or "NORMAL",
        status="Pending",
    )
    db.add(new_request)
    await db.flush()

    # Tạo thông báo thời gian thực gửi tới Bộ phận Lễ tân
    await create_department_notification(
        db,
        department="Reception",
        title=f"Yêu cầu lễ tân mới: {ticket_code}",
        description=f"Khách {new_request.guest_name} tại {new_request.room_number}: {new_request.title}",
        request_id=new_request.id,
        request_type="reception",
    )

    await db.commit()
    await db.refresh(new_request)
    return new_request


@router.get(
    "/reception/requests",
    response_model=List[ReceptionRequestResponse],
    tags=TAG_REC,
    summary="Danh sách toàn bộ yêu cầu Lễ tân & Đặt phòng",
)
async def list_reception_requests(
    status: Optional[str] = Query(None, description="Lọc theo trạng thái yêu cầu"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các yêu cầu tiếp nhận tại bộ phận Lễ tân."""
    stmt = (
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-RECEPTION",
                SupportRequest.service_type_id == "ST-RECEPTION",
            )
        )
        .order_by(desc(SupportRequest.created_at))
    )
    if status and status not in ("All", ""):
        stmt = stmt.where(SupportRequest.status == status)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get(
    "/reception/requests/{request_id}",
    response_model=ReceptionRequestResponse,
    tags=TAG_REC,
    summary="Xem chi tiết một yêu cầu Lễ tân & Đặt phòng",
    responses={
        200: {"description": "Lấy chi tiết yêu cầu Lễ tân thành công."},
        404: {"description": "Không tìm thấy yêu cầu Lễ tân."},
    },
)
async def get_reception_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết một yêu cầu Lễ tân & Đặt phòng theo `request_id` (ID hệ thống hoặc mã `ticket_code` như `REC-12345`).
    """
    clean_id = request_id.replace("REQ-", "").replace("REC-", "").strip()
    result = await db.execute(
        select(SupportRequest).where(
            or_(
                SupportRequest.id == request_id,
                SupportRequest.ticket_code == request_id,
                SupportRequest.id == clean_id,
                SupportRequest.ticket_code == clean_id,
                SupportRequest.ticket_code == f"REC-{clean_id}",
            )
        )
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu Lễ tân")
    return request


@router.patch(
    "/reception/requests/{request_id}",
    response_model=ReceptionRequestResponse,
    tags=TAG_REC,
    summary="Cập nhật trạng thái và phân công xử lý yêu cầu Lễ tân",
    responses={
        200: {"description": "Cập nhật yêu cầu lễ tân thành công."},
        404: {"description": "Không tìm thấy yêu cầu lễ tân."}
    },
)
async def update_reception_request(
    request_id: str,
    update_in: ReceptionRequestUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Nhân viên Lễ tân đổi trạng thái (`In Progress`, `Completed`), tiếp nhận xử lý phiếu hoặc phân công nhân sự giải quyết.
    """
    clean_id = request_id.replace("REQ-", "").strip()
    result = await db.execute(
        select(SupportRequest).where(
            or_(
                SupportRequest.id == request_id,
                SupportRequest.ticket_code == request_id,
                SupportRequest.id == clean_id,
                SupportRequest.ticket_code == clean_id,
            )
        )
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu Lễ tân")

    if update_in.status is not None:
        request.status = update_in.status
    if update_in.assigned_to is not None:
        request.assigned_staff_name = update_in.assigned_to
    if update_in.note:
        request.description = f"{request.description or ''} | Note: {update_in.note}".strip(" |")
    if update_in.escalated:
        request.priority = "HIGH"

    request.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(request)
    return request
