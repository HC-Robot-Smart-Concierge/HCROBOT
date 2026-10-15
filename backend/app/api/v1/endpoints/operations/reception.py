import random
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import SupportRequest
from app.schemas.operations import (
    ReceptionRequestCreate,
    ReceptionRequestUpdate,
    ReceptionRequestResponse,
    ReceptionDashboardResponse,
)
from app.repositories import SupportRequestRepository, get_support_request_repository
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
async def get_reception_dashboard(
    repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn các yêu cầu khách hàng cần Lễ tân xử lý:
    - Hỗ trợ đặt phòng (Room Booking / Reservations)
    - Thủ tục Check-in / Check-out / Gia hạn lưu trú
    - Đổi phòng và thông tin dịch vụ lưu trú
    
    Dữ liệu được truy vấn chuẩn hóa từ bảng `support_requests` có `department_id = 'DEP-RECEPTION'` hoặc `service_type_id = 'ST-RECEPTION'`.
    """
    current_req = await repo.get_active_by_department(
        department_ids=["DEP-RECEPTION"],
        service_type_ids=["ST-RECEPTION"],
    )
    all_reqs = await repo.get_recent_by_department(
        department_ids=["DEP-RECEPTION"],
        service_type_ids=["ST-RECEPTION"],
        limit=10,
    )

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
    repo: SupportRequestRepository = Depends(get_support_request_repository),
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
        status="Pending",
    )
    await repo.create(new_request)

    # Tạo thông báo thời gian thực gửi tới Bộ phận Lễ tân
    await create_department_notification(
        db,
        department="Reception",
        title=f"Yêu cầu lễ tân mới: {ticket_code}",
        description=f"Khách {new_request.guest_name} tại {new_request.room_number}: {new_request.title}",
        request_id=new_request.id,
        request_type="reception",
    )

    await repo.commit()
    await repo.refresh(new_request)
    return new_request


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
    repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết một yêu cầu Lễ tân & Đặt phòng theo `request_id` (ID hệ thống hoặc mã `ticket_code` như `REC-12345`).
    """
    request = await repo.get_by_id_or_code(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu Lễ tân")
    return request

