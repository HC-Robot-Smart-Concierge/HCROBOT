import asyncio
import random
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, status
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import OrderItem as OrderItemModel, RoomServiceOrder, SupportRequest
from app.repositories import RoomServiceRepository, get_room_service_repository
from app.schemas.operations import RoomServiceOrderCreate, RoomServiceOrderResponse
from app.services.notification_manager import notification_manager
from .shared import TAG_FB, create_department_notification

router = APIRouter()


@router.post(
    "/room-service/orders",
    response_model=RoomServiceOrderResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_FB,
    summary="Tạo đơn gọi món phục vụ phòng",
)
async def create_room_service_order(
    order_in: RoomServiceOrderCreate,
    db: AsyncSession = Depends(get_db),
    repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """Creates a new Room Service order stored in both SupportRequest and RoomServiceOrder/OrderItem tables."""
    order_num = f"{random.randint(1043, 9999)}"

    # Try looking up room in database via repository
    room = await repo.find_room(order_in.room_number)
    room_id = room.id if room else None

    # Calculate total amount and enrich item details
    total_amount = 0.0
    items_payload = []
    order_items_to_create = []

    for it in order_in.items:
        food_item, m_item = await repo.lookup_food_and_menu_item(
            name=it.name or "",
            food_item_id=getattr(it, "food_item_id", None),
            menu_item_id=getattr(it, "menu_item_id", None),
        )

        # Xác định đơn giá từ MenuItem trong thực đơn
        price = m_item.price if (m_item and m_item.price > 0) else 0.0
        qty = int(it.qty) if str(it.qty).isdigit() else 1
        subtotal = price * qty
        total_amount += subtotal

        food_id = food_item.id if food_item else None
        menu_item_id = m_item.id if m_item else None
        notes_str = getattr(it, "notes", None)

        items_payload.append({
            "name": it.name,
            "qty": qty,
            "unit_price": price,
            "subtotal": subtotal,
            "food_item_id": food_id,
            "menu_item_id": menu_item_id,
            "notes": notes_str,
        })

        order_items_to_create.append({
            "menu_item_id": menu_item_id,
            "food_item_id": food_id,
            "item_name": it.name,
            "quantity": qty,
            "unit_price": price,
            "subtotal": subtotal,
            "notes": notes_str,
        })

    order_id = f"ORD-{uuid.uuid4().hex[:8]}"
    ticket_code = f"ORD-{order_num}"
    items_desc = ", ".join([f"{it.qty}x {it.name}" for it in (order_in.items or [])])

    # Tra cứu thông tin khách và số điện thoại liên lạc từ phòng check-in
    raw_gn = order_in.guest_name
    if not raw_gn or str(raw_gn).lower().strip() in ["quý khách", "hotel guest", "khách lưu trú", ""]:
        guest_name_val = (room.current_guest_name if room else None) or raw_gn or f"Khách Phòng {order_in.room_number}"
    else:
        guest_name_val = raw_gn
    guest_phone_val = order_in.guest_phone or (getattr(room, "current_guest_phone", None) if room else None)
    room_phone_val = order_in.room_phone or (getattr(room, "room_phone", None) if room else None) or f"Ext {order_in.room_number}"

    # Phuong an A: Tu dong gop don neu phong nay da co don Pending trong vong 10 phut gan nhat
    clean_room = order_in.room_number.upper().replace("ROOM", "").strip()
    merge_window_start = datetime.utcnow() - timedelta(minutes=10)
    existing_pending_stmt = (
        select(RoomServiceOrder)
        .options(selectinload(RoomServiceOrder.order_items))
        .where(
            or_(
                RoomServiceOrder.room_number == order_in.room_number,
                RoomServiceOrder.room_number == clean_room,
            ),
            RoomServiceOrder.status.in_(["Pending", "pending", "Chờ tiếp nhận", "unassigned"]),
            RoomServiceOrder.is_service_request == order_in.is_service_request,
            RoomServiceOrder.created_at >= merge_window_start,
        )
        .order_by(desc(RoomServiceOrder.created_at))
    )
    existing_res = await db.execute(existing_pending_stmt)
    existing_order = existing_res.scalars().first()

    if existing_order:
        existing_order.total_amount = float(existing_order.total_amount or 0.0) + total_amount

        if order_in.note and str(order_in.note).strip():
            clean_new_note = str(order_in.note).strip()
            if existing_order.note:
                if clean_new_note not in existing_order.note:
                    existing_order.note = f"{existing_order.note}; Gộp thêm: {clean_new_note}"
            else:
                existing_order.note = f"Gộp thêm: {clean_new_note}"

        existing_items_map = {}
        for oi in existing_order.order_items:
            key = oi.food_item_id or oi.menu_item_id or oi.item_name.lower().strip()
            existing_items_map[key] = oi

        for oi_data in order_items_to_create:
            key = oi_data["food_item_id"] or oi_data["menu_item_id"] or oi_data["item_name"].lower().strip()
            if key in existing_items_map:
                existing_oi = existing_items_map[key]
                existing_oi.quantity += oi_data["quantity"]
                existing_oi.subtotal = float(existing_oi.subtotal or 0.0) + oi_data["subtotal"]
                if oi_data["notes"] and oi_data["notes"] not in (existing_oi.notes or ""):
                    existing_oi.notes = f"{existing_oi.notes}; {oi_data['notes']}" if existing_oi.notes else oi_data["notes"]
            else:
                order_item = OrderItemModel(
                    order_id=existing_order.id,
                    menu_item_id=oi_data["menu_item_id"],
                    food_item_id=oi_data["food_item_id"],
                    item_name=oi_data["item_name"],
                    quantity=oi_data["quantity"],
                    unit_price=oi_data["unit_price"],
                    subtotal=oi_data["subtotal"],
                    notes=oi_data["notes"],
                )
                db.add(order_item)
                existing_items_map[key] = order_item

        existing_order.updated_at = datetime.utcnow()

        sr = await db.get(SupportRequest, existing_order.id)
        if not sr and existing_order.support_request_id:
            sr = await db.get(SupportRequest, existing_order.support_request_id)

        if sr:
            sr.total_amount = existing_order.total_amount
            sr_items_dict = {}
            for it in (sr.items or []):
                name = it.get("name") or it.get("item_name")
                if name:
                    sr_items_dict[name] = sr_items_dict.get(name, 0) + int(it.get("qty") or it.get("quantity") or 1)
            for it in items_payload:
                name = it.get("name") or it.get("item_name")
                if name:
                    sr_items_dict[name] = sr_items_dict.get(name, 0) + int(it.get("qty") or it.get("quantity") or 1)

            sr.items = [{"name": k, "qty": v} for k, v in sr_items_dict.items()]
            sr.description = ", ".join([f"{v}x {k}" if v > 1 else k for k, v in sr_items_dict.items()])
            sr.updated_at = datetime.utcnow()

        dept_target = "Kitchen" if not order_in.is_service_request else "Room Service"
        await create_department_notification(
            db=db,
            department=dept_target,
            title=f"Đơn gộp món #{existing_order.order_number} - Phòng {order_in.room_number}",
            description=f"Phòng {order_in.room_number} ({guest_name_val}): Khách gộp thêm {items_desc}. Tổng tiền mới: {existing_order.total_amount:,.0f} đ. Bếp chế biến và Robot giao cùng 1 chuyến.",
            request_id=existing_order.id,
            request_type="room_service",
            type="Request",
        )
        await create_department_notification(
            db=db,
            department="Reception",
            title=f"Cập nhật hóa đơn gộp #{existing_order.order_number} - Phòng {order_in.room_number}",
            description=f"Phòng {order_in.room_number}: Gộp thêm {items_desc} ({total_amount:,.0f} đ). Tổng hóa đơn phòng mới: {existing_order.total_amount:,.0f} đ.",
            request_id=existing_order.id,
            request_type="room_service",
            type="Request",
        )

        await db.commit()
        await db.refresh(existing_order)

        merged_broadcast_payload = {
            "id": existing_order.id,
            "raw_id": existing_order.id,
            "ticket_code": (sr.ticket_code if sr else None) or f"ORD-{existing_order.order_number}",
            "order_number": existing_order.order_number,
            "room_number": existing_order.room_number,
            "room": existing_order.room_number,
            "status": existing_order.status or "Pending",
            "progress": existing_order.progress or 0,
            "total_amount": existing_order.total_amount,
            "title": (sr.title if sr else None) or f"Room Service Order #{existing_order.order_number}",
            "description": sr.description if sr else existing_order.note,
            "notes": existing_order.note,
            "items": existing_order.items,
            "is_service_request": existing_order.is_service_request,
            "is_merged": True,
            "image_url": existing_order.image_url,
            "created_at": existing_order.created_at.isoformat() if existing_order.created_at else datetime.utcnow().isoformat(),
            "updated_at": existing_order.updated_at.isoformat() if existing_order.updated_at else datetime.utcnow().isoformat(),
            "guest_name": existing_order.guest_name,
            "guestName": existing_order.guest_name,
            "guest_phone": existing_order.guest_phone,
            "guestPhone": existing_order.guest_phone,
            "room_phone": existing_order.room_phone,
            "roomPhone": existing_order.room_phone,
            "department": "F&B",
            "table_type": "room_service",
        }
        asyncio.create_task(notification_manager.broadcast_order_created(merged_broadcast_payload, department="All"))
        asyncio.create_task(notification_manager.broadcast_status_update(merged_broadcast_payload, department="All"))

        setattr(existing_order, "is_merged", True)
        return existing_order

    # 1. Tạo SupportRequest phục vụ Unified Dashboard, Robot & Webhook
    assigned_dept_id = "DEP-KITCHEN" if not order_in.is_service_request else "DEP-ROOMSERVICE"
    order_title = (
        f"Kitchen Food Order #{order_num}"
        if not order_in.is_service_request
        else f"Room Service Order #{order_num}"
    )

    new_order = SupportRequest(
        id=order_id,
        ticket_code=ticket_code,
        title=order_title,
        description=order_in.note or items_desc or ("Đơn gọi món bếp" if not order_in.is_service_request else "Yêu cầu phục vụ phòng"),
        service_type_id="ST-ROOM-SERVICE",
        department_id=assigned_dept_id,
        room_id=room_id,
        room_number=order_in.room_number,
        guest_name=guest_name_val,
        guest_phone=guest_phone_val,
        room_phone=room_phone_val,
        source="Guest App / In-Room Tablet",
        status="Pending",
        progress=0,
        total_amount=total_amount,
        items=items_payload,
        extra_data={
            "is_service_request": bool(order_in.is_service_request),
            "image_url": order_in.image_url,
            "guest_phone": guest_phone_val,
            "room_phone": room_phone_val,
        },
    )
    db.add(new_order)

    # 2. Tạo RoomServiceOrder trong bảng room_service_orders chuẩn ERD
    rs_order = RoomServiceOrder(
        id=order_id,
        order_number=order_num,
        room_number=order_in.room_number,
        room_id=room_id,
        support_request_id=order_id,
        guest_name=guest_name_val,
        guest_phone=guest_phone_val,
        room_phone=room_phone_val,
        status="Pending",
        note=order_in.note,
        image_url=order_in.image_url,
        is_service_request=order_in.is_service_request,
        progress=0,
        total_amount=total_amount,
    )
    db.add(rs_order)

    # 3. Tạo các ORDER_ITEM trong bảng order_items chuẩn ERD
    for oi_data in order_items_to_create:
        order_item = OrderItemModel(
            order_id=order_id,
            menu_item_id=oi_data["menu_item_id"],
            food_item_id=oi_data["food_item_id"],
            item_name=oi_data["item_name"],
            quantity=oi_data["quantity"],
            unit_price=oi_data["unit_price"],
            subtotal=oi_data["subtotal"],
            notes=oi_data["notes"],
        )
        db.add(order_item)

    if not order_in.is_service_request:
        await create_department_notification(
            db=db,
            department="Kitchen",
            title=f"Đơn món ăn mới #{order_num} - Phòng {order_in.room_number}",
            description=f"Phòng {order_in.room_number} ({guest_name_val} - SĐT: {guest_phone_val or 'Chưa có'}): {items_desc or 'Đơn món ăn mới'}. Bếp vui lòng tiếp nhận và chế biến.",
            request_id=new_order.id,
            request_type="room_service",
            type="Request",
        )

    await create_department_notification(
        db=db,
        department="Room Service",
        title=f"Đơn Room Service mới #{order_num}",
        description=f"Phòng {order_in.room_number}: {items_desc or order_in.note or 'Yêu cầu phục vụ phòng mới'}",
        request_id=new_order.id,
        request_type="room_service",
        type="Request",
    )
    await create_department_notification(
        db=db,
        department="Reception",
        title=f"Hóa đơn Room Service #{order_num} - Phòng {order_in.room_number}",
        description=f"Phòng {order_in.room_number}: {items_desc or 'Yêu cầu dịch vụ phòng'}. Chi phí: {total_amount:,.0f} đ (Ghi nợ hóa đơn phòng, thu khi check-out).",
        request_id=new_order.id,
        request_type="room_service",
        type="Request",
    )
    await db.commit()
    await db.refresh(new_order)

    order_broadcast_payload = {
        "id": new_order.id,
        "raw_id": new_order.id,
        "ticket_code": new_order.ticket_code or f"ORD-{order_num}",
        "order_number": order_num,
        "room_number": order_in.room_number,
        "room": order_in.room_number,
        "status": new_order.status or "Pending",
        "progress": new_order.progress or 0,
        "total_amount": total_amount,
        "title": new_order.title,
        "description": new_order.description,
        "notes": new_order.description,
        "items": items_payload,
        "is_service_request": order_in.is_service_request,
        "image_url": order_in.image_url,
        "created_at": new_order.created_at.isoformat() if new_order.created_at else datetime.utcnow().isoformat(),
        "guest_name": guest_name_val,
        "guestName": guest_name_val,
        "guest_phone": guest_phone_val,
        "guestPhone": guest_phone_val,
        "room_phone": room_phone_val,
        "roomPhone": room_phone_val,
        "department": "F&B",
        "table_type": "room_service",
    }
    asyncio.create_task(notification_manager.broadcast_order_created(order_broadcast_payload, department="All"))

    return new_order
