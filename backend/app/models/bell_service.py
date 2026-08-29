import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BellRequest(Base):
    __tablename__ = "bell_requests"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"BS-{uuid.uuid4().hex[:8]}")
    ticket_code: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. 'BS-501', 'BS-502', 'BS-503'
    title: Mapped[str] = mapped_column(String(200), nullable=False) # e.g. 'Luggage Pickup (Urgent)', 'Room Move Assistance'
    priority: Mapped[str] = mapped_column(String(50), default="Pending") # 'HIGH PRIORITY', 'Pending', 'In Progress'
    is_urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    
    location: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. 'Suite 402', 'Room 215 to 510', 'Lobby Lounge'
    guest_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # e.g. 'Mr. Aris Thorne'
    reporter: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # e.g. 'Staff (J. Doe)'
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    request_type: Mapped[str] = mapped_column(String(50), default="luggage") # 'luggage', 'room_move', 'lost_found'
    status: Mapped[str] = mapped_column(String(50), default="Pending") # 'Pending', 'In Progress', 'Completed'
    
    assigned_to: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # e.g. 'Marcus T.', 'Bot Unit Alpha'
    assigned_robot_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("robot_units.id"), nullable=True)
    assigned_staff_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("staff.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
