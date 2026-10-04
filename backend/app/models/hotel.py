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
    floors: Mapped[List["Floor"]] = relationship("Floor", back_populates="hotel", cascade="all, delete-orphan")
    rooms: Mapped[List["Room"]] = relationship("Room", back_populates="hotel", cascade="all, delete-orphan")
    amenities: Mapped[List["Amenity"]] = relationship("Amenity", back_populates="hotel", cascade="all, delete-orphan")
    facilities: Mapped[List["Amenity"]] = relationship("Amenity", back_populates="hotel", viewonly=True)
    events: Mapped[List["Event"]] = relationship("Event", back_populates="hotel", cascade="all, delete-orphan")
    maps: Mapped[List["Map"]] = relationship("Map", back_populates="hotel", cascade="all, delete-orphan")


class Floor(Base):
    __tablename__ = "floors"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"FLR-{uuid.uuid4().hex[:6].upper()}")
    hotel_id: Mapped[str] = mapped_column(String(50), ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    floor_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True) # 1, 2, 3, 4, 5...
    name: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "Tầng 1 - Sảnh chính"
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    hotel: Mapped["Hotel"] = relationship("Hotel", back_populates="floors")
    rooms: Mapped[List["Room"]] = relationship("Room", back_populates="floor_rel")
    maps: Mapped[List["Map"]] = relationship("Map", back_populates="floor_rel")
    amenities: Mapped[List["Amenity"]] = relationship("Amenity", back_populates="floor_rel")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"ROOM-{uuid.uuid4().hex[:6].upper()}")
    hotel_id: Mapped[str] = mapped_column(String(50), ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    floor_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("floors.id", ondelete="SET NULL"), nullable=True, index=True)
    room_number: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. "402", "305", "502"
    floor: Mapped[str] = mapped_column(String(50), default="Tầng 4") # compatibility label
    room_type: Mapped[str] = mapped_column(String(50), default="Deluxe Suite") # 'Standard', 'Deluxe', 'Suite', 'Presidential'
    status: Mapped[str] = mapped_column(String(50), default="AVAILABLE") # 'AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'
    current_guest_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    qr_code: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    hotel: Mapped["Hotel"] = relationship("Hotel", back_populates="rooms")
    floor_rel: Mapped[Optional["Floor"]] = relationship("Floor", back_populates="rooms")
    support_requests: Mapped[List["SupportRequest"]] = relationship("SupportRequest", back_populates="room")


class Amenity(Base):
    __tablename__ = "amenities"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"AMN-{uuid.uuid4().hex[:6].upper()}")
    hotel_id: Mapped[str] = mapped_column(String(50), ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    floor_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("floors.id", ondelete="SET NULL"), nullable=True, index=True)
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
    hotel: Mapped["Hotel"] = relationship("Hotel", back_populates="amenities")
    floor_rel: Mapped[Optional["Floor"]] = relationship("Floor", back_populates="amenities")


# Backward compatibility alias
Facility = Amenity


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
