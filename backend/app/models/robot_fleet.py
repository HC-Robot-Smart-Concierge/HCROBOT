import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RobotUnit(Base):
    __tablename__ = "robot_units"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"BOT-{uuid.uuid4().hex[:8]}")
    unit_code: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. 'U1', 'U2', 'U3', 'ALPHA'
    name: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. 'Unit 01', 'Bot Unit Alpha'
    model_type: Mapped[str] = mapped_column(String(50), default="delivery") # 'delivery', 'automated_cart', 'service_cart'
    status: Mapped[str] = mapped_column(String(50), default="Available") # 'Available', 'Delivering', 'Charging', 'Maintenance'
    status_color: Mapped[str] = mapped_column(String(20), default="emerald") # 'emerald', 'sky', 'amber', 'stone'
    location: Mapped[str] = mapped_column(String(100), default="Dock 1") # 'F&B Dock', 'En route Fl 4', '84%'
    battery_level: Mapped[int] = mapped_column(Integer, default=100) # 0-100%
    current_payload: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
