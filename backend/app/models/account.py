import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"ACC-{uuid.uuid4().hex[:8].upper()}")
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, default=lambda: f"user_{uuid.uuid4().hex[:6]}")
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. 'MS', 'JD', 'ER', 'MV'
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="STAFF") # 'ADMIN', 'STAFF', 'MANAGER', 'GUEST'
    
    # Foreign key to Department
    department_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    department: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="General") # Compatibility label
    
    default_dashboard: Mapped[str] = mapped_column(String(50), default="room_service") # 'reception', 'room_service', 'housekeeping', 'bell_services', 'maintenance', 'admin_map'
    location: Mapped[str] = mapped_column(String(100), default="Main Hotel") # e.g. 'Floor 3', 'Lobby', 'Floor 5'
    status: Mapped[str] = mapped_column(String(50), default="available") # 'available', 'busy', 'off_shift'
    current_tasks_count: Mapped[int] = mapped_column(Integer, default=0)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="+84 90 123 4567")
    shift: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="Morning Shift (06:00 - 14:00)")
    is_fallback_agent: Mapped[bool] = mapped_column(Boolean, default=False)
    assigned_floors: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="Floor 1 - 5")
    notification_channels: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, default="Web Dashboard, Tablet Alert")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    department_rel: Mapped[Optional["Department"]] = relationship("Department", back_populates="accounts")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="account")

    @property
    def department_name(self) -> Optional[str]:
        if self.department_id:
            dept_map = {
                "DEP-HOUSEKEEPING": "Housekeeping",
                "DEP-BELL": "Bell Services",
                "DEP-TAXI": "Taxi & Transportation",
                "DEP-MAINTENANCE": "Maintenance & Engineering",
                "DEP-RECEPTION": "Front Desk & Reception",
                "DEP-CONCIERGE": "Concierge & Live Support",
                "DEP-FB": "Food & Beverage",
            }
            if self.department_id in dept_map:
                return dept_map[self.department_id]
        return self.department or "General"
    # TODO (Phase sau): Kích hoạt khi chạy migration thêm assigned_account_id/created_by_account_id vào management_directives trong DB
    # directives_assigned: Mapped[List["ManagementDirective"]] = relationship(
    #     "ManagementDirective", foreign_keys="ManagementDirective.assigned_account_id", back_populates="assigned_account"
    # )
    # directives_created: Mapped[List["ManagementDirective"]] = relationship(
    #     "ManagementDirective", foreign_keys="ManagementDirective.created_by_account_id", back_populates="created_by_account"
    # )
