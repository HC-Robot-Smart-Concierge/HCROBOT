from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.models import Staff, RoomServiceOrder, InventoryStock
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
    # 1. Fetch Orders
    orders_res = await db.execute(select(RoomServiceOrder).order_by(desc(RoomServiceOrder.created_at)))
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
    """Creates a new F&B / Room Service order from guest room or tablet."""
    order_num = f"{random.randint(1043, 9999)}"
    new_order = RoomServiceOrder(
        order_number=order_num,
        room_number=order_in.room_number,
        items=[item.model_dump() for item in order_in.items],
        note=order_in.note,
        image_url=order_in.image_url,
        is_service_request=order_in.is_service_request,
        status="Pending",
        progress=0,
    )
    db.add(new_order)
    items_desc = ", ".join([f"{it.get('qty', 1)}x {it.get('name', 'Món')}" for it in (order_in.items or [])])
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


@router.patch("/room-service/orders/{order_id}/status", response_model=RoomServiceOrderResponse, tags=TAG_FB)
async def update_room_service_order_status(
    order_id: str,
    status_in: RoomServiceOrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates order status (e.g. Cooking, Ready, Completed, Rejected)."""
    res = await db.execute(
        select(RoomServiceOrder).where(
            (RoomServiceOrder.id == order_id) | (RoomServiceOrder.order_number == order_id)
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
async def assign_robot_to_order(
    order_id: str,
    assign_in: RoomServiceOrderAssignRobot,
    db: AsyncSession = Depends(get_db),
):
    """Assigns and dispatches an autonomous HCRobot unit to deliver this order."""
    res = await db.execute(
        select(RoomServiceOrder).where(
            (RoomServiceOrder.id == order_id) | (RoomServiceOrder.order_number == order_id)
        )
    )
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.assigned_robot_id = assign_in.robot_id
    order.assigned_staff_name = assign_in.robot_name or assign_in.robot_id or "HCRobot Unit 01"
    order.status = "Delivering"
    await db.commit()
    await db.refresh(order)
    return order


