import random
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, func

from app.core.database import get_db
from app.models import SupportRequest
from app.schemas.operations import (
    ConciergeLiveRequestCreate,
    ConciergeLiveRequestUpdate,
    ConciergeLiveRequestResponse,
    ConciergeDashboardResponse,
)
from .shared import TAG_CONCIERGE, create_department_notification

router = APIRouter()


# =====================================================================
# 17. CONCIERGE & LIVE SUPPORT DASHBOARD (TRỢ LÝ CONCIERGE & LIVE CALL)
# =====================================================================

@router.get(
    "/dashboard/concierge",
    response_model=ConciergeDashboardResponse,
    tags=TAG_CONCIERGE,
    summary="Dashboard Concierge: Phiên hỗ trợ Live Call và trợ giúp khách hàng mới nhất",
    responses={
        200: {"description": "Lấy thông tin phiên hỗ trợ trực tuyến Concierge thành công."}
    },
)
async def get_concierge_dashboard(db: AsyncSession = Depends(get_db)):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn phiên hỗ trợ trực tuyến (Live Call / Video Assistance) mới nhất khi khách hàng tương tác với Robot Kiosk:
    - Cuộc gọi video cần nhân viên can thiệp trực tiếp (Human-in-the-loop)
    - Hội thoại thoại (`transcript`) giữa Robot và khách
    - Ảnh chụp hiện trường / lỗi robot chuyển tiếp
    
    Dữ liệu được lưu trữ chuẩn hóa trong bảng `support_requests` với `department_id = 'DEP-CONCIERGE'` hoặc `service_type_id = 'ST-CONCIERGE'`.
    """
    result = await db.execute(
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-CONCIERGE",
                SupportRequest.service_type_id == "ST-CONCIERGE",
            )
        )
        .order_by(desc(SupportRequest.created_at))
        .limit(1)
    )
    current_req = result.scalar_one_or_none()

    # Đếm số phiên đang active
    count_res = await db.execute(
        select(func.count(SupportRequest.id))
        .where(
            or_(
                SupportRequest.department_id == "DEP-CONCIERGE",
                SupportRequest.service_type_id == "ST-CONCIERGE",
            ),
            SupportRequest.status.in_(["Pending", "In Progress", "Connected"]),
        )
    )
    active_count = count_res.scalar() or 0

    return {
        "current_request": current_req,
        "active_sessions_count": active_count,
    }


@router.post(
    "/concierge/requests",
    response_model=ConciergeLiveRequestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_CONCIERGE,
    summary="Khởi tạo phiên hỗ trợ Live Call / Video Call từ Robot Kiosk",
    responses={
        201: {"description": "Khởi tạo phiên hỗ trợ Concierge thành công."},
        400: {"description": "Dữ liệu không hợp lệ."},
    },
)
async def create_concierge_live_request(
    request_in: ConciergeLiveRequestCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Robot Kiosk hoặc ứng dụng khách phát tín hiệu cần nhân viên Concierge can thiệp hỗ trợ trực tuyến:
    - Khởi tạo cuộc gọi Video Call hai chiều
    - Chuyển giao ngữ cảnh hội thoại (`transcript`)
    - Hệ thống tự động gán mã `ST-CONCIERGE` và phòng ban `DEP-CONCIERGE`.
    """
    code_num = random.randint(1000, 99999)
    ticket_code = f"CCG-{code_num}"

    new_request = SupportRequest(
        ticket_code=ticket_code,
        title=request_in.title,
        description=request_in.description or "Yêu cầu can thiệp hỗ trợ thoại trực tiếp từ Robot",
        department_id="DEP-CONCIERGE",
        service_type_id="ST-CONCIERGE",
        room_number=request_in.room_number or "Main Lobby Kiosk",
        guest_name=request_in.guest_name or "Hotel Guest",
        source="Robot Voice Assistant",
        priority="HIGH",
        status="Pending",
    )
    db.add(new_request)
    await db.flush()

    # Gửi thông báo khẩn tới tổng đài viên Concierge
    await create_department_notification(
        db,
        department="Concierge",
        title=f"Cuộc gọi hỗ trợ mới: {ticket_code}",
        description=f"Khách tại {new_request.room_number} cần kết nối Live Call với Concierge",
        request_id=new_request.id,
        request_type="concierge",
        type="LiveAssistance",
    )

    await db.commit()
    await db.refresh(new_request)
    return new_request


@router.patch(
    "/concierge/requests/{request_id}",
    response_model=ConciergeLiveRequestResponse,
    tags=TAG_CONCIERGE,
    summary="Cập nhật trạng thái cuộc gọi, phân công hoặc đóng phiên Live Call Concierge",
    responses={
        200: {"description": "Cập nhật phiên hỗ trợ Concierge thành công."},
        404: {"description": "Không tìm thấy phiên hỗ trợ."}
    },
)
async def update_concierge_request(
    request_id: str,
    update_in: ConciergeLiveRequestUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Tổng đài viên Concierge tiếp nhận cuộc gọi, đổi trạng thái (`Connected`, `In Progress`, `Completed`), ghi chú và kết thúc phiên làm việc.
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
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên hỗ trợ Concierge")

    if update_in.status is not None:
        request.status = update_in.status
    if update_in.assigned_to is not None:
        request.assigned_staff_name = update_in.assigned_to

    request.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(request)
    return request
