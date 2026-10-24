import random
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import SupportRequest
from app.models.hotel import Room
from app.schemas.operations import (
    ReceptionRequestCreate,
    ReceptionRequestUpdate,
    ReceptionRequestResponse,
    ReceptionDashboardResponse,
    RoomPinVerifyRequest,
    RoomPinVerifyResponse,
    RoomCheckInRequest,
    RoomInfoResponse,
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


# =====================================================================
# 1. ROOM PIN VERIFICATION & GUEST AUTHENTICATION (XÁC THỰC MÃ PIN PHÒNG)
# =====================================================================

@router.post(
    "/rooms/verify-pin",
    response_model=RoomPinVerifyResponse,
    tags=TAG_REC,
    summary="Xác thực mã PIN hoặc 4 số cuối CCCD của khách tại phòng",
)
async def verify_room_pin(
    payload: RoomPinVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Xác thực khách hàng trước khi robot tạo đơn phục vụ:
    - So khớp mã PIN 4 số của phòng HOẶC 4 số cuối của CCCD/Hộ chiếu.
    - Nếu hợp lệ: Tự động khởi tạo ticket SupportRequest tương ứng.
    """
    clean_room = payload.room_number.replace("Phòng", "").replace("phòng", "").replace("Room", "").replace("room", "").strip()
    stmt = select(Room).where(Room.room_number == clean_room)
    res = await db.execute(stmt)
    room = res.scalars().first()

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Phòng {payload.room_number} không tồn tại trên hệ thống khách sạn."
        )

    if room.status != "OCCUPIED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Phòng {room.room_number} hiện đang ở trạng thái '{room.status}' (chưa có khách check-in). Vui lòng liên hệ quầy lễ tân để được hỗ trợ."
        )

    entered_pin = payload.pin.strip()
    is_pin_matched = bool(room.pin_code and entered_pin == room.pin_code.strip())
    is_cccd_matched = bool(room.identity_number and entered_pin == room.identity_number.strip()[-4:])

    if not (is_pin_matched or is_cccd_matched):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã PIN phòng hoặc 4 số cuối CCCD/Hộ chiếu không chính xác. Quý khách vui lòng thử lại."
        )

    # Khởi tạo ticket SupportRequest nếu có action / items
    ticket_code = None
    if payload.action and payload.action not in ["chitchat", "conversation", "faq", "unknown"]:
        code_num = random.randint(1000, 99999)
        dept_id = "DEP-ROOMSERVICE" if any(k in payload.action for k in ["room", "fb", "food", "dining"]) else "DEP-HOUSEKEEPING"
        svc_id = "ST-ROOM-SERVICE" if dept_id == "DEP-ROOMSERVICE" else "ST-HOUSEKEEPING"
        prefix = "ORD" if dept_id == "DEP-ROOMSERVICE" else "REQ"
        ticket_code = f"{prefix}-{code_num}"

        items_str = payload.items or payload.note or "Yêu cầu dịch vụ phòng qua Kiosk"
        new_req = SupportRequest(
            ticket_code=ticket_code,
            title=f"Yêu cầu từ Kiosk (Phòng {room.room_number})",
            description=items_str,
            department_id=dept_id,
            service_type_id=svc_id,
            room_id=room.id,
            room_number=room.room_number,
            guest_name=room.current_guest_name or "Hotel Guest",
            source="Robot Kiosk (PIN Verified)",
            status="Pending",
        )
        db.add(new_req)
        await db.flush()

        await create_department_notification(
            db,
            department="Room Service" if dept_id == "DEP-ROOMSERVICE" else "Housekeeping",
            title=f"Đơn mới #{ticket_code} (Đã xác thực PIN)",
            description=f"Phòng {room.room_number} ({room.current_guest_name}): {items_str}",
            request_id=new_req.id,
            request_type="room_service" if dept_id == "DEP-ROOMSERVICE" else "housekeeping",
        )
        await db.commit()

    return RoomPinVerifyResponse(
        verified=True,
        room_number=room.room_number,
        guest_name=room.current_guest_name,
        ticket_code=ticket_code,
        message=f"Xác thực phòng {room.room_number} thành công! Yêu cầu đã được chuyển tới bộ phận liên quan."
    )


@router.get(
    "/rooms",
    response_model=List[RoomInfoResponse],
    tags=TAG_REC,
    summary="Danh sách toàn bộ phòng và trạng thái check-in, mã PIN",
)
async def list_all_rooms(db: AsyncSession = Depends(get_db)):
    """Trả về danh sách tất cả các phòng để phục vụ Lễ tân quản lý và xem mã PIN/CCCD."""
    stmt = select(Room).order_by(Room.room_number)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post(
    "/rooms/{room_id}/check-in",
    response_model=RoomInfoResponse,
    tags=TAG_REC,
    summary="Lễ tân thực hiện Check-in và cấp mã PIN cho phòng",
)
async def check_in_room(
    room_id: str,
    payload: RoomCheckInRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Thủ tục Check-in phòng:
    - Gán tên khách, số CCCD/Hộ chiếu.
    - Cấp mã PIN 4 số (tự sinh ngẫu nhiên nếu không truyền).
    - Đổi trạng thái phòng thành 'OCCUPIED'.
    """
    stmt = select(Room).where((Room.id == room_id) | (Room.room_number == room_id))
    res = await db.execute(stmt)
    room = res.scalars().first()

    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng")

    # Sinh mã PIN 4 số ngẫu nhiên nếu không truyền
    generated_pin = payload.pin_code
    if not generated_pin:
        if payload.identity_number and len(payload.identity_number.strip()) >= 4:
            generated_pin = payload.identity_number.strip()[-4:]
        else:
            generated_pin = f"{random.randint(1000, 9999)}"

    room.current_guest_name = payload.guest_name.strip()
    room.identity_number = payload.identity_number.strip() if payload.identity_number else None
    room.pin_code = generated_pin
    room.status = payload.status or "OCCUPIED"

    await db.commit()
    await db.refresh(room)
    return room


@router.post(
    "/rooms/{room_id}/check-out",
    response_model=RoomInfoResponse,
    tags=TAG_REC,
    summary="Lễ tân thực hiện Check-out và xóa mã PIN phòng",
)
async def check_out_room(
    room_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Thủ tục Check-out phòng:
    - Xóa tên khách, mã PIN, số CCCD để đảm bảo bảo mật.
    - Đổi trạng thái phòng thành 'CLEANING'.
    """
    stmt = select(Room).where((Room.id == room_id) | (Room.room_number == room_id))
    res = await db.execute(stmt)
    room = res.scalars().first()

    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng")

    room.current_guest_name = None
    room.identity_number = None
    room.pin_code = None
    room.status = "CLEANING"

    await db.commit()
    await db.refresh(room)
    return room


