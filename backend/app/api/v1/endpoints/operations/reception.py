import time
import re
import random
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import SupportRequest
from app.models.hotel import Room
from app.services.maintenance_request_service import get_or_create_maintenance_request, duplicate_maintenance_message, merged_maintenance_message
from app.services.bell_request_service import (
    BELL_DEPARTMENT_ID, BELL_SERVICE_TYPE_ID, bell_request_message, get_or_create_bell_request,
)
from app.services.ai.constants import is_lost_found_text
from app.schemas.operations import (
    ReceptionRequestCreate,
    ReceptionRequestUpdate,
    ReceptionRequestResponse,
    ReceptionDashboardResponse,
    RoomPinVerifyRequest,
    RoomPinVerifyResponse,
    RoomNfcVerifyRequest,
    RoomCheckInRequest,
    RoomInfoResponse,
)
from app.repositories import SupportRequestRepository, get_support_request_repository
from .shared import TAG_REC, create_department_notification

# Anti-bruteforce: Khoa 1 phut (60s) sau 5 lan nhap sai ma PIN
ROOM_PIN_ATTEMPTS: Dict[str, Dict[str, Any]] = {}
PIN_LOCKOUT_MAX_ATTEMPTS = 5
PIN_LOCKOUT_DURATION_SEC = 60

router = APIRouter()


