import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List, Dict, Any
from sqlalchemy import String, Integer, Float, DateTime, Boolean, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.hotel import Room
    from app.models.support_request import SupportRequest
    from app.models.menu import MenuItem, FoodItem


class RoomServiceOrder(Base):
    """
    Model lưu trữ đơn gọi món dịch vụ phòng (Room Service Order) trong PostgreSQL.
    Liên kết với SUPPORT_REQUEST và danh sách ORDER_ITEM.
    """
    __tablename__ = "room_service_orders"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"ORD-{uuid.uuid4().hex[:8].upper()}")
    order_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    room_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    room_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    account_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    support_request_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("support_requests.id", ondelete="SET NULL"), nullable=True, index=True)
    
    status: Mapped[str] = mapped_column(String(50), default="Pending") # 'Pending', 'Cooking', 'Ready', 'Delivering', 'Completed', 'Cancelled'
    items: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, default=list) # JSON cache
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_service_request: Mapped[bool] = mapped_column(Boolean, default=False)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    est_completion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    assigned_robot_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    assigned_staff_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    priority: Mapped[Optional[str]] = mapped_column(String(20), default="NORMAL")
    is_vip: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    room: Mapped[Optional["Room"]] = relationship("Room")
    account: Mapped[Optional["Account"]] = relationship("Account")
    support_request: Mapped[Optional["SupportRequest"]] = relationship("SupportRequest")
    order_items: Mapped[List["OrderItem"]] = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    """
    Model lưu chi tiết từng món ăn trong một đơn hàng phục vụ phòng (Order Item).
    Liên kết trực tiếp giữa ROOM_SERVICE_ORDER và MENU_ITEM / FOOD_ITEM.
    """
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(String(50), ForeignKey("room_service_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    menu_item_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("menu_items.id", ondelete="SET NULL"), nullable=True, index=True)
    food_item_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("food_items.id", ondelete="SET NULL"), nullable=True, index=True)
    
    item_name: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    order: Mapped["RoomServiceOrder"] = relationship("RoomServiceOrder", back_populates="order_items")
    menu_item: Mapped[Optional["MenuItem"]] = relationship("MenuItem")
    food_item: Mapped[Optional["FoodItem"]] = relationship("FoodItem")
