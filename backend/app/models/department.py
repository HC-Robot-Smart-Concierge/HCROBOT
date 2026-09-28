import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"DEP-{uuid.uuid4().hex[:8].upper()}")
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True) # e.g. 'RECEPTION', 'HOUSEKEEPING', 'MAINTENANCE', 'BELL', 'FB', 'EXECUTIVE'
    name: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. 'Front Desk & Reception', 'Housekeeping', 'Maintenance & Engineering'
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    accounts: Mapped[List["Account"]] = relationship("Account", back_populates="department_rel", cascade="all, delete-orphan")
    service_types: Mapped[List["ServiceType"]] = relationship("ServiceType", back_populates="department", cascade="all, delete-orphan")
