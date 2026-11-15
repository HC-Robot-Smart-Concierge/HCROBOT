import uuid
from datetime import timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Base, engine, get_db
from app.models.room_service import RoomServiceCatalogItem
from app.schemas.operations import (
    RoomServiceCatalogItemCreate,
    RoomServiceCatalogItemResponse,
    RoomServiceCatalogItemUpdate,
)
from app.core.time import utc_now_naive
from .shared import TAG_ROOM_SERVICE

router = APIRouter()

DEFAULT_ROOM_SERVICE_CATALOG = [
    {
        "id": "AMENITY-01",
        "name": "Khăn tắm lớn cao cấp",
        "category": "bath",
        "price": 0.0,
        "unit": "Chiếc",
        "prep_time": 10,
        "badge": "Miễn phí",
        "description": "Khăn tắm cotton 100% sợi dệt dài cao cấp của khách sạn, mềm mại và siêu thấm hút.",
        "image_url": "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 1,
    },
    {
        "id": "AMENITY-02",
        "name": "Bộ khăn tắm & khăn mặt",
        "category": "bath",
        "price": 0.0,
        "unit": "Bộ (2 khăn tắm + 2 khăn mặt)",
        "prep_time": 10,
        "badge": "Phổ biến",
        "description": "Set đầy đủ gồm 2 khăn tắm đại và 2 khăn lau mặt tiệt trùng tinh khiết.",
        "image_url": "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 2,
    },
    {
        "id": "AMENITY-03",
        "name": "Gối lông vũ cao cấp thêm",
        "category": "bedding",
        "price": 0.0,
        "unit": "Chiếc",
        "prep_time": 12,
        "badge": "Miễn phí",
        "description": "Gối lông vũ êm ái chống mỏi cổ vai gáy, áo gối lụa tơ tằm mềm mịn thoáng mát.",
        "image_url": "https://images.unsplash.com/photo-1584100936733-315132228d4d?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 3,
    },
    {
        "id": "AMENITY-04",
        "name": "Chăn đắp ấm bổ sung",
        "category": "bedding",
        "price": 0.0,
        "unit": "Chiếc",
        "prep_time": 12,
        "badge": "Miễn phí",
        "description": "Chăn ấm bông microfiber cao cấp nhẹ nhàng, giữ nhiệt tốt cho giấc ngủ sâu.",
        "image_url": "https://images.unsplash.com/photo-1540518614846-7ede433c4ef4?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 4,
    },
    {
        "id": "AMENITY-05",
        "name": "Bộ đồ vệ sinh cá nhân cao cấp",
        "category": "bath",
        "price": 0.0,
        "unit": "Bộ (Bàn chải, dao cạo, chụp tóc)",
        "prep_time": 10,
        "badge": "Miễn phí",
        "description": "Bàn chải than hoạt tính, kem đánh răng thảo mộc, dao cạo kép và lược gỗ tự nhiên.",
        "image_url": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 5,
    },
    {
        "id": "SPA-01",
        "name": "Massage toàn thân Thụy Điển",
        "category": "spa",
        "price": 350000.0,
        "unit": "Suất 60 phút / Kỹ thuật viên tại phòng",
        "prep_time": 20,
        "badge": "Được yêu thích",
        "description": "Kỹ thuật massage miết dài kết hợp tinh dầu oải hương Pháp giúp thư giãn cơ thể và giảm căng thẳng.",
        "image_url": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 6,
    },
    {
        "id": "SPA-02",
        "name": "Trị liệu bấm huyệt cổ vai gáy",
        "category": "spa",
        "price": 280000.0,
        "unit": "Suất 45 phút / Kỹ thuật viên tại phòng",
        "prep_time": 20,
        "badge": "Trị liệu sâu",
        "description": "Tập trung giải tỏa căng cơ vùng cổ, gáy và bả vai, lưu thông khí huyết cho người mệt mỏi sau chuyến đi.",
        "image_url": "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 7,
    },
    {
        "id": "SPA-03",
        "name": "Ngâm chân thảo dược & Massage chân",
        "category": "spa",
        "price": 220000.0,
        "unit": "Suất 45 phút / Kỹ thuật viên tại phòng",
        "prep_time": 15,
        "badge": "Thư giãn",
        "description": "Ngâm chân nước ấm thảo mộc gừng quế kết hợp bấm huyệt lòng bàn chân phục hồi thể lực tức thì.",
        "image_url": "https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 8,
    },
    {
        "id": "SPA-04",
        "name": "Trị liệu đá nóng núi lửa",
        "category": "spa",
        "price": 450000.0,
        "unit": "Suất 75 phút / Kỹ thuật viên tại phòng",
        "prep_time": 25,
        "badge": "Cao cấp",
        "description": "Chườm đá bazan núi lửa giữ nhiệt kết hợp ấn huyệt toàn thân giúp thải độc và cải thiện tuần hoàn máu.",
        "image_url": "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 9,
    },
    {
        "id": "HK-01",
        "name": "Dọn phòng & thay drap giường ngay",
        "category": "housekeeping",
        "price": 0.0,
        "unit": "Lượt phục vụ",
        "prep_time": 15,
        "badge": "Miễn phí",
        "description": "Nhân viên buồng phòng đến thay toàn bộ vỏ gối, drap giường và dọn dẹp phòng sạch tinh tươm.",
        "image_url": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 10,
    },
    {
        "id": "HK-02",
        "name": "Thu dọn rác & làm sạch nhanh",
        "category": "housekeeping",
        "price": 0.0,
        "unit": "Lượt phục vụ",
        "prep_time": 10,
        "badge": "Miễn phí",
        "description": "Thu gom túi rác, làm sạch bàn trà và bổ sung túi rác mới nhanh chóng trong 10 phút.",
        "image_url": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 11,
    },
    {
        "id": "HK-03",
        "name": "Xông tinh dầu khử mùi phòng ngủ",
        "category": "housekeeping",
        "price": 0.0,
        "unit": "Lượt phục vụ",
        "prep_time": 10,
        "badge": "Thư thái",
        "description": "Máy khuếch tán tinh dầu sả chanh hoặc ngọc lan tây tự nhiên mang lại không gian thư giãn dễ chịu.",
        "image_url": "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 12,
    },
    {
        "id": "LAUNDRY-01",
        "name": "Ủi / Là phẳng trang phục khẩn cấp",
        "category": "laundry",
        "price": 60000.0,
        "unit": "2 món trang phục",
        "prep_time": 25,
        "badge": "Tận nơi",
        "description": "Ủi hơi nước đứng chuyên dụng cho áo sơ mi, váy đầm hoặc âu phục lấy lại phom dáng chuẩn chỉnh.",
        "image_url": "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 13,
    },
    {
        "id": "LAUNDRY-02",
        "name": "Giặt sấy nhanh trong ngày",
        "category": "laundry",
        "price": 120000.0,
        "unit": "Giỏ 3kg",
        "prep_time": 180,
        "badge": "Giao tận phòng",
        "description": "Giặt sạch, sấy thơm và gấp gọn trang phục thường ngày giao tận cửa phòng trong vòng 3-4 giờ.",
        "image_url": "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 14,
    },
    {
        "id": "LAUNDRY-03",
        "name": "Mượn bàn ủi & cầu là tại phòng",
        "category": "laundry",
        "price": 0.0,
        "unit": "Bộ thiết bị",
        "prep_time": 10,
        "badge": "Miễn phí",
        "description": "Giao bàn ủi hơi nước Tefal và bàn để ủi chuyên dụng lên phòng để khách tự do sử dụng.",
        "image_url": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=80",
        "is_available": True,
        "display_order": 15,
    },
]


