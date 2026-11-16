import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List, Dict, Any
from sqlalchemy import String, Integer, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.chat_session import ChatSession
    from app.models.robot import Robot
    from app.models.schedule import Schedule
    from app.models.workflow import RobotWorkflow


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"JOB-{uuid.uuid4().hex[:8].upper()}")
    job_code: Mapped[str] = mapped_column(String(30), unique=True, index=True) # e.g. 'JOB-20260929-001'
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    
    # Associated Entities
    workflow_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("robot_workflows.id", ondelete="SET NULL"), nullable=True, index=True)
    chat_session_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    robot_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("robots.id", ondelete="SET NULL"), nullable=True, index=True)
    schedule_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("schedules.id", ondelete="SET NULL"), nullable=True, index=True)
    account_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    
    trigger_type: Mapped[str] = mapped_column(String(50), default="MANUAL") # 'MANUAL', 'SCHEDULE', 'AUTO_DETECT', 'GUEST_TAP', 'VOICE'
    status: Mapped[str] = mapped_column(String(50), default="PENDING") # 'PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'
    
    current_step_index: Mapped[int] = mapped_column(Integer, default=0)
    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    robot: Mapped[Optional["Robot"]] = relationship("Robot", back_populates="jobs")
    workflow: Mapped[Optional["RobotWorkflow"]] = relationship("RobotWorkflow")
    chat_session: Mapped[Optional["ChatSession"]] = relationship("ChatSession")
    schedule: Mapped[Optional["Schedule"]] = relationship("Schedule", back_populates="jobs")
    account: Mapped[Optional["Account"]] = relationship("Account")
    job_steps: Mapped[List["JobStep"]] = relationship("JobStep", back_populates="job", cascade="all, delete-orphan", order_by="JobStep.step_index")
    job_events: Mapped[List["JobEvent"]] = relationship("JobEvent", back_populates="job", cascade="all, delete-orphan", order_by="JobEvent.id")


class JobStep(Base):
    __tablename__ = "job_steps"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"JS-{uuid.uuid4().hex[:8].upper()}")
    job_id: Mapped[str] = mapped_column(String(50), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    step_type: Mapped[str] = mapped_column(String(50), nullable=False) # 'MOVE', 'GREET', 'SPEAK', 'SHOW', 'LISTEN', 'RECOMMEND', 'CREATE_REQUEST', 'FEEDBACK'
    params: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(50), default="PENDING") # 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'
    
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    result_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="job_steps")


class JobEvent(Base):
    __tablename__ = "job_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(50), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True) # 'JOB_STARTED', 'WAYPOINT_REACHED', 'OBSTACLE_AVOIDED', 'TTS_FINISHED', 'STEP_COMPLETED', 'JOB_FAILED'
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="INFO") # 'INFO', 'WARNING', 'ERROR'
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="job_events")
