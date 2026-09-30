import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.chat_session import ChatSession


class Feedback(Base):
    __tablename__ = "feedbacks"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"FB-{uuid.uuid4().hex[:8].upper()}")
    chat_session_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    account_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    
    rating: Mapped[int] = mapped_column(Integer, default=5) # 1 - 5 stars
    category: Mapped[str] = mapped_column(String(50), default="Service") # 'Service', 'Robot', 'Cleanliness', 'F&B'
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    guest_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    room_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    chat_session: Mapped[Optional["ChatSession"]] = relationship("ChatSession", back_populates="feedbacks")
    account: Mapped[Optional["Account"]] = relationship("Account")
