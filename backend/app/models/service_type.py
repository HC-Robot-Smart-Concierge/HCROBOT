import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ServiceType(Base):
    __tablename__ = "service_types"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"ST-{uuid.uuid4().hex[:8].upper()}")
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True) # e.g. 'TOWEL', 'ROOM_CLEAN', 'LUGGAGE_PICKUP', 'AC_REPAIR'
    name: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. 'Giao thêm khăn/nước', 'Dọn phòng', 'Vận chuyển hành lý'
    department_id: Mapped[str] = mapped_column(String(50), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_priority: Mapped[str] = mapped_column(String(20), default="NORMAL") # 'LOW', 'NORMAL', 'HIGH', 'URGENT'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    department: Mapped["Department"] = relationship("Department", back_populates="service_types")
    support_requests: Mapped[List["SupportRequest"]] = relationship("SupportRequest", back_populates="service_type")

    @property
    def department_name(self) -> Optional[str]:
        return self.department.name if self.department else None
