import datetime
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class ChatSession(Base):
    """
    Model lưu trữ phiên hội thoại của khách hàng với Robot Concierge trong PostgreSQL Database.
    """
    __tablename__ = "chat_sessions"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    room_number = Column(String(20), nullable=True, index=True)
    guest_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.id")


class ChatMessage(Base):
    """
    Model lưu trữ từng tin nhắn (lượt nói user/assistant) trong một phiên hội thoại.
    """
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String(20), nullable=False)  # 'user' hoặc 'assistant'
    text = Column(Text, nullable=False)
    language = Column(String(20), default="vi-VN")
    intent_action = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")
