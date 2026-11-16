import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional, List
from sqlalchemy import String, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.job import Job


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Robot(Base):
    __tablename__ = "robots"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"RC-{uuid.uuid4().hex[:6].upper()}")
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)  # e.g. 'RC-001'
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="HCRobot Concierge")
    model_type: Mapped[str] = mapped_column(String(50), default="Differential Drive Concierge")
    serial_number: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, default="SN-HCR-2026-001")
    firmware_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="v2.4.0-ros2")
    status: Mapped[str] = mapped_column(String(50), default="IDLE")  # 'IDLE', 'NAVIGATING', 'INTERACTING', 'CHARGING', 'MAINTENANCE', 'ERROR', 'OFFLINE'
    battery_level: Mapped[int] = mapped_column(Integer, default=100)  # 0 - 100%
    current_location: Mapped[str] = mapped_column(String(100), default="Main Lobby")
    is_online: Mapped[bool] = mapped_column(Boolean, default=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_heartbeat: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, onupdate=_utc_now_naive)

    # Relationships
    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="robot")
    maintenance_schedules: Mapped[List["RobotMaintenanceSchedule"]] = relationship(
        "RobotMaintenanceSchedule",
        back_populates="robot",
        cascade="all, delete-orphan",
        order_by="RobotMaintenanceSchedule.scheduled_date.asc()",
    )


class RobotMaintenanceSchedule(Base):
    """Lịch bảo trì và kiểm tra định kỳ phần cứng/phần mềm của Robot."""
    __tablename__ = "robot_maintenance_schedules"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"RMS-{uuid.uuid4().hex[:8].upper()}")
    robot_id: Mapped[str] = mapped_column(String(50), ForeignKey("robots.id", ondelete="CASCADE"), default="RC-001", index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    maintenance_type: Mapped[str] = mapped_column(String(50), default="preventive")  # preventive, inspection, calibration, repair
    component: Mapped[str] = mapped_column(String(50), default="general")  # lidar, battery, motors, camera, chassis, software, general
    priority: Mapped[str] = mapped_column(String(20), default="Normal")  # Low, Normal, High, Urgent
    status: Mapped[str] = mapped_column(String(30), default="Scheduled", index=True)  # Scheduled, In Progress, Completed, Overdue, Cancelled
    scheduled_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    completed_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    interval_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    assigned_technician: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, onupdate=_utc_now_naive)

    # Relationships
    robot: Mapped["Robot"] = relationship("Robot", back_populates="maintenance_schedules")

