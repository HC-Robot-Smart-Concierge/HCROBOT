import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List
from sqlalchemy import String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.job import Job
    from app.models.workflow import RobotWorkflow


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"SCH-{uuid.uuid4().hex[:8].upper()}")
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    workflow_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("robot_workflows.id", ondelete="SET NULL"), nullable=True, index=True)
    account_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    
    cron_expression: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # e.g. "0 9 * * *"
    scheduled_time: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # e.g. "09:00"
    repeat_days: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # e.g. "MON,TUE,WED,THU,FRI"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    workflow: Mapped[Optional["RobotWorkflow"]] = relationship("RobotWorkflow")
    account: Mapped[Optional["Account"]] = relationship("Account")
    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="schedule")
