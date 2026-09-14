from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.models import RestaurantReservation, RestaurantPreOrder
from app.schemas.operations import (
    RestaurantReservationCreate,
    RestaurantReservationResponse,
    RestaurantPreOrderCreate,
    RestaurantPreOrderResponse,
    RestaurantDashboardResponse,
)
from .shared import TAG_REST

router = APIRouter()

# 10. RESTAURANT DASHBOARD, TABLE RESERVATIONS & PRE-ORDERS
# =====================================================================


@router.get("/dashboard/restaurant", response_model=RestaurantDashboardResponse, tags=TAG_REST)
async def get_restaurant_dashboard(db: AsyncSession = Depends(get_db)):
    """Returns real-time KPIs, active table reservations, and pre-ordered dishes for the Restaurant."""
    res_db = await db.execute(select(RestaurantReservation).order_by(desc(RestaurantReservation.created_at)))
    reservations = res_db.scalars().all()

    pre_db = await db.execute(select(RestaurantPreOrder).order_by(desc(RestaurantPreOrder.created_at)))
    pre_orders = pre_db.scalars().all()

    kpis = {
        "totalReservations": len(reservations),
        "totalPreOrders": len(pre_orders),
        "seatedGuests": sum(r.party_size for r in reservations if r.status == "Seated"),
        "pendingPreOrders": sum(1 for p in pre_orders if p.status == "Pending"),
    }

    return {
        "kpis": kpis,
        "reservations": reservations,
        "pre_orders": pre_orders,
    }


@router.post("/restaurant/reservations", response_model=RestaurantReservationResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def create_restaurant_reservation(
    res_in: RestaurantReservationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new Restaurant Table Reservation (from HCRobot Kiosk or Reception)."""
    res_code = f"RES-{random.randint(1024, 9999)}"
    new_res = RestaurantReservation(
        reservation_code=res_code,
        guest_name=res_in.guest_name,
        room_number=res_in.room_number,
        party_size=res_in.party_size,
        reservation_time=res_in.reservation_time,
        table_number=res_in.table_number or f"Table {random.randint(1, 20):02d}",
        special_note=res_in.special_note,
        status="Confirmed",
    )
    db.add(new_res)
    await db.commit()
    await db.refresh(new_res)
    return new_res


@router.get("/restaurant/reservations", response_model=List[RestaurantReservationResponse], tags=TAG_REST)
async def get_restaurant_reservations(db: AsyncSession = Depends(get_db)):
    """Returns list of all table reservations."""
    res = await db.execute(select(RestaurantReservation).order_by(desc(RestaurantReservation.created_at)))
    return res.scalars().all()


@router.post("/restaurant/pre-orders", response_model=RestaurantPreOrderResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def create_restaurant_pre_order(
    order_in: RestaurantPreOrderCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new Food/Dish Pre-Order for a restaurant table from HCRobot Kiosk."""
    order_code = f"ORD-{random.randint(5012, 9999)}"
    items_data = [item.model_dump() for item in order_in.items]
    calc_total = order_in.total_price or sum(item.quantity * item.price for item in order_in.items)

    new_pre_order = RestaurantPreOrder(
        order_code=order_code,
        reservation_code=order_in.reservation_code,
        guest_name=order_in.guest_name,
        room_number=order_in.room_number,
        items=items_data,
        total_price=calc_total,
        note=order_in.note,
        status="Pending",
    )
    db.add(new_pre_order)
    await db.commit()
    await db.refresh(new_pre_order)
    return new_pre_order


@router.get("/restaurant/pre-orders", response_model=List[RestaurantPreOrderResponse], tags=TAG_REST)
async def get_restaurant_pre_orders(db: AsyncSession = Depends(get_db)):
    """Returns list of all dish pre-orders."""
    res = await db.execute(select(RestaurantPreOrder).order_by(desc(RestaurantPreOrder.created_at)))
    return res.scalars().all()


@router.patch("/restaurant/reservations/{reservation_id}/status", response_model=RestaurantReservationResponse, tags=TAG_REST)
async def update_restaurant_reservation_status(
    reservation_id: str,
    status: str,
    db: AsyncSession = Depends(get_db),
):
    """Updates reservation status (e.g. Confirmed, Seated, Completed, Cancelled)."""
    res = await db.execute(
        select(RestaurantReservation).where(
            (RestaurantReservation.id == reservation_id) |
            (RestaurantReservation.reservation_code == reservation_id)
        )
    )
    res_obj = res.scalar_one_or_none()
    if not res_obj:
        raise HTTPException(status_code=404, detail="Reservation not found")

    res_obj.status = status
    await db.commit()
    await db.refresh(res_obj)
    return res_obj


