import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Integer, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RoomServiceOrder(Base):
    __tablename__ = "room_service_orders"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"ORD-{uuid.uuid4().hex[:8]}")
    order_number: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. '1042', '1041', '1040'
    room_number: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. 'ROOM 412', 'ROOM 208'
    is_vip: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(50), default="Pending") # 'Pending', 'Cooking', 'Ready', 'Delivering', 'Completed', 'Rejected'
    priority: Mapped[str] = mapped_column(String(20), default="normal") # 'high', 'normal', 'low'
    
    # Store items list as JSON: [{"name": "Club Sandwich & Truffle Fries", "qty": 2}, ...]
    items: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    is_service_request: Mapped[bool] = mapped_column(Boolean, default=False)
    progress: Mapped[int] = mapped_column(Integer, default=0) # 0 - 100%
    est_completion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # e.g. '4 mins'
    
    assigned_robot_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("robot_units.id"), nullable=True)
    assigned_staff_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
