import asyncio
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.services.notification_manager import notification_manager
from app.models import SupportRequest, RoomServiceOrder, OrderItem as OrderItemModel
from app.schemas.operations import (
    RoomServiceOrderCreate,
    RoomServiceOrderResponse,
    RoomServiceDashboardResponse,
    OrderItemResponse,
    RoomOrdersHistoryResponse,
    RoomServiceCatalogItemCreate,
    RoomServiceCatalogItemUpdate,
    RoomServiceCatalogItemResponse,
)
from app.repositories import (
    RoomServiceRepository,
    get_room_service_repository,
)
from .room_service_helpers import execute_create_room_service_order, fetch_room_orders_history_data
from .shared import TAG_ROOM_SERVICE, TAG_FB

router = APIRouter()

_CATALOG_DATA_PATH = Path(__file__).resolve().parent / "data" / "room_service_catalog.json"
with _CATALOG_DATA_PATH.open("r", encoding="utf-8") as _f:
    DEFAULT_ROOM_SERVICE_CATALOG: List[Dict[str, Any]] = json.load(_f)


@router.get(
    "/dashboard/room-service",
    response_model=RoomServiceDashboardResponse,
    tags=TAG_FB,
    summary="Xem Dashboard Phục vụ phòng (Room Service)",
)
async def get_room_service_dashboard(
    is_service_request: Optional[bool] = Query(None, description="Lọc dịch vụ phòng (True) hoặc món ăn bếp (False)"),
    type: Optional[str] = Query(None, description="Lọc theo 'food' hoặc 'service'"),
    department: Optional[str] = Query(None, description="Lọc theo 'room_service' hoặc 'kitchen'"),
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """Returns real-time KPIs, active orders, delivery fleet, and low stock alerts for Room Service or Kitchen."""
    # 1. Fetch Orders directly from RoomServiceOrder repository
    all_orders = await rs_repo.list_orders()

    # Phân loại và cô lập triệt để đơn hàng: Món ăn chỉ gửi Bếp, Dịch vụ chỉ gửi Room Service
    if is_service_request is not None:
        orders = [o for o in all_orders if bool(o.is_service_request) == is_service_request]
    elif type == "food" or department == "kitchen":
        orders = [o for o in all_orders if not o.is_service_request]
    elif type == "service" or department == "room_service":
        orders = [o for o in all_orders if o.is_service_request]
    else:
        orders = list(all_orders)

    # 2. Fetch Robots (Deprecated - returning empty list)
    delivery_fleet = []

    # 3. Stock (Table dropped per schema cleanup)
    low_stock_alerts = []

    # 4. Calculate dynamic KPIs theo 3 trạng thái chuẩn hoá: Chờ tiếp nhận, Đang xử lý, Hoàn tất
    pending_count = sum(1 for o in orders if (o.status or "").lower().strip() in ["pending", "unassigned", "chờ tiếp nhận", "sent to kitchen", "sent_to_kitchen"])
    in_prep_count = sum(1 for o in orders if (o.status or "").lower().strip() in ["in progress", "in_progress", "cooking", "in preparation", "delivering", "ready", "đang xử lý", "đang chuẩn bị", "đang giao"])
    completed_count = sum(1 for o in orders if (o.status or "").lower().strip() in ["completed", "delivered", "hoàn tất", "hoàn thành"])

    kpis = {
        "pendingOrders": {"value": pending_count, "delta": "+0", "status": "neutral"},
        "inPreparation": {"value": in_prep_count, "label": "Đang xử lý", "avgTime": "10m"},
        "delivering": {"value": 0, "label": "In Transit"},
        "completedToday": {"value": completed_count},
        "totalOrders": {"value": len(orders)},
    }
    return {
        "kpis": kpis,
        "orders": orders,
        "delivery_fleet": delivery_fleet,
        "low_stock_alerts": low_stock_alerts,
    }


@router.post(
    "/room-service/orders",
    response_model=RoomServiceOrderResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_FB,
    summary="Tạo đơn gọi món phục vụ phòng",
)
async def create_room_service_order(
    order_in: RoomServiceOrderCreate,
    db: AsyncSession = Depends(get_db),
    repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """Creates a new Room Service order stored in both SupportRequest and RoomServiceOrder/OrderItem tables."""
    return await execute_create_room_service_order(order_in, db, repo)


@router.get(
    "/room-service/rooms/{room_number}/orders",
    response_model=RoomOrdersHistoryResponse,
    tags=TAG_FB,
    summary="Tra cứu toàn bộ đơn hàng và món ăn phòng đó đã đặt",
    responses={
        200: {"description": "Lấy thông tin tổng hợp các món và danh sách đơn của phòng thành công."}
    },
)
@router.get(
    "/room-service/orders/by-room/{room_number}",
    response_model=RoomOrdersHistoryResponse,
    tags=TAG_FB,
    include_in_schema=False,
)
async def get_room_orders_history(
    room_number: str,
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết lịch sử đặt món ăn / dịch vụ phòng theo số phòng (vd: `402`, `ROOM 201`, `304`):
    - **Tổng số đơn hàng**: Tổng số lần phòng này đã đặt Room Service
    - **Tổng số tiền**: Tổng chi phí các đơn đã đặt
    - **Danh sách tổng hợp các món đã đặt**: Tên món, tổng số lượng, đơn giá và thời điểm đặt gần nhất
    - **Danh sách chi tiết các đơn hàng**: Chi tiết từng đơn (mã đơn, trạng thái, danh sách món, ghi chú)
    """
    return await fetch_room_orders_history_data(room_number, rs_repo)


@router.get(
    "/room-service/orders/{order_id}",
    response_model=RoomServiceOrderResponse,
    tags=TAG_FB,
    summary="Chi tiết một đơn hàng Room Service",
)
@router.get(
    "/room-service/requests/{order_id}",
    response_model=RoomServiceOrderResponse,
    tags=TAG_FB,
    include_in_schema=False,
)
async def get_room_service_order(
    order_id: str,
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """Lấy thông tin chi tiết một đơn đặt món Room Service theo ID hoặc mã đơn."""
    order = await rs_repo.get_order_by_id_or_number(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng Room Service.")
    return order


# =====================================================================
# ORDER_ITEM ENDPOINTS (CHI TIẾT MÓN ĂN TRONG ĐƠN PHỤC VỤ PHÒNG)
# =====================================================================

@router.get(
    "/room-service/orders/{order_id}/items",
    response_model=List[OrderItemResponse],
    tags=TAG_FB,
    summary="Danh sách món ăn của một đơn hàng Room Service (ORDER_ITEM)",
)
async def get_order_items(
    order_id: str,
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """Lấy danh sách các bản ghi ORDER_ITEM chi tiết thuộc về một đơn hàng phục vụ phòng cụ thể."""
    clean_id = order_id.replace("ORD-", "")
    rs_order = await rs_repo.get_order_by_id_or_number(order_id)
    actual_order_id = rs_order.id if rs_order else order_id
    items = await rs_repo.get_order_items(actual_order_id, clean_id=clean_id)

    # Fallback nếu đơn lưu trước khi có bảng order_items
    if not items and rs_order and rs_order.items:
        return [
            OrderItemResponse(
                item_name=it.get("name", "Món ăn"),
                quantity=int(it.get("qty", 1)),
                unit_price=float(it.get("unit_price", 0.0)),
                subtotal=float(it.get("subtotal", 0.0)),
                menu_item_id=it.get("menu_item_id"),
                food_item_id=it.get("food_item_id"),
                notes=it.get("notes"),
            )
            for it in rs_order.items
        ]
    return items


@router.get(
    "/room-service/order-items",
    response_model=List[OrderItemResponse],
    tags=TAG_FB,
    summary="Tra cứu toàn bộ danh sách các món ăn đã gọi (ORDER_ITEM)",
)
async def list_all_order_items(
    order_id: Optional[str] = Query(None, description="Lọc theo ID đơn hàng"),
    food_item_id: Optional[str] = Query(None, description="Lọc theo ID món gốc"),
    menu_item_id: Optional[str] = Query(None, description="Lọc theo ID món trong thực đơn"),
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
):
    """Liệt kê toàn bộ các món ăn đã được gọi qua dịch vụ phòng (ORDER_ITEM)."""
    return await rs_repo.list_all_order_items(
        order_id=order_id,
        food_item_id=food_item_id,
        menu_item_id=menu_item_id,
    )



@router.delete(
    "/room-service/orders/clear-all",
    tags=TAG_FB,
    summary="Xóa sạch toàn bộ đơn món ăn của bộ phận bếp / Room Service",
)
async def clear_all_room_service_orders(
    db: AsyncSession = Depends(get_db),
):
    """Xóa toàn bộ các đơn đặt món ăn và order items để reset hàng đợi bếp."""
    from sqlalchemy import delete, or_
    await db.execute(delete(OrderItemModel))
    await db.execute(delete(RoomServiceOrder))
    await db.execute(delete(SupportRequest).where(
        or_(
            SupportRequest.service_type_id == "ST-ROOM-SERVICE",
            SupportRequest.department_id == "DEP-ROOMSERVICE",
            SupportRequest.service_type_id == "room_service",
            SupportRequest.department_id == "Room Service",
        )
    ))
    await db.commit()
    asyncio.create_task(
        notification_manager.broadcast_to_department("All", {"type": "ORDERS_CLEARED"})
    )
    return {"status": "success", "message": "Đã xóa sạch toàn bộ đơn món ăn bên bộ phận bếp."}


# =====================================================================
# ROOM SERVICE & AMENITIES CATALOG MANAGEMENT (CRUD DỊCH VỤ PHÒNG)
# =====================================================================


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
    from app.models.room_service import RoomServiceCatalogItem
    from sqlalchemy import select, delete, or_

    # 1. Đảm bảo bảng room_service_catalog_items đã được tạo
    from app.core.database import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Xóa sạch bất kỳ item nào là nước khoáng khỏi bảng dịch vụ nếu có
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

    # 3. Lấy dữ liệu hiện tại
    stmt = select(RoomServiceCatalogItem).order_by(RoomServiceCatalogItem.display_order.asc(), RoomServiceCatalogItem.created_at.asc())
    result = await db.execute(stmt)
    items = result.scalars().all()

    # 4. Nếu bảng rỗng, nạp danh mục chuẩn 14 dịch vụ ban đầu (không có nước khoáng)
    if not items:
        for cat_item in DEFAULT_ROOM_SERVICE_CATALOG:
            db_item = RoomServiceCatalogItem(**cat_item)
            db.add(db_item)
        await db.commit()

        result = await db.execute(stmt)
        items = result.scalars().all()

    # 5. Áp dụng bộ lọc
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
    from app.models.room_service import RoomServiceCatalogItem

    from app.core.database import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Chống spam / double-click: kiểm tra nếu cùng tên dịch vụ vừa được tạo trong 10 giây
    from datetime import timedelta
    ten_seconds_ago = datetime.utcnow() - timedelta(seconds=10)
    check_stmt = select(RoomServiceCatalogItem).where(
        RoomServiceCatalogItem.name.ilike(service_in.name.strip()),
        RoomServiceCatalogItem.created_at >= ten_seconds_ago
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
    from app.models.room_service import RoomServiceCatalogItem
    from sqlalchemy import select

    stmt = select(RoomServiceCatalogItem).where(RoomServiceCatalogItem.id == service_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy dịch vụ.")

    update_data = service_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    item.updated_at = datetime.utcnow()
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
    from app.models.room_service import RoomServiceCatalogItem
    from sqlalchemy import select

    stmt = select(RoomServiceCatalogItem).where(RoomServiceCatalogItem.id == service_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy dịch vụ.")

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
    from app.models.room_service import RoomServiceCatalogItem
    from sqlalchemy import select

    stmt = select(RoomServiceCatalogItem).where(RoomServiceCatalogItem.id == service_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy dịch vụ.")

    item.is_available = not item.is_available
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)
    return item
