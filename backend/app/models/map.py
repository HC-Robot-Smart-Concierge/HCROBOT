import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"zone-{uuid.uuid4().hex[:8]}")
    map_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="KEEP_OUT") # 'KEEP_OUT', 'SLOW_SPEED', 'SILENT_ZONE', 'GREETING_ZONE', 'SERVICE_PRIORITY'
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    width: Mapped[float] = mapped_column(Float, default=2.0)
    height: Mapped[float] = mapped_column(Float, default=2.0)
    speed_limit: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0.3)
    floor: Mapped[str] = mapped_column(String(50), default="Sảnh Tầng 1")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Endpoint(Base):
    __tablename__ = "endpoints"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"wp-{uuid.uuid4().hex[:8]}")
    map_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "Quầy Lễ Tân", "Trạm Sạc", "Bàn VIP 1"
    floor: Mapped[str] = mapped_column(String(50), default="Sảnh Tầng 1")
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    yaw: Mapped[float] = mapped_column(Float, default=0.0)
    type: Mapped[str] = mapped_column(String(50), default="standby") # 'dock', 'service', 'standby', 'room', 'elevator'
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    group_memberships: Mapped[List["EndpointGroupMember"]] = relationship("EndpointGroupMember", back_populates="endpoint", cascade="all, delete-orphan")


class EndpointGroup(Base):
    __tablename__ = "endpoint_groups"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"GRP-{uuid.uuid4().hex[:6].upper()}")
    name: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "Nhóm Bàn Tiếp Khách", "Nhóm Cửa Thang Máy"
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    members: Mapped[List["EndpointGroupMember"]] = relationship("EndpointGroupMember", back_populates="endpoint_group", cascade="all, delete-orphan")


class EndpointGroupMember(Base):
    __tablename__ = "endpoint_group_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    endpoint_id: Mapped[str] = mapped_column(String(50), ForeignKey("endpoints.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint_group_id: Mapped[str] = mapped_column(String(50), ForeignKey("endpoint_groups.id", ondelete="CASCADE"), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    endpoint: Mapped["Endpoint"] = relationship("Endpoint", back_populates="group_memberships")
    endpoint_group: Mapped["EndpointGroup"] = relationship("EndpointGroup", back_populates="members")
