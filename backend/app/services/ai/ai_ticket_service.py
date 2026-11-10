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
            import uuid
            from datetime import timedelta
            from sqlalchemy import select, or_, desc
            from sqlalchemy.orm import selectinload
            from app.models.room_service import RoomServiceOrder, OrderItem

            service_kw = [
                "khăn", "khan", "gối", "goi", "chăn", "chan", "nệm", "nem",
                "dọn phòng", "don phong", "vệ sinh", "ve sinh", "massage", "mát xa", "spa",
                "giặt", "giat", "ủi", "ui", "bàn ủi", "bàn là", "tiện ích", "amenity",
                "dịch vụ phòng", "dép", "bàn chải", "dao cạo", "lược", "dầu gội", "sữa tắm",
                "ly", "tách", "muỗng", "nĩa", "chén", "đĩa", "đá lạnh", "tableware", "ice", "glass"
            ]
            items_lower = (items or "").lower()
            non_orderable_kw = [
                "xem lại", "xem lai", "cho tôi xem", "cho toi xem", "cho xem",
                "kiểm tra", "kiem tra", "trạng thái", "trang thai", "tiến độ", "tien do",
                "xong chưa", "xong chua", "khi nào", "bao giờ", "tại sao", "tai sao",
                "vì sao", "vi sao", "lý do", "ly do", "món đồ đặc", "mon do dac", "món đồ đạc",
                "đã đặt", "da dat", "đã gọi", "da goi"
            ]
            if any(k in items_lower for k in non_orderable_kw):
                logger.warning(f"[AITicketService] Bỏ qua tạo/gộp món rác từ câu hỏi tra cứu: '{items}'")
                return ""
            is_svc = any(k in items_lower for k in service_kw)
            assigned_dept_id = "DEP-ROOMSERVICE" if is_svc else "DEP-KITCHEN"
            target_dept_name = "Room Service" if is_svc else "Kitchen"
            clean_room = rm.upper().replace("ROOM", "").strip()

            # Kiểm tra gộp đơn trong vòng 10 phút gần nhất nếu đã có đơn Pending
            merge_window_start = datetime.utcnow() - timedelta(minutes=10)
            existing_pending_stmt = (
                select(RoomServiceOrder)
                .options(selectinload(RoomServiceOrder.order_items))
                .where(
                    or_(
                        RoomServiceOrder.room_number == rm,
                        RoomServiceOrder.room_number == clean_room,
                    ),
                    RoomServiceOrder.status.in_(["Pending", "pending", "Chờ tiếp nhận", "unassigned"]),
                    RoomServiceOrder.is_service_request == is_svc,
                    RoomServiceOrder.created_at >= merge_window_start,
                )
                .order_by(desc(RoomServiceOrder.created_at))
            )
            existing_res = await db.execute(existing_pending_stmt)
            existing_order = existing_res.scalars().first()

            if existing_order:
                item_name_clean = items or ("Dịch vụ phòng" if is_svc else "Món ăn")
                found_item = None
                for oi in existing_order.order_items:
                    if oi.item_name.lower().strip() == item_name_clean.lower().strip():
                        found_item = oi
                        break
                if found_item:
                    found_item.quantity += 1
                else:
                    new_oi = OrderItem(
                        order_id=existing_order.id,
                        item_name=item_name_clean,
                        quantity=1,
                        unit_price=0.0,
                        subtotal=0.0,
                        notes=items,
                    )
                    db.add(new_oi)

                existing_order.updated_at = datetime.utcnow()
                if items and (not existing_order.note or items not in existing_order.note):
                    existing_order.note = f"{existing_order.note}; Gộp thêm: {items}" if existing_order.note else f"Gộp thêm: {items}"

                # Cập nhật SupportRequest tương ứng
                sr = await db.get(SupportRequest, existing_order.id)
                if not sr and existing_order.support_request_id:
                    sr = await db.get(SupportRequest, existing_order.support_request_id)
                if sr:
                    sr_items_dict = {}
                    for it in (sr.items or []):
                        name = it.get("name") or it.get("item_name")
                        if name:
                            sr_items_dict[name] = sr_items_dict.get(name, 0) + int(it.get("qty") or it.get("quantity") or 1)
                    sr_items_dict[item_name_clean] = sr_items_dict.get(item_name_clean, 0) + 1
                    sr.items = [{"name": k, "qty": v} for k, v in sr_items_dict.items()]
                    sr.description = ", ".join([f"{v}x {k}" if v > 1 else k for k, v in sr_items_dict.items()])
                    sr.updated_at = datetime.utcnow()

                await create_department_notification(
                    db=db,
                    department=target_dept_name,
                    title=f"Robot AI: Gộp thêm yêu cầu #{existing_order.order_number} - Phòng {rm}",
                    description=f"Phòng {rm}: Khách gộp thêm {items}",
                    request_id=existing_order.id,
                    request_type="room_service",
                    type="Request",
                )
                await db.commit()
                return f"ORD-{existing_order.order_number}"

            order_num = str(random.randint(1043, 9999))
            ticket_code = f"ORD-{order_num}"
            order_id = f"ORD-{uuid.uuid4().hex[:8]}"
            order_title = (
                f"Yêu cầu Room Service (Phòng {rm}): {items}"
                if is_svc
                else f"Đơn món ăn Bếp (Phòng {rm}): {items}"
            )

            order = SupportRequest(
                id=order_id,
                ticket_code=ticket_code,
                title=order_title,
                room_number=rm,
                description=items or "Yêu cầu gửi từ HCRobot Concierge AI Chat",
                guest_name=f"Guest (Room {rm})",
                department_id=assigned_dept_id,
                service_type_id="ST-ROOM-SERVICE",
                items=[{"name": items, "qty": 1}],
                source="HCRobot Concierge AI Chat",
                status="Pending",
                progress=0,
                extra_data={"is_service_request": is_svc},
            )
            db.add(order)

            # Đồng bộ tạo thêm RoomServiceOrder và OrderItem để Bếp nhận đơn
            from app.models.room_service import RoomServiceOrder, OrderItem
            rs_order = RoomServiceOrder(
                id=order_id,
                order_number=order_num,
                room_number=rm,
                support_request_id=order_id,
                guest_name=f"Guest (Room {rm})",
                status="Pending",
                is_service_request=is_svc,
                total_amount=0.0,
                note=items or "Yêu cầu từ AI Chat",
            )
            db.add(rs_order)
            oi = OrderItem(
                order_id=order_id,
                item_name=items or ("Dịch vụ phòng" if is_svc else "Món ăn"),
                quantity=1,
                unit_price=0.0,
                subtotal=0.0,
                notes=items,
            )
            db.add(oi)
            await create_department_notification(
                db=db,
                department=target_dept_name,
                title=f"Robot AI: Yêu cầu {target_dept_name} mới từ Phòng {rm}",
                description=f"{items}",
                request_id=order.id,
                request_type="room_service",
                type="Request",
            )
            if not is_svc:
                await create_department_notification(
                    db=db,
                    department="Room Service",
                    title=f"Robot AI: Đơn món ăn mới từ Phòng {rm}",
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
        elif action == "cancel_service":
            # Xử lý HỦY YÊU CẦU: Tìm ticket đang chờ gần nhất của số phòng đó và cập nhật thành 'Cancelled'
            from sqlalchemy.future import select
            from sqlalchemy import desc
            if db:
                stmt = (
                    select(SupportRequest)
                    .where(
                        SupportRequest.room_number == rm,
                        SupportRequest.status.in_(["Pending", "Unassigned", "In Progress"]),
                    )
                    .order_by(desc(SupportRequest.created_at))
                    .limit(1)
                )
                res = await db.execute(stmt)
                active_req = res.scalar_one_or_none()
                if active_req:
                    active_req.status = "Cancelled"
                    active_req.description = f"{active_req.description or ''}\n[Khách hủy yêu cầu qua Robot]"

                    # Đồng bộ sang RoomServiceOrder nếu đây là đơn phòng/ẩm thực
                    try:
                        clean_t_code = (active_req.ticket_code or "").replace("ORD-", "").replace("REQ-", "").strip()
                        stmt_rs = select(RoomServiceOrder).where(
                            or_(
                                RoomServiceOrder.support_request_id == active_req.id,
                                RoomServiceOrder.id == active_req.id,
                                (RoomServiceOrder.order_number == clean_t_code) if clean_t_code else False,
                            )
                        )
                        res_rs = await db.execute(stmt_rs)
                        linked_rs = res_rs.scalars().first()
                        if linked_rs:
                            linked_rs.status = "Cancelled"
                            linked_rs.note = f"{linked_rs.note or ''}\n[Khách hủy yêu cầu qua Robot]"
                    except Exception as ex_sync:
                        logger.warning(f"[AITicketService] Sync RoomServiceOrder cancel error: {ex_sync}")

                    await create_department_notification(
                        db=db,
                        department="Reception",
                        title=f"Robot AI: Khách Phòng {rm} đã HỦY yêu cầu #{active_req.ticket_code}",
                        description=f"Yêu cầu '{active_req.title}' đã được hủy thành công theo lệnh của khách.",
                        request_id=active_req.id,
                        request_type="cancellation",
                        type="Alert",
                    )
                    await db.commit()
                    logger.info(f"[AITicketService] Cancelled ticket #{active_req.ticket_code} for Room {rm}")
                    return f"CANCELLED-{active_req.ticket_code}"

            cancel_code = f"CAN-{random.randint(1000, 9999)}"
            if db:
                req = SupportRequest(
                    ticket_code=cancel_code,
                    source="HCRobot Concierge AI Chat",
                    title=f"Yêu cầu Hủy dịch vụ từ Phòng {rm}: {items}",
                    room_number=rm,
                    description=items or "Khách yêu cầu hủy dịch vụ nhưng không tìm thấy ticket chờ nào",
                    guest_name=f"Guest (Room {rm})",
                    department_id="DEP-RECEPTION",
                    service_type_id="ST-RECEPTION",
                    status="Pending",
                )
                db.add(req)
                await create_department_notification(
                    db=db,
                    department="Reception",
                    title=f"Robot AI: Yêu cầu Hủy dịch vụ mới #{cancel_code}",
                    description=f"Phòng {rm}: {items}",
                    request_id=req.id,
                    request_type="reception",
                    type="Alert",
                )
                await db.commit()
            return cancel_code

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
    if action in ["provide_room_number", "chitchat", "conversation", "faq", "fast_path", "unknown", "query_order_status", "open_food_menu", "open_room_service_menu", "open_maintenance_menu"]:
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
                bg_db, target_action, str(room_number).strip(), items_desc
            )
            if created_ticket_code:
                logger.info(
                    f"[AITicketService] Successfully created ticket #{created_ticket_code} for department '{target_action}' (Room {room_number}): {items_desc}"
                )
    except Exception as ex_ticket:
        logger.warning(f"[AITicketService Warning] Could not auto-create ticket: {ex_ticket}")
