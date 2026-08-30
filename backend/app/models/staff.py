import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"STF-{uuid.uuid4().hex[:8]}")
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, default=lambda: f"user_{uuid.uuid4().hex[:6]}")
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. 'MS', 'JD', 'ER', 'MV'
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. 'Shift Leader', 'Housekeeping Lead', 'Bell Captain'
    department: Mapped[str] = mapped_column(String(50), nullable=False) # 'Housekeeping', 'Bell Services', 'Maintenance', 'F&B', 'Executive'
    default_dashboard: Mapped[str] = mapped_column(String(50), default="room_service") # 'reception', 'room_service', 'housekeeping', 'bell_services', 'maintenance', 'admin_map'
    location: Mapped[str] = mapped_column(String(100), default="Main Hotel") # e.g. 'Floor 3', 'Lobby', 'Floor 5'
    status: Mapped[str] = mapped_column(String(50), default="available") # 'available', 'busy', 'off_shift'
    current_tasks_count: Mapped[int] = mapped_column(Integer, default=0)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="+84 90 123 4567")
    shift: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="Morning Shift (06:00 - 14:00)")
    is_fallback_agent: Mapped[bool] = mapped_column(Boolean, default=False)
    assigned_floors: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="Floor 1 - 5")
    notification_channels: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, default="Web Dashboard, Tablet Alert")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


