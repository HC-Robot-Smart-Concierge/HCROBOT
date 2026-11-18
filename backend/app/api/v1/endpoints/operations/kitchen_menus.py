"""Kitchen and restaurant menus and menu-items CRUD routes."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models import FoodItem, Menu, MenuItem
from app.repositories import KitchenRepository, get_kitchen_repository
from app.schemas.operations import (
    AssignFoodToMenuRequest,
    MenuCreate,
    MenuItemCreate,
    MenuItemResponse,
    MenuItemUpdate,
    MenuResponse,
    MenuUpdate,
)
from .shared import TAG_KITCHEN_MENU

router = APIRouter()


async def _resolve_or_create_food(
    repo: KitchenRepository,
    *,
    food_item_id: Optional[str],
    name: Optional[str],
    category: Optional[str],
    description: Optional[str],
    image_url: Optional[str],
    prep_time_minutes: Optional[int],
    is_available: bool,
    missing_id_error: bool,
) -> Optional[FoodItem]:
    if food_item_id:
        food = await repo.get_food_item_by_id(food_item_id)
        if not food and missing_id_error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Món ăn gốc {food_item_id} không tồn tại.",
            )
        return food
    if name and name.strip():
        clean_name = name.strip()
        food = await repo.find_food_by_name(clean_name)
        if not food:
            food = FoodItem(
                name=clean_name,
                category=category or "Món chính",
                description=description,
                image_url=image_url,
                prep_time_minutes=prep_time_minutes or 15,
                is_available=is_available,
            )
            repo.add(food)
            await repo.flush()
        return food
    return None


def _build_menu_item(
    menu_id: str,
    food: FoodItem,
    *,
    price: Optional[float],
    display_order: int,
    is_available: bool,
) -> MenuItem:
    effective_price = price if (price is not None and price > 0) else 0.0
    return MenuItem(
        menu_id=menu_id,
        food_item_id=food.id,
        price=effective_price,
        display_order=display_order,
        is_available=is_available,
        name=food.name,
        category=food.category,
        image_url=food.image_url,
        description=food.description,
        currency="VND",
    )


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
@router.post(
    "/restaurant/menus",
    response_model=MenuResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_KITCHEN_MENU,
    include_in_schema=False,
)
async def create_kitchen_menu(
    menu_in: MenuCreate,
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Tạo mới một bộ thực đơn, đồng thời tự động liên kết các món ăn với kho dữ liệu FoodItem gốc."""
    clean_menu_name = menu_in.name.strip()
    if not clean_menu_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tên thực đơn không được để trống.")

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

    if menu_in.items:
        existing_food_ids = await repo.get_existing_menu_food_ids(target_menu.id)
        for it in menu_in.items:
            target_food = await _resolve_or_create_food(
                repo,
                food_item_id=it.food_item_id,
                name=it.name,
                category=it.category,
                description=it.description,
                image_url=it.image_url,
                prep_time_minutes=getattr(it, "prep_time_minutes", 15),
                is_available=it.is_available,
                missing_id_error=False,
            )
            if not target_food or target_food.id in existing_food_ids:
                continue

            repo.add(
                _build_menu_item(
                    target_menu.id,
                    target_food,
                    price=it.price,
                    display_order=it.display_order,
                    is_available=it.is_available,
                )
            )
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

    menu.updated_at = datetime.utcnow()
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
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Lấy danh sách các món ăn đã được đưa vào thực đơn, với đầy đủ thông tin món gốc FoodItem."""
    return await repo.list_menu_items(menu_id=menu_id, category=category)


@router.post(
    "/kitchen/menu-items",
    response_model=MenuItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_KITCHEN_MENU,
    summary="Tạo và gán nhanh món vào thực đơn",
)
@router.post(
    "/restaurant/menu-items",
    response_model=MenuItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_KITCHEN_MENU,
    include_in_schema=False,
)
async def create_kitchen_menu_item(
    item_in: MenuItemCreate,
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Thêm món vào Menu. Chấp nhận food_item_id có sẵn hoặc tên món để tự động tìm/tạo FoodItem."""
    menu = await repo.get_menu_by_id(item_in.menu_id)
    if not menu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thực đơn với ID {item_in.menu_id} không tồn tại.",
        )

    target_food = await _resolve_or_create_food(
        repo,
        food_item_id=item_in.food_item_id,
        name=item_in.name,
        category=item_in.category,
        description=item_in.description,
        image_url=item_in.image_url,
        prep_time_minutes=getattr(item_in, "prep_time_minutes", 15),
        is_available=item_in.is_available,
        missing_id_error=True,
    )
    if not target_food:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng cung cấp food_item_id hoặc name của món ăn.",
        )

    existing_item = await repo.get_menu_item_by_menu_and_food(item_in.menu_id, target_food.id)
    if existing_item:
        if item_in.price is not None and item_in.price > 0:
            existing_item.price = item_in.price
            await repo.commit()
            await repo.refresh(existing_item)
        return existing_item

    new_item = _build_menu_item(
        item_in.menu_id,
        target_food,
        price=item_in.price,
        display_order=item_in.display_order,
        is_available=item_in.is_available,
    )
    repo.add(new_item)
    await repo.commit()
    return await repo.get_menu_item_by_id(new_item.id, load_food=True)


