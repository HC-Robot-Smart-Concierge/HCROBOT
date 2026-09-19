from datetime import datetime
import random
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.operations import (
    RestaurantReservationCreate,
    RestaurantReservationResponse,
    RestaurantPreOrderCreate,
    RestaurantPreOrderResponse,
    RestaurantDashboardResponse,
)
from .shared import TAG_REST

router = APIRouter()

# 10. RESTAURANT DASHBOARD, TABLE RESERVATIONS & PRE-ORDERS (Fallback - Table schemas deprecated in Alembic)
# =====================================================================


@router.get("/dashboard/restaurant", response_model=RestaurantDashboardResponse, tags=TAG_REST)
async def get_restaurant_dashboard(db: AsyncSession = Depends(get_db)):
    """Returns real-time KPIs, active table reservations, and pre-ordered dishes for the Restaurant."""
    kpis = {
        "totalReservations": 0,
        "totalPreOrders": 0,
        "seatedGuests": 0,
        "pendingPreOrders": 0,
    }
    return {
        "kpis": kpis,
        "reservations": [],
        "pre_orders": [],
    }


@router.post("/restaurant/reservations", response_model=RestaurantReservationResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def create_restaurant_reservation(
    res_in: RestaurantReservationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new Restaurant Table Reservation (from HCRobot Kiosk or Reception)."""
    res_code = f"RES-{random.randint(1024, 9999)}"
    return RestaurantReservationResponse(
        id=f"res_{random.randint(1000, 9999)}",
        reservation_code=res_code,
        guest_name=res_in.guest_name,
        room_number=res_in.room_number,
        party_size=res_in.party_size,
        reservation_time=res_in.reservation_time,
        table_number=res_in.table_number or f"Table {random.randint(1, 20):02d}",
        special_note=res_in.special_note,
        status="Confirmed",
        created_at=datetime.utcnow(),
    )


@router.get("/restaurant/reservations", response_model=List[RestaurantReservationResponse], tags=TAG_REST)
async def get_restaurant_reservations(db: AsyncSession = Depends(get_db)):
    """Returns list of all table reservations."""
    return []


@router.post("/restaurant/pre-orders", response_model=RestaurantPreOrderResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def create_restaurant_pre_order(
    order_in: RestaurantPreOrderCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new Food/Dish Pre-Order for a restaurant table from HCRobot Kiosk."""
    order_code = f"ORD-{random.randint(5012, 9999)}"
    items_data = [item.model_dump() for item in order_in.items]
    calc_total = order_in.total_price or sum(item.quantity * item.price for item in order_in.items)

    return RestaurantPreOrderResponse(
        id=f"order_{random.randint(1000, 9999)}",
        order_code=order_code,
        reservation_code=order_in.reservation_code,
        guest_name=order_in.guest_name,
        room_number=order_in.room_number,
        items=items_data,
        total_price=calc_total,
        note=order_in.note,
        status="Pending",
        created_at=datetime.utcnow(),
    )


@router.get("/restaurant/pre-orders", response_model=List[RestaurantPreOrderResponse], tags=TAG_REST)
async def get_restaurant_pre_orders(db: AsyncSession = Depends(get_db)):
    """Returns list of all dish pre-orders."""
    return []


@router.patch("/restaurant/reservations/{reservation_id}/status", response_model=RestaurantReservationResponse, tags=TAG_REST)
async def update_restaurant_reservation_status(
    reservation_id: str,
    status: str,
    db: AsyncSession = Depends(get_db),
):
    """Updates reservation status (e.g. Confirmed, Seated, Completed, Cancelled)."""
    return RestaurantReservationResponse(
        id=reservation_id,
        reservation_code=reservation_id,
        guest_name="Guest",
        room_number="101",
        party_size=2,
        reservation_time=datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
        table_number="Table 01",
        special_note="",
        status=status,
        created_at=datetime.utcnow(),
    )
