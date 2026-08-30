import enum
from sqlalchemy import Column, Integer, String, DateTime, Text, Index, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base

class LogLevelEnum(str, enum.Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class LogCategoryEnum(str, enum.Enum):
    AI_VOICE = "AI_VOICE"
    ROBOT = "ROBOT"
    DISPATCH = "DISPATCH"
    AUDIT = "AUDIT"
    SYSTEM = "SYSTEM"

class ActorTypeEnum(str, enum.Enum):
    ROBOT = "ROBOT"
    STAFF = "STAFF"
    ADMIN = "ADMIN"
    SYSTEM = "SYSTEM"
    AI = "AI"
    GUEST = "GUEST"

class LogEvent(Base):
    __tablename__ = "log_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    level = Column(SQLEnum(LogLevelEnum), default=LogLevelEnum.INFO, nullable=False, index=True)
    category = Column(SQLEnum(LogCategoryEnum), nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    module = Column(String(150), nullable=True, index=True)
    message = Column(Text, nullable=False)

    # Actor Information
    actor_type = Column(SQLEnum(ActorTypeEnum), default=ActorTypeEnum.SYSTEM, nullable=False, index=True)
    actor_id = Column(String(100), nullable=True, index=True)

    # Target & Scope Entities
    robot_id = Column(String(50), default="RC-001", nullable=True, index=True)
    staff_id = Column(Integer, nullable=True, index=True)
    guest_id = Column(String(100), nullable=True, index=True)
    service_request_id = Column(String(100), nullable=True, index=True)
    conversation_id = Column(String(100), nullable=True, index=True)

    # Tracing & Correlation
    correlation_id = Column(String(100), nullable=True, index=True)
    request_id = Column(String(100), nullable=True)
    trace_id = Column(String(100), nullable=True)

    # Module-specific Structured JSONB Data
    metadata_payload = Column(JSONB, default={}, nullable=True)

    # Network / Client Context
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_log_correlation_timestamp", "correlation_id", "timestamp"),
        Index("idx_log_category_timestamp", "category", "timestamp"),
        Index("idx_log_level_timestamp", "level", "timestamp"),
        Index("idx_log_robot_timestamp", "robot_id", "timestamp"),
        Index("idx_log_service_request_timestamp", "service_request_id", "timestamp"),
    )

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    actor_type = Column(SQLEnum(ActorTypeEnum), nullable=False, index=True)
    actor_id = Column(String(100), nullable=False, index=True)
    actor_name = Column(String(150), nullable=True)
    action = Column(String(100), nullable=False, index=True) # LOGIN, LOGOUT, CREATE, UPDATE, DELETE, CONFIG_CHANGED, KB_UPDATED
    resource_type = Column(String(100), nullable=False, index=True) # STAFF, KNOWLEDGE_DOCUMENT, SETTING, SERVICE_REQUEST
    resource_id = Column(String(100), nullable=True, index=True)
    
    before_state = Column(JSONB, nullable=True)
    after_state = Column(JSONB, nullable=True)
    
    correlation_id = Column(String(100), nullable=True, index=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_audit_resource_timestamp", "resource_type", "resource_id", "timestamp"),
        Index("idx_audit_actor_timestamp", "actor_id", "timestamp"),
    )
