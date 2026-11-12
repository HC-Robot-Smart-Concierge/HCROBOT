"""Keep reports for one room/device on its open repair ticket across channels."""
import hashlib
import re
import unicodedata
from datetime import datetime

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.maintenance import MaintenanceCatalogItem
from app.models.support_request import SupportRequest


TERMINAL_STATUSES = (
    "completed", "resolved", "done", "closed", "cancelled", "canceled",
    "declined", "rejected", "delivered", "missed",
    "hoàn tất", "đã hoàn thành", "đã hoàn tất", "đã hủy", "hủy", "đã từ chối",
)

# Deliberately identify devices, never an entire catalog category (e.g. plumbing).
# Unknown or ambiguous free text keeps exact-issue deduplication only.
DEVICE_PATTERNS = {
    "air_conditioner": r"\b(?:ac|air con(?:ditioner|ditioning)?|dieu hoa|may lanh)\b",
    "faucet_shower": r"\b(?:faucet|shower head|voi nuoc|voi sen|voi rua)\b",
    "drain": r"\b(?:sink|drain(?:age)?|bon rua|thoat nuoc)\b",
    "toilet": r"\b(?:toilet|bon cau)\b",
    "hot_water": r"\b(?:hot water|nuoc nong|water heater|binh nong lanh)\b",
    "lighting": r"\b(?:lighting|light bulb|bong den|den phong|den ngu)\b",
    "power_outlet": r"\b(?:outlet|socket|o cam)\b",
    "room_power": r"\b(?:power outage|circuit breaker|mat dien|aptomat)\b",
    "door_lock": r"\b(?:door lock|keycard|khoa cua|khoa the)\b",
    "wifi": r"\b(?:wi fi|wifi|internet|access point)\b",
    "tv": r"\b(?:tv|tivi|television)\b",
    "minibar": r"\b(?:minibar|mini bar|mini fridge|tu lanh)\b",
    "safe": r"\b(?:safe|ket sat)\b",
}


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value or "").casefold().replace("đ", "d"))
    value = "".join(char for char in value if not unicodedata.combining(char))
    return " ".join(re.findall(r"[a-z0-9]+", value))


# Guests often report a fault without a request verb ("điều hòa còn bị chảy nước
# nữa"). Matched on the accented text so "hông" (= "không") is not read as "hỏng".
SYMPTOM_PATTERN = re.compile(
    r"(?<!\w)(?:"
    r"hư|hỏng|bị lỗi|bi loi|trục trặc|truc trac|có vấn đề|co van de|yếu|"
    r"chảy nước|chay nuoc|rò nước|ro nuoc|rò rỉ|ro ri|rỉ nước|ri nuoc|nhỏ giọt|nho giot|đọng nước|dong nuoc|"
    r"không (?:mát|lạnh|nóng|chạy|hoạt động|bật được|tắt được|lên|sáng|vào|kết nối|có điện|có sóng|có hình|có tiếng|xả được|thoát nước|mở được|khóa được)|"
    r"khong (?:mat|lanh|nong|chay|hoat dong|bat duoc|tat duoc|len|sang|vao|ket noi|co dien|co song|co hinh|co tieng|xa duoc|thoat nuoc|mo duoc|khoa duoc)|"
    r"kêu to|keu to|kêu ồn|keu on|ồn quá|tiếng ồn|tieng on|bốc mùi|boc mui|có mùi|co mui|"
    r"chập chờn|chap chon|chập điện|chap dien|mất điện|mat dien|cúp điện|cup dien|tự tắt|tu tat|tắc|nghẹt|nghet|"
    r"leak(?:s|ing)?|drip(?:s|ping)?|broken|noisy|clogged|blocked|no (?:power|signal|hot water)|"
    r"not (?:working|cooling|heating|draining)|(?:does not|doesn[’']t|won[’']t|will not|can[’']t|cannot) (?:work|turn on|connect|cool|drain)"
    r")(?!\w)",
    re.IGNORECASE,
)


def is_fault_report(text: str) -> bool:
    """A named device plus a symptom is a repair report, not an amenity question."""
    if not text or not SYMPTOM_PATTERN.search(str(text).lower()):
        return False
    normalized = normalize_text(text)
    return any(re.search(pattern, normalized) for pattern in DEVICE_PATTERNS.values())


def normalize_room(value: str) -> str:
    return re.sub(r"^(?:room|phong|p)\s*(?=\d)", "", normalize_text(value)).strip()


def maintenance_room_filter(room: str):
    compact = normalize_room(room).replace(" ", "")
    variants = [compact, f"room{compact}", f"phòng{compact}", f"phong{compact}", f"p.{compact}"]
    return func.lower(func.replace(func.trim(SupportRequest.room_number), " ", "")).in_(variants)


def issue_texts(request: SupportRequest) -> set[str]:
    # Scheduling preference is not a different issue. Strip only the kiosk's
    # known suffix, preserving arbitrary guest notes in square brackets.
    description = re.sub(
        r"\s*-?\s*\[(?:Cần thợ lên ngay|Lên khi khách vắng mặt|Require immediate visit|Visit when guest is out)\]\s*$",
        "", request.description or "", flags=re.IGNORECASE,
    )
    title = request.title or ""
    if normalize_text(title).startswith(("yeu cau tu kiosk", "su co ky thuat phong")):
        title = ""  # Generic voice/PIN titles must not merge different repairs.
    return {value for value in (normalize_text(title), normalize_text(description)) if value}


