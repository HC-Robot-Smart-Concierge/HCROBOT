from datetime import datetime
from sqlalchemy import Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Telemetry(Base):
    __tablename__ = "telemetries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    robot_id: Mapped[str] = mapped_column(String(50), ForeignKey("robots.id", ondelete="CASCADE"), nullable=False, index=True)
    battery_level: Mapped[int] = mapped_column(Integer, default=100)
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    yaw: Mapped[float] = mapped_column(Float, default=0.0)
    linear_velocity: Mapped[float] = mapped_column(Float, default=0.0)
    angular_velocity: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="IDLE")
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    robot: Mapped["Robot"] = relationship("Robot", back_populates="telemetries")
