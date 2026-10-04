from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Menu, MenuItem, FoodItem
from app.schemas.operations import (
    MenuCreate,
    MenuUpdate,
    MenuResponse,
    MenuItemCreate,
    MenuItemUpdate,
    MenuItemResponse,
    FoodItemCreate,
    FoodItemUpdate,
    FoodItemResponse,
    AssignFoodToMenuRequest,
)
from .shared import TAG_KITCHEN_FOOD_CATALOG, TAG_KITCHEN_MENU

router = APIRouter()


# =====================================================================
# 10A. BẾP & ẨM THỰC - DANH MỤC MÓN ĂN GỐC (MASTER FOOD CATALOG)
# =====================================================================

@router.get(
    "/kitchen/food-items",
    response_model=List[FoodItemResponse],
    tags=TAG_KITCHEN_FOOD_CATALOG,
    summary="Danh mục tất cả món ăn gốc (Master Catalog)",
)
@router.get("/restaurant/food-items", response_model=List[FoodItemResponse], tags=TAG_KITCHEN_FOOD_CATALOG, include_in_schema=False)
async def get_kitchen_food_items(
    category: Optional[str] = Query(None, description="Lọc theo phân loại: Khai vị, Món chính, Đồ uống, Tráng miệng, Ăn nhẹ"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo tên món ăn"),
    is_available: Optional[bool] = Query(None, description="Lọc theo tình trạng phục vụ của bếp tổng"),
    db: AsyncSession = Depends(get_db),
):
    """Tra cứu danh mục tất cả món ăn / thức uống gốc của toàn khách sạn (Master Catalog)."""
    stmt = select(FoodItem).order_by(FoodItem.category, FoodItem.name)
    if category:
        stmt = stmt.where(FoodItem.category == category)
    if is_available is not None:
        stmt = stmt.where(FoodItem.is_available == is_available)
    if search:
        stmt = stmt.where(FoodItem.name.ilike(f"%{search.strip()}%"))
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post(
    "/kitchen/food-items",
    response_model=FoodItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_KITCHEN_FOOD_CATALOG,
    summary="Thêm món ăn mới vào danh mục gốc",
)
@router.post("/restaurant/food-items", response_model=FoodItemResponse, status_code=status.HTTP_201_CREATED, tags=TAG_KITCHEN_FOOD_CATALOG, include_in_schema=False)
async def create_kitchen_food_item(
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


@router.get(
    "/kitchen/food-items/{food_id}",
    response_model=FoodItemResponse,
    tags=TAG_KITCHEN_FOOD_CATALOG,
    summary="Xem thông tin chi tiết món ăn gốc",
)
@router.get("/restaurant/food-items/{food_id}", response_model=FoodItemResponse, tags=TAG_KITCHEN_FOOD_CATALOG, include_in_schema=False)
async def get_kitchen_food_item(
    food_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin chi tiết một món ăn trong danh mục gốc theo ID."""
    food = await db.get(FoodItem, food_id)
    if not food:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn.")
    return food


@router.put(
    "/kitchen/food-items/{food_id}",
    response_model=FoodItemResponse,
    tags=TAG_KITCHEN_FOOD_CATALOG,
    summary="Cập nhật thông tin món ăn gốc",
)
@router.put("/restaurant/food-items/{food_id}", response_model=FoodItemResponse, tags=TAG_KITCHEN_FOOD_CATALOG, include_in_schema=False)
async def update_kitchen_food_item(
    food_id: str,
    food_in: FoodItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin món ăn trong danh mục gốc (tên, mô tả, ảnh, giá gốc, thời gian chế biến, trạng thái)."""
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


@router.delete(
    "/kitchen/food-items/{food_id}",
    tags=TAG_KITCHEN_FOOD_CATALOG,
    summary="Xóa món ăn khỏi kho dữ liệu gốc",
)
@router.delete("/restaurant/food-items/{food_id}", tags=TAG_KITCHEN_FOOD_CATALOG, include_in_schema=False)
async def delete_kitchen_food_item(
    food_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Xóa một món ăn khỏi danh mục gốc (tự động xóa khỏi các thực đơn liên quan nhờ CASCADE)."""
    food = await db.get(FoodItem, food_id)
    if not food:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn.")

    await db.delete(food)
    await db.commit()
    return {"detail": "Đã xoá món ăn thành công khỏi danh mục gốc", "id": food_id}


# =====================================================================
# 10B. BẾP & ẨM THỰC - QUẢN LÝ THỰC ĐƠN & MÓN ĂN (MENUS & MENU ITEMS)
# =====================================================================

@router.get(
    "/kitchen/menus",
    response_model=List[MenuResponse],
    tags=TAG_KITCHEN_MENU,
    summary="Danh sách tất cả các thực đơn (Menus)",
)
@router.get("/kitchen/menu", response_model=List[MenuResponse], tags=TAG_KITCHEN_MENU, include_in_schema=False)
@router.get("/restaurant/menus", response_model=List[MenuResponse], tags=TAG_KITCHEN_MENU, include_in_schema=False)
@router.get("/restaurant/menu", response_model=List[MenuResponse], tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def get_kitchen_menus(
    category: Optional[str] = Query(None, description="Lọc theo phân loại thực đơn (Food, Beverage, Dessert, Combo...)"),
    is_active: Optional[bool] = Query(None, description="Lọc theo trạng thái hoạt động (True/False)"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các bộ thực đơn (Sáng, Tối, Alacarte, Room Service...) kèm tất cả các món ăn bên trong."""
    stmt = (
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.food_item))
    )
    if is_active is not None:
        stmt = stmt.where(Menu.is_active == is_active)
    if category:
        stmt = stmt.where(Menu.category == category)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post(
    "/kitchen/menus",
    response_model=MenuResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_KITCHEN_MENU,
    summary="Tạo thực đơn mới (kèm danh sách món nếu có)",
)
@router.post("/restaurant/menus", response_model=MenuResponse, status_code=status.HTTP_201_CREATED, tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def create_kitchen_menu(
    menu_in: MenuCreate,
    db: AsyncSession = Depends(get_db),
):
    """Tạo mới một bộ thực đơn, đồng thời tự động liên kết các món ăn với kho dữ liệu FoodItem gốc."""
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
    stmt = (
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.food_item))
        .where(Menu.id == target_menu.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get(
    "/kitchen/menus/{menu_id}",
    response_model=MenuResponse,
    tags=TAG_KITCHEN_MENU,
    summary="Xem chi tiết một thực đơn kèm danh sách món",
)
@router.get("/restaurant/menus/{menu_id}", response_model=MenuResponse, tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def get_kitchen_menu(
    menu_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin chi tiết của một bộ thực đơn theo ID kèm các món ăn bên trong."""
    stmt = (
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.food_item))
        .where(Menu.id == menu_id)
    )
    res = await db.execute(stmt)
    menu = res.scalar_one_or_none()
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thực đơn.")
    return menu


@router.put(
    "/kitchen/menus/{menu_id}",
    response_model=MenuResponse,
    tags=TAG_KITCHEN_MENU,
    summary="Cập nhật thông tin thực đơn",
)
@router.put("/restaurant/menus/{menu_id}", response_model=MenuResponse, tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def update_kitchen_menu(
    menu_id: str,
    menu_in: MenuUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Chỉnh sửa thông tin thực đơn (tên, phân loại, mô tả, trạng thái hoạt động)."""
    menu = await db.get(Menu, menu_id)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thực đơn.")

    update_data = menu_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"]:
        update_data["name"] = update_data["name"].strip()

    for k, v in update_data.items():
        setattr(menu, k, v)

    menu.updated_at = datetime.utcnow()
    await db.commit()

    stmt = (
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.food_item))
        .where(Menu.id == menu.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.delete(
    "/kitchen/menus/{menu_id}",
    tags=TAG_KITCHEN_MENU,
    summary="Xóa một thực đơn",
)
@router.delete("/restaurant/menus/{menu_id}", tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def delete_kitchen_menu(
    menu_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Xóa bỏ một bộ thực đơn (các món ăn trong kho dữ liệu gốc FoodItem vẫn được giữ nguyên)."""
    menu = await db.get(Menu, menu_id)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thực đơn.")

    await db.delete(menu)
    await db.commit()
    return {"detail": "Đã xóa thực đơn thành công", "id": menu_id}


@router.get(
    "/kitchen/menu-items",
    response_model=List[MenuItemResponse],
    tags=TAG_KITCHEN_MENU,
    summary="Danh sách món ăn trong thực đơn (Menu Items)",
)
@router.get("/restaurant/menu-items", response_model=List[MenuItemResponse], tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def get_kitchen_menu_items(
    menu_id: Optional[str] = Query(None, description="Lọc theo ID thực đơn cụ thể"),
    category: Optional[str] = Query(None, description="Lọc theo danh mục món"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các món ăn đã được đưa vào thực đơn, với đầy đủ thông tin món gốc FoodItem."""
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


@router.post(
    "/kitchen/menu-items",
    response_model=MenuItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_KITCHEN_MENU,
    summary="Tạo và gán nhanh món vào thực đơn",
)
@router.post("/restaurant/menu-items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED, tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def create_kitchen_menu_item(
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
    
    stmt_reload = select(MenuItem).options(selectinload(MenuItem.food_item)).where(MenuItem.id == new_item.id)
    res_reload = await db.execute(stmt_reload)
    return res_reload.scalar_one()


@router.post(
    "/kitchen/menus/{menu_id}/items",
    response_model=MenuItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_KITCHEN_MENU,
    summary="Gán món từ kho gốc vào thực đơn với giá riêng",
)
@router.post("/restaurant/menus/{menu_id}/items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED, tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def assign_kitchen_food_item_to_menu(
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


@router.patch(
    "/kitchen/menus/{menu_id}/items/{menu_item_id}",
    response_model=MenuItemResponse,
    tags=TAG_KITCHEN_MENU,
    summary="Cập nhật giá và trạng thái món trong thực đơn",
)
@router.patch("/restaurant/menus/{menu_id}/items/{menu_item_id}", response_model=MenuItemResponse, tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def update_kitchen_menu_item(
    menu_id: str,
    menu_item_id: str,
    item_in: MenuItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật giá bán áp dụng riêng (`price`), thứ tự sắp xếp (`display_order`) hoặc trạng thái khả dụng (`is_available`) của món trong thực đơn này."""
    stmt = select(MenuItem).where(MenuItem.id == menu_item_id, MenuItem.menu_id == menu_id)
    res = await db.execute(stmt)
    item = res.scalars().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn trong thực đơn này.")

    if item_in.price is not None:
        item.price = item_in.price
    if item_in.display_order is not None:
        item.display_order = item_in.display_order
    if item_in.is_available is not None:
        item.is_available = item_in.is_available

    item.updated_at = datetime.utcnow()
    await db.commit()

    stmt_reload = select(MenuItem).options(selectinload(MenuItem.food_item)).where(MenuItem.id == item.id)
    res_reload = await db.execute(stmt_reload)
    return res_reload.scalar_one()


@router.delete(
    "/kitchen/menus/{menu_id}/items/{menu_item_id}",
    tags=TAG_KITCHEN_MENU,
    summary="Gỡ món ăn khỏi thực đơn",
)
@router.delete("/restaurant/menus/{menu_id}/items/{menu_item_id}", tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def remove_kitchen_item_from_menu(
    menu_id: str,
    menu_item_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Gỡ món ăn khỏi một thực đơn cụ thể (không xóa món ăn trong danh mục gốc)."""
    stmt = select(MenuItem).where(MenuItem.id == menu_item_id, MenuItem.menu_id == menu_id)
    res = await db.execute(stmt)
    item = res.scalars().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn trong thực đơn này.")

    await db.delete(item)
    await db.commit()
    return {"detail": "Đã gỡ món khỏi thực đơn thành công", "menu_id": menu_id, "menu_item_id": menu_item_id}
