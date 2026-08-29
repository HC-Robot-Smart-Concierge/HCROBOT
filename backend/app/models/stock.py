import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InventoryStock(Base):
    __tablename__ = "inventory_stocks"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"STK-{uuid.uuid4().hex[:8]}")
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True) # 'Artisan Cola', 'Sparkling Water (L)'
    category: Mapped[str] = mapped_column(String(50), default="beverage") # 'beverage', 'condiment', 'toiletries'
    count_label: Mapped[str] = mapped_column(String(50), default="6 left") # '6 left', '1 btl'
    quantity: Mapped[int] = mapped_column(Integer, default=10)
    level: Mapped[str] = mapped_column(String(20), default="danger") # 'danger', 'warning', 'normal'
    
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
