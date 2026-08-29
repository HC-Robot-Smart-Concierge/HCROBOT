import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ManagementDirective(Base):
    __tablename__ = "management_directives"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"DIR-{uuid.uuid4().hex[:8]}")
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. 'OP-101', 'OP-102'
    title: Mapped[str] = mapped_column(String(200), nullable=False) # e.g. 'Spill in Lobby'
    department: Mapped[str] = mapped_column(String(50), default="Housekeeping")
    priority: Mapped[str] = mapped_column(String(50), default="URGENT") # 'URGENT', 'PENDING', 'IN PROGRESS'
    location: Mapped[str] = mapped_column(String(100), default="Main Entrance")
    reported_time_label: Mapped[str] = mapped_column(String(50), default="Reported 2m ago")
    
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Unassigned") # 'Unassigned', 'In Progress', 'Completed'
    
    assigned_staff_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    assigned_eta: Mapped[Optional[str]] = mapped_column(String(20), nullable=True) # e.g. '5m'
    assigned_staff_avatar: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    type: Mapped[str] = mapped_column(String(50), default="spill") # 'spill', 'room_service', 'towels', 'directive'
    created_by: Mapped[str] = mapped_column(String(100), default="System Administrator")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
