import random
import time
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import SupportRequest
from app.models.hotel import Room
from app.schemas.operations import (
    RoomNfcVerifyRequest,
    RoomPinVerifyRequest,
    RoomPinVerifyResponse,
)
from app.services.ai.constants import is_lost_found_text
from app.services.bell_request_service import (
    BELL_DEPARTMENT_ID,
    BELL_SERVICE_TYPE_ID,
    bell_request_message,
    get_or_create_bell_request,
)
from app.services.maintenance_request_service import (
    duplicate_maintenance_message,
    get_or_create_maintenance_request,
    merged_maintenance_message,
)
from .shared import TAG_REC, create_department_notification

# Anti-bruteforce: Khoa 1 phut (60s) sau 5 lan nhap sai ma PIN
ROOM_PIN_ATTEMPTS: Dict[str, Dict[str, Any]] = {}
PIN_LOCKOUT_MAX_ATTEMPTS = 5
PIN_LOCKOUT_DURATION_SEC = 60

_NO_TICKET_ACTIONS = {
    "chitchat", "conversation", "faq", "unknown",
    "verify_only", "auth_only", "food_menu", "food_order",
    "room_service", "room_service_menu", "amenity_order",
    "taxi", "book_taxi", "taxi_booking",
    "query_order_status", "query_service_status", "query_taxi_status",
}

_NO_TICKET_RESPONSE_ACTIONS = {
    "taxi", "book_taxi", "taxi_booking",
    "query_order_status", "query_service_status", "query_taxi_status",
    "food_menu", "room_service_menu", "verify_only", "auth_only",
}

router = APIRouter()


def normalize_nfc_uid(uid: Optional[str]) -> str:
    """Chuẩn hóa mã UID thẻ NFC: xóa dấu :, gạch ngang, khoảng trắng và chuyển chữ thường."""
    if not uid:
        return ""
    return uid.replace(":", "").replace("-", "").replace(" ", "").strip().lower()


def _resolve_kiosk_department(action: Optional[str], items_or_note: str):
    act_lower = (action or "").lower()
    if any(k in act_lower for k in ["maintenance", "bảo trì", "sửa", "hong"]):
        return "DEP-MAINTENANCE", "ST-MAINTENANCE", "MN", "Maintenance", "maintenance"
    if any(k in act_lower for k in ["room", "fb", "food", "dining"]):
        return "DEP-ROOMSERVICE", "ST-ROOM-SERVICE", "ORD", "Room Service", "room_service"
    if any(k in act_lower for k in ["bell", "hành lý", "hành lí", "thất lạc", "mất đồ", "quên đồ", "lost"]):
        req_type = "lost_found" if is_lost_found_text(f"{act_lower} {items_or_note.lower()}") else "luggage"
        return BELL_DEPARTMENT_ID, BELL_SERVICE_TYPE_ID, "BS", "Bell Services", req_type
    return "DEP-HOUSEKEEPING", "ST-HOUSEKEEPING", "REQ", "Housekeeping", "housekeeping"


