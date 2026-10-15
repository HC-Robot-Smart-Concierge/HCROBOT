from typing import Optional, List, Sequence, Set
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.models.menu import Menu, MenuItem, FoodItem
from app.repositories.base import BaseRepository


class KitchenRepository(BaseRepository[FoodItem]):
    """
    Repository for Master Food Catalog, Menus, and Menu Items.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db, FoodItem)

    # ---------------- Food Items ----------------

    async def list_food_items(
        self,
        category: Optional[str] = None,
        search: Optional[str] = None,
        is_available: Optional[bool] = None,
    ) -> Sequence[FoodItem]:
        """Fetch all food items with optional category, search, and availability filtering."""
        stmt = select(FoodItem).order_by(FoodItem.category, FoodItem.name)
        if category:
            stmt = stmt.where(FoodItem.category == category)
        if is_available is not None:
            stmt = stmt.where(FoodItem.is_available == is_available)
        if search:
            stmt = stmt.where(FoodItem.name.ilike(f"%{search.strip()}%"))
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_food_item_by_id(self, item_id: str) -> Optional[FoodItem]:
        """Fetch single food item by ID."""
        return await self.db.get(FoodItem, item_id)

    async def find_food_by_name(self, clean_name: str) -> Optional[FoodItem]:
        """Find a food item by name (case-insensitive)."""
        stmt = select(FoodItem).where(func.lower(FoodItem.name) == clean_name.lower().strip())
        res = await self.db.execute(stmt)
        return res.scalars().first()

    # ---------------- Menus ----------------

    async def list_menus(
        self,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Sequence[Menu]:
        """Fetch menus with items and nested food items loaded."""
        stmt = (
            select(Menu)
            .options(selectinload(Menu.items).selectinload(MenuItem.food_item))
            .order_by(Menu.created_at.desc())
        )
        if category:
            stmt = stmt.where(Menu.category == category)
        if is_active is not None:
            stmt = stmt.where(Menu.is_active == is_active)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_menu_by_id(self, menu_id: str) -> Optional[Menu]:
        """Fetch single menu with its menu items and nested food items."""
        stmt = (
            select(Menu)
            .options(selectinload(Menu.items).selectinload(MenuItem.food_item))
            .where(Menu.id == menu_id)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def find_menu_by_name(self, clean_name: str) -> Optional[Menu]:
        """Find a menu by name (case-insensitive)."""
        stmt = select(Menu).where(func.lower(Menu.name) == clean_name.lower().strip())
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_existing_menu_food_ids(self, menu_id: str) -> Set[str]:
        """Fetch the set of food_item_ids currently assigned to a menu."""
        stmt = select(MenuItem.food_item_id).where(MenuItem.menu_id == menu_id)
        res = await self.db.execute(stmt)
        return set(res.scalars().all())

    # ---------------- Menu Items ----------------

    async def get_menu_item_by_id(self, menu_item_id: str, load_food: bool = False) -> Optional[MenuItem]:
        """Fetch single menu item with optional food item eager loading."""
        if not load_food:
            return await self.db.get(MenuItem, menu_item_id)
        stmt = (
            select(MenuItem)
            .options(selectinload(MenuItem.food_item))
            .where(MenuItem.id == menu_item_id)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_menu_items(
        self,
        menu_id: Optional[str] = None,
        category: Optional[str] = None,
        available_only: bool = True,
    ) -> Sequence[MenuItem]:
        """Fetch menu items with eager loaded food items and filters."""
        stmt = (
            select(MenuItem)
            .options(selectinload(MenuItem.food_item))
            .order_by(MenuItem.display_order, MenuItem.id)
        )
        if available_only:
            stmt = stmt.where(MenuItem.is_available == True)
        if menu_id:
            stmt = stmt.where(MenuItem.menu_id == menu_id)
        if category:
            stmt = stmt.where(
                (MenuItem.category == category) | (MenuItem.food_item.has(FoodItem.category == category))
            )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_menu_item_by_menu_and_food(
        self,
        menu_id: str,
        food_item_id: str,
    ) -> Optional[MenuItem]:
        """Find a menu item by menu ID and food item ID."""
        stmt = select(MenuItem).where(
            MenuItem.menu_id == menu_id,
            MenuItem.food_item_id == food_item_id,
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_menu_item_in_menu(
        self,
        menu_id: str,
        menu_item_id: str,
    ) -> Optional[MenuItem]:
        """Find a menu item belonging to a specific menu."""
        stmt = select(MenuItem).where(
            MenuItem.id == menu_item_id,
            MenuItem.menu_id == menu_id,
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()
