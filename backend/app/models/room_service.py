import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Integer, Float, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RoomServiceOrder(Base):
    __tablename__ = "room_service_orders"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"ORD-{uuid.uuid4().hex[:8]}")
    order_number: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. '1042', '1041', '1040'
    room_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    room_number: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. 'ROOM 412', 'ROOM 208'
    account_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(50), default="Pending") # 'Pending', 'Cooking', 'Ready', 'Delivering', 'Completed', 'Rejected'
    
    # Store items list as JSON: [{"name": "Club Sandwich & Truffle Fries", "qty": 2}, ...]
    items: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    is_service_request: Mapped[bool] = mapped_column(Boolean, default=False)
    progress: Mapped[int] = mapped_column(Integer, default=0) # 0 - 100%
    est_completion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # e.g. '4 mins'
    
    assigned_robot_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    assigned_staff_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    total_amount: Mapped[float] = mapped_column(Float, default=0.0) # Tổng tiền đơn hàng (VND)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    room: Mapped[Optional["Room"]] = relationship("Room", back_populates="room_service_orders")
    account: Mapped[Optional["Account"]] = relationship("Account")
    order_items: Mapped[List["OrderItem"]] = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(String(50), ForeignKey("room_service_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    menu_item_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("menu_items.id", ondelete="SET NULL"), nullable=True, index=True)
    item_name: Mapped[str] = mapped_column(String(150), nullable=False) # e.g. "Club Sandwich & Truffle Fries"
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0) # Đơn giá tại thời điểm đặt (VND)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0) # Thành tiền = quantity * unit_price
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # Ghi chú từng món (vd: "Không cay", "Ít đường")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    order: Mapped["RoomServiceOrder"] = relationship("RoomServiceOrder", back_populates="order_items")
    menu_item: Mapped[Optional["MenuItem"]] = relationship("MenuItem", back_populates="order_items")