async def _complete_kiosk_verification(
    db: AsyncSession,
    payload: Any,
    room: Room,
    verification_type: str,
    *,
    is_nfc_flow: bool = False,
) -> RoomPinVerifyResponse:
    """Xử lý tạo ticket (nếu cần), đánh dấu session đã xác thực và dựng response."""
    ticket_code = None
    duplicate = False
    merged = False
    bell_ticket = None
    should_create_ticket = (
        not getattr(payload, "skip_ticket_creation", False)
        and getattr(payload, "create_ticket", True) is not False
        and bool(payload.action)
        and payload.action not in _NO_TICKET_ACTIONS
    )

    if should_create_ticket:
        code_num = random.randint(1000, 99999)
        raw_items_or_note = payload.items or payload.note or ""
        dept_id, svc_id, prefix, dept_name_str, req_type_str = _resolve_kiosk_department(
            payload.action, raw_items_or_note
        )
        ticket_code = f"{prefix}-{code_num}"
        default_items = "Yêu cầu dịch vụ phòng qua Kiosk (Thẻ NFC)" if is_nfc_flow else "Yêu cầu dịch vụ phòng qua Kiosk"
        items_str = raw_items_or_note or default_items

        if is_nfc_flow:
            req_title = (
                f"Báo cáo đồ thất lạc Phòng {room.room_number} (NFC): {items_str}"
                if req_type_str == "lost_found"
                else f"Hỗ trợ hành lý Phòng {room.room_number} (NFC): {items_str}"
                if dept_id == "DEP-BELL"
                else f"Yêu cầu từ Kiosk (Phòng {room.room_number} - Thẻ NFC)"
            )
            source_label = "Robot Kiosk (NFC Verified)"
            notif_title = f"Đơn mới #{ticket_code} (Đã quẹt thẻ NFC)"
        else:
            req_title = (
                f"Báo cáo đồ thất lạc Phòng {room.room_number}: {items_str}"
                if req_type_str == "lost_found"
                else f"Hỗ trợ hành lý Phòng {room.room_number}: {items_str}"
                if dept_id == "DEP-BELL"
                else f"Yêu cầu từ Kiosk (Phòng {room.room_number})"
            )
            source_label = f"Robot Kiosk ({verification_type} Verified)"
            notif_title = f"Đơn mới #{ticket_code} (Đã xác thực {verification_type})"

        new_req = SupportRequest(
            ticket_code=ticket_code,
            title=req_title,
            description=items_str,
            department_id=dept_id,
            service_type_id=svc_id,
            room_id=room.id,
            room_number=room.room_number,
            guest_name=room.current_guest_name or "Hotel Guest",
            source=source_label,
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
                source=source_label,
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
                title=f"Bổ sung sự cố #{ticket_code}" if merged else notif_title,
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
        or payload.action in _NO_TICKET_RESPONSE_ACTIONS
    )
    prefix_msg = (
        f"Xác thực thẻ phòng {room.room_number} thành công!"
        if is_nfc_flow
        else f"Xác thực phòng {room.room_number} thành công!"
    )
    success_msg = prefix_msg if is_no_ticket else f"{prefix_msg} Yêu cầu đã được chuyển tới bộ phận liên quan."

    return RoomPinVerifyResponse(
        verified=True,
        success=True,
        room_number=room.room_number,
        guest_name=room.current_guest_name,
        ticket_code=ticket_code,
        verification_type=verification_type,
        tagCode=room.tag_code,
        duplicate=duplicate,
        merged=merged,
        message=(
            bell_request_message(bell_ticket, created=not duplicate) if bell_ticket
            else merged_maintenance_message(ticket_code or "") if merged
            else duplicate_maintenance_message(ticket_code or "") if duplicate else success_msg
        ),
    )


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
    res = await db.execute(select(Room).where(Room.room_number == clean_room))
    room = res.scalars().first()

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Phòng {payload.room_number} không tồn tại trên hệ thống khách sạn.",
        )

    if room.status != "OCCUPIED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": f"Dạ phòng {room.room_number} hiện chưa làm thủ tục nhận phòng. Quý khách vui lòng qua quầy Lễ tân để check-in rồi mới được đặt món nhé ạ.",
                "not_checked_in": True,
                "room_number": room.room_number,
                "destination_key": "front_desk",
            },
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
    return await _complete_kiosk_verification(db, payload, room, verification_type, is_nfc_flow=False)


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
    res = await db.execute(select(Room).where(Room.status == "OCCUPIED"))
    rooms = res.scalars().all()

    matched_room = None
    for r in rooms:
        norm_room_tag = normalize_nfc_uid(r.tag_code)
        norm_room_num = normalize_nfc_uid(r.room_number)
        if (
            (norm_room_tag and norm_entered == norm_room_tag)
            or (norm_room_num and norm_entered == norm_room_num)
            or (norm_room_tag and (norm_entered in norm_room_tag or norm_room_tag in norm_entered))
        ):
            matched_room = r
            break

    if not matched_room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mã thẻ (tagCode: '{tag_input}') không tồn tại trên hệ thống hoặc phòng chưa được check-in.",
        )

    return await _complete_kiosk_verification(db, payload, matched_room, "NFC", is_nfc_flow=True)
