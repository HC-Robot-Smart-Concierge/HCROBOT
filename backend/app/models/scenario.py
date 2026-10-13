import uuid
from datetime import datetime
from typing import Optional, List, Any
from sqlalchemy import String, Integer, DateTime, Boolean, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DialogueScenario(Base):
    """
    Mo hinh kich ban hoi thoai dong danh cho Concierge Robot.
    Cho phep Admin cau hinh san cac tinh huong hoi dap, loi chao, thong tin tien ich
    va hanh dong tuong ung (Fast-Path, Video Call, Hien ban do, v.v.).
    """
    __tablename__ = "dialogue_scenarios"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"scn-{uuid.uuid4().hex[:8]}")
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="faq")  # 'faq', 'greeting', 'facility', 'service', 'chitchat'
    match_keywords: Mapped[List[str]] = mapped_column(JSON, default=list)
    match_type: Mapped[str] = mapped_column(String(20), default="keyword")  # 'keyword', 'exact', 'regex'
    response_vi: Mapped[str] = mapped_column(Text, nullable=False)
    response_en: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    action_type: Mapped[str] = mapped_column(String(50), default="none")  # 'none', 'trigger_video_call', 'show_map', 'open_menu'
    action_payload: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    is_fast_path: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