def normalize_nfc_uid(uid: Optional[str]) -> str:
    """Chuẩn hóa mã UID thẻ NFC: xóa dấu :, gạch ngang, khoảng trắng và chuyển chữ thường."""
    if not uid:
        return ""
    return str(uid).replace(":", "").replace("-", "").replace(" ", "").strip().lower()


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
    now_ts = time.time()
    clean_room = payload.room_number.replace("Phòng", "").replace("phòng", "").replace("Room", "").replace("room", "").strip()

    # Kiem tra lockout neu phong da bi khoa do nhap sai qua 5 lan
    attempt_info = ROOM_PIN_ATTEMPTS.get(clean_room, {"count": 0, "locked_until": 0.0})
    if attempt_info.get("locked_until", 0.0) > now_ts:
        remaining_sec = int(attempt_info["locked_until"] - now_ts) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Quý khách đã nhập sai mã PIN 5 lần. Hệ thống tạm khóa 1 phút. Quý khách vui lòng thử lại sau ({remaining_sec}s).",
        )
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
            detail={
                "message": f"Dạ phòng {room.room_number} hiện chưa làm thủ tục nhận phòng. Quý khách vui lòng qua quầy Lễ tân để check-in rồi mới được đặt món nhé ạ.",
                "not_checked_in": True,
                "room_number": room.room_number,
                "destination_key": "front_desk",
            }
        )

    entered_pin = (payload.pin or "").strip()
    tag_input = (payload.tag_code or payload.nfc_card_uid or entered_pin).strip()
    norm_input = normalize_nfc_uid(tag_input)
    room_tag = normalize_nfc_uid(room.tag_code)

    is_pin_matched = bool(room.pin_code and entered_pin == room.pin_code.strip())
    identity_num = getattr(room, 'identity_number', None)
    is_cccd_matched = bool(identity_num and (entered_pin == identity_num.strip()[-4:] or entered_pin == identity_num.strip()[-6:]))
    is_nfc_matched = bool(room_tag and norm_input and (norm_input == room_tag or norm_input == normalize_nfc_uid(room.room_number)))

    if not (is_pin_matched or is_cccd_matched or is_nfc_matched):
        attempt_info["count"] = attempt_info.get("count", 0) + 1
        if attempt_info["count"] >= PIN_LOCKOUT_MAX_ATTEMPTS:
            attempt_info["locked_until"] = now_ts + PIN_LOCKOUT_DURATION_SEC
            ROOM_PIN_ATTEMPTS[clean_room] = attempt_info
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Quý khách đã nhập sai mã PIN 5 lần. Hệ thống tạm khóa 1 phút. Quý khách vui lòng thử lại sau.",
            )
        ROOM_PIN_ATTEMPTS[clean_room] = attempt_info
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã PIN phòng không chính xác. Quý khách vui lòng thử lại sau.",
        )

    # Đăng nhập thành công -> Xóa lịch sử nhập sai
    ROOM_PIN_ATTEMPTS.pop(clean_room, None)

    verification_type = "NFC" if is_nfc_matched else ("CCCD" if is_cccd_matched else "PIN")

    # Khởi tạo ticket SupportRequest nếu có action / items và không có cờ bỏ qua tạo ticket
    ticket_code = None
    duplicate = False
    merged = False
    bell_ticket = None
    should_create_ticket = (
        not getattr(payload, "skip_ticket_creation", False)
        and getattr(payload, "create_ticket", True) is not False
        and bool(payload.action)
        and payload.action not in [
            "chitchat", "conversation", "faq", "unknown",
            "verify_only", "auth_only", "food_menu", "food_order",
            "room_service", "room_service_menu", "amenity_order",
            "taxi", "book_taxi", "taxi_booking",
            "query_order_status", "query_service_status", "query_taxi_status"
        ]
    )
    if should_create_ticket:
        code_num = random.randint(1000, 99999)
        act_lower = (payload.action or "").lower()
        if any(k in act_lower for k in ["maintenance", "bảo trì", "sửa", "hong"]):
            dept_id = "DEP-MAINTENANCE"
            svc_id = "ST-MAINTENANCE"
            prefix = "MN"
            dept_name_str = "Maintenance"
            req_type_str = "maintenance"
        elif any(k in act_lower for k in ["room", "fb", "food", "dining"]):
            dept_id = "DEP-ROOMSERVICE"
            svc_id = "ST-ROOM-SERVICE"
            prefix = "ORD"
            dept_name_str = "Room Service"
            req_type_str = "room_service"
        elif any(k in act_lower for k in ["bell", "hành lý", "hành lí", "thất lạc", "mất đồ", "quên đồ", "lost"]):
            dept_id = BELL_DEPARTMENT_ID
            svc_id = BELL_SERVICE_TYPE_ID
            prefix = "BS"
            dept_name_str = "Bell Services"
            items_check = f"{act_lower} {(payload.items or payload.note or '').lower()}"
            req_type_str = "lost_found" if is_lost_found_text(items_check) else "luggage"
        else:
            dept_id = "DEP-HOUSEKEEPING"
            svc_id = "ST-HOUSEKEEPING"
            prefix = "REQ"
            dept_name_str = "Housekeeping"
            req_type_str = "housekeeping"
        ticket_code = f"{prefix}-{code_num}"

        items_str = payload.items or payload.note or "Yêu cầu dịch vụ phòng qua Kiosk"
        req_title = (
            f"Báo cáo đồ thất lạc Phòng {room.room_number}: {items_str}"
            if req_type_str == "lost_found"
            else f"Hỗ trợ hành lý Phòng {room.room_number}: {items_str}"
            if dept_id == "DEP-BELL"
            else f"Yêu cầu từ Kiosk (Phòng {room.room_number})"
        )
        new_req = SupportRequest(
            ticket_code=ticket_code,
            title=req_title,
            description=items_str,
            department_id=dept_id,
            service_type_id=svc_id,
            room_id=room.id,
            room_number=room.room_number,
            guest_name=room.current_guest_name or "Hotel Guest",
            source=f"Robot Kiosk ({verification_type} Verified)",
            status="Pending",
            request_type=req_type_str,
        )
        if dept_id == "DEP-MAINTENANCE":
            new_req, created, merged = await get_or_create_maintenance_request(db, new_req)
            duplicate = not created and not merged
            ticket_code = new_req.ticket_code
        elif dept_id == BELL_DEPARTMENT_ID and req_type_str != "lost_found":
            # Notifies Bell Services itself; a repeated open request returns its ticket.
            new_req, created = await get_or_create_bell_request(
                db, room_number=room.room_number, description=items_str,
                source=f"Robot Kiosk ({verification_type} Verified)",
                guest_name=room.current_guest_name, room_id=room.id,
            )
            duplicate, bell_ticket, ticket_code = not created, new_req, new_req.ticket_code
        else:
            db.add(new_req)
            await db.flush()

        if not duplicate and not bell_ticket:
            await create_department_notification(
                db,
                department=dept_name_str,
                title=f"Bổ sung sự cố #{ticket_code}" if merged else f"Đơn mới #{ticket_code} (Đã xác thực {verification_type})",
                description=f"Phòng {room.room_number} ({room.current_guest_name}): {items_str}",
                request_id=new_req.id,
                request_type=req_type_str,
            )
        await db.commit()

    session_id = getattr(payload, "session_id", None)
    if session_id:
        from app.services.ai.session_manager import session_manager
        session_manager.set_room_authenticated(session_id, room.room_number)
        session_manager.set_room_number(session_id, room.room_number)

    is_no_ticket = (
        getattr(payload, "skip_ticket_creation", False)
        or not should_create_ticket
        or payload.action in [
            "taxi", "book_taxi", "taxi_booking",
            "query_order_status", "query_service_status", "query_taxi_status",
            "food_menu", "room_service_menu", "verify_only", "auth_only"
        ]
    )
    pin_success_msg = f"Xác thực phòng {room.room_number} thành công!" if is_no_ticket else f"Xác thực phòng {room.room_number} thành công! Yêu cầu đã được chuyển tới bộ phận liên quan."

    return RoomPinVerifyResponse(
        verified=True,
        success=True,
        room_number=room.room_number,
        guest_name=room.current_guest_name,
        ticket_code=ticket_code,
        verification_type=verification_type,
        tag_code=room.tag_code,
        duplicate=duplicate,
        merged=merged,
        message=(
            bell_request_message(bell_ticket, created=not duplicate) if bell_ticket
            else merged_maintenance_message(ticket_code) if merged
            else duplicate_maintenance_message(ticket_code) if duplicate else pin_success_msg
        )
    )


