from sqlalchemy import Column, String, Integer, Float, DateTime, JSON
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class RestaurantReservation(Base):
    """Bảng Đặt Bàn Trước Nhà Hàng qua Robot Kiosk hoặc Lễ Tân."""
    __tablename__ = "restaurant_reservations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reservation_code = Column(String, unique=True, index=True, nullable=False)
    guest_name = Column(String, nullable=False)
    room_number = Column(String, nullable=True)
    party_size = Column(Integer, default=2)
    reservation_time = Column(String, nullable=False)
    table_number = Column(String, nullable=True)
    special_note = Column(String, nullable=True)
    status = Column(String, default="Confirmed")  # Confirmed, Seated, Completed, Cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RestaurantPreOrder(Base):
    """Bảng Đặt Món Trước Nhà Hàng qua Robot Kiosk."""
    __tablename__ = "restaurant_pre_orders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_code = Column(String, unique=True, index=True, nullable=False)
    reservation_code = Column(String, nullable=True)
    guest_name = Column(String, nullable=False)
    room_number = Column(String, nullable=True)
    items = Column(JSON, nullable=False)  # list of dicts: [{"name": "...", "quantity": 1, "price": 100000}]
    total_price = Column(Float, default=0.0)
    note = Column(String, nullable=True)
    status = Column(String, default="Pending")  # Pending, Preparing, Served, Cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
