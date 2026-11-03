import asyncio
import random
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_

from app.core.database import get_db
from app.services.notification_manager import notification_manager
from app.models import (
    Staff,
    SupportRequest,
    MenuItem,
    FoodItem,
    Room,
    RoomServiceOrder,
    OrderItem as OrderItemModel,
    RoomServiceCatalogItem,
)
from app.schemas.operations import (
    RoomServiceOrderCreate,
    RoomServiceOrderStatusUpdate,
    RoomServiceOrderResponse,
    RoomServiceDashboardResponse,
    OrderItemResponse,
    RoomOrderedItemSummary,
    RoomOrdersHistoryResponse,
    RoomServiceCatalogItemCreate,
    RoomServiceCatalogItemUpdate,
    RoomServiceCatalogItemResponse,
)
from app.repositories import (
    RoomServiceRepository,
    get_room_service_repository,
    SupportRequestRepository,
    get_support_request_repository,
)
from .shared import TAG_ROOM_SERVICE, TAG_FB, create_department_notification

router = APIRouter()


@router.get(
    "/dashboard/room-service",
    response_model=RoomServiceDashboardResponse,
    tags=TAG_FB,
    summary="Xem Dashboard Phục vụ phòng (Room Service)",
)
async def get_room_service_dashboard(
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """Returns real-time KPIs, active orders, delivery fleet, and low stock alerts for Room Service."""
    # 1. Fetch Orders directly from RoomServiceOrder repository
    orders = await rs_repo.list_orders()

    # 2. Fetch Robots (Deprecated - returning empty list)
    delivery_fleet = []

    # 3. Stock (Table dropped per schema cleanup)
    low_stock_alerts = []

    # 4. Calculate dynamic KPIs
    pending_count = sum(1 for o in orders if o.status == "Pending")
    in_prep_count = sum(1 for o in orders if o.status == "Cooking")
    delivering_count = sum(1 for o in orders if o.status in ["Delivering", "Ready"])
    completed_count = sum(1 for o in orders if o.status in ["Completed", "Delivered"])

    kpis = {
        "pendingOrders": {"value": pending_count, "delta": "+0", "status": "neutral"},
        "inPreparation": {"value": in_prep_count, "avgTime": "12m"},
        "delivering": {"value": delivering_count, "label": "In Transit"},
        "completedToday": {"value": completed_count},
    }

    return {
        "kpis": kpis,
        "orders": orders,
        "delivery_fleet": delivery_fleet,
        "low_stock_alerts": low_stock_alerts,
    }


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
        if m_item and m_item.price > 0:
            price = m_item.price
        else:
            price = 0.0

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

    # Phuong an A: Tu dong gop don neu phong nay da co don Pending dang cho xu ly
    clean_room = order_in.room_number.upper().replace("ROOM", "").strip()
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
        )
        .order_by(desc(RoomServiceOrder.created_at))
    )
    existing_res = await db.execute(existing_pending_stmt)
    existing_order = existing_res.scalars().first()

    if existing_order:
        # 1. Cong don tong tien
        existing_order.total_amount = float(existing_order.total_amount or 0.0) + total_amount

        # 2. Cap nhat ghi chu
        if order_in.note and str(order_in.note).strip():
            clean_new_note = str(order_in.note).strip()
            if existing_order.note:
                existing_order.note = f"{existing_order.note}; Gộp thêm: {clean_new_note}"
            else:
                existing_order.note = f"Gộp thêm: {clean_new_note}"

        # 3. Tao cac ban ghi OrderItemModel moi gan truc tiep vao don cu
        for oi_data in order_items_to_create:
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

        existing_order.updated_at = datetime.utcnow()

        # 4. Cap nhat SupportRequest tuong ung
        sr = await db.get(SupportRequest, existing_order.id)
        if not sr and existing_order.support_request_id:
            sr = await db.get(SupportRequest, existing_order.support_request_id)

        if sr:
            sr.total_amount = existing_order.total_amount
            current_sr_items = list(sr.items or [])
            current_sr_items.extend(items_payload)
            sr.items = current_sr_items
            sr.description = f"{sr.description}, {items_desc}" if sr.description else items_desc
            sr.updated_at = datetime.utcnow()

        # 5. Thong bao phong ban lien quan
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

        # 6. Real-time WebSocket Broadcast thong bao cap nhat don
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
        asyncio.create_task(
            notification_manager.broadcast_order_created(merged_broadcast_payload, department="All")
        )
        asyncio.create_task(
            notification_manager.broadcast_status_update(merged_broadcast_payload, department="All")
        )

        setattr(existing_order, "is_merged", True)
        return existing_order

    # 1. Tạo SupportRequest phục vụ Unified Dashboard, Robot & Webhook
    new_order = SupportRequest(
        id=order_id,
        ticket_code=ticket_code,
        title=f"Room Service Order #{order_num}",
        description=order_in.note or items_desc or "Yêu cầu phục vụ phòng",
        service_type_id="ST-ROOM-SERVICE",
        department_id="DEP-ROOMSERVICE",
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
            "is_service_request": order_in.is_service_request,
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

    # Thong bao truc tiep toi bo phan Bep neu la don mon an am thuc
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
    # Đồng bộ thông báo hóa đơn dịch vụ phòng về Quầy Lễ Tân (Reception) đối soát khi check-out
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

    # Real-time WebSocket Broadcast tới toàn bộ Dashboard (Room Service, Kitchen, Staff Requests, Robot Kiosk)
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
    asyncio.create_task(
        notification_manager.broadcast_order_created(order_broadcast_payload, department="All")
    )

    return new_order



@router.get(
    "/room-service/rooms/{room_number}/orders",
    response_model=RoomOrdersHistoryResponse,
    tags=TAG_FB,
    summary="Tra cứu toàn bộ đơn hàng và món ăn phòng đó đã đặt",
    responses={
        200: {"description": "Lấy thông tin tổng hợp các món và danh sách đơn của phòng thành công."}
    },
)
@router.get(
    "/room-service/orders/by-room/{room_number}",
    response_model=RoomOrdersHistoryResponse,
    tags=TAG_FB,
    include_in_schema=False,
)
async def get_room_orders_history(
    room_number: str,
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết lịch sử đặt món ăn / dịch vụ phòng theo số phòng (vd: `402`, `ROOM 201`, `304`):
    - **Tổng số đơn hàng**: Tổng số lần phòng này đã đặt Room Service
    - **Tổng số tiền**: Tổng chi phí các đơn đã đặt
    - **Danh sách tổng hợp các món đã đặt**: Tên món, tổng số lượng, đơn giá và thời điểm đặt gần nhất
    - **Danh sách chi tiết các đơn hàng**: Chi tiết từng đơn (mã đơn, trạng thái, danh sách món, ghi chú)
    """
    orders = await rs_repo.list_orders_by_room(room_number)

    total_amount = sum(float(o.total_amount or 0.0) for o in orders)

    # Gom nhóm và tính toán tổng số lượng từng món phòng đã đặt
    items_map: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        if o.items and isinstance(o.items, list):
            for item in o.items:
                if isinstance(item, dict):
                    name = item.get("name") or item.get("item_name") or "Món ăn"
                    raw_qty = item.get("qty") or item.get("quantity") or 1
                    try:
                        qty = int(raw_qty)
                    except (ValueError, TypeError):
                        qty = 1

                    price = float(item.get("unit_price") or item.get("price") or 0.0)
                    subtotal = float(item.get("subtotal") or (price * qty))

                    if name not in items_map:
                        items_map[name] = {
                            "item_name": name,
                            "total_quantity": 0,
                            "unit_price": price,
                            "total_price": 0.0,
                            "last_ordered_at": o.created_at,
                        }
                    items_map[name]["total_quantity"] += qty
                    items_map[name]["total_price"] += subtotal
                    if o.created_at and (not items_map[name]["last_ordered_at"] or o.created_at > items_map[name]["last_ordered_at"]):
                        items_map[name]["last_ordered_at"] = o.created_at
                        if price > 0:
                            items_map[name]["unit_price"] = price

    ordered_items_summary = [
        RoomOrderedItemSummary(**data) for data in items_map.values()
    ]

    return RoomOrdersHistoryResponse(
        room_number=room_number,
        total_orders=len(orders),
        total_amount=total_amount,
        ordered_items_summary=ordered_items_summary,
        orders=orders,
    )


@router.get(
    "/room-service/orders/{order_id}",
    response_model=RoomServiceOrderResponse,
    tags=TAG_FB,
    summary="Chi tiết một đơn hàng Room Service",
)
@router.get(
    "/room-service/requests/{order_id}",
    response_model=RoomServiceOrderResponse,
    tags=TAG_FB,
    include_in_schema=False,
)
async def get_room_service_order(
    order_id: str,
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """Lấy thông tin chi tiết một đơn đặt món Room Service theo ID hoặc mã đơn."""
    order = await rs_repo.get_order_by_id_or_number(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng Room Service.")
    return order


# =====================================================================
# ORDER_ITEM ENDPOINTS (CHI TIẾT MÓN ĂN TRONG ĐƠN PHỤC VỤ PHÒNG)
# =====================================================================

@router.get(
    "/room-service/orders/{order_id}/items",
    response_model=List[OrderItemResponse],
    tags=TAG_FB,
    summary="Danh sách món ăn của một đơn hàng Room Service (ORDER_ITEM)",
)
async def get_order_items(
    order_id: str,
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """Lấy danh sách các bản ghi ORDER_ITEM chi tiết thuộc về một đơn hàng phục vụ phòng cụ thể."""
    clean_id = order_id.replace("ORD-", "")
    rs_order = await rs_repo.get_order_by_id_or_number(order_id)
    actual_order_id = rs_order.id if rs_order else order_id
    items = await rs_repo.get_order_items(actual_order_id, clean_id=clean_id)

    # Fallback nếu đơn lưu trước khi có bảng order_items
    if not items and rs_order and rs_order.items:
        return [
            OrderItemResponse(
                item_name=it.get("name", "Món ăn"),
                quantity=int(it.get("qty", 1)),
                unit_price=float(it.get("unit_price", 0.0)),
                subtotal=float(it.get("subtotal", 0.0)),
                menu_item_id=it.get("menu_item_id"),
                food_item_id=it.get("food_item_id"),
                notes=it.get("notes"),
            )
            for it in rs_order.items
        ]
    return items


@router.get(
    "/room-service/order-items",
    response_model=List[OrderItemResponse],
    tags=TAG_FB,
    summary="Tra cứu toàn bộ danh sách các món ăn đã gọi (ORDER_ITEM)",
)
async def list_all_order_items(
    order_id: Optional[str] = Query(None, description="Lọc theo ID đơn hàng"),
    food_item_id: Optional[str] = Query(None, description="Lọc theo ID món gốc"),
    menu_item_id: Optional[str] = Query(None, description="Lọc theo ID món trong thực đơn"),
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """Liệt kê toàn bộ các món ăn đã được gọi qua dịch vụ phòng (ORDER_ITEM)."""
    return await rs_repo.list_all_order_items(
        order_id=order_id,
        food_item_id=food_item_id,
        menu_item_id=menu_item_id,
    )



@router.delete(
    "/room-service/orders/clear-all",
    tags=TAG_FB,
    summary="Xóa sạch toàn bộ đơn món ăn của bộ phận bếp / Room Service",
)
async def clear_all_room_service_orders(
    db: AsyncSession = Depends(get_db),
):
    """Xóa toàn bộ các đơn đặt món ăn và order items để reset hàng đợi bếp."""
    from sqlalchemy import delete, or_
    await db.execute(delete(OrderItemModel))
    await db.execute(delete(RoomServiceOrder))
    await db.execute(delete(SupportRequest).where(
        or_(
            SupportRequest.service_type_id == "ST-ROOM-SERVICE",
            SupportRequest.department_id == "DEP-ROOMSERVICE",
            SupportRequest.service_type_id == "room_service",
            SupportRequest.department_id == "Room Service",
        )
    ))
    await db.commit()
    asyncio.create_task(
        notification_manager.broadcast_to_department("All", {"type": "ORDERS_CLEARED"})
    )
    return {"status": "success", "message": "Đã xóa sạch toàn bộ đơn món ăn bên bộ phận bếp."}


# =====================================================================
# ROOM SERVICE & AMENITIES CATALOG MANAGEMENT (CRUD DỊCH VỤ PHÒNG)
# =====================================================================

DEFAULT_ROOM_SERVICE_CATALOG = [
    {
        "id": "AMENITY-01",
        "name": "Khăn tắm lớn cao cấp",
        "category": "bath",
        "price": 0.0,
        "unit": "Chiếc",
        "prep_time": 10,
        "badge": "Miễn phí",
        "description": "Khăn tắm cotton 100% sợi dệt dài cao cấp của khách sạn, mềm mại và siêu thấm hút.",
        "image_url": "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 1,
    },
    {
        "id": "AMENITY-02",
        "name": "Bộ khăn tắm & khăn mặt",
        "category": "bath",
        "price": 0.0,
        "unit": "Bộ (2 khăn tắm + 2 khăn mặt)",
        "prep_time": 10,
        "badge": "Phổ biến",
        "description": "Set đầy đủ gồm 2 khăn tắm đại và 2 khăn lau mặt tiệt trùng tinh khiết.",
        "image_url": "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 2,
    },
    {
        "id": "AMENITY-03",
        "name": "Gối lông vũ cao cấp thêm",
        "category": "bedding",
        "price": 0.0,
        "unit": "Chiếc",
        "prep_time": 12,
        "badge": "Miễn phí",
        "description": "Gối lông vũ êm ái chống mỏi cổ vai gáy, áo gối lụa tơ tằm mềm mịn thoáng mát.",
        "image_url": "https://images.unsplash.com/photo-1584100936733-315132228d4d?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 3,
    },
    {
        "id": "AMENITY-04",
        "name": "Chăn đắp ấm bổ sung",
        "category": "bedding",
        "price": 0.0,
        "unit": "Chiếc",
        "prep_time": 12,
        "badge": "Miễn phí",
        "description": "Chăn ấm bông microfiber cao cấp nhẹ nhàng, giữ nhiệt tốt cho giấc ngủ sâu.",
        "image_url": "https://images.unsplash.com/photo-1540518614846-7ede433c4ef4?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 4,
    },
    {
        "id": "AMENITY-05",
        "name": "Bộ đồ vệ sinh cá nhân cao cấp",
        "category": "bath",
        "price": 0.0,
        "unit": "Bộ (Bàn chải, dao cạo, chụp tóc)",
        "prep_time": 10,
        "badge": "Miễn phí",
        "description": "Bàn chải than hoạt tính, kem đánh răng thảo mộc, dao cạo kép và lược gỗ tự nhiên.",
        "image_url": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 5,
    },
    {
        "id": "SPA-01",
        "name": "Massage toàn thân Thụy Điển",
        "category": "spa",
        "price": 350000.0,
        "unit": "Suất 60 phút / Kỹ thuật viên tại phòng",
        "prep_time": 20,
        "badge": "Được yêu thích",
        "description": "Kỹ thuật massage miết dài kết hợp tinh dầu oải hương Pháp giúp thư giãn cơ thể và giảm căng thẳng.",
        "image_url": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 6,
    },
    {
        "id": "SPA-02",
        "name": "Trị liệu bấm huyệt cổ vai gáy",
        "category": "spa",
        "price": 280000.0,
        "unit": "Suất 45 phút / Kỹ thuật viên tại phòng",
        "prep_time": 20,
        "badge": "Trị liệu sâu",
        "description": "Tập trung giải tỏa căng cơ vùng cổ, gáy và bả vai, lưu thông khí huyết cho người mệt mỏi sau chuyến đi.",
        "image_url": "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 7,
    },
    {
        "id": "SPA-03",
        "name": "Ngâm chân thảo dược & Massage chân",
        "category": "spa",
        "price": 220000.0,
        "unit": "Suất 45 phút / Kỹ thuật viên tại phòng",
        "prep_time": 15,
        "badge": "Thư giãn",
        "description": "Ngâm chân nước ấm thảo mộc gừng quế kết hợp bấm huyệt lòng bàn chân phục hồi thể lực tức thì.",
        "image_url": "https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 8,
    },
    {
        "id": "SPA-04",
        "name": "Trị liệu đá nóng núi lửa",
        "category": "spa",
        "price": 450000.0,
        "unit": "Suất 75 phút / Kỹ thuật viên tại phòng",
        "prep_time": 25,
        "badge": "Cao cấp",
        "description": "Chườm đá bazan núi lửa giữ nhiệt kết hợp ấn huyệt toàn thân giúp thải độc và cải thiện tuần hoàn máu.",
        "image_url": "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 9,
    },
    {
        "id": "HK-01",
        "name": "Dọn phòng & thay drap giường ngay",
        "category": "housekeeping",
        "price": 0.0,
        "unit": "Lượt phục vụ",
        "prep_time": 15,
        "badge": "Miễn phí",
        "description": "Nhân viên buồng phòng đến thay toàn bộ vỏ gối, drap giường và dọn dẹp phòng sạch tinh tươm.",
        "image_url": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 10,
    },
    {
        "id": "HK-02",
        "name": "Thu dọn rác & làm sạch nhanh",
        "category": "housekeeping",
        "price": 0.0,
        "unit": "Lượt phục vụ",
        "prep_time": 10,
        "badge": "Miễn phí",
        "description": "Thu gom túi rác, làm sạch bàn trà và bổ sung túi rác mới nhanh chóng trong 10 phút.",
        "image_url": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 11,
    },
    {
        "id": "HK-03",
        "name": "Xông tinh dầu khử mùi phòng ngủ",
        "category": "housekeeping",
        "price": 0.0,
        "unit": "Lượt phục vụ",
        "prep_time": 10,
        "badge": "Thư thái",
        "description": "Máy khuếch tán tinh dầu sả chanh hoặc ngọc lan tây tự nhiên mang lại không gian thư giãn dễ chịu.",
        "image_url": "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 12,
    },
    {
        "id": "LAUNDRY-01",
        "name": "Ủi / Là phẳng trang phục khẩn cấp",
        "category": "laundry",
        "price": 60000.0,
        "unit": "2 món trang phục",
        "prep_time": 25,
        "badge": "Tận nơi",
        "description": "Ủi hơi nước đứng chuyên dụng cho áo sơ mi, váy đầm hoặc âu phục lấy lại phom dáng chuẩn chỉnh.",
        "image_url": "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 13,
    },
    {
        "id": "LAUNDRY-02",
        "name": "Giặt sấy nhanh trong ngày",
        "category": "laundry",
        "price": 120000.0,
        "unit": "Giỏ 3kg",
        "prep_time": 180,
        "badge": "Giao tận phòng",
        "description": "Giặt sạch, sấy thơm và gấp gọn trang phục thường ngày giao tận cửa phòng trong vòng 3-4 giờ.",
        "image_url": "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 14,
    },
    {
        "id": "LAUNDRY-03",
        "name": "Mượn bàn ủi & cầu là tại phòng",
        "category": "laundry",
        "price": 0.0,
        "unit": "Bộ thiết bị",
        "prep_time": 10,
        "badge": "Miễn phí",
        "description": "Giao bàn ủi hơi nước Tefal và bàn để ủi chuyên dụng lên phòng để khách tự do sử dụng.",
        "image_url": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 15,
    },
]


@router.get(
    "/room-service/services",
    response_model=List[RoomServiceCatalogItemResponse],
    tags=TAG_ROOM_SERVICE,
    summary="Danh sách tất cả dịch vụ phòng (Room Service & Amenities)",
)
async def get_room_service_catalog(
    category: Optional[str] = Query(None, description="Lọc theo danh mục: bath, spa, bedding, housekeeping, laundry"),
    is_available: Optional[bool] = Query(None, description="Lọc theo trạng thái khả dụng"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách dịch vụ phòng hiển thị trên Kiosk Robot & Mobile.
    Tự động khởi tạo dữ liệu mẫu nếu bảng rỗng, và loại bỏ hoàn toàn nước khoáng khỏi phần dịch vụ.
    """
    from app.models.room_service import RoomServiceCatalogItem
    from sqlalchemy import select, delete, or_

    # 1. Đảm bảo bảng room_service_catalog_items đã được tạo
    from app.core.database import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Xóa sạch bất kỳ item nào là nước khoáng khỏi bảng dịch vụ nếu có
    await db.execute(
        delete(RoomServiceCatalogItem).where(
            or_(
                RoomServiceCatalogItem.id == "AMENITY-06",
                RoomServiceCatalogItem.name.ilike("%nước khoáng%"),
                RoomServiceCatalogItem.name.ilike("%nuoc khoang%"),
            )
        )
    )
    await db.commit()

    # 3. Lấy dữ liệu hiện tại
    stmt = select(RoomServiceCatalogItem).order_by(RoomServiceCatalogItem.display_order.asc(), RoomServiceCatalogItem.created_at.asc())
    result = await db.execute(stmt)
    items = result.scalars().all()

    # 4. Nếu bảng rỗng, nạp danh mục chuẩn 14 dịch vụ ban đầu (không có nước khoáng)
    if not items:
        for cat_item in DEFAULT_ROOM_SERVICE_CATALOG:
            db_item = RoomServiceCatalogItem(**cat_item)
            db.add(db_item)
        await db.commit()

        result = await db.execute(stmt)
        items = result.scalars().all()

    # 5. Áp dụng bộ lọc
    category_str = category if isinstance(category, str) else None
    avail_bool = is_available if isinstance(is_available, bool) else None

    filtered = list(items)
    if category_str and category_str.lower() != "all":
        filtered = [it for it in filtered if it.category.lower() == category_str.lower()]
    if avail_bool is not None:
        filtered = [it for it in filtered if it.is_available == avail_bool]

    return filtered


@router.post(
    "/room-service/services",
    response_model=RoomServiceCatalogItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_ROOM_SERVICE,
    summary="Thêm mới dịch vụ phòng",
)
async def create_room_service_service(
    service_in: RoomServiceCatalogItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """Nhân viên Room Service thêm một dịch vụ hoặc tiện ích buồng phòng mới."""
    from app.models.room_service import RoomServiceCatalogItem

    from app.core.database import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Chống spam / double-click: kiểm tra nếu cùng tên dịch vụ vừa được tạo trong 10 giây
    from datetime import timedelta
    ten_seconds_ago = datetime.utcnow() - timedelta(seconds=10)
    check_stmt = select(RoomServiceCatalogItem).where(
        RoomServiceCatalogItem.name.ilike(service_in.name.strip()),
        RoomServiceCatalogItem.created_at >= ten_seconds_ago
    )
    existing_res = await db.execute(check_stmt)
    existing_item = existing_res.scalars().first()
    if existing_item:
        return existing_item

    item_id = service_in.id or f"SVC-{uuid.uuid4().hex[:6].upper()}"
    new_item = RoomServiceCatalogItem(
        id=item_id,
        name=service_in.name.strip(),
        category=service_in.category,
        price=service_in.price,
        unit=service_in.unit,
        prep_time=service_in.prep_time,
        badge=service_in.badge,
        description=service_in.description,
        image_url=service_in.image_url,
        is_available=service_in.is_available,
        display_order=service_in.display_order,
    )
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    return new_item


@router.put(
    "/room-service/services/{service_id}",
    response_model=RoomServiceCatalogItemResponse,
    tags=TAG_ROOM_SERVICE,
    summary="Chỉnh sửa dịch vụ phòng",
)
async def update_room_service_service(
    service_id: str,
    service_in: RoomServiceCatalogItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin dịch vụ phòng."""
    from app.models.room_service import RoomServiceCatalogItem
    from sqlalchemy import select

    stmt = select(RoomServiceCatalogItem).where(RoomServiceCatalogItem.id == service_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy dịch vụ.")

    update_data = service_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)
    return item


@router.delete(
    "/room-service/services/{service_id}",
    tags=TAG_ROOM_SERVICE,
    summary="Xóa dịch vụ phòng",
)
async def delete_room_service_service(
    service_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Xóa hoàn toàn một dịch vụ phòng khỏi menu."""
    from app.models.room_service import RoomServiceCatalogItem
    from sqlalchemy import select

    stmt = select(RoomServiceCatalogItem).where(RoomServiceCatalogItem.id == service_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy dịch vụ.")

    await db.delete(item)
    await db.commit()
    return {"status": "success", "message": f"Đã xóa dịch vụ {service_id} thành công", "id": service_id}


@router.patch(
    "/room-service/services/{service_id}/toggle",
    response_model=RoomServiceCatalogItemResponse,
    tags=TAG_ROOM_SERVICE,
    summary="Bật / Tắt trạng thái phục vụ của dịch vụ phòng",
)
async def toggle_room_service_service(
    service_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Chuyển đổi trạng thái is_available của dịch vụ phòng (Đang phục vụ / Tạm ngưng)."""
    from app.models.room_service import RoomServiceCatalogItem
    from sqlalchemy import select

    stmt = select(RoomServiceCatalogItem).where(RoomServiceCatalogItem.id == service_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy dịch vụ.")

    item.is_available = not item.is_available
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)
    return item