def issue_keys(request: SupportRequest, catalog: list[MaintenanceCatalogItem]) -> set[str]:
    values = issue_texts(request)
    keys = {f"text:{value}" for value in values}
    keys.update((request.extra_data or {}).get("maintenance_issue_keys") or [])
    catalog_id = (request.extra_data or {}).get("maintenance_catalog_item_id")
    for item in catalog:
        names = {normalize_text(item.name_vi), normalize_text(item.name_en)} - {""}
        if item.id == catalog_id or values.intersection(names):
            keys.add(f"catalog:{item.id}")
    return keys


def equipment_key(request: SupportRequest, catalog: list[MaintenanceCatalogItem]) -> str | None:
    stored = (request.extra_data or {}).get("maintenance_equipment_key")
    if stored:
        return stored
    keys = issue_keys(request, catalog)
    matched_items = [item for item in catalog if f"catalog:{item.id}" in keys]
    # Catalog labels provide a stable bilingual identity; arbitrary notes must
    # not change which device a selected catalog item refers to.
    labels = " ".join(f"{item.name_vi} {item.name_en}" for item in matched_items)
    value = normalize_text(labels) if labels else " ".join(issue_texts(request))
    devices = {key for key, pattern in DEVICE_PATTERNS.items() if re.search(pattern, value)}
    return next(iter(devices)) if len(devices) == 1 else None


def maintenance_queue_order():
    """Open tickets first, staff-marked urgent first, FIFO within each group."""
    return (
        func.lower(func.trim(func.coalesce(SupportRequest.status, "Pending"))).in_(TERMINAL_STATUSES),
        (func.upper(func.trim(SupportRequest.priority)) == "URGENT").desc(),
        SupportRequest.created_at.asc(),
        SupportRequest.id.asc(),
    )


async def get_or_create_maintenance_request(
    db: AsyncSession, request: SupportRequest, catalog_item_id: str | None = None,
) -> tuple[SupportRequest, bool, bool]:
    """Return (ticket, created, merged); notify only on creation/new symptoms.

    A PostgreSQL transaction lock serializes all creation channels for a room,
    including the first request when no ticket row exists yet. It is released
    on commit/rollback, and works across backend processes/devices.
    """
    room = normalize_room(request.room_number)
    if not room:
        raise ValueError("A room is required for a maintenance request")
    lock_key = int.from_bytes(hashlib.sha256(f"maintenance:{room}".encode()).digest()[:8], "big", signed=True)
    await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})

    catalog = list((await db.execute(select(MaintenanceCatalogItem))).scalars().all())
    if catalog_item_id and any(item.id == catalog_item_id for item in catalog):
        request.extra_data = {**(request.extra_data or {}), "maintenance_catalog_item_id": catalog_item_id}
    keys = issue_keys(request, catalog)
    device = equipment_key(request, catalog)
    room_match = maintenance_room_filter(room)
    if request.room_id:
        room_match = or_(room_match, SupportRequest.room_id == request.room_id)
    candidates = (await db.execute(
        select(SupportRequest).where(
            or_(SupportRequest.department_id == "DEP-MAINTENANCE", SupportRequest.service_type_id == "ST-MAINTENANCE"),
            room_match,
            func.lower(func.trim(func.coalesce(SupportRequest.status, "Pending"))).notin_(TERMINAL_STATUSES),
        ).order_by(SupportRequest.created_at, SupportRequest.id).with_for_update()
    )).scalars().all()
    for existing in candidates:
        existing_device = equipment_key(existing, catalog)
        if device and existing_device and device != existing_device:
            continue  # A shared generic title cannot equate two different devices.
        if keys.intersection(issue_keys(existing, catalog)):
            return existing, False, False

    for existing in candidates:
        if device and device == equipment_key(existing, catalog):
            existing_keys = issue_keys(existing, catalog)
            # Reassign the JSON value so SQLAlchemy persists the added keys.
            existing.extra_data = {
                **(existing.extra_data or {}),
                "maintenance_equipment_key": device,
                "maintenance_issue_keys": sorted(existing_keys | keys),
            }
            previous = existing.description or existing.title or ""
            incoming = request.description or request.title or ""
            existing.description = f"{previous}\n• {incoming}"
            existing.updated_at = datetime.utcnow()
            # Keep status, assigned technician, priority and creation time.
            await db.flush()
            return existing, False, True

    request.room_number = room
    request.extra_data = {
        **(request.extra_data or {}), "maintenance_issue_keys": sorted(keys),
        "maintenance_equipment_key": device,
    }
    request.priority = "Normal"  # Only staff can escalate a repair ticket.
    db.add(request)
    await db.flush()
    return request, True, False


def merged_maintenance_message(ticket_code: str, english: bool = False) -> str:
    if english:
        return f"The additional issue was added to your open repair request #{ticket_code} for the same equipment. The technician will see the update; no new ticket was created."
    return f"Đã bổ sung sự cố vào phiếu sửa chữa #{ticket_code} đang mở cho cùng thiết bị. Kỹ thuật viên sẽ nhận được nội dung bổ sung; không tạo thêm phiếu mới."


def duplicate_maintenance_message(ticket_code: str, english: bool = False) -> str:
    if english:
        return f"This issue already has an open request #{ticket_code} for your room. Please track that request; no new ticket was created."
    return f"Sự cố này của phòng đã có phiếu #{ticket_code} đang chờ hoặc đang xử lý. Quý khách vui lòng theo dõi phiếu hiện có; hệ thống không tạo phiếu mới."
