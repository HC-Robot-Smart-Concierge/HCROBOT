from typing import Optional, List, Sequence, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, func
from sqlalchemy.orm import selectinload

from app.models.room_service import RoomServiceOrder, OrderItem
from app.models.hotel import Room
from app.models.menu import FoodItem, MenuItem
from app.repositories.base import BaseRepository


class RoomServiceRepository(BaseRepository[RoomServiceOrder]):
    """
    Repository for Room Service orders, order items, and room lookup.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db, RoomServiceOrder)

    async def list_orders(self, limit: int = 100) -> Sequence[RoomServiceOrder]:
        """Fetch all room service orders with order items loaded."""
        stmt = (
            select(RoomServiceOrder)
            .options(selectinload(RoomServiceOrder.order_items))
            .order_by(desc(RoomServiceOrder.created_at))
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_order_by_id_or_number(self, identifier: str) -> Optional[RoomServiceOrder]:
        """Find order by ID or order_number."""
        target = identifier.strip()
        clean = target.replace("ORD-", "").strip()
        stmt = (
            select(RoomServiceOrder)
            .options(selectinload(RoomServiceOrder.order_items))
            .where(
                or_(
                    RoomServiceOrder.id == target,
                    RoomServiceOrder.order_number == target,
                    RoomServiceOrder.id == clean,
                    RoomServiceOrder.order_number == clean,
                    RoomServiceOrder.id == f"ORD-{clean}",
                )
            )
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def find_room(self, room_number: str) -> Optional[Room]:
        """Find a room record by its number (e.g. '101' or 'Room 101')."""
        clean_room = room_number.upper().replace("ROOM", "").strip()
        stmt = select(Room).where(
            (Room.room_number == room_number) | (Room.room_number == clean_room)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_orders_by_room(self, room_number: str, limit: int = 50) -> Sequence[RoomServiceOrder]:
        """Fetch orders for a specific room."""
        clean_room = room_number.upper().replace("ROOM", "").strip()
        stmt = (
            select(RoomServiceOrder)
            .options(selectinload(RoomServiceOrder.order_items))
            .where(
                or_(
                    RoomServiceOrder.room_number == room_number,
                    RoomServiceOrder.room_number == clean_room,
                )
            )
            .order_by(desc(RoomServiceOrder.created_at))
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_order_items(self, actual_order_id: str, clean_id: str = "") -> Sequence[OrderItem]:
        """Fetch items for an order."""
        stmt = (
            select(OrderItem)
            .where(
                or_(
                    OrderItem.order_id == actual_order_id,
                    OrderItem.order_id == clean_id,
                    OrderItem.order_id == f"ORD-{clean_id}",
                )
            )
            .order_by(OrderItem.id)
        )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def list_all_order_items(
        self,
        order_id: Optional[str] = None,
        food_item_id: Optional[str] = None,
        menu_item_id: Optional[str] = None,
    ) -> Sequence[OrderItem]:
        """List order items with optional filters."""
        stmt = select(OrderItem).order_by(desc(OrderItem.id))
        if order_id:
            stmt = stmt.where(OrderItem.order_id == order_id)
        if food_item_id:
            stmt = stmt.where(OrderItem.food_item_id == food_item_id)
        if menu_item_id:
            stmt = stmt.where(OrderItem.menu_item_id == menu_item_id)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def lookup_food_and_menu_item(
        self,
        name: str,
        food_item_id: Optional[str] = None,
        menu_item_id: Optional[str] = None,
    ) -> Tuple[Optional[FoodItem], Optional[MenuItem]]:
        """Look up corresponding FoodItem and MenuItem entities for an order line item."""
        food_item: Optional[FoodItem] = None
        m_item: Optional[MenuItem] = None

        if food_item_id:
            food_item = await self.db.get(FoodItem, food_item_id)
        if menu_item_id:
            m_item = await self.db.get(MenuItem, menu_item_id)

        if not food_item and m_item and m_item.food_item_id:
            food_item = await self.db.get(FoodItem, m_item.food_item_id)

        if not food_item and not m_item and name:
            f_res = await self.db.execute(
                select(FoodItem).where(FoodItem.name.ilike(f"%{name.strip()}%"))
            )
            food_item = f_res.scalars().first()

        if food_item and not m_item:
            m_res = await self.db.execute(
                select(MenuItem).where(MenuItem.food_item_id == food_item.id, MenuItem.is_available == True)
            )
            m_item = m_res.scalars().first()

        if not food_item and not m_item and name:
            m_item_res = await self.db.execute(
                select(MenuItem).where(MenuItem.name.ilike(f"%{name.strip()}%"))
            )
            m_item = m_item_res.scalars().first()
            if m_item and m_item.food_item_id:
                food_item = await self.db.get(FoodItem, m_item.food_item_id)

        return food_item, m_item

    async def find_order_by_linked_or_number(
        self,
        support_request_id: Optional[str] = None,
        order_identifier: Optional[str] = None,
    ) -> Optional[RoomServiceOrder]:
        """Find order linked by support request ID or order number variations."""
        conditions = []
        if support_request_id:
            conditions.append(RoomServiceOrder.support_request_id == support_request_id)
            conditions.append(RoomServiceOrder.id == support_request_id)
        if order_identifier:
            conditions.append(RoomServiceOrder.order_number == order_identifier)
            conditions.append(RoomServiceOrder.id == order_identifier)
        if not conditions:
            return None
        stmt = select(RoomServiceOrder).where(or_(*conditions))
        res = await self.db.execute(stmt)
        return res.scalars().first()
