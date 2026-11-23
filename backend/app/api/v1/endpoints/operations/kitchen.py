"""Kitchen master food catalog routes (mounts kitchen menu routes)."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models import FoodItem
from app.repositories import KitchenRepository, get_kitchen_repository
from app.schemas.operations import FoodItemCreate, FoodItemResponse, FoodItemUpdate
from .kitchen_menus import router as menus_router
from .shared import TAG_KITCHEN_FOOD_CATALOG

router = APIRouter()
router.include_router(menus_router)


# =====================================================================
# 10A. BẾP & ẨM THỰC - DANH MỤC MÓN ĂN GỐC (MASTER FOOD CATALOG)
# =====================================================================

@router.get(
    "/kitchen/food-items",
    response_model=List[FoodItemResponse],
    tags=TAG_KITCHEN_FOOD_CATALOG,
    summary="Danh mục tất cả món ăn gốc (Master Catalog)",
)
@router.get(
    "/restaurant/food-items",
    response_model=List[FoodItemResponse],
    tags=TAG_KITCHEN_FOOD_CATALOG,
    include_in_schema=False,
)
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
@router.post(
    "/restaurant/food-items",
    response_model=FoodItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_KITCHEN_FOOD_CATALOG,
    include_in_schema=False,
)
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
@router.get(
    "/restaurant/food-items/{food_id}",
    response_model=FoodItemResponse,
    tags=TAG_KITCHEN_FOOD_CATALOG,
    include_in_schema=False,
)
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
@router.put(
    "/restaurant/food-items/{food_id}",
    response_model=FoodItemResponse,
    tags=TAG_KITCHEN_FOOD_CATALOG,
    include_in_schema=False,
)
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

    food.updated_at = datetime.utcnow()
    await repo.commit()
    await repo.refresh(food)
    return food


@router.delete(
    "/kitchen/food-items/{food_id}",
    tags=TAG_KITCHEN_FOOD_CATALOG,
    summary="Xóa món ăn khỏi kho dữ liệu gốc",
)
@router.delete(
    "/restaurant/food-items/{food_id}",
    tags=TAG_KITCHEN_FOOD_CATALOG,
    include_in_schema=False,
)
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