@router.post(
    "/kitchen/menus/{menu_id}/items",
    response_model=MenuItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_KITCHEN_MENU,
    summary="Gán món từ kho gốc vào thực đơn với giá riêng",
)
@router.post(
    "/restaurant/menus/{menu_id}/items",
    response_model=MenuItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_KITCHEN_MENU,
    include_in_schema=False,
)
async def assign_kitchen_food_item_to_menu(
    menu_id: str,
    assign_in: AssignFoodToMenuRequest,
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Gán một món ăn từ danh mục gốc (FoodItem) vào một thực đơn cụ thể với đơn giá riêng."""
    menu = await repo.get_menu_by_id(menu_id)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thực đơn không tồn tại.")

    food = await repo.get_food_item_by_id(assign_in.food_item_id)
    if not food:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Món ăn không tồn tại trong danh mục gốc.")

    existing = await repo.get_menu_item_by_menu_and_food(menu_id, assign_in.food_item_id)
    if existing:
        if assign_in.price is not None:
            existing.price = assign_in.price
        existing.is_available = assign_in.is_available
        existing.display_order = assign_in.display_order
        await repo.commit()
        await repo.refresh(existing)
        return existing

    menu_item = _build_menu_item(
        menu_id,
        food,
        price=assign_in.price,
        display_order=assign_in.display_order,
        is_available=assign_in.is_available,
    )
    repo.add(menu_item)
    await repo.commit()
    return await repo.get_menu_item_by_id(menu_item.id, load_food=True)


@router.patch(
    "/kitchen/menus/{menu_id}/items/{menu_item_id}",
    response_model=MenuItemResponse,
    tags=TAG_KITCHEN_MENU,
    summary="Cập nhật giá và trạng thái món trong thực đơn",
)
@router.patch(
    "/restaurant/menus/{menu_id}/items/{menu_item_id}",
    response_model=MenuItemResponse,
    tags=TAG_KITCHEN_MENU,
    include_in_schema=False,
)
async def update_kitchen_menu_item(
    menu_id: str,
    menu_item_id: str,
    item_in: MenuItemUpdate,
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Cập nhật giá bán áp dụng riêng (`price`), thứ tự sắp xếp (`display_order`) hoặc trạng thái khả dụng (`is_available`) của món trong thực đơn này."""
    item = await repo.get_menu_item_in_menu(menu_id, menu_item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn trong thực đơn này.")

    if item_in.price is not None:
        item.price = item_in.price
    if item_in.display_order is not None:
        item.display_order = item_in.display_order
    if item_in.is_available is not None:
        item.is_available = item_in.is_available

    item.updated_at = datetime.utcnow()
    await repo.commit()
    return await repo.get_menu_item_by_id(item.id, load_food=True)


@router.delete(
    "/kitchen/menus/{menu_id}/items/{menu_item_id}",
    tags=TAG_KITCHEN_MENU,
    summary="Gỡ món ăn khỏi thực đơn",
)
@router.delete(
    "/restaurant/menus/{menu_id}/items/{menu_item_id}",
    tags=TAG_KITCHEN_MENU,
    include_in_schema=False,
)
async def remove_kitchen_item_from_menu(
    menu_id: str,
    menu_item_id: str,
    repo: KitchenRepository = Depends(get_kitchen_repository),
):
    """Gỡ món ăn khỏi một thực đơn cụ thể (không xóa món ăn trong danh mục gốc)."""
    item = await repo.get_menu_item_in_menu(menu_id, menu_item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy món ăn trong thực đơn này.")

    await repo.delete(item, autocommit=True)
    return {"detail": "Đã gỡ món khỏi thực đơn thành công", "menu_id": menu_id, "menu_item_id": menu_item_id}
