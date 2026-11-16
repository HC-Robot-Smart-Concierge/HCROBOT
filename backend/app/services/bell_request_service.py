"""Bellman requests shared by voice AI, PIN/NFC verification and the robot menu.

Guests can ask the Bell team for luggage handling and help moving to another
room. Each request is stored in ``support_requests`` under DEP-BELL / ST-BELL,
tagged with the service in ``extra_data["bell_service"]``.
"""
import hashlib
import random
import re

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.support_request import SupportRequest
from app.services.ai.constants import SERVICE_KEYWORDS, contains_keyword
from app.services.maintenance_request_service import (
    TERMINAL_STATUSES,
    maintenance_room_filter,
    normalize_room,
    normalize_text,
)

BELL_DEPARTMENT_ID = "DEP-BELL"
BELL_SERVICE_TYPE_ID = "ST-BELL"
GENERIC_LABEL = {"vi": "Hỗ trợ hành lý", "en": "Luggage assistance"}

# Checked in order on accent-free text: specific wording ("lấy lại hành lý đã gửi")
# must win over generic luggage words that every service shares.
BELL_SERVICES = {
    "room_move": {
        "vi": "Chuyển đồ sang phòng mới",
        "en": "Room move assistance",
        "pattern": r"\b(?:chuyen|doi) (?:do |hanh l[iy] |vali )?(?:sang |qua )?phong\b|\bphong moi\b"
                   r"|\broom (?:move|change)\b|\bchang(?:e|ing) rooms?\b"
                   r"|\bmov(?:e|ing) (?:to )?(?:a |an )?(?:new |another |different )room\b",
    },
    "luggage_retrieval": {
        "vi": "Lấy lại hành lý đã gửi",
        "en": "Retrieve stored luggage",
        "pattern": r"\b(?:lay|nhan) lai (?:hanh l[iy]|vali|do|tui)\b|\bhanh l[iy] (?:da )?gui\b"
                   r"|\bretriev|\bstored (?:luggage|bags?|suitcases?)\b",
    },
    "luggage_storage": {
        "vi": "Gửi giữ hành lý",
        "en": "Store luggage",
        "pattern": r"\b(?:gui|giu|ky gui) (?:lai )?(?:hanh l[iy]|vali|do|tui)\b|\bgui giu\b"
                   r"|\bstor(?:e|age)\b|\b(?:keep|hold|leave) (?:my )?(?:luggage|bags?|suitcases?)\b",
    },
    "luggage_pickup": {
        "vi": "Lấy hành lý xuống sảnh",
        "en": "Take luggage down to lobby",
        "pattern": r"\bxuong (?:sanh|tang tret|le tan|duoi)\b|\btra phong\b|\bcheck ?out\b|\bra (?:xe|taxi|cua)\b"
                   r"|\b(?:lay|mang|dem|chuyen|xach) (?:hanh l[iy]|vali|do|tui)(?: [a-z]+){0,3} xuong\b"
                   r"|\bpick(?:ing)? ?up\b|\bcollect\b|\b(?:down )?to the (?:lobby|car|taxi)\b|\bdown\b",
    },
    "luggage_delivery": {
        "vi": "Mang hành lý lên phòng",
        "en": "Bring luggage to room",
        "pattern": r"\blen phong\b|\b(?:mang|dem|dua|xach|chuyen|van chuyen) (?:hanh l[iy]|vali|do|tui)(?: [a-z]+){0,3} len\b"
                   r"|\b(?:up )?to my room\b|\bdeliver|\bbring\b|\bcarry\b",
    },
}


def classify_bell_request(text_value: str) -> str | None:
    """Return the Bellman service a guest asked for, or None for a generic luggage request."""
    value = normalize_text(text_value)
    return next((key for key, svc in BELL_SERVICES.items() if re.search(svc["pattern"], value)), None)


def bell_service_label(service_key: str | None, english: bool = False) -> str:
    labels = BELL_SERVICES.get(service_key or "", GENERIC_LABEL)
    return labels["en"] if english else labels["vi"]


def is_bell_inquiry(text_value: str) -> bool:
    """The guest is talking about luggage ("hành lý tôi đem lên chưa"), not food or housekeeping."""
    return contains_keyword(str(text_value or "").lower(), SERVICE_KEYWORDS["bellman"])


def _bell_query(clean_room: str):
    return select(SupportRequest).where(
        or_(SupportRequest.department_id == BELL_DEPARTMENT_ID, SupportRequest.service_type_id == BELL_SERVICE_TYPE_ID),
        maintenance_room_filter(clean_room),
    )


