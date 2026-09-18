import uuid
from datetime import datetime
from typing import Optional, List, Any
from sqlalchemy import String, Float, DateTime, Boolean, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RobotWaypoint(Base):
    __tablename__ = "robot_waypoints"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"wp-{uuid.uuid4().hex[:8]}")
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    floor: Mapped[str] = mapped_column(String(50), default="Tầng 1")
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    yaw: Mapped[float] = mapped_column(Float, default=0.0)
    type: Mapped[str] = mapped_column(String(50), default="standby")  # 'dock', 'service', 'standby', 'room', 'elevator'
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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


class RobotZone(Base):
    __tablename__ = "robot_zones"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"zone-{uuid.uuid4().hex[:8]}")
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="KEEP_OUT")  # 'KEEP_OUT', 'SLOW_SPEED', 'SILENT_ZONE', 'GREETING_ZONE', 'SERVICE_PRIORITY'
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    width: Mapped[float] = mapped_column(Float, default=2.0)
    height: Mapped[float] = mapped_column(Float, default=2.0)
    speed_limit: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0.3)
    floor: Mapped[str] = mapped_column(String(50), default="Sảnh Tầng 1")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

