import logging
import random
from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.support_request import SupportRequest
from app.models.support import HumanSupportSession
from app.services.maintenance_request_service import get_or_create_maintenance_request
from app.services.bell_request_service import get_or_create_bell_request, BELL_DEPARTMENT_ID, BELL_SERVICE_TYPE_ID
from app.services.ai.ai_ticket_handlers import (
    handle_cancel_service_ticket,
    handle_room_service_or_restaurant_ticket,
)
from app.services.ai.constants import is_lost_found_text
from app.api.v1.endpoints.operations.shared import create_department_notification

logger = logging.getLogger(__name__)


async def create_maintenance_voice_ticket(db: AsyncSession, room_number: str, items: str) -> tuple[str, bool, bool]:
    request = SupportRequest(
        ticket_code=f"MN-{random.randint(1000, 99999)}",
        source="HCRobot Concierge AI Chat",
        title=f"Sự cố kỹ thuật Phòng {room_number}: {items}",
        room_number=room_number,
        description=items,
        guest_name=f"Guest (Room {room_number})",
        department_id="DEP-MAINTENANCE",
        service_type_id="ST-MAINTENANCE",
        status="Pending",
    )
    request, created, merged = await get_or_create_maintenance_request(db, request)
    if created or merged:
        for department in ("Maintenance", "Reception"):
            await create_department_notification(
                db=db, department=department,
                title=f"Robot AI: Bổ sung sự cố #{request.ticket_code}" if merged else f"Robot AI: Yêu cầu Kỹ thuật mới #{request.ticket_code}",
                description=f"Phòng {room_number}: {items}",
                request_id=request.id, request_type="maintenance", type="Request",
            )
    ticket_code = request.ticket_code
    await db.commit()
    return ticket_code, created, merged


async def create_bell_voice_ticket(db: AsyncSession, room_number: str, items: str) -> tuple[SupportRequest, bool]:
    if is_lost_found_text(items):
        ticket_code = f"BS-{random.randint(1000, 99999)}"
        req = SupportRequest(
            ticket_code=ticket_code,
            source="HCRobot Concierge AI Chat",
            title=f"Báo cáo đồ thất lạc Phòng {room_number}: {items}",
            room_number=room_number,
            guest_name=f"Guest (Room {room_number})",
            description=items,
            department_id=BELL_DEPARTMENT_ID,
            service_type_id=BELL_SERVICE_TYPE_ID,
            status="Pending",
            request_type="lost_found",
        )
        db.add(req)
        await db.flush()
        await create_department_notification(
            db=db,
            department="Bell Services",
            title=f"Robot AI: Báo cáo Đồ thất lạc #{ticket_code}",
            description=f"Phòng {room_number}: {items}",
            request_id=req.id,
            request_type="bell_service",
            type="Request",
        )
        await create_department_notification(
            db=db,
            department="Reception",
            title=f"Robot AI: Yêu cầu Bellman từ Khách Phòng {room_number}",
            description=f"Phiếu #{ticket_code}: {items}",
            request_id=req.id,
            request_type="bell_service",
            type="Request",
        )
        await db.commit()
        return req, True

    request, created = await get_or_create_bell_request(
        db, room_number=room_number, description=items,
        source="HCRobot Concierge AI Chat", notify_reception=True,
    )
    await db.commit()
    return request, created


