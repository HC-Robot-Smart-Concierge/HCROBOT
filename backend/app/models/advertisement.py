import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Advertisement(Base):
    __tablename__ = "advertisements"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"AD-{uuid.uuid4().hex[:6].upper()}")
    title: Mapped[str] = mapped_column(String(200), nullable=False) # e.g. "Tiệc Trà Chiều Hoàng Gia", "Khuyến mãi Spa 30%"
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    media_type: Mapped[str] = mapped_column(String(20), default="IMAGE") # 'IMAGE' hoặc 'VIDEO'
    media_url: Mapped[str] = mapped_column(String(500), nullable=False) # Cloudinary secure_url hoặc local static url
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True) # Cloudinary thumbnail
    public_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True) # Cloudinary public_id để xóa/quản lý
    storage_provider: Mapped[str] = mapped_column(String(50), default="cloudinary") # 'cloudinary' hoặc 'local'
    duration_seconds: Mapped[int] = mapped_column(Integer, default=10) # Thời gian hiển thị (giây)
    priority: Mapped[int] = mapped_column(Integer, default=1) # Độ ưu tiên hiển thị (1..10)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True) # Bật / Tắt quảng cáo
    display_location: Mapped[str] = mapped_column(String(50), default="ALL") # 'ALL', 'IDLE_STANDBY', 'WORKFLOW'

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