async def _get_rs_catalog_item_or_404(db: AsyncSession, service_id: str) -> RoomServiceCatalogItem:
    res = await db.execute(select(RoomServiceCatalogItem).where(RoomServiceCatalogItem.id == service_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy dịch vụ.")
    return item


@router.get(
    "/room-service/services",
    response_model=List[RoomServiceCatalogItemResponse],
    tags=TAG_ROOM_SERVICE,
    summary="Danh sách tất cả dịch vụ phòng (Room Service & Amenities)",
)
async def get_room_service_catalog(
    category: Optional[str] = Query(None, description="Lọc theo danh mục: bath, spa, bedding, housekeeping, laundry"),
    is_available: Optional[bool] = Query(None, description="Lọc theo trạng thái khả dụng"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách dịch vụ phòng hiển thị trên Kiosk Robot & Mobile.
    Tự động khởi tạo dữ liệu mẫu nếu bảng rỗng, và loại bỏ hoàn toàn nước khoáng khỏi phần dịch vụ.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await db.execute(
        delete(RoomServiceCatalogItem).where(
            or_(
                RoomServiceCatalogItem.id == "AMENITY-06",
                RoomServiceCatalogItem.name.ilike("%nước khoáng%"),
                RoomServiceCatalogItem.name.ilike("%nuoc khoang%"),
            )
        )
    )
    await db.commit()

    stmt = select(RoomServiceCatalogItem).order_by(
        RoomServiceCatalogItem.display_order.asc(),
        RoomServiceCatalogItem.created_at.asc(),
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    if not items:
        for cat_item in DEFAULT_ROOM_SERVICE_CATALOG:
            db.add(RoomServiceCatalogItem(**cat_item))
        await db.commit()
        result = await db.execute(stmt)
        items = result.scalars().all()

    category_str = category if isinstance(category, str) else None
    avail_bool = is_available if isinstance(is_available, bool) else None

    filtered = list(items)
    if category_str and category_str.lower() != "all":
        filtered = [it for it in filtered if it.category.lower() == category_str.lower()]
    if avail_bool is not None:
        filtered = [it for it in filtered if it.is_available == avail_bool]

    return filtered


@router.post(
    "/room-service/services",
    response_model=RoomServiceCatalogItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_ROOM_SERVICE,
    summary="Thêm mới dịch vụ phòng",
)
async def create_room_service_service(
    service_in: RoomServiceCatalogItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """Nhân viên Room Service thêm một dịch vụ hoặc tiện ích buồng phòng mới."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    ten_seconds_ago = utc_now_naive() - timedelta(seconds=10)
    check_stmt = select(RoomServiceCatalogItem).where(
        RoomServiceCatalogItem.name.ilike(service_in.name.strip()),
        RoomServiceCatalogItem.created_at >= ten_seconds_ago,
    )
    existing_res = await db.execute(check_stmt)
    existing_item = existing_res.scalars().first()
    if existing_item:
        return existing_item

    item_id = service_in.id or f"SVC-{uuid.uuid4().hex[:6].upper()}"
    new_item = RoomServiceCatalogItem(
        id=item_id,
        name=service_in.name.strip(),
        category=service_in.category,
        price=service_in.price,
        unit=service_in.unit,
        prep_time=service_in.prep_time,
        badge=service_in.badge,
        description=service_in.description,
        image_url=service_in.image_url,
        is_available=service_in.is_available,
        display_order=service_in.display_order,
    )
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    return new_item


@router.put(
    "/room-service/services/{service_id}",
    response_model=RoomServiceCatalogItemResponse,
    tags=TAG_ROOM_SERVICE,
    summary="Chỉnh sửa dịch vụ phòng",
)
async def update_room_service_service(
    service_id: str,
    service_in: RoomServiceCatalogItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin dịch vụ phòng."""
    item = await _get_rs_catalog_item_or_404(db, service_id)
    for field, value in service_in.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.updated_at = utc_now_naive()
    await db.commit()
    await db.refresh(item)
    return item


@router.delete(
    "/room-service/services/{service_id}",
    tags=TAG_ROOM_SERVICE,
    summary="Xóa dịch vụ phòng",
)
async def delete_room_service_service(
    service_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Xóa hoàn toàn một dịch vụ phòng khỏi menu."""
    item = await _get_rs_catalog_item_or_404(db, service_id)
    await db.delete(item)
    await db.commit()
    return {"status": "success", "message": f"Đã xóa dịch vụ {service_id} thành công", "id": service_id}


@router.patch(
    "/room-service/services/{service_id}/toggle",
    response_model=RoomServiceCatalogItemResponse,
    tags=TAG_ROOM_SERVICE,
    summary="Bật / Tắt trạng thái phục vụ của dịch vụ phòng",
)
async def toggle_room_service_service(
    service_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Chuyển đổi trạng thái is_available của dịch vụ phòng (Đang phục vụ / Tạm ngưng)."""
    item = await _get_rs_catalog_item_or_404(db, service_id)
    item.is_available = not item.is_available
    item.updated_at = utc_now_naive()
    await db.commit()
    await db.refresh(item)
    return item