async def bell_status_reply(db: AsyncSession, room_number: str, english: bool = False) -> str:
    """Spoken answer to "has my luggage been brought up?": the newest open request, else the newest one."""
    clean_room = normalize_room(room_number)
    requests = (await db.execute(
        _bell_query(clean_room).order_by(SupportRequest.created_at.desc()).limit(20)
    )).scalars().all()
    if not requests:
        if english:
            return f"Room {room_number} has no luggage requests yet. Say \"luggage menu\" if you would like the Bell team's help."
        return f"Dạ phòng {room_number} hiện chưa có yêu cầu hành lý nào ạ. Quý khách nói \"menu hành lý\" nếu cần Bellman hỗ trợ nhé."

    def status_of(req):
        return (req.status or "Pending").strip().lower()

    open_requests = [r for r in requests if status_of(r) not in TERMINAL_STATUSES]
    target = open_requests[0] if open_requests else requests[0]
    status = status_of(target)
    label = bell_service_label((target.extra_data or {}).get("bell_service"), english)
    staff = target.assigned_staff_name
    if status in ("in progress", "assigned", "on the way"):
        phrase = (f"is being handled by {staff}" if staff else "is being handled by our Bell team") if english \
            else (f"đang được nhân viên {staff} xử lý" if staff else "đang được nhân viên Bellman xử lý")
    elif status in ("completed", "resolved", "done", "delivered", "hoàn tất", "đã hoàn thành", "đã hoàn tất"):
        phrase = "has been completed" if english else "đã hoàn tất"
    elif status in TERMINAL_STATUSES:
        phrase = "was cancelled" if english else "đã bị hủy"
    else:
        phrase = "has been received and is waiting for a bellman" if english \
            else "đã được tiếp nhận và đang chờ nhân viên Bellman nhận xử lý"
    others = len(open_requests) - 1 if target in open_requests else 0
    if english:
        more = f" You have {others} more open luggage request(s)." if others > 0 else ""
        return f"Your request \"{label}\" (#{target.ticket_code}) for Room {room_number} {phrase}.{more}"
    more = f" Phòng còn {others} yêu cầu hành lý khác đang chờ." if others > 0 else ""
    return f"Dạ yêu cầu \"{label}\" (#{target.ticket_code}) của Phòng {room_number} {phrase} ạ.{more}"


async def get_or_create_bell_request(
    db: AsyncSession,
    *,
    room_number: str,
    description: str,
    source: str,
    service_key: str | None = None,
    guest_name: str | None = None,
    room_id: str | None = None,
    notify_reception: bool = False,
) -> tuple[SupportRequest, bool]:
    """Return (ticket, created). Repeating an open request for the same room returns that ticket."""
    from app.api.v1.endpoints.operations.shared import create_department_notification

    room = str(room_number or "").strip()
    clean_room = normalize_room(room)
    if not clean_room:
        raise ValueError("A room is required for a Bellman request")
    if service_key not in BELL_SERVICES:
        service_key = classify_bell_request(description)

    # Serialize channels (voice, PIN, menu, double taps) for one room until commit.
    lock_key = int.from_bytes(hashlib.sha256(f"bell:{clean_room}".encode()).digest()[:8], "big", signed=True)
    await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})

    room_match = maintenance_room_filter(clean_room)
    if room_id:
        room_match = or_(room_match, SupportRequest.room_id == room_id)
    open_requests = (await db.execute(
        select(SupportRequest).where(
            or_(SupportRequest.department_id == BELL_DEPARTMENT_ID, SupportRequest.service_type_id == BELL_SERVICE_TYPE_ID),
            room_match,
            func.lower(func.trim(func.coalesce(SupportRequest.status, "Pending"))).notin_(TERMINAL_STATUSES),
        ).order_by(SupportRequest.created_at, SupportRequest.id)
    )).scalars().all()
    for existing in open_requests:
        existing_key = (existing.extra_data or {}).get("bell_service")
        if service_key and existing_key == service_key:
            return existing, False
        if not service_key and not existing_key and normalize_text(existing.description) == normalize_text(description):
            return existing, False

    label = bell_service_label(service_key)
    request = SupportRequest(
        ticket_code=f"BS-{random.randint(1000, 99999)}",
        title=label,
        room_number=room,
        room_id=room_id,
        guest_name=guest_name or f"Guest (Room {room})",
        source=source,
        description=description or label,
        department_id=BELL_DEPARTMENT_ID,
        service_type_id=BELL_SERVICE_TYPE_ID,
        status="Pending",
        extra_data={"bell_service": service_key},
    )
    db.add(request)
    await db.flush()

    # Reception assigns the new room, so it must also see room-move requests.
    departments = ("Bell Services", "Reception") if notify_reception or service_key == "room_move" else ("Bell Services",)
    for department in departments:
        await create_department_notification(
            db,
            department=department,
            title=f"Yêu cầu Bellman mới #{request.ticket_code}: {label}",
            description=f"Phòng {room}: {request.description}",
            request_id=request.id,
            request_type="bell_service",
            type="Request",
        )
    return request, True


def bell_request_message(request: SupportRequest, created: bool, english: bool = False) -> str:
    service_key = (request.extra_data or {}).get("bell_service")
    label = bell_service_label(service_key, english)
    code, room = request.ticket_code, request.room_number
    if created:
        if english:
            note = " Front Desk will confirm your new room." if service_key == "room_move" else ""
            return f"Your request \"{label}\" for Room {room} has been sent to the Bell team (ticket #{code}).{note}"
        note = " Lễ tân sẽ xác nhận phòng mới với quý khách." if service_key == "room_move" else ""
        return f"Dạ Rora đã gửi yêu cầu \"{label}\" của Phòng {room} tới bộ phận Bellman, mã phiếu #{code}.{note}"
    if english:
        return f"Room {room} already has an open request \"{label}\" (#{code}). No new ticket was created."
    return f"Phòng {room} đã có yêu cầu \"{label}\" đang chờ xử lý (#{code}). Hệ thống không tạo thêm phiếu mới."
