import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReceptionRequest(Base):
    __tablename__ = "reception_requests"

    id: Mapped[str] = mapped_column(
        String(50), primary_key=True, default=lambda: f"REC-{uuid.uuid4().hex[:8]}"
    )
    ticket_code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    created_label: Mapped[str] = mapped_column(String(50), default="Created just now")
    location: Mapped[str] = mapped_column(String(150), default="Main Lobby")
    location_details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    guest_name: Mapped[str] = mapped_column(String(120), default="Hotel Guest")
    guest_tier: Mapped[str] = mapped_column(String(30), default="Standard")
    guest_stay_details: Mapped[str] = mapped_column(String(250), default="Current stay")

    priority: Mapped[str] = mapped_column(String(30), default="High")
    status: Mapped[str] = mapped_column(String(50), default="Pending Action")
    description: Mapped[str] = mapped_column(String(2000), default="")
    attached_media: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    transcript: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    assistance_status: Mapped[str] = mapped_column(String(50), default="Connected")
    assigned_to: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    assigned_role: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    notes: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    activity_log: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    escalated: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
