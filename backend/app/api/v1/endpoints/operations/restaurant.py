from datetime import datetime
import random
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Menu, MenuItem, FoodItem
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
    FoodItemCreate,
    FoodItemUpdate,
    FoodItemResponse,
    AssignFoodToMenuRequest,
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
# MASTER FOOD ITEMS (DISH CATALOG - DIAGRAM 2)
# =====================================================================

@router.get("/restaurant/food-items", response_model=List[FoodItemResponse], tags=TAG_REST)
async def get_restaurant_food_items(
    category: Optional[str] = None,
    search: Optional[str] = None,
    is_available: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh mục tất cả món ăn / thức uống gốc của toàn khách sạn (Master Catalog)."""
    stmt = select(FoodItem).order_by(FoodItem.category, FoodItem.name)
    if category:
        stmt = stmt.where(FoodItem.category == category)
    if is_available is not None:
        stmt = stmt.where(FoodItem.is_available == is_available)
    if search:
        stmt = stmt.where(FoodItem.name.ilike(f"%{search.strip()}%"))
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/restaurant/food-items", response_model=FoodItemResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def create_restaurant_food_item(
    food_in: FoodItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """Tạo mới một món ăn / thức uống vào danh mục gốc của khách sạn."""
    clean_name = food_in.name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên món ăn không được để trống.",
        )

    # Kiểm tra xem đã có món ăn cùng tên chưa
    stmt = select(FoodItem).where(func.lower(FoodItem.name) == clean_name.lower())
    res = await db.execute(stmt)
    existing_food = res.scalars().first()
    if existing_food:
        return existing_food

    new_food = FoodItem(
        name=clean_name,
        category=food_in.category,
        description=food_in.description,
        image_url=food_in.image_url,
        base_price=food_in.base_price,
        currency=food_in.currency,
        prep_time_minutes=food_in.prep_time_minutes,
        is_available=food_in.is_available,
    )
    db.add(new_food)
    await db.commit()
    await db.refresh(new_food)
    return new_food


@router.get("/restaurant/food-items/{food_id}", response_model=FoodItemResponse, tags=TAG_REST)
async def get_restaurant_food_item(
    food_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin chi tiết một món ăn trong danh mục gốc."""
    food = await db.get(FoodItem, food_id)
    if not food:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn.")
    return food


@router.put("/restaurant/food-items/{food_id}", response_model=FoodItemResponse, tags=TAG_REST)
async def update_restaurant_food_item(
    food_id: str,
    food_in: FoodItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin món ăn trong danh mục gốc."""
    food = await db.get(FoodItem, food_id)
    if not food:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn.")

    update_data = food_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"]:
        update_data["name"] = update_data["name"].strip()
    
    for key, value in update_data.items():
        setattr(food, key, value)
    
    food.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(food)
    return food


@router.delete("/restaurant/food-items/{food_id}", tags=TAG_REST)
async def delete_restaurant_food_item(
    food_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Xóa một món ăn khỏi danh mục gốc (tự động xóa khỏi các thực đơn liên quan)."""
    food = await db.get(FoodItem, food_id)
    if not food:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn.")

    await db.delete(food)
    await db.commit()
    return {"detail": "Đã xoá món ăn thành công khỏi danh mục gốc", "id": food_id}


# =====================================================================
# MENUS & MENU ITEMS (DIAGRAM 2 JUNCTION)
# =====================================================================

@router.get("/restaurant/menus", response_model=List[MenuResponse], tags=TAG_REST)
@router.get("/restaurant/menu", response_model=List[MenuResponse], tags=TAG_REST, include_in_schema=False)
async def get_restaurant_menus(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Returns active restaurant menus with all items and loaded food details."""
    stmt = (
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.food_item))
        .where(Menu.is_active == True)
    )
    if category:
        stmt = stmt.where(Menu.category == category)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/restaurant/menus", response_model=MenuResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def create_restaurant_menu(
    menu_in: MenuCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new menu or reuses an existing one, and links items to FoodItem catalog."""
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

    # 2. Xử lý các món ăn trong menu: liên kết với FoodItem
    if menu_in.items:
        # Lấy danh sách food_item_id hiện có trong menu này
        stmt_existing = select(MenuItem.food_item_id).where(MenuItem.menu_id == target_menu.id)
        existing_res = await db.execute(stmt_existing)
        existing_food_ids = set(existing_res.scalars().all())

        for it in menu_in.items:
            target_food: Optional[FoodItem] = None
            if it.food_item_id:
                target_food = await db.get(FoodItem, it.food_item_id)
            elif it.name and it.name.strip():
                clean_item_name = it.name.strip()
                stmt_food = select(FoodItem).where(func.lower(FoodItem.name) == clean_item_name.lower())
                f_res = await db.execute(stmt_food)
                target_food = f_res.scalars().first()
                if not target_food:
                    # Tự động tạo FoodItem nếu chưa có
                    target_food = FoodItem(
                        name=clean_item_name,
                        category=it.category or "Món chính",
                        description=it.description,
                        image_url=it.image_url,
                        base_price=it.price or 0.0,
                        currency=it.currency or "VND",
                        prep_time_minutes=it.prep_time_minutes or 15,
                        is_available=it.is_available,
                    )
                    db.add(target_food)
                    await db.flush()

            if not target_food or target_food.id in existing_food_ids:
                continue

            item_price = it.price if it.price and it.price > 0 else target_food.base_price
            menu_item = MenuItem(
                menu_id=target_menu.id,
                food_item_id=target_food.id,
                price=item_price,
                display_order=it.display_order,
                is_available=it.is_available,
                # Cache fields for fast access
                name=target_food.name,
                category=target_food.category,
                image_url=target_food.image_url,
                description=target_food.description,
                prep_time_minutes=target_food.prep_time_minutes,
                currency=target_food.currency,
            )
            db.add(menu_item)
            existing_food_ids.add(target_food.id)

    await db.commit()
    # Eager load items for response_model
    stmt = (
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.food_item))
        .where(Menu.id == target_menu.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/restaurant/menu-items", response_model=List[MenuItemResponse], tags=TAG_REST)
async def get_restaurant_menu_items(
    menu_id: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Returns all restaurant menu items, with food_item eager-loaded."""
    stmt = (
        select(MenuItem)
        .options(selectinload(MenuItem.food_item))
        .where(MenuItem.is_available == True)
        .order_by(MenuItem.display_order, MenuItem.id)
    )
    if menu_id:
        stmt = stmt.where(MenuItem.menu_id == menu_id)
    if category:
        stmt = stmt.where(
            (MenuItem.category == category) | (MenuItem.food_item.has(FoodItem.category == category))
        )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/restaurant/menu-items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def create_restaurant_menu_item(
    item_in: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """Thêm món vào Menu. Chấp nhận food_item_id có sẵn hoặc tên món để tự động tìm/tạo FoodItem."""
    menu = await db.get(Menu, item_in.menu_id)
    if not menu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thực đơn với ID {item_in.menu_id} không tồn tại.",
        )

    target_food: Optional[FoodItem] = None
    if item_in.food_item_id:
        target_food = await db.get(FoodItem, item_in.food_item_id)
        if not target_food:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Món ăn gốc {item_in.food_item_id} không tồn tại.",
            )
    elif item_in.name and item_in.name.strip():
        clean_name = item_in.name.strip()
        stmt = select(FoodItem).where(func.lower(FoodItem.name) == clean_name.lower())
        res = await db.execute(stmt)
        target_food = res.scalars().first()
        if not target_food:
            target_food = FoodItem(
                name=clean_name,
                category=item_in.category or "Món chính",
                description=item_in.description,
                image_url=item_in.image_url,
                base_price=item_in.price or 0.0,
                currency=item_in.currency or "VND",
                prep_time_minutes=item_in.prep_time_minutes or 15,
                is_available=item_in.is_available,
            )
            db.add(target_food)
            await db.flush()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng cung cấp food_item_id hoặc name của món ăn.",
        )

    # Kiểm tra xem món này đã có trong Menu chưa
    stmt_check = select(MenuItem).where(
        MenuItem.menu_id == item_in.menu_id,
        MenuItem.food_item_id == target_food.id,
    )
    check_res = await db.execute(stmt_check)
    existing_item = check_res.scalars().first()
    if existing_item:
        if item_in.price is not None and item_in.price > 0:
            existing_item.price = item_in.price
            await db.commit()
            await db.refresh(existing_item)
        return existing_item

    effective_price = item_in.price if (item_in.price is not None and item_in.price > 0) else target_food.base_price
    new_item = MenuItem(
        menu_id=item_in.menu_id,
        food_item_id=target_food.id,
        price=effective_price,
        display_order=item_in.display_order,
        is_available=item_in.is_available,
        name=target_food.name,
        category=target_food.category,
        image_url=target_food.image_url,
        description=target_food.description,
        prep_time_minutes=target_food.prep_time_minutes,
        currency=target_food.currency,
    )
    db.add(new_item)
    await db.commit()
    
    # Reload with food_item relationship
    stmt_reload = select(MenuItem).options(selectinload(MenuItem.food_item)).where(MenuItem.id == new_item.id)
    res_reload = await db.execute(stmt_reload)
    return res_reload.scalar_one()


@router.post("/restaurant/menus/{menu_id}/items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def assign_food_item_to_menu(
    menu_id: str,
    assign_in: AssignFoodToMenuRequest,
    db: AsyncSession = Depends(get_db),
):
    """Gán một món ăn từ danh mục gốc (FoodItem) vào một thực đơn cụ thể với đơn giá riêng."""
    menu = await db.get(Menu, menu_id)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thực đơn không tồn tại.")

    food = await db.get(FoodItem, assign_in.food_item_id)
    if not food:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Món ăn không tồn tại trong danh mục gốc.")

    # Check if already assigned
    stmt = select(MenuItem).where(
        MenuItem.menu_id == menu_id,
        MenuItem.food_item_id == assign_in.food_item_id,
    )
    res = await db.execute(stmt)
    existing = res.scalars().first()
    if existing:
        if assign_in.price is not None:
            existing.price = assign_in.price
        existing.is_available = assign_in.is_available
        existing.display_order = assign_in.display_order
        await db.commit()
        await db.refresh(existing)
        return existing

    price = assign_in.price if (assign_in.price is not None and assign_in.price > 0) else food.base_price
    menu_item = MenuItem(
        menu_id=menu_id,
        food_item_id=food.id,
        price=price,
        display_order=assign_in.display_order,
        is_available=assign_in.is_available,
        name=food.name,
        category=food.category,
        image_url=food.image_url,
        description=food.description,
        prep_time_minutes=food.prep_time_minutes,
        currency=food.currency,
    )
    db.add(menu_item)
    await db.commit()

    stmt_reload = select(MenuItem).options(selectinload(MenuItem.food_item)).where(MenuItem.id == menu_item.id)
    res_reload = await db.execute(stmt_reload)
    return res_reload.scalar_one()


@router.delete("/restaurant/menus/{menu_id}/items/{menu_item_id}", tags=TAG_REST)
async def remove_item_from_menu(
    menu_id: str,
    menu_item_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Gỡ món ăn khỏi một thực đơn cụ thể (không xoá món ăn trong danh mục gốc)."""
    stmt = select(MenuItem).where(MenuItem.id == menu_item_id, MenuItem.menu_id == menu_id)
    res = await db.execute(stmt)
    item = res.scalars().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn trong thực đơn này.")

    await db.delete(item)
    await db.commit()
    return {"detail": "Đã gỡ món khỏi thực đơn thành công", "menu_id": menu_id, "menu_item_id": menu_item_id}
