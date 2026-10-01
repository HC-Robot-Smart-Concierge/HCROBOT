import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.department import Department
    from app.models.hotel import Room
    from app.models.service_type import ServiceType


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

    def __init__(self, **kwargs):
        # Normalize legacy field aliases
        aliases = {"location": "room_number", "assigned_to": "assigned_staff_name", "reporter": "guest_name"}
        for old_k, new_k in aliases.items():
            if old_k in kwargs:
                val = kwargs.pop(old_k)
                if new_k not in kwargs:
                    kwargs[new_k] = val

        if "category" in kwargs:
            self._category = kwargs.pop("category")
        if "request_type" in kwargs:
            self._request_type = kwargs.pop("request_type")

        # Strip presentation/client-only labels
        for k in (
            "time_label", "reported_time_label", "created_label",
            "location_details", "guest_tier", "guest_stay_details",
            "attached_media", "transcript", "assistance_status", "assigned_role",
            "notes", "activity_log", "escalated"
        ):
            kwargs.pop(k, None)

        super().__init__(**kwargs)

    # -------------------------------------------------------------
    # Compatibility properties for Swagger UI & API Responses
    # -------------------------------------------------------------
    @property
    def location(self) -> str:
        return self.room_number or "Main Hotel"

    @location.setter
    def location(self, val: str):
        self.room_number = val

    @property
    def assigned_to(self) -> Optional[str]:
        return self.assigned_staff_name

    @assigned_to.setter
    def assigned_to(self, val: Optional[str]):
        self.assigned_staff_name = val

    @property
    def reporter(self) -> Optional[str]:
        return self.guest_name or self.source or "Staff / Guest"

    @reporter.setter
    def reporter(self, val: Optional[str]):
        self.guest_name = val

    @property
    def time_label(self) -> str:
        return self.created_at.strftime("%I:%M %p").lstrip("0") if self.created_at else "Just now"

    @property
    def request_type(self) -> str:
        if getattr(self, "_request_type", None):
            return self._request_type
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

    @request_type.setter
    def request_type(self, val: str):
        self._request_type = val

    @property
    def category(self) -> str:
        if getattr(self, "_category", None):
            return self._category
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

    @category.setter
    def category(self, val: str):
        self._category = val

    @property
    def reported_time_label(self) -> str:
        return self.time_label

    @property
    def created_label(self) -> str:
        return self.time_label

    @property
    def location_details(self) -> dict:
        return {"floor": "Floor 3", "room": self.room_number or "Lobby"}

    # Mock presentation properties
    @property
    def guest_tier(self) -> str: return "Standard Guest"
    @property
    def guest_stay_details(self) -> str: return f"Phòng {self.room_number or 'Lobby'}"
    @property
    def attached_media(self) -> list: return []
    @property
    def transcript(self) -> list: return []
    @property
    def assistance_status(self) -> str: return "Connected" if self.status == "In Progress" else "Pending"
    @property
    def assigned_role(self) -> str: return "Staff"
    @property
    def notes(self) -> list: return []
    @property
    def activity_log(self) -> list: return []
    @property
    def escalated(self) -> bool: return self.priority in ["HIGH", "URGENT"]
