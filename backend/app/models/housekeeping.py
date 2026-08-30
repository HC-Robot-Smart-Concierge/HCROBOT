import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class HousekeepingRequest(Base):
    __tablename__ = "housekeeping_requests"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"HK-{uuid.uuid4().hex[:8]}")
    ticket_code: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. 'HK-1042', 'HK-1043'
    source: Mapped[str] = mapped_column(String(50), default="From HCRobot") # 'From HCRobot', 'Front Desk', 'Guest App'
    time_label: Mapped[str] = mapped_column(String(20), default="10:00 AM")
    
    title: Mapped[str] = mapped_column(String(200), nullable=False) # e.g. 'Spill cleanup required', 'Extra Towels'
    room_number: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. '502', '314'
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    guest_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    status: Mapped[str] = mapped_column(String(50), default="Unassigned") # 'Unassigned', 'In Progress', 'Completed'
    assigned_staff_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    assigned_staff_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("staff.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
