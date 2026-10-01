import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Float, Integer, DateTime, Boolean, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base



class FoodItem(Base):
    """
    Master Data: Danh mục món ăn / thức uống tổng thể của khách sạn (Diagram 2).
    Chứa thông tin gốc không phụ thuộc vào thực đơn cụ thể.
    """
    __tablename__ = "food_items"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"FOOD-{uuid.uuid4().hex[:6].upper()}")
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True) # e.g. "Club Sandwich & Truffle Fries"
    category: Mapped[str] = mapped_column(String(50), default="Món chính", index=True) # 'Khai vị', 'Món chính', 'Đồ uống', 'Tráng miệng', 'Ăn nhẹ'
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    base_price: Mapped[float] = mapped_column(Float, default=0.0) # Đơn giá gốc chuẩn (VND)
    currency: Mapped[str] = mapped_column(String(10), default="VND")
    prep_time_minutes: Mapped[int] = mapped_column(Integer, default=15)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True) # Bếp tổng còn phục vụ món này không

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    menu_items: Mapped[List["MenuItem"]] = relationship("MenuItem", back_populates="food_item", cascade="all, delete-orphan")


class Menu(Base):
    """
    Thực đơn theo ngữ cảnh: Sáng, Tối, Alacarte, Room Service, Late Night...
    """
    __tablename__ = "menus"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"MENU-{uuid.uuid4().hex[:6].upper()}")
    name: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "Thực đơn Buffet Sáng", "Thực đơn Gọi Món Alacarte", "Thực đơn Room Service"
    category: Mapped[str] = mapped_column(String(50), default="Food") # 'Food', 'Beverage', 'Dessert', 'Combo'
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items: Mapped[List["MenuItem"]] = relationship("MenuItem", back_populates="menu", cascade="all, delete-orphan")


class MenuItem(Base):
    """
    Bảng liên kết Nhiều - Nhiều giữa MENU và FOOD_ITEM (Diagram 2).
    Đại diện cho việc đưa một Món ăn vào một Thực đơn cụ thể với chính sách giá riêng.
    """
    __tablename__ = "menu_items"
    __table_args__ = (
        UniqueConstraint("menu_id", "food_item_id", name="uq_menu_food_item"),
    )

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"ITEM-{uuid.uuid4().hex[:6].upper()}")
    menu_id: Mapped[str] = mapped_column(String(50), ForeignKey("menus.id", ondelete="CASCADE"), nullable=False, index=True)
    food_item_id: Mapped[str] = mapped_column(String(50), ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False, index=True)
    price: Mapped[float] = mapped_column(Float, default=0.0) # Đơn giá áp dụng riêng tại thực đơn này (VND)
    display_order: Mapped[int] = mapped_column(Integer, default=0) # Thứ tự sắp xếp trong menu
    is_available: Mapped[bool] = mapped_column(Boolean, default=True) # Có đang bật phục vụ tại menu này không

    # Legacy/cache columns (nullable, duy trì tương thích bảng cũ)
    name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    currency: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default="VND")
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    prep_time_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=15)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    menu: Mapped["Menu"] = relationship("Menu", back_populates="items")
    food_item: Mapped["FoodItem"] = relationship("FoodItem", back_populates="menu_items", lazy="joined")
