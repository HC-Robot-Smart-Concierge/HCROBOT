from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models import FoodItem, MenuItem
from app.repositories import KitchenRepository, get_kitchen_repository
from app.schemas.operations import (
    AssignFoodToMenuRequest,
    MenuItemCreate,
    MenuItemResponse,
    MenuItemUpdate,
)
from app.core.time import utc_now_naive
from .shared import TAG_KITCHEN_MENU

router = APIRouter()


async def _create_menu_item_record(
    repo: KitchenRepository,
    menu_id: str,
    food: FoodItem,
    raw_price: Optional[float],
    display_order: int,
    is_available: bool,
):
    """Tạo và lưu bản ghi MenuItem liên kết giữa thực đơn và món gốc FoodItem."""
    effective_price = raw_price if (raw_price is not None and raw_price > 0) else 0.0
    new_item = MenuItem(
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
    repo.add(new_item)
    await repo.commit()
    return await repo.get_menu_item_by_id(new_item.id, load_food=True)


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
@router.post("/restaurant/menu-items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED, tags=TAG_KITCHEN_MENU, include_in_schema=False)
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

    target_food: Optional[FoodItem] = None
    if item_in.food_item_id:
        target_food = await repo.get_food_item_by_id(item_in.food_item_id)
        if not target_food:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Món ăn gốc {item_in.food_item_id} không tồn tại.",
            )
    elif item_in.name and item_in.name.strip():
        clean_name = item_in.name.strip()
        target_food = await repo.find_food_by_name(clean_name)
        if not target_food:
            target_food = FoodItem(
                name=clean_name,
                category=item_in.category or "Món chính",
                description=item_in.description,
                image_url=item_in.image_url,
                prep_time_minutes=getattr(item_in, 'prep_time_minutes', 15) or 15,
                is_available=item_in.is_available,
            )
            repo.add(target_food)
            await repo.flush()
    else:
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

    return await _create_menu_item_record(
        repo=repo,
        menu_id=item_in.menu_id,
        food=target_food,
        raw_price=item_in.price,
        display_order=item_in.display_order,
        is_available=item_in.is_available,
    )


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

    return await _create_menu_item_record(
        repo=repo,
        menu_id=menu_id,
        food=food,
        raw_price=assign_in.price,
        display_order=assign_in.display_order,
        is_available=assign_in.is_available,
    )


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

    item.updated_at = utc_now_naive()
    await repo.commit()
    return await repo.get_menu_item_by_id(item.id, load_food=True)


@router.delete(
    "/kitchen/menus/{menu_id}/items/{menu_item_id}",
    tags=TAG_KITCHEN_MENU,
    summary="Gỡ món ăn khỏi thực đơn",
)
@router.delete("/restaurant/menus/{menu_id}/items/{menu_item_id}", tags=TAG_KITCHEN_MENU, include_in_schema=False)
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
