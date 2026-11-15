from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.models import Menu, MenuItem, FoodItem
from app.schemas.operations import (
    MenuCreate,
    MenuUpdate,
    MenuResponse,
    FoodItemCreate,
    FoodItemUpdate,
    FoodItemResponse,
)
from app.repositories import KitchenRepository, get_kitchen_repository
from app.core.time import utc_now_naive
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
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Tra cứu danh mục tất cả món ăn / thức uống gốc của toàn khách sạn (Master Catalog)."""
    return await repo.list_food_items(
        category=category,
        search=search,
        is_available=is_available,
    )


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
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Tạo mới một món ăn / thức uống vào danh mục gốc của khách sạn."""
    clean_name = food_in.name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên món ăn không được để trống.",
        )

    # Kiểm tra xem đã có món ăn cùng tên chưa
    existing_food = await repo.find_food_by_name(clean_name)
    if existing_food:
        return existing_food

    new_food = FoodItem(
        name=clean_name,
        category=food_in.category,
        description=food_in.description,
        image_url=food_in.image_url,
        prep_time_minutes=food_in.prep_time_minutes,
        is_available=food_in.is_available,
    )
    await repo.create(new_food, autocommit=True)
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
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Lấy thông tin chi tiết một món ăn trong danh mục gốc theo ID."""
    food = await repo.get_food_item_by_id(food_id)
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
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Cập nhật thông tin món ăn trong danh mục gốc (tên, mô tả, ảnh, giá gốc, thời gian chế biến, trạng thái)."""
    food = await repo.get_food_item_by_id(food_id)
    if not food:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn.")

    update_data = food_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"]:
        update_data["name"] = update_data["name"].strip()

    for key, value in update_data.items():
        setattr(food, key, value)

    food.updated_at = utc_now_naive()
    await repo.commit()
    await repo.refresh(food)
    return food


@router.delete(
    "/kitchen/food-items/{food_id}",
    tags=TAG_KITCHEN_FOOD_CATALOG,
    summary="Xóa món ăn khỏi kho dữ liệu gốc",
)
@router.delete("/restaurant/food-items/{food_id}", tags=TAG_KITCHEN_FOOD_CATALOG, include_in_schema=False)
async def delete_kitchen_food_item(
    food_id: str,
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Xóa một món ăn khỏi danh mục gốc (tự động xóa khỏi các thực đơn liên quan nhờ CASCADE)."""
    food = await repo.get_food_item_by_id(food_id)
    if not food:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn.")

    await repo.delete(food, autocommit=True)
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
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Lấy danh sách các bộ thực đơn (Sáng, Tối, Alacarte, Room Service...) kèm tất cả các món ăn bên trong."""
    return await repo.list_menus(category=category, is_active=is_active)


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
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Tạo mới một bộ thực đơn, đồng thời tự động liên kết các món ăn với kho dữ liệu FoodItem gốc."""
    clean_menu_name = menu_in.name.strip()
    if not clean_menu_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên thực đơn không được để trống.",
        )

    # 1. Tìm menu theo tên (không phân biệt hoa thường)
    target_menu = await repo.find_menu_by_name(clean_menu_name)

    if not target_menu:
        target_menu = Menu(
            name=clean_menu_name,
            category=menu_in.category,
            description=menu_in.description,
            is_active=menu_in.is_active,
        )
        repo.add(target_menu)
        await repo.flush()

    # 2. Xử lý các món ăn trong menu: liên kết với FoodItem
    if menu_in.items:
        existing_food_ids = await repo.get_existing_menu_food_ids(target_menu.id)

        for it in menu_in.items:
            target_food: Optional[FoodItem] = None
            if it.food_item_id:
                target_food = await repo.get_food_item_by_id(it.food_item_id)
            elif it.name and it.name.strip():
                clean_item_name = it.name.strip()
                target_food = await repo.find_food_by_name(clean_item_name)
                if not target_food:
                    target_food = FoodItem(
                        name=clean_item_name,
                        category=it.category or "Món chính",
                        description=it.description,
                        image_url=it.image_url,
                        prep_time_minutes=getattr(it, 'prep_time_minutes', 15) or 15,
                        is_available=it.is_available,
                    )
                    repo.add(target_food)
                    await repo.flush()

            if not target_food or target_food.id in existing_food_ids:
                continue

            item_price = it.price if it.price and it.price > 0 else 0.0
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
                currency="VND",
            )
            repo.add(menu_item)
            existing_food_ids.add(target_food.id)

    await repo.commit()
    return await repo.get_menu_by_id(target_menu.id)


@router.get(
    "/kitchen/menus/{menu_id}",
    response_model=MenuResponse,
    tags=TAG_KITCHEN_MENU,
    summary="Xem chi tiết một thực đơn kèm danh sách món",
)
@router.get("/restaurant/menus/{menu_id}", response_model=MenuResponse, tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def get_kitchen_menu(
    menu_id: str,
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Lấy thông tin chi tiết của một bộ thực đơn theo ID kèm các món ăn bên trong."""
    menu = await repo.get_menu_by_id(menu_id)
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
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Chỉnh sửa thông tin thực đơn (tên, phân loại, mô tả, trạng thái hoạt động)."""
    menu = await repo.get_menu_by_id(menu_id)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thực đơn.")

    update_data = menu_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"]:
        update_data["name"] = update_data["name"].strip()

    for k, v in update_data.items():
        setattr(menu, k, v)

    menu.updated_at = utc_now_naive()
    await repo.commit()
    return await repo.get_menu_by_id(menu.id)


@router.delete(
    "/kitchen/menus/{menu_id}",
    tags=TAG_KITCHEN_MENU,
    summary="Xóa một thực đơn",
)
@router.delete("/restaurant/menus/{menu_id}", tags=TAG_KITCHEN_MENU, include_in_schema=False)
async def delete_kitchen_menu(
    menu_id: str,
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Xóa bỏ một bộ thực đơn (các món ăn trong kho dữ liệu gốc FoodItem vẫn được giữ nguyên)."""
    menu = await repo.get_menu_by_id(menu_id)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thực đơn.")

    await repo.delete(menu, autocommit=True)
    return {"detail": "Đã xóa thực đơn thành công", "id": menu_id}


from .kitchen_menu_items import router as kitchen_menu_items_router

router.include_router(kitchen_menu_items_router)
