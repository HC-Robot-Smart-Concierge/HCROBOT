import random
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_

from app.core.database import get_db
from app.models import Staff, SupportRequest, MenuItem, FoodItem, Room, InventoryStock
from app.schemas.operations import (
    RoomServiceOrderCreate,
    RoomServiceOrderStatusUpdate,
    RoomServiceOrderAssignRobot,
    RoomServiceOrderResponse,
    RoomServiceDashboardResponse,
)
from .shared import TAG_FB, create_department_notification

router = APIRouter()


@router.get("/dashboard/room-service", response_model=RoomServiceDashboardResponse, tags=TAG_FB)
async def get_room_service_dashboard(db: AsyncSession = Depends(get_db)):
    """Returns real-time KPIs, active orders, delivery fleet, and low stock alerts for Room Service."""
    # 1. Fetch Orders from unified SupportRequest table
    orders_res = await db.execute(
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-FB",
                SupportRequest.service_type_id == "ST-ROOM-SERVICE",
            )
        )
        .order_by(desc(SupportRequest.created_at))
    )
    orders = orders_res.scalars().all()

    # 2. Fetch Robots (Deprecated - returning empty list)
    delivery_fleet = []

    # 3. Fetch Stock
    stock_res = await db.execute(select(InventoryStock).order_by(InventoryStock.quantity))
    low_stock_alerts = stock_res.scalars().all()

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


@router.post("/room-service/orders", response_model=RoomServiceOrderResponse, status_code=status.HTTP_201_CREATED, tags=TAG_FB)
async def create_room_service_order(order_in: RoomServiceOrderCreate, db: AsyncSession = Depends(get_db)):
    """Creates a new F&B / Room Service order stored as a SupportRequest."""
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
    for it in order_in.items:
        # 1. Tìm món ăn trong Master Food Item Catalog
        f_res = await db.execute(
            select(FoodItem).where(FoodItem.name.ilike(f"%{it.name}%"))
        )
        food_item = f_res.scalars().first()

        # 2. Tìm MenuItem liên kết để lấy giá bán theo thực đơn nếu có
        m_item = None
        price = 0.0
        if food_item:
            m_res = await db.execute(
                select(MenuItem).where(MenuItem.food_item_id == food_item.id, MenuItem.is_available == True)
            )
            m_item = m_res.scalars().first()
            price = m_item.price if (m_item and m_item.price > 0) else food_item.base_price
        else:
            # Fallback legacy lookup by MenuItem name
            m_item_res = await db.execute(
                select(MenuItem).where(MenuItem.name.ilike(f"%{it.name}%"))
            )
            m_item = m_item_res.scalars().first()
            if m_item:
                price = m_item.price

        qty = int(it.qty) if str(it.qty).isdigit() else 1
        subtotal = price * qty
        total_amount += subtotal
        items_payload.append({
            "name": it.name,
            "qty": it.qty,
            "unit_price": price,
            "subtotal": subtotal,
        })

    order_id = f"ORD-{uuid.uuid4().hex[:8]}"
    ticket_code = f"ORD-{order_num}"
    items_desc = ", ".join([f"{it.qty}x {it.name}" for it in (order_in.items or [])])

    new_order = SupportRequest(
        id=order_id,
        ticket_code=ticket_code,
        title=f"Room Service Order #{order_num}",
        description=order_in.note or items_desc or "Yêu cầu phục vụ phòng",
        service_type_id="ST-ROOM-SERVICE",
        department_id="DEP-FB",
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

    await create_department_notification(
        db=db,
        department="F&B",
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
    status: Optional[str] = Query(None, description="Lọc theo trạng thái đơn hàng"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các đơn đặt món Room Service."""
    stmt = (
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-FB",
                SupportRequest.service_type_id == "ST-ROOM-SERVICE",
            )
        )
        .order_by(desc(SupportRequest.created_at))
    )
    if status and status not in ("All", ""):
        stmt = stmt.where(SupportRequest.status == status)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.patch("/room-service/orders/{order_id}/status", response_model=RoomServiceOrderResponse, tags=TAG_FB)
async def update_room_service_order_status(
    order_id: str,
    status_in: RoomServiceOrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates order status (e.g. Cooking, Ready, Completed, Rejected)."""
    clean_id = order_id.replace("ORD-", "")
    res = await db.execute(
        select(SupportRequest).where(
            (SupportRequest.id == order_id)
            | (SupportRequest.ticket_code == order_id)
            | (SupportRequest.ticket_code == f"ORD-{clean_id}")
            | (SupportRequest.ticket_code == clean_id)
        )
    )
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = status_in.status
    if status_in.progress is not None:
        order.progress = status_in.progress
    if status_in.est_completion is not None:
        order.est_completion = status_in.est_completion
    if status_in.assigned_staff_name is not None:
        order.assigned_staff_name = status_in.assigned_staff_name

    await db.commit()
    await db.refresh(order)
    return order


@router.post("/room-service/orders/{order_id}/assign-robot", response_model=RoomServiceOrderResponse, tags=TAG_FB)
@router.post("/room-service/orders/{order_id}/dispatch-robot", response_model=RoomServiceOrderResponse, tags=TAG_FB, include_in_schema=False)
async def assign_robot_to_order(
    order_id: str,
    robot_id: Optional[str] = Query(None),
    assign_in: Optional[RoomServiceOrderAssignRobot] = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """Assigns and dispatches an autonomous HCRobot unit to deliver this order."""
    clean_id = order_id.replace("ORD-", "")
    res = await db.execute(
        select(SupportRequest).where(
            (SupportRequest.id == order_id)
            | (SupportRequest.ticket_code == order_id)
            | (SupportRequest.ticket_code == f"ORD-{clean_id}")
            | (SupportRequest.ticket_code == clean_id)
        )
    )
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    target_robot_id = (assign_in.robot_id if assign_in and assign_in.robot_id else None) or robot_id or "RC-001"
    target_robot_name = (assign_in.robot_name if assign_in and assign_in.robot_name else None) or target_robot_id or "HCRobot Unit 01"

    order.assigned_robot_id = target_robot_id
    order.assigned_staff_name = target_robot_name
    order.status = "Delivering"
    await db.commit()
    await db.refresh(order)
    return order
