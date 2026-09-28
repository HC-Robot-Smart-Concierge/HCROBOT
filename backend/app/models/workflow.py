import uuid
from datetime import datetime
from typing import Optional, List, Any
from sqlalchemy import String, Float, DateTime, Boolean, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


# Backward compatibility aliases
from app.models.map import Endpoint as RobotWaypoint, Zone as RobotZone


class RobotWorkflow(Base):
    __tablename__ = "robot_workflows"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"wf-{uuid.uuid4().hex[:8]}")
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    trigger_type: Mapped[str] = mapped_column(String(50), default="MANUAL")  # 'AUTO_DETECT', 'MANUAL', 'SCHEDULE', 'GUEST_TAP'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    steps: Mapped[List[Any]] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


