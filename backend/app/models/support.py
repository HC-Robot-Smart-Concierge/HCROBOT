import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class HumanSupportSession(Base):
    __tablename__ = "human_support_sessions"

    id: Mapped[str] = mapped_column(
        String(50), primary_key=True, default=lambda: f"SUP-{uuid.uuid4().hex[:8]}"
    )
    session_code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    room_number: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. 'Room 302', 'Room 402'
    guest_name: Mapped[str] = mapped_column(String(100), default="Hotel Guest")
    
    category: Mapped[str] = mapped_column(String(50), default="Escort Request") # 'Escort Request', 'Maintenance', 'Housekeeping', 'Luggage Assist'
    origin_robot_code: Mapped[str] = mapped_column(String(50), default="RC-001 (Main Lobby)")
    sentiment: Mapped[str] = mapped_column(String(50), default="Neutral") # 'Impatient', 'Neutral', 'Positive', 'Frustrated'
    wait_time_label: Mapped[str] = mapped_column(String(30), default="02m 14s")
    status: Mapped[str] = mapped_column(String(50), default="Active") # 'Active', 'Resolved', 'Queued'
    linked_request_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # e.g. 'REQ-1042'
    
    # Dual-track multilingual message history
    # Each item: { "id", "speaker", "speaker_name", "raw_transcript", "languages_detected": [...], "translations": { "vi", "en" }, "timestamp", "intent_payload" }
    messages: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