async def create_live_call_session(
    db: AsyncSession,
    prompt: str,
    room_number: Optional[str] = None
) -> Tuple[Optional[str], Optional[str]]:
    """
    Khởi tạo phiên hỗ trợ trực tiếp (Live Video Call) tới Concierge và tạo thông báo khẩn cấp.
    Trả về tuple: (support_session_id, call_ticket_code)
    """
    try:
        code_num = random.randint(1000, 99999)
        call_ticket_code = f"CCG-{code_num}"
        room_loc = room_number or "Main Lobby Kiosk"

        req = SupportRequest(
            ticket_code=call_ticket_code,
            source="Robot Voice Assistant",
            title=f"Live Call Concierge ({room_loc})",
            room_number=room_loc,
            description=prompt or "Yêu cầu cuộc gọi video trực tiếp từ khách",
            guest_name=f"Guest ({room_loc})",
            department_id="DEP-CONCIERGE",
            service_type_id="ST-CONCIERGE",
            status="Pending",
        )
        db.add(req)
        await db.flush()

        human_session = HumanSupportSession(
            session_code=f"LIVE-{code_num}",
            room_number=room_loc,
            guest_name=f"Guest ({room_loc})",
            category="Live Call Support",
            origin_robot_code="RC-001 (Main Lobby)",
            sentiment="Neutral",
            status="Active",
            linked_request_id=req.id,
            call_started_at=datetime.now(timezone.utc).replace(tzinfo=None),
            messages=[{"speaker": "guest", "text": prompt}],
        )
        db.add(human_session)
        await db.flush()

        await create_department_notification(
            db=db,
            department="Concierge",
            title=f"Cuộc gọi Video Call mới: {call_ticket_code}",
            description=f"Khách tại {room_loc} đang gọi video tới Concierge",
            request_id=req.id,
            request_type="concierge",
            type="LiveAssistance",
        )

        from app.services.video_call_manager import video_call_manager
        video_call_manager.register_alias(
            call_ticket_code,
            req.id,
            human_session.id,
            human_session.session_code,
        )

        await db.commit()
        logger.info(
            f"[AITicketService] Live video call created: ticket='{call_ticket_code}', "
            f"req_id='{req.id}', session_id='{human_session.id}'"
        )
        # Trả về call_ticket_code làm support_session_id để Robot và Concierge cùng kết nối phòng CCG-xxxxx
        return call_ticket_code, call_ticket_code
    except Exception as e:
        logger.error(f"[AITicketService VideoCall Error] {e}")
        await db.rollback()
        return None, None


