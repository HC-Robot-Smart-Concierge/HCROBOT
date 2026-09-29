import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SupportRequest(Base):
    __tablename__ = "support_requests"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"REQ-{uuid.uuid4().hex[:8].upper()}")
    ticket_code: Mapped[str] = mapped_column(String(30), unique=True, index=True) # e.g. 'HK-1042', 'BS-501', 'MN-401', 'REQ-101'
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Classification & Assignment
    service_type_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("service_types.id", ondelete="SET NULL"), nullable=True, index=True)
    department_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    account_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Location & Context
    room_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    room_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # e.g. 'Room 412', 'Room 305'
    guest_name: Mapped[str] = mapped_column(String(100), default="Hotel Guest")
    source: Mapped[str] = mapped_column(String(50), default="From HCRobot") # 'From HCRobot', 'Front Desk', 'Guest App'
    priority: Mapped[str] = mapped_column(String(20), default="NORMAL") # 'LOW', 'NORMAL', 'HIGH', 'URGENT'
    status: Mapped[str] = mapped_column(String(50), default="Pending") # 'Pending', 'In Progress', 'Completed', 'Cancelled'
    
    # Backward compatibility fields
    assigned_staff_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    assigned_robot_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    service_type: Mapped[Optional["ServiceType"]] = relationship("ServiceType", back_populates="support_requests")
    department: Mapped[Optional["Department"]] = relationship("Department")
    assigned_account: Mapped[Optional["Account"]] = relationship("Account")
    room: Mapped[Optional["Room"]] = relationship("Room", back_populates="support_requests")
