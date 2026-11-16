import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MaintenanceCatalogItem(Base):
    """
    Template danh mục sự cố kỹ thuật & bảo trì (Maintenance Issue Catalog).
    Cho phép nhân viên Kỹ thuật thêm, sửa, xóa, bật/tắt phục vụ hiển thị trên Robot Kiosk & Mobile.
    Song ngữ Anh - Việt, không cần hình ảnh.
    """
    __tablename__ = "maintenance_catalog_items"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"MNT-{uuid.uuid4().hex[:6].upper()}")
    name_vi: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    name_en: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), default="hvac", index=True)
    priority: Mapped[str] = mapped_column(String(20), default="NORMAL")
    description_vi: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description_en: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estimated_fix_time: Mapped[int] = mapped_column(Integer, default=15)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

