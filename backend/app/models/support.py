import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, JSON, String, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.chat_session import ChatSession


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
    is_vip: Mapped[bool] = mapped_column(Boolean, default=False)
    chat_session_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    account_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Dual-track multilingual message history
    # Each item: { "id", "speaker", "speaker_name", "raw_transcript", "languages_detected": [...], "translations": { "vi", "en" }, "timestamp", "intent_payload" }
    messages: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)

    # Video Call & Cloudinary Recording fields
    recording_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recording_public_id: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    recording_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True) # Thời lượng (giây)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    call_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    call_ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    chat_session: Mapped[Optional["ChatSession"]] = relationship("ChatSession")
    assigned_account: Mapped[Optional["Account"]] = relationship("Account")
