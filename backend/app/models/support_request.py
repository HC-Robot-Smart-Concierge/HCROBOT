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
    room_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True) # e.g. 'Room 412', 'Lobby', or None
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

    # Backward Compatibility Properties for Legacy Dashboard Schemas
    @property
    def location(self) -> str:
        return self.room_number or "Main Hotel"

    @property
    def assigned_to(self) -> Optional[str]:
        return self.assigned_staff_name

    @property
    def time_label(self) -> str:
        return self.created_at.strftime("%I:%M %p") if self.created_at else "Just now"

    @property
    def reporter(self) -> Optional[str]:
        return self.source or "Staff / Guest"

    @property
    def request_type(self) -> str:
        if self.service_type_id:
            st = str(self.service_type_id).upper()
            if "BELL" in st:
                return "luggage"
            elif "HOUSEKEEPING" in st:
                return "cleaning"
            elif "TAXI" in st:
                return "taxi"
            elif "MAINTENANCE" in st:
                return "repair"
            elif "CONCIERGE" in st:
                return "concierge"
            elif "RECEPTION" in st:
                return "booking"
        return "general"

    @property
    def category(self) -> str:
        if self.service_type_id:
            st = str(self.service_type_id).upper()
            if "BELL" in st:
                return "Bell Services"
            elif "HOUSEKEEPING" in st:
                return "Housekeeping"
            elif "TAXI" in st:
                return "Taxi & Transportation"
            elif "MAINTENANCE" in st:
                return "Maintenance"
            elif "CONCIERGE" in st:
                return "Concierge & Live Support"
            elif "RECEPTION" in st:
                return "Front Desk & Reception"
        return "General"

    @property
    def reported_time_label(self) -> str:
        return self.time_label

    @property
    def created_label(self) -> str:
        return self.time_label

    @property
    def location_details(self) -> dict:
        return {"room": self.room_number or "Lobby", "floor": "Floor 1"}

    @property
    def guest_tier(self) -> str:
        return "Standard"

    @property
    def guest_stay_details(self) -> str:
        return f"Room {self.room_number or 'Lobby'}"

    @property
    def attached_media(self) -> list:
        return []

    @property
    def transcript(self) -> list:
        return []

    @property
    def assistance_status(self) -> str:
        return "Idle"

    @property
    def assigned_role(self) -> Optional[str]:
        return "Staff"

    @property
    def notes(self) -> list:
        return []

    @property
    def activity_log(self) -> list:
        return []

    @property
    def escalated(self) -> bool:
        return False
