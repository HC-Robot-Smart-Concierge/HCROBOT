import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List
from sqlalchemy import String, Integer, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.job import Job


class Robot(Base):
    __tablename__ = "robots"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"RC-{uuid.uuid4().hex[:6].upper()}")
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True) # e.g. 'RC-001', 'ROBOT-ALPHA'
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="HCRobot Concierge")
    model_type: Mapped[str] = mapped_column(String(50), default="Differential Drive Concierge")
    status: Mapped[str] = mapped_column(String(50), default="IDLE") # 'IDLE', 'NAVIGATING', 'INTERACTING', 'CHARGING', 'ERROR', 'OFFLINE'
    battery_level: Mapped[int] = mapped_column(Integer, default=100) # 0 - 100%
    current_location: Mapped[str] = mapped_column(String(100), default="Main Lobby")
    is_online: Mapped[bool] = mapped_column(Boolean, default=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_heartbeat: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="robot")

