import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List
from sqlalchemy import String, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.map import Map
    from app.models.support_request import SupportRequest


class Hotel(Base):
    __tablename__ = "hotels"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"HTL-{uuid.uuid4().hex[:6].upper()}")
    name: Mapped[str] = mapped_column(String(150), nullable=False) # e.g. "HC Grand Hotel & Suites"
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    star_rating: Mapped[int] = mapped_column(Integer, default=5)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    rooms: Mapped[List["Room"]] = relationship("Room", back_populates="hotel", cascade="all, delete-orphan")
    facilities: Mapped[List["Facility"]] = relationship("Facility", back_populates="hotel", cascade="all, delete-orphan")
    events: Mapped[List["Event"]] = relationship("Event", back_populates="hotel", cascade="all, delete-orphan")
    maps: Mapped[List["Map"]] = relationship("Map", back_populates="hotel", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"ROOM-{uuid.uuid4().hex[:6].upper()}")
    hotel_id: Mapped[str] = mapped_column(String(50), ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    room_number: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. "402", "305", "502"
    floor: Mapped[str] = mapped_column(String(50), default="Tầng 4")
    room_type: Mapped[str] = mapped_column(String(50), default="Deluxe Suite") # 'Standard', 'Deluxe', 'Suite', 'Presidential'
    status: Mapped[str] = mapped_column(String(50), default="AVAILABLE") # 'AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'
    current_guest_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    qr_code: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    hotel: Mapped["Hotel"] = relationship("Hotel", back_populates="rooms")
    support_requests: Mapped[List["SupportRequest"]] = relationship("SupportRequest", back_populates="room")
    # TODO (Phase sau): Kích hoạt khi chạy migration thêm cột room_id vào bảng room_service_orders trong DB
    # room_service_orders: Mapped[List["RoomServiceOrder"]] = relationship("RoomServiceOrder", back_populates="room")


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"FAC-{uuid.uuid4().hex[:6].upper()}")
    hotel_id: Mapped[str] = mapped_column(String(50), ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "Bể bơi vô cực Tầng 5", "Phòng Gym Tầng 3"
    category: Mapped[str] = mapped_column(String(50), default="Recreation") # 'Dining', 'Wellness', 'Recreation', 'Business'
    location: Mapped[str] = mapped_column(String(100), default="Tầng 5")
    open_time: Mapped[str] = mapped_column(String(20), default="06:00")
    close_time: Mapped[str] = mapped_column(String(20), default="22:00")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    hotel: Mapped["Hotel"] = relationship("Hotel", back_populates="facilities")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"EVT-{uuid.uuid4().hex[:6].upper()}")
    hotel_id: Mapped[str] = mapped_column(String(50), ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False) # e.g. "Tiệc Cocktail Chào mừng Khách VIP"
    location: Mapped[str] = mapped_column(String(100), default="Sky Lounge Tầng 19")
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    hotel: Mapped["Hotel"] = relationship("Hotel", back_populates="events")
