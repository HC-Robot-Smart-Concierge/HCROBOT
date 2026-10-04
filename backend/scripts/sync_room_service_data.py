import asyncio
import logging
from sqlalchemy import select, func
from app.core.database import AsyncSessionLocal
from app.models import (
    RoomServiceOrder,
    OrderItem,
    SupportRequest,
    FoodItem,
    MenuItem,
    InventoryStock,
    ServiceType,
    Department,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sync_room_service")

async def sync():
    async with AsyncSessionLocal() as session:
        # 1. Đảm bảo ServiceType 'ST-ROOM-SERVICE' tồn tại trong service_types
        st_res = await session.execute(select(ServiceType).where(ServiceType.id == "ST-ROOM-SERVICE"))
        st = st_res.scalars().first()
        if not st:
            logger.info("Adding ST-ROOM-SERVICE into service_types...")
            st = ServiceType(
                id="ST-ROOM-SERVICE",
                code="ROOM_SERVICE",
                name="Dịch vụ phục vụ phòng (Room Service)",
                department_id="DEP-ROOMSERVICE",
                description="Tiếp nhận và chế biến các đơn gọi món đồ ăn, thức uống tận phòng nghỉ",
                default_priority="NORMAL",
                is_active=True,
            )
            session.add(st)
            await session.commit()
            logger.info("ST-ROOM-SERVICE added.")

        # 2. Seed Inventory Stocks nếu trống
        stock_count = await session.scalar(select(func.count(InventoryStock.id)))
        if stock_count == 0:
            logger.info("Seeding inventory stocks...")
            stocks = [
                InventoryStock(name="Artisan Cola", category="beverage", count_label="6 lon", quantity=6, level="danger"),
                InventoryStock(name="Sparkling Water (L)", category="beverage", count_label="2 chai", quantity=2, level="danger"),
                InventoryStock(name="Truffle Oil", category="condiment", count_label="1 chai", quantity=1, level="warning"),
                InventoryStock(name="Bộ dao nĩa cao cấp", category="cutlery", count_label="5 bộ", quantity=5, level="warning"),
                InventoryStock(name="Khăn ăn vải trắng", category="linen", count_label="20 cái", quantity=20, level="normal"),
            ]
            session.add_all(stocks)
            await session.commit()
            logger.info(f"Added {len(stocks)} inventory stocks.")

        # 3. Đồng bộ OrderItems và SupportRequests cho toàn bộ RoomServiceOrder
        rso_res = await session.execute(select(RoomServiceOrder))
        orders = rso_res.scalars().all()
        logger.info(f"Syncing {len(orders)} RoomServiceOrders...")

        for o in orders:
            # A. Kiểm tra và bổ sung order_items
            existing_oi = await session.execute(select(OrderItem).where(OrderItem.order_id == o.id))
            items_in_db = existing_oi.scalars().all()

            if not items_in_db and o.items:
                for it in o.items:
                    name = it.get("name", "Món phục vụ phòng")
                    qty = int(it.get("qty", 1)) if str(it.get("qty", 1)).isdigit() else 1
                    price = float(it.get("unit_price", 0.0))
                    
                    food_res = await session.execute(select(FoodItem).where(FoodItem.name.ilike(f"%{name}%")))
                    food = food_res.scalars().first()
                    m_item = None
                    if food:
                        m_res = await session.execute(select(MenuItem).where(MenuItem.food_item_id == food.id))
                        m_item = m_res.scalars().first()
                        if price == 0:
                            price = m_item.price if m_item else food.base_price

                    if price == 0:
                        price = 95000.0 # Giá mặc định mẫu

                    subtotal = price * qty
                    oi = OrderItem(
                        order_id=o.id,
                        menu_item_id=m_item.id if m_item else None,
                        food_item_id=food.id if food else None,
                        item_name=name,
                        quantity=qty,
                        unit_price=price,
                        subtotal=subtotal,
                        notes=it.get("notes"),
                    )
                    session.add(oi)

            # B. Đồng bộ sang SupportRequest nếu chưa có
            sr_res = await session.execute(
                select(SupportRequest).where(
                    (SupportRequest.id == o.id)
                    | (SupportRequest.ticket_code == f"ORD-{o.order_number}")
                    | (SupportRequest.id == o.support_request_id)
                )
            )
            sr = sr_res.scalars().first()
            if not sr:
                items_desc = ", ".join([f"{it.get('qty', 1)}x {it.get('name', 'Món')}" for it in (o.items or [])])
                new_sr = SupportRequest(
                    id=o.id,
                    ticket_code=f"ORD-{o.order_number}",
                    title=f"Room Service Order #{o.order_number}",
                    description=o.note or items_desc or f"Phục vụ phòng {o.room_number}",
                    service_type_id="ST-ROOM-SERVICE",
                    department_id="DEP-ROOMSERVICE",
                    room_id=o.room_id,
                    room_number=o.room_number,
                    guest_name="Room Guest",
                    source="Guest App / In-Room Tablet",
                    status=o.status or "Pending",
                    priority=o.priority or "NORMAL",
                    progress=o.progress or 0,
                    total_amount=o.total_amount or 0.0,
                    items=o.items,
                    extra_data={
                        "is_service_request": o.is_service_request,
                        "image_url": o.image_url,
                    },
                )
                session.add(new_sr)
                o.support_request_id = o.id

        await session.commit()
        logger.info("Room Service data synchronization complete!")

if __name__ == "__main__":
    asyncio.run(sync())
