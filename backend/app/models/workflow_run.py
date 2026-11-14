"""Durable physical workflow runs; nullable unique reservation serializes a robot."""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Integer, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    workflow_id: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(200))
    robot_id: Mapped[str] = mapped_column(String(50))
    active_robot_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    schedule_slot: Mapped[Optional[str]] = mapped_column(String(160), unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    events: Mapped[list] = mapped_column(JSON, default=list)
    current_step_index: Mapped[int] = mapped_column(Integer, default=0)
    completed_steps: Mapped[int] = mapped_column(Integer, default=0)
    round_index: Mapped[int] = mapped_column(Integer, default=0)
    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    heartbeat_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
