import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"MN-{uuid.uuid4().hex[:8]}")
    ticket_code: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. 'MN-401', 'MN-402'
    title: Mapped[str] = mapped_column(String(200), nullable=False) # e.g. 'Plumbing Leak', 'Air Conditioner Issue'
    category: Mapped[str] = mapped_column(String(50), default="general") # 'plumbing', 'hvac', 'electrical', 'general'
    priority: Mapped[str] = mapped_column(String(50), default="Pending") # 'HIGH PRIORITY', 'In Progress', 'Completed'
    reported_time_label: Mapped[str] = mapped_column(String(50), default="10 mins ago")
    
    location: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. 'Room 412', 'Room 305'
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="RECEIVED FROM HCROBOT")
    status: Mapped[str] = mapped_column(String(50), default="Pending") # 'Pending', 'In Progress', 'Completed'
    
    assigned_to: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # e.g. 'James D.'
    assigned_staff_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("staff.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
