from datetime import datetime
import random
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Menu, MenuItem
from app.schemas.operations import (
    RestaurantReservationCreate,
    RestaurantReservationResponse,
    RestaurantPreOrderCreate,
    RestaurantPreOrderResponse,
    RestaurantDashboardResponse,
    MenuCreate,
    MenuResponse,
    MenuItemCreate,
    MenuItemResponse,
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


# =====================================================================
# MENUS & MENU ITEMS
# =====================================================================

@router.get("/restaurant/menus", response_model=List[MenuResponse], tags=TAG_REST)
async def get_restaurant_menus(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Returns active restaurant menus with all items."""
    stmt = select(Menu).options(selectinload(Menu.items)).where(Menu.is_active == True)
    if category:
        stmt = stmt.where(Menu.category == category)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/restaurant/menus", response_model=MenuResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def create_restaurant_menu(
    menu_in: MenuCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new menu or reuses an existing one, and adds items only if they do not exist yet."""
    clean_menu_name = menu_in.name.strip()
    if not clean_menu_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên thực đơn không được để trống.",
        )

    # 1. Tìm menu theo tên (không phân biệt hoa thường)
    stmt_menu = select(Menu).where(func.lower(Menu.name) == clean_menu_name.lower())
    res_menu = await db.execute(stmt_menu)
    target_menu = res_menu.scalars().first()

    if not target_menu:
        target_menu = Menu(
            name=clean_menu_name,
            category=menu_in.category,
            description=menu_in.description,
            is_active=menu_in.is_active,
        )
        db.add(target_menu)
        await db.flush()

    # 2. Xử lý các món ăn trong menu: nếu món chưa có thì mới tạo, có rồi thì không làm gì (skip)
    if menu_in.items:
        stmt_existing = select(MenuItem.name).where(MenuItem.menu_id == target_menu.id)
        existing_res = await db.execute(stmt_existing)
        existing_item_names = {name.strip().lower() for name in existing_res.scalars().all() if name}

        for it in menu_in.items:
            clean_item_name = it.name.strip()
            if not clean_item_name:
                continue
            item_key = clean_item_name.lower()
            if item_key in existing_item_names:
                # Đã có món này trong menu rồi -> bỏ qua
                continue

            item = MenuItem(
                menu_id=target_menu.id,
                name=clean_item_name,
                price=it.price,
                currency=it.currency,
                image_url=it.image_url,
                category=it.category,
                is_available=it.is_available,
                prep_time_minutes=it.prep_time_minutes,
                description=it.description,
            )
            db.add(item)
            existing_item_names.add(item_key)

    await db.commit()
    # Eager load items for response_model
    stmt = select(Menu).options(selectinload(Menu.items)).where(Menu.id == target_menu.id)
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/restaurant/menu-items", response_model=List[MenuItemResponse], tags=TAG_REST)
async def get_restaurant_menu_items(
    menu_id: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Returns all restaurant menu items, optionally filtered by menu or category."""
    stmt = select(MenuItem).where(MenuItem.is_available == True)
    if menu_id:
        stmt = stmt.where(MenuItem.menu_id == menu_id)
    if category:
        stmt = stmt.where(MenuItem.category == category)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/restaurant/menu-items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def create_restaurant_menu_item(
    item_in: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new dish / menu item under a menu. If it already exists, returns the existing item without duplicating."""
    clean_name = item_in.name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên món ăn không được để trống.",
        )

    # Kiểm tra menu có tồn tại không
    menu = await db.get(Menu, item_in.menu_id)
    if not menu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thực đơn với ID {item_in.menu_id} không tồn tại.",
        )

    # Kiểm tra món ăn đã có trong menu chưa
    stmt = select(MenuItem).where(
        MenuItem.menu_id == item_in.menu_id,
        func.lower(MenuItem.name) == clean_name.lower(),
    )
    res = await db.execute(stmt)
    existing_item = res.scalars().first()
    if existing_item:
        # Nếu đã có rồi thì trả về món hiện tại mà không tạo thêm
        return existing_item

    new_item = MenuItem(
        menu_id=item_in.menu_id,
        name=clean_name,
        price=item_in.price,
        currency=item_in.currency,
        image_url=item_in.image_url,
        category=item_in.category,
        is_available=item_in.is_available,
        prep_time_minutes=item_in.prep_time_minutes,
        description=item_in.description,
    )
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    return new_item
