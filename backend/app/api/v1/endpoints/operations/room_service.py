import asyncio
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.services.notification_manager import notification_manager
from app.models import (
    Staff,
    SupportRequest,
    MenuItem,
    FoodItem,
    Room,
    RoomServiceOrder,
    OrderItem as OrderItemModel,
    RoomServiceCatalogItem,
)
from app.schemas.operations import (
    RoomServiceOrderCreate,
    RoomServiceOrderStatusUpdate,
    RoomServiceOrderResponse,
    RoomServiceDashboardResponse,
    OrderItemResponse,
    RoomOrderedItemSummary,
    RoomOrdersHistoryResponse,
    RoomServiceCatalogItemCreate,
    RoomServiceCatalogItemUpdate,
    RoomServiceCatalogItemResponse,
)
from app.repositories import (
    RoomServiceRepository,
    get_room_service_repository,
    SupportRequestRepository,
    get_support_request_repository,
)
from .shared import TAG_ROOM_SERVICE, TAG_FB, create_department_notification

router = APIRouter()


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


from .room_service_order_create import (
    create_room_service_order,
    router as room_service_order_create_router,
)

router.include_router(room_service_order_create_router)



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
    orders = await rs_repo.list_orders_by_room(room_number)

    total_amount = sum(float(o.total_amount or 0.0) for o in orders)

    # Gom nhóm và tính toán tổng số lượng từng món phòng đã đặt
    items_map: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        if o.items and isinstance(o.items, list):
            for item in o.items:
                if isinstance(item, dict):
                    name = item.get("name") or item.get("item_name") or "Món ăn"
                    raw_qty = item.get("qty") or item.get("quantity") or 1
                    try:
                        qty = int(raw_qty)
                    except (ValueError, TypeError):
                        qty = 1

                    price = float(item.get("unit_price") or item.get("price") or 0.0)
                    subtotal = float(item.get("subtotal") or (price * qty))

                    if name not in items_map:
                        items_map[name] = {
                            "item_name": name,
                            "total_quantity": 0,
                            "unit_price": price,
                            "total_price": 0.0,
                            "last_ordered_at": o.created_at,
                        }
                    items_map[name]["total_quantity"] += qty
                    items_map[name]["total_price"] += subtotal
                    if o.created_at and (not items_map[name]["last_ordered_at"] or o.created_at > items_map[name]["last_ordered_at"]):
                        items_map[name]["last_ordered_at"] = o.created_at
                        if price > 0:
                            items_map[name]["unit_price"] = price

    ordered_items_summary = [
        RoomOrderedItemSummary(**data) for data in items_map.values()
    ]

    return RoomOrdersHistoryResponse(
        room_number=room_number,
        total_orders=len(orders),
        total_amount=total_amount,
        ordered_items_summary=ordered_items_summary,
        orders=[RoomServiceOrderResponse.model_validate(o) for o in orders],
    )


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


from .room_service_catalog import (
    DEFAULT_ROOM_SERVICE_CATALOG,
    create_room_service_service,
    delete_room_service_service,
    get_room_service_catalog,
    router as room_service_catalog_router,
    toggle_room_service_service,
    update_room_service_service,
)

router.include_router(room_service_catalog_router)
