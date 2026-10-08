import random
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_

from app.core.database import get_db
from app.models import (
    Staff,
    SupportRequest,
    MenuItem,
    FoodItem,
    Room,
    RoomServiceOrder,
    OrderItem as OrderItemModel,
)
from app.schemas.operations import (
    RoomServiceOrderCreate,
    RoomServiceOrderStatusUpdate,
    RoomServiceOrderResponse,
    RoomServiceDashboardResponse,
    OrderItemResponse,
    RoomOrderedItemSummary,
    RoomOrdersHistoryResponse,
)
from .shared import TAG_ROOM_SERVICE, TAG_FB, create_department_notification

router = APIRouter()


@router.get(
    "/dashboard/room-service",
    response_model=RoomServiceDashboardResponse,
    tags=TAG_FB,
    summary="Xem Dashboard Phục vụ phòng (Room Service)",
)
async def get_room_service_dashboard(db: AsyncSession = Depends(get_db)):
    """Returns real-time KPIs, active orders, delivery fleet, and low stock alerts for Room Service."""
    # 1. Fetch Orders directly from RoomServiceOrder table (ERD Entity ROOM_SERVICE_ORDER)
    orders_res = await db.execute(
        select(RoomServiceOrder).order_by(desc(RoomServiceOrder.created_at))
    )
    orders = orders_res.scalars().all()

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
async def create_room_service_order(order_in: RoomServiceOrderCreate, db: AsyncSession = Depends(get_db)):
    """Creates a new Room Service order stored in both SupportRequest and RoomServiceOrder/OrderItem tables."""
    order_num = f"{random.randint(1043, 9999)}"
    
    # Try looking up room in database
    clean_room = order_in.room_number.upper().replace("ROOM", "").strip()
    room_res = await db.execute(
        select(Room).where(
            (Room.room_number == order_in.room_number) | (Room.room_number == clean_room)
        )
    )
    room = room_res.scalar_one_or_none()
    room_id = room.id if room else None

    # Calculate total amount and enrich item details
    total_amount = 0.0
    items_payload = []
    order_items_to_create = []

    for it in order_in.items:
        food_item = None
        m_item = None

        # 1. Tra cứu theo ID nếu client có gửi lên
        if getattr(it, "food_item_id", None):
            food_item = await db.get(FoodItem, it.food_item_id)
        if getattr(it, "menu_item_id", None):
            m_item = await db.get(MenuItem, it.menu_item_id)

        # 2. Nếu có m_item thì lấy food_item liên quan
        if not food_item and m_item and m_item.food_item_id:
            food_item = await db.get(FoodItem, m_item.food_item_id)

        # 3. Tra cứu theo tên nếu chưa có
        if not food_item and not m_item:
            f_res = await db.execute(
                select(FoodItem).where(FoodItem.name.ilike(f"%{it.name}%"))
            )
            food_item = f_res.scalars().first()

        if food_item and not m_item:
            m_res = await db.execute(
                select(MenuItem).where(MenuItem.food_item_id == food_item.id, MenuItem.is_available == True)
            )
            m_item = m_res.scalars().first()

        if not food_item and not m_item:
            m_item_res = await db.execute(
                select(MenuItem).where(MenuItem.name.ilike(f"%{it.name}%"))
            )
            m_item = m_item_res.scalars().first()
            if m_item and m_item.food_item_id:
                food_item = await db.get(FoodItem, m_item.food_item_id)

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
        guest_name="Room Guest",
        source="Guest App / In-Room Tablet",
        status="Pending",
        priority="NORMAL",
        progress=0,
        total_amount=total_amount,
        items=items_payload,
        extra_data={
            "is_service_request": order_in.is_service_request,
            "image_url": order_in.image_url,
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
        status="Pending",
        items=items_payload,
        note=order_in.note,
        image_url=order_in.image_url,
        is_service_request=order_in.is_service_request,
        progress=0,
        total_amount=total_amount,
        priority="NORMAL",
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

    await create_department_notification(
        db=db,
        department="Room Service",
        title=f"Đơn Room Service mới #{order_num}",
        description=f"{order_in.room_number}: {items_desc or order_in.note or 'Yêu cầu phục vụ phòng mới'}",
        request_id=new_order.id,
        request_type="room_service",
        type="Request",
    )
    await db.commit()
    await db.refresh(new_order)
    return new_order


@router.get(
    "/room-service/orders",
    response_model=List[RoomServiceOrderResponse],
    tags=TAG_FB,
    summary="Danh sách toàn bộ đơn hàng Room Service",
)
async def list_room_service_orders(
    status: Optional[str] = Query(None, description="Lọc theo trạng thái đơn hàng ('Pending', 'Cooking', 'Delivering', 'Completed')"),
    room_number: Optional[str] = Query(None, description="Lọc theo số phòng (vd: '402', 'ROOM 201')"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các đơn đặt món Room Service (bảng room_service_orders)."""
    stmt = select(RoomServiceOrder).order_by(desc(RoomServiceOrder.created_at))
    if status and status not in ("All", ""):
        stmt = stmt.where(RoomServiceOrder.status == status)
    if room_number and room_number not in ("All", ""):
        clean_room = room_number.upper().replace("ROOM", "").replace("PHÒNG", "").strip()
        stmt = stmt.where(
            or_(
                RoomServiceOrder.room_number == room_number,
                RoomServiceOrder.room_number.ilike(f"%{clean_room}%"),
                RoomServiceOrder.room_number == f"ROOM {clean_room}",
                RoomServiceOrder.room_number == f"Room {clean_room}",
            )
        )
    res = await db.execute(stmt)
    return res.scalars().all()


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
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết lịch sử đặt món ăn / dịch vụ phòng theo số phòng (vd: `402`, `ROOM 201`, `304`):
    - **Tổng số đơn hàng**: Tổng số lần phòng này đã đặt Room Service
    - **Tổng số tiền**: Tổng chi phí các đơn đã đặt
    - **Danh sách tổng hợp các món đã đặt**: Tên món, tổng số lượng, đơn giá và thời điểm đặt gần nhất
    - **Danh sách chi tiết các đơn hàng**: Chi tiết từng đơn (mã đơn, trạng thái, danh sách món, ghi chú)
    """
    clean_room = room_number.upper().replace("ROOM", "").replace("PHÒNG", "").strip()
    stmt = (
        select(RoomServiceOrder)
        .where(
            or_(
                RoomServiceOrder.room_number == room_number,
                RoomServiceOrder.room_number.ilike(f"%{clean_room}%"),
                RoomServiceOrder.room_number == f"ROOM {clean_room}",
                RoomServiceOrder.room_number == f"Room {clean_room}",
            )
        )
        .order_by(desc(RoomServiceOrder.created_at))
    )
    res = await db.execute(stmt)
    orders = res.scalars().all()

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
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin chi tiết một đơn đặt món Room Service theo ID hoặc mã đơn."""
    clean_id = order_id.replace("ORD-", "")
    res = await db.execute(
        select(RoomServiceOrder).where(
            (RoomServiceOrder.id == order_id)
            | (RoomServiceOrder.order_number == order_id)
            | (RoomServiceOrder.order_number == clean_id)
            | (RoomServiceOrder.support_request_id == order_id)
        )
    )
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng Room Service.")
    return order


@router.patch(
    "/room-service/orders/{order_id}/status",
    response_model=RoomServiceOrderResponse,
    tags=TAG_FB,
    summary="Cập nhật trạng thái đơn phục vụ phòng",
)
async def update_room_service_order_status(
    order_id: str,
    status_in: RoomServiceOrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates order status (e.g. Cooking, Ready, Completed, Rejected)."""
    clean_id = order_id.replace("REQ-", "").replace("ORD-", "").strip()
    res = await db.execute(
        select(SupportRequest).where(
            (SupportRequest.id == order_id)
            | (SupportRequest.ticket_code == order_id)
            | (SupportRequest.ticket_code == f"ORD-{clean_id}")
            | (SupportRequest.ticket_code == clean_id)
            | (SupportRequest.ticket_code == f"REQ-ORD-{clean_id}")
        )
    )
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = status_in.status
    st_lower = (status_in.status or "").lower().strip()
    if status_in.progress is not None:
        target_progress = status_in.progress
    elif st_lower in ["completed", "delivered", "done"]:
        target_progress = 100
    elif st_lower in ["delivering"]:
        target_progress = 85
    elif st_lower in ["ready", "food ready"]:
        target_progress = 75
    elif st_lower in ["cooking", "in preparation"]:
        target_progress = 50
    elif st_lower in ["sent to kitchen", "sent_to_kitchen"]:
        target_progress = 25
    elif st_lower in ["pending"]:
        target_progress = 0
    else:
        target_progress = order.progress or 0

    order.progress = target_progress
    if status_in.est_completion is not None:
        order.est_completion = status_in.est_completion
    if status_in.assigned_staff_name is not None:
        order.assigned_staff_name = status_in.assigned_staff_name

    # Cross-department notifications
    ticket_label = order.ticket_code or order.id
    room_label = order.room_number or "phòng khách"
    try:
        if st_lower in ["sent to kitchen", "sent_to_kitchen", "chờ bếp"]:
            await create_department_notification(
                db,
                department="Kitchen",
                title=f"Đơn Room Service #{ticket_label} chuyển Bếp",
                description=f"{room_label}: {order.title}. Bếp vui lòng tiếp nhận và làm món.",
                request_id=order.id,
                request_type="Room Service",
            )
        elif st_lower in ["ready", "food ready"]:
            await create_department_notification(
                db,
                department="Room Service",
                title=f"Bếp đã làm xong món #{ticket_label}!",
                description=f"Món ăn {room_label} đã sẵn sàng. Room Service vui lòng lấy món và chuẩn bị dụng cụ giao lên phòng.",
                request_id=order.id,
                request_type="Room Service",
            )
    except Exception:
        pass

    await db.commit()
    await db.refresh(order)

    # Đồng bộ cập nhật sang bảng room_service_orders nếu có
    rs_res = await db.execute(
        select(RoomServiceOrder).where(
            (RoomServiceOrder.id == order.id)
            | (RoomServiceOrder.support_request_id == order.id)
            | (RoomServiceOrder.order_number == clean_id)
        )
    )
    rs_order = rs_res.scalars().first()
    if rs_order:
        rs_order.status = status_in.status
        rs_order.progress = target_progress
        if status_in.est_completion is not None:
            rs_order.est_completion = status_in.est_completion
        if status_in.assigned_staff_name is not None:
            rs_order.assigned_staff_name = status_in.assigned_staff_name
        await db.commit()

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
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các bản ghi ORDER_ITEM chi tiết thuộc về một đơn hàng phục vụ phòng cụ thể."""
    clean_id = order_id.replace("ORD-", "")
    
    # Tìm mã order thực tế
    rs_res = await db.execute(
        select(RoomServiceOrder).where(
            (RoomServiceOrder.id == order_id)
            | (RoomServiceOrder.order_number == order_id)
            | (RoomServiceOrder.order_number == clean_id)
            | (RoomServiceOrder.support_request_id == order_id)
        )
    )
    rs_order = rs_res.scalar_one_or_none()
    actual_order_id = rs_order.id if rs_order else order_id

    stmt = (
        select(OrderItemModel)
        .where(
            (OrderItemModel.order_id == actual_order_id)
            | (OrderItemModel.order_id == order_id)
            | (OrderItemModel.order_id == f"ORD-{clean_id}")
        )
        .order_by(OrderItemModel.id)
    )
    res = await db.execute(stmt)
    items = res.scalars().all()

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
    db: AsyncSession = Depends(get_db),
):
    """Liệt kê toàn bộ các món ăn đã được gọi qua dịch vụ phòng (ORDER_ITEM)."""
    stmt = select(OrderItemModel).order_by(desc(OrderItemModel.id))
    if order_id:
        stmt = stmt.where(OrderItemModel.order_id == order_id)
    if food_item_id:
        stmt = stmt.where(OrderItemModel.food_item_id == food_item_id)
    if menu_item_id:
        stmt = stmt.where(OrderItemModel.menu_item_id == menu_item_id)
    res = await db.execute(stmt)
    return res.scalars().all()