@router.post(
    "/rooms/verify-nfc",
    response_model=RoomPinVerifyResponse,
    tags=TAG_REC,
    summary="Xác thực tự động bằng quét thẻ NFC / NDEF tagCode (Tự động nhận diện số phòng)",
)
async def verify_room_nfc(
    payload: RoomNfcVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Quẹt thẻ NFC / Đọc NDEF tagCode tại Robot Kiosk:
    - Nhận diện tag_code (chuỗi NDEF record hoặc UID phần cứng).
    - Tự động tra cứu phòng tương ứng đang lưu trú.
    - Tự động tạo ticket dịch vụ SupportRequest nếu có action / items.
    """
    tag_input = (payload.tag_code or payload.nfc_card_uid or "").strip()
    norm_entered = normalize_nfc_uid(tag_input)
    if not norm_entered:
        raise HTTPException(status_code=400, detail="Dữ liệu thẻ NFC (tagCode/NDEF) không hợp lệ.")

    # Tìm phòng có tag_code hoặc room_number khớp (tìm trên toàn bộ phòng đang lưu trú)
    stmt = select(Room).where(Room.status == "OCCUPIED")
    res = await db.execute(stmt)
    rooms = res.scalars().all()

    matched_room = None
    for r in rooms:
        norm_room_tag = normalize_nfc_uid(r.tag_code)
        norm_room_num = normalize_nfc_uid(r.room_number)
        # So khớp tag_code (UID / NDEF record) HOẶC so khớp trực tiếp số phòng
        if (norm_room_tag and norm_entered == norm_room_tag) or (norm_room_num and norm_entered == norm_room_num) or (norm_room_tag and (norm_entered in norm_room_tag or norm_room_tag in norm_entered)):
            matched_room = r
            break

    if not matched_room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mã thẻ (tagCode: '{tag_input}') không tồn tại trên hệ thống hoặc phòng chưa được check-in."
        )

    # Khởi tạo ticket SupportRequest nếu có action / items và không có cờ bỏ qua tạo ticket
    ticket_code = None
    duplicate = False
    merged = False
    bell_ticket = None
    should_create_ticket = (
        not getattr(payload, "skip_ticket_creation", False)
        and getattr(payload, "create_ticket", True) is not False
        and bool(payload.action)
        and payload.action not in [
            "chitchat", "conversation", "faq", "unknown",
            "verify_only", "auth_only", "food_menu", "food_order",
            "room_service", "room_service_menu", "amenity_order",
            "taxi", "book_taxi", "taxi_booking",
            "query_order_status", "query_service_status", "query_taxi_status"
        ]
    )
    if should_create_ticket:
        code_num = random.randint(1000, 99999)
        act_lower = (payload.action or "").lower()
        if any(k in act_lower for k in ["maintenance", "bảo trì", "sửa", "hong"]):
            dept_id = "DEP-MAINTENANCE"
            svc_id = "ST-MAINTENANCE"
            prefix = "MN"
            dept_name_str = "Maintenance"
            req_type_str = "maintenance"
        elif any(k in act_lower for k in ["room", "fb", "food", "dining"]):
            dept_id = "DEP-ROOMSERVICE"
            svc_id = "ST-ROOM-SERVICE"
            prefix = "ORD"
            dept_name_str = "Room Service"
            req_type_str = "room_service"
        elif any(k in act_lower for k in ["bell", "hành lý", "hành lí", "thất lạc", "mất đồ", "quên đồ", "lost"]):
            dept_id = BELL_DEPARTMENT_ID
            svc_id = BELL_SERVICE_TYPE_ID
            prefix = "BS"
            dept_name_str = "Bell Services"
            items_check = f"{act_lower} {(payload.items or payload.note or '').lower()}"
            req_type_str = "lost_found" if is_lost_found_text(items_check) else "luggage"
        else:
            dept_id = "DEP-HOUSEKEEPING"
            svc_id = "ST-HOUSEKEEPING"
            prefix = "REQ"
            dept_name_str = "Housekeeping"
            req_type_str = "housekeeping"
        ticket_code = f"{prefix}-{code_num}"

        items_str = payload.items or payload.note or "Yêu cầu dịch vụ phòng qua Kiosk (Thẻ NFC)"
        req_title_nfc = (
            f"Báo cáo đồ thất lạc Phòng {matched_room.room_number} (NFC): {items_str}"
            if req_type_str == "lost_found"
            else f"Hỗ trợ hành lý Phòng {matched_room.room_number} (NFC): {items_str}"
            if dept_id == "DEP-BELL"
            else f"Yêu cầu từ Kiosk (Phòng {matched_room.room_number} - Thẻ NFC)"
        )
        new_req = SupportRequest(
            ticket_code=ticket_code,
            title=req_title_nfc,
            description=items_str,
            department_id=dept_id,
            service_type_id=svc_id,
            room_id=matched_room.id,
            room_number=matched_room.room_number,
            guest_name=matched_room.current_guest_name or "Hotel Guest",
            source="Robot Kiosk (NFC Verified)",
            status="Pending",
            request_type=req_type_str,
        )
        if dept_id == "DEP-MAINTENANCE":
            new_req, created, merged = await get_or_create_maintenance_request(db, new_req)
            duplicate = not created and not merged
            ticket_code = new_req.ticket_code
        elif dept_id == BELL_DEPARTMENT_ID and req_type_str != "lost_found":
            # Notifies Bell Services itself; a repeated open request returns its ticket.
            new_req, created = await get_or_create_bell_request(
                db, room_number=matched_room.room_number, description=items_str,
                source="Robot Kiosk (NFC Verified)",
                guest_name=matched_room.current_guest_name, room_id=matched_room.id,
            )
            duplicate, bell_ticket, ticket_code = not created, new_req, new_req.ticket_code
        else:
            db.add(new_req)
            await db.flush()

        if not duplicate and not bell_ticket:
            await create_department_notification(
                db,
                department=dept_name_str,
                title=f"Bổ sung sự cố #{ticket_code}" if merged else f"Đơn mới #{ticket_code} (Đã quẹt thẻ NFC)",
                description=f"Phòng {matched_room.room_number} ({matched_room.current_guest_name}): {items_str}",
                request_id=new_req.id,
                request_type=req_type_str,
            )
        await db.commit()

    session_id = getattr(payload, "session_id", None)
    if session_id:
        from app.services.ai.session_manager import session_manager
        session_manager.set_room_authenticated(session_id, matched_room.room_number)
        session_manager.set_room_number(session_id, matched_room.room_number)

    is_no_ticket_nfc = (
        getattr(payload, "skip_ticket_creation", False)
        or not should_create_ticket
        or payload.action in [
            "taxi", "book_taxi", "taxi_booking",
            "query_order_status", "query_service_status", "query_taxi_status",
            "food_menu", "room_service_menu", "verify_only", "auth_only"
        ]
    )
    nfc_success_msg = f"Xác thực thẻ phòng {matched_room.room_number} thành công!" if is_no_ticket_nfc else f"Xác thực thẻ phòng {matched_room.room_number} thành công! Yêu cầu đã được chuyển tới bộ phận liên quan."

    return RoomPinVerifyResponse(
        verified=True,
        success=True,
        room_number=matched_room.room_number,
        guest_name=matched_room.current_guest_name,
        ticket_code=ticket_code,
        verification_type="NFC",
        tag_code=matched_room.tag_code,
        duplicate=duplicate,
        merged=merged,
        message=(
            bell_request_message(bell_ticket, created=not duplicate) if bell_ticket
            else merged_maintenance_message(ticket_code) if merged
            else duplicate_maintenance_message(ticket_code) if duplicate else nfc_success_msg
        )
    )


@router.get(
    "/rooms",
    response_model=List[RoomInfoResponse],
    tags=TAG_REC,
    summary="Danh sách toàn bộ phòng và trạng thái check-in, mã PIN, tagCode",
)
async def list_all_rooms(db: AsyncSession = Depends(get_db)):
    """Trả về danh sách tất cả các phòng để phục vụ Lễ tân quản lý và xem mã PIN/CCCD/tagCode."""
    stmt = select(Room).order_by(Room.room_number)
    res = await db.execute(stmt)
    rooms = res.scalars().all()

    # Tự động đồng bộ với file RAG nếu chưa đủ 20 phòng chuẩn (301-310, 401-410)
    valid_rn = {f"{f}{i:02d}" for f in (3, 4) for i in range(1, 11)}
    current_rn = {r.room_number for r in rooms}
    if not rooms or not valid_rn.issubset(current_rn):
        from app.services.rag.room_sync_service import sync_rooms_with_rag
        await sync_rooms_with_rag(db)
        res = await db.execute(stmt)
        rooms = res.scalars().all()

    return rooms


@router.post(
    "/rooms/sync-rag",
    tags=TAG_REC,
    summary="Đồng bộ danh sách phòng từ file RAG hệ thống (Obsidian Vault)",
)
async def sync_rooms_from_rag_endpoint(db: AsyncSession = Depends(get_db)):
    """Đồng bộ trực tiếp danh sách phòng trong CSDL theo file RAG (301-310, 401-410)."""
    from app.services.rag.room_sync_service import sync_rooms_with_rag
    result = await sync_rooms_with_rag(db)
    return {"message": "Đồng bộ phòng từ file RAG thành công!", "detail": result}


@router.post(
    "/rooms/{room_id}/check-in",
    response_model=RoomInfoResponse,
    tags=TAG_REC,
    summary="Lễ tân thực hiện Check-in và cấp mã PIN, tagCode cho phòng",
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
    - Cấp thẻ phòng NFC (tagCode).
    - Đổi trạng thái phòng thành 'OCCUPIED'.
    """
    stmt = select(Room).where((Room.id == room_id) | (Room.room_number == room_id))
    res = await db.execute(stmt)
    room = res.scalars().first()

    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng")

    # Yêu cầu bắt buộc nhập CCCD / Hộ chiếu và tự động tạo mã PIN từ 4 số cuối CCCD
    clean_id = (payload.identity_number or "").strip()
    if not clean_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập số CCCD / Hộ chiếu của khách để làm thủ tục nhận phòng."
        )

    if not clean_id.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số CCCD / Hộ chiếu chỉ được chứa các chữ số (0-9)."
        )

    if len(clean_id) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số CCCD / Hộ chiếu phải có ít nhất 4 chữ số để tạo mã PIN phòng."
        )

    generated_pin = clean_id[-4:]

    room.current_guest_name = payload.guest_name.strip()
    if hasattr(room, 'current_guest_phone'):
        room.current_guest_phone = payload.guest_phone.strip() if payload.guest_phone else None
    if hasattr(room, 'room_phone'):
        room.room_phone = payload.room_phone.strip() if payload.room_phone else f"Ext {room.room_number}"
    if hasattr(room, 'identity_number'):
        room.identity_number = clean_id
    room.pin_code = generated_pin
    tag_val = payload.tag_code or payload.nfc_card_uid
    if tag_val is not None:
        room.tag_code = tag_val.strip() if tag_val.strip() else None
    room.status = payload.status or "OCCUPIED"

    await db.commit()
    await db.refresh(room)
    return room


@router.post(
    "/rooms/{room_id}/check-out",
    response_model=RoomInfoResponse,
    tags=TAG_REC,
    summary="Lễ tân thực hiện Check-out và xóa mã PIN, tagCode phòng",
)
async def check_out_room(
    room_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Thủ tục Check-out phòng:
    - Xóa tên khách, mã PIN, số CCCD và thẻ NFC tagCode để đảm bảo bảo mật.
    - Đổi trạng thái phòng thành 'CLEANING'.
    """
    stmt = select(Room).where((Room.id == room_id) | (Room.room_number == room_id))
    res = await db.execute(stmt)
    room = res.scalars().first()

    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng")

    room.current_guest_name = None
    if hasattr(room, 'current_guest_phone'):
        room.current_guest_phone = None
    room.identity_number = None
    room.pin_code = None
    room.tag_code = None
    room.status = "CLEANING"

    await db.commit()
    await db.refresh(room)
    return room