async def auto_create_ticket(
    db: AsyncSession,
    action: str,
    room_number: str,
    items: str
) -> str:
    """
    Tự động chèn Ticket dịch vụ vào PostgreSQL Database tương ứng (SupportRequest)
    và gửi Notification tới phòng ban phụ trách cùng Lễ tân.
    """
    code = f"AUTO-{random.randint(1000, 99999)}"
    if not room_number:
        logger.warning(f"[AITicketService] auto_create_ticket skipped: missing room_number for action '{action}'.")
        return ""
    rm = room_number.strip()

    try:
        if action in ["room_service", "restaurant"]:
            return await handle_room_service_or_restaurant_ticket(db, rm, items)

        elif action == "housekeeping":
            ticket_code = f"HK-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="HCRobot Concierge AI Chat",
                title=f"Yêu cầu Buồng phòng (Phòng {rm}): {items}",
                room_number=rm,
                description=items,
                guest_name=f"Guest (Room {rm})",
                department_id="DEP-HOUSEKEEPING",
                service_type_id="ST-HOUSEKEEPING",
                status="Unassigned",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Housekeeping",
                title=f"Robot AI: Yêu cầu Buồng phòng mới #{ticket_code}",
                description=f"Phòng {rm}: {items}",
                request_id=req.id,
                request_type="housekeeping",
                type="Request",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Yêu cầu Buồng phòng từ Khách Phòng {rm}",
                description=f"Phiếu #{ticket_code}: {items}",
                request_id=req.id,
                request_type="housekeeping",
                type="Request",
            )
            await db.commit()
            return ticket_code

        elif action == "bellman":
            req, _ = await create_bell_voice_ticket(db, rm, items)
            return req.ticket_code

        elif action == "emotion_alert":
            loc = rm if (rm and rm != "General") else "Main Lobby Kiosk"
            ticket_code = f"EA-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="HCRobot Emotion AI",
                title=f"Cảnh báo AI: Khách có biểu cảm khó chịu tại {loc}",
                room_number=loc,
                guest_name=f"Guest ({loc})" if rm else "Khách tại Sảnh Kiosk",
                description=items or "Camera AI phát hiện khách có biểu cảm khó chịu trong khi giao tiếp với Robot Kiosk.",
                department_id="DEP-CONCIERGE",
                service_type_id="ST-CONCIERGE",
                status="Pending",
                priority="High",
                request_type="emotion_alert",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Concierge",
                title=f"Cảnh báo Khẩn #{ticket_code}: Khách có biểu cảm khó chịu",
                description=f"Vị trí {loc}: {items}",
                request_id=req.id,
                request_type="concierge",
                type="Alert",
            )
            await db.commit()
            return ticket_code

        elif action == "maintenance":
            ticket_code, _, _ = await create_maintenance_voice_ticket(db, rm, items)
            return ticket_code

        elif action == "taxi":
            ticket_code = f"TX-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="HCRobot Concierge AI Chat",
                title=f"Yêu cầu Đặt xe từ Phòng {rm}: {items}",
                room_number=rm,
                description=items,
                guest_name=f"Guest (Room {rm})",
                department_id="DEP-TAXI",
                service_type_id="ST-TAXI",
                status="Pending",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Taxi",
                title=f"Robot AI: Yêu cầu Đặt xe mới #{ticket_code}",
                description=f"Phòng {rm}: {items}",
                request_id=req.id,
                request_type="taxi",
                type="Request",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Yêu cầu Taxi từ Khách Phòng {rm}",
                description=f"Phiếu #{ticket_code}: {items}",
                request_id=req.id,
                request_type="taxi",
                type="Request",
            )
            await db.commit()
            return ticket_code

        elif action in ["concierge", "live_support", "video_call", "emergency"]:
            ticket_code = f"CCG-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="Robot Voice Assistant",
                title=f"Yêu cầu Hỗ trợ Concierge trực tuyến (Phòng {rm}): {items}",
                room_number=rm,
                description=items or "Yêu cầu kết nối Live Call với Concierge từ Robot",
                guest_name=f"Guest (Room {rm})",
                department_id="DEP-CONCIERGE",
                service_type_id="ST-CONCIERGE",
                status="Pending",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Concierge",
                title=f"Robot AI: Cuộc gọi hỗ trợ Concierge #{ticket_code}",
                description=f"Phòng {rm} cần trợ giúp: {items}",
                request_id=req.id,
                request_type="concierge",
                type="LiveAssistance",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Yêu cầu Concierge từ Khách Phòng {rm}",
                description=f"Phiếu #{ticket_code}: {items}",
                request_id=req.id,
                request_type="concierge",
                type="Request",
            )

        elif action == "cancel_service":
            return await handle_cancel_service_ticket(db, rm, items)

        elif action == "laundry":
            ticket_code = f"LD-{random.randint(1000, 99999)}"
            if db:
                req = SupportRequest(
                    ticket_code=ticket_code,
                    source="HCRobot Concierge AI Chat",
                    title=f"Yêu cầu Giặt ủi (Phòng {rm}): {items}",
                    room_number=rm,
                    description=items,
                    guest_name=f"Guest (Room {rm})",
                    department_id="DEP-HOUSEKEEPING",
                    service_type_id="ST-HOUSEKEEPING",
                    status="Pending",
                )
                db.add(req)
                await create_department_notification(
                    db=db,
                    department="Housekeeping",
                    title=f"Robot AI: Yêu cầu Giặt ủi mới #{ticket_code}",
                    description=f"Phòng {rm}: {items}",
                    request_id=req.id,
                    request_type="laundry",
                    type="Request",
                )
                await create_department_notification(
                    db=db,
                    department="Reception",
                    title=f"Robot AI: Yêu cầu Giặt ủi từ Khách Phòng {rm}",
                    description=f"Phiếu #{ticket_code}: {items}",
                    request_id=req.id,
                    request_type="laundry",
                    type="Request",
                )
                await db.commit()
            return ticket_code

        elif action == "wake_up":
            ticket_code = f"WU-{random.randint(1000, 99999)}"
            if db:
                req = SupportRequest(
                    ticket_code=ticket_code,
                    source="HCRobot Concierge AI Chat",
                    title=f"Yêu cầu Báo thức (Phòng {rm}): {items}",
                    room_number=rm,
                    description=items,
                    guest_name=f"Guest (Room {rm})",
                    department_id="DEP-RECEPTION",
                    service_type_id="ST-RECEPTION",
                    status="Pending",
                )
                db.add(req)
                await create_department_notification(
                    db=db,
                    department="Reception",
                    title=f"Robot AI: Yêu cầu Báo thức mới #{ticket_code}",
                    description=f"Phòng {rm}: {items}",
                    request_id=req.id,
                    request_type="wake_up",
                    type="Request",
                )
                await db.commit()
            return ticket_code
        else:
            # Default Reception & General Service Request
            ticket_code = f"REC-{random.randint(1000, 99999)}"
            if db:
                req = SupportRequest(
                    ticket_code=ticket_code,
                    source="HCRobot Concierge AI Chat",
                    title=f"Yêu cầu Lễ tân từ Phòng {rm}: {items}",
                    room_number=rm,
                    description=items,
                    guest_name=f"Guest (Room {rm})",
                    department_id="DEP-RECEPTION",
                    service_type_id="ST-RECEPTION",
                    status="Pending",
                )
                db.add(req)
                await create_department_notification(
                    db=db,
                    department="Reception",
                    title=f"Robot AI: Yêu cầu Lễ tân mới #{ticket_code}",
                    description=f"Phòng {rm}: {items}",
                    request_id=req.id,
                    request_type="reception",
                    type="Request",
                )
                await db.commit()
            return ticket_code

    except Exception as e:
        logger.error(f"[AITicketService] Error auto-creating service ticket: {e}")
        await db.rollback()

    return code


