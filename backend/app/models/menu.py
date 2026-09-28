import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Float, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Menu(Base):
    __tablename__ = "menus"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"MENU-{uuid.uuid4().hex[:6].upper()}")
    name: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "Thực đơn Buffet Sáng", "Thực đơn Gọi Món Alacarte", "Menu Đồ Uống & Cocktail"
    category: Mapped[str] = mapped_column(String(50), default="Food") # 'Food', 'Beverage', 'Dessert', 'Combo'
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items: Mapped[List["MenuItem"]] = relationship("MenuItem", back_populates="menu", cascade="all, delete-orphan")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"ITEM-{uuid.uuid4().hex[:6].upper()}")
    menu_id: Mapped[str] = mapped_column(String(50), ForeignKey("menus.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False) # e.g. "Club Sandwich & Truffle Fries", "Cà Phê Muối", "Phở Bò Wagyu"
    price: Mapped[float] = mapped_column(Float, default=0.0) # Đơn giá (VND)
    currency: Mapped[str] = mapped_column(String(10), default="VND")
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="Món chính") # 'Khai vị', 'Món chính', 'Đồ uống', 'Tráng miệng', 'Ăn nhẹ'
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    prep_time_minutes: Mapped[int] = mapped_column(Integer, default=15)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    menu: Mapped["Menu"] = relationship("Menu", back_populates="items")
    order_items: Mapped[List["OrderItem"]] = relationship("OrderItem", back_populates="menu_item")
