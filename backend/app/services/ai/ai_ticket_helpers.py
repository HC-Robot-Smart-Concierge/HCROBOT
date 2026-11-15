"""Helper routines for AI auto-created tickets (Room Service merge/create, cancellation, and standard department tickets)."""

import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import desc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.v1.endpoints.operations.shared import create_department_notification
from app.models.room_service import OrderItem, RoomServiceOrder
from app.models.support_request import SupportRequest

logger = logging.getLogger(__name__)


async def create_room_service_auto_ticket(
    db: AsyncSession,
    rm: str,
    items: str,
) -> str:
    """Create or merge into an active 10-minute Pending RoomServiceOrder & SupportRequest."""
    service_kw = [
        "khăn", "khan", "gối", "goi", "chăn", "chan", "nệm", "nem",
        "dọn phòng", "don phong", "vệ sinh", "ve sinh", "massage", "mát xa", "spa",
        "giặt", "giat", "ủi", "ui", "bàn ủi", "bàn là", "tiện ích", "amenity",
        "dịch vụ phòng", "dép", "bàn chải", "dao cạo", "lược", "dầu gội", "sữa tắm",
        "ly", "tách", "muỗng", "nĩa", "chén", "đĩa", "đá lạnh", "tableware", "ice", "glass",
    ]
    items_lower = (items or "").lower()
    non_orderable_kw = [
        "xem lại", "xem lai", "cho tôi xem", "cho toi xem", "cho xem",
        "kiểm tra", "kiem tra", "trạng thái", "trang thai", "tiến độ", "tien do",
        "xong chưa", "xong chua", "khi nào", "bao giờ", "tại sao", "tai sao",
        "vì sao", "vi sao", "lý do", "ly do", "món đồ đặc", "mon do dac", "món đồ đạc",
        "đã đặt", "da dat", "đã gọi", "da goi",
    ]
    if any(k in items_lower for k in non_orderable_kw):
        logger.warning(f"[AITicketService] Bỏ qua tạo/gộp món rác từ câu hỏi tra cứu: '{items}'")
        return ""
    is_svc = any(k in items_lower for k in service_kw)
    assigned_dept_id = "DEP-ROOMSERVICE" if is_svc else "DEP-KITCHEN"
    target_dept_name = "Room Service" if is_svc else "Kitchen"
    clean_room = rm.upper().replace("ROOM", "").strip()

    # Kiểm tra gộp đơn trong vòng 10 phút gần nhất nếu đã có đơn Pending
    merge_window_start = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=10)
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
            db.add(
                OrderItem(
                    order_id=existing_order.id,
                    item_name=item_name_clean,
                    quantity=1,
                    unit_price=0.0,
                    subtotal=0.0,
                    notes=items,
                )
            )

        existing_order.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        if items and (not existing_order.note or items not in existing_order.note):
            existing_order.note = f"{existing_order.note}; Gộp thêm: {items}" if existing_order.note else f"Gộp thêm: {items}"

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
            sr.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

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
    db.add(
        OrderItem(
            order_id=order_id,
            item_name=items or ("Dịch vụ phòng" if is_svc else "Món ăn"),
            quantity=1,
            unit_price=0.0,
            subtotal=0.0,
            notes=items,
        )
    )
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


async def cancel_latest_room_request(
    db: Optional[AsyncSession],
    rm: str,
    items: str,
) -> str:
    """Cancel the latest active SupportRequest (and synced RoomServiceOrder) for a room, or log fallback ticket."""
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

            try:
                from app.models import RoomServiceOrder as _RoomServiceOrder
                clean_t_code = (active_req.ticket_code or "").replace("ORD-", "").replace("REQ-", "").strip()
                stmt_rs = select(_RoomServiceOrder).where(
                    or_(
                        _RoomServiceOrder.support_request_id == active_req.id,
                        _RoomServiceOrder.id == active_req.id,
                        (_RoomServiceOrder.order_number == clean_t_code) if clean_t_code else (_RoomServiceOrder.id == active_req.id),
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


async def create_standard_department_ticket(
    db: Optional[AsyncSession],
    *,
    prefix: str,
    title: str,
    room_number: str,
    description: str,
    department_id: str,
    service_type_id: str,
    status: str = "Pending",
    request_type: str,
    primary_department: Optional[str] = None,
    primary_title: Optional[str] = None,
    reception_title: Optional[str] = None,
) -> str:
    """Create a standard department SupportRequest with primary & Reception notifications."""
    ticket_code = f"{prefix}-{random.randint(1000, 99999)}"
    if not db:
        return ticket_code

    req = SupportRequest(
        ticket_code=ticket_code,
        source="HCRobot Concierge AI Chat",
        title=title,
        room_number=room_number,
        description=description,
        guest_name=f"Guest (Room {room_number})",
        department_id=department_id,
        service_type_id=service_type_id,
        status=status,
    )
    db.add(req)
    if primary_department and primary_title:
        await create_department_notification(
            db=db,
            department=primary_department,
            title=primary_title.format(ticket_code=ticket_code),
            description=f"Phòng {room_number}: {description}",
            request_id=req.id,
            request_type=request_type,
            type="Request",
        )
    if reception_title:
        await create_department_notification(
            db=db,
            department="Reception",
            title=reception_title.format(ticket_code=ticket_code),
            description=f"Phiếu #{ticket_code}: {description}" if primary_department else f"Phòng {room_number}: {description}",
            request_id=req.id,
            request_type=request_type,
            type="Request",
        )
    await db.commit()
    return ticket_code