async def background_extract_and_create_ticket(
    prompt: str,
    room_number: Optional[str],
    action: Optional[str] = None,
    items: Optional[str] = None
):
    """
    Tạo ticket ngầm dưới nền sử dụng intent đã có sẵn từ LangGraph,
    kèm số phòng chính xác của khách và định tuyến đến đúng phòng ban phụ trách.
    """
    if not room_number:
        logger.info(f"[AITicketService] Skipping background ticket creation for '{action}' because guest has not yet provided room number.")
        return

    # Không tạo ticket nếu là chào hỏi, giới thiệu phòng hoặc câu hỏi thông tin chung
    if action in ["provide_room_number", "chitchat", "conversation", "faq", "fast_path", "unknown", "query_order_status", "open_food_menu", "open_room_service_menu", "open_maintenance_menu", "open_bellman_menu"]:
        return

    items_desc_check = (items or prompt or "").lower()
    non_orderable_kw = [
        "xem lại", "xem lai", "cho tôi xem", "cho toi xem", "cho xem",
        "kiểm tra", "kiem tra", "trạng thái", "trang thai", "tiến độ", "tien do",
        "xong chưa", "xong chua", "khi nào", "bao giờ", "tại sao", "tai sao",
        "vì sao", "vi sao", "lý do", "ly do", "món đồ đặc", "mon do dac", "món đồ đạc",
        "đã đặt", "da dat", "đã gọi", "da goi"
    ]
    if any(k in items_desc_check for k in non_orderable_kw):
        logger.warning(f"[AITicketService] Skipping background ticket creation for non-orderable inquiry: '{items or prompt}'")
        return

    try:
        from app.core.database import AsyncSessionLocal
        target_action = action or "reception"
        items_desc = items or prompt

        async with AsyncSessionLocal() as bg_db:
            created_ticket_code = await auto_create_ticket(
                bg_db, target_action, room_number.strip(), items_desc
            )
            if created_ticket_code:
                logger.info(
                    f"[AITicketService] Successfully created ticket #{created_ticket_code} for department '{target_action}' (Room {room_number}): {items_desc}"
                )
    except Exception as ex_ticket:
        logger.warning(f"[AITicketService Warning] Could not auto-create ticket: {ex_ticket}")
