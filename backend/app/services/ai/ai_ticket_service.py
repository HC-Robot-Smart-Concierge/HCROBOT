import logging
import random
from typing import Optional, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.support_request import SupportRequest
from app.models.support import HumanSupportSession
from app.api.v1.endpoints.operations.shared import create_department_notification

logger = logging.getLogger(__name__)


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
            call_started_at=datetime.utcnow(),
            messages=[{"speaker": "guest", "text": prompt}],
        )
        db.add(human_session)
        await db.flush()
        support_session_id = human_session.id

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
    rm = str(room_number).strip()

    try:
        if action in ["room_service", "restaurant"]:
            order_num = str(random.randint(1043, 9999))
            ticket_code = f"ORD-{order_num}"
            order = SupportRequest(
                ticket_code=ticket_code,
                title=f"Đơn Room Service (Phòng {rm}): {items}",
                room_number=rm,
                description=items or "Yêu cầu gửi từ HCRobot Concierge AI Chat",
                guest_name=f"Guest (Room {rm})",
                department_id="DEP-ROOMSERVICE",
                service_type_id="ST-ROOM-SERVICE",
                items=[{"name": items, "qty": 1}],
                source="HCRobot Concierge AI Chat",
                status="Pending",
                progress=0,
            )
            db.add(order)
            await create_department_notification(
                db=db,
                department="F&B",
                title=f"Robot AI: Yêu cầu F&B mới từ Phòng {rm}",
                description=f"{items}",
                request_id=order.id,
                request_type="room_service",
                type="Request",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Đơn F&B mới từ Khách Phòng {rm}",
                description=f"Robot đã tiếp nhận đơn #{ticket_code}: {items}",
                request_id=order.id,
                request_type="room_service",
                type="Request",
            )
            await db.commit()
            return ticket_code

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
            ticket_code = f"BS-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="HCRobot Concierge AI Chat",
                title=f"Khách phòng {rm} hỗ trợ hành lý: {items}",
                room_number=rm,
                guest_name=f"Guest (Room {rm})",
                description=items,
                department_id="DEP-BELL",
                service_type_id="ST-BELL",
                status="Pending",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Bell Services",
                title=f"Robot AI: Yêu cầu Hành lý mới #{ticket_code}",
                description=f"Phòng {rm}: {items}",
                request_id=req.id,
                request_type="bell_service",
                type="Request",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Yêu cầu Bellman từ Khách Phòng {rm}",
                description=f"Phiếu #{ticket_code}: {items}",
                request_id=req.id,
                request_type="bell_service",
                type="Request",
            )
            await db.commit()
            return ticket_code

        elif action == "maintenance":
            ticket_code = f"MN-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="HCRobot Concierge AI Chat",
                title=f"Sự cố kỹ thuật Phòng {rm}: {items}",
                room_number=rm,
                description=items,
                guest_name=f"Guest (Room {rm})",
                department_id="DEP-MAINTENANCE",
                service_type_id="ST-MAINTENANCE",
                status="Pending",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Maintenance",
                title=f"Robot AI: Yêu cầu Kỹ thuật mới #{ticket_code}",
                description=f"Phòng {rm}: {items}",
                request_id=req.id,
                request_type="maintenance",
                type="Request",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Yêu cầu Bảo trì từ Khách Phòng {rm}",
                description=f"Phiếu #{ticket_code}: {items}",
                request_id=req.id,
                request_type="maintenance",
                type="Request",
            )
            await db.commit()
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
            await db.commit()
            return ticket_code

        else:
            # Default Reception & General Service Request
            ticket_code = f"REC-{random.randint(1000, 99999)}"
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
    if action in ["provide_room_number", "chitchat", "conversation", "faq", "fast_path", "unknown"]:
        return

    try:
        from app.core.database import AsyncSessionLocal
        target_action = action or "reception"
        items_desc = items or prompt

        async with AsyncSessionLocal() as bg_db:
            created_ticket_code = await auto_create_ticket(
                bg_db, target_action, str(room_number).strip(), items_desc
            )
            if created_ticket_code:
                logger.info(
                    f"[AITicketService] Successfully created ticket #{created_ticket_code} for department '{target_action}' (Room {room_number}): {items_desc}"
                )
    except Exception as ex_ticket:
        logger.warning(f"[AITicketService Warning] Could not auto-create ticket: {ex_ticket}")
