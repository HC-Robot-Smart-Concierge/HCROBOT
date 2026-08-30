import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"NOTIF-{uuid.uuid4().hex[:8].upper()}")
    department: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # e.g. 'F&B', 'Housekeeping', 'Bell Services', 'Maintenance', 'Reception', 'All'
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False)
    
    request_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # ID of the related order/request
    request_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # 'room_service', 'housekeeping', 'bell_service', 'maintenance', 'reception', 'robot', 'directive'
    
    type: Mapped[str] = mapped_column(String(50), default="Request") # 'Request', 'Warning', 'Robot', 'Directive', 'Info'
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
