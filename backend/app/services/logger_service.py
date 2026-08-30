import logging
import datetime
import random
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_

from app.core.database import AsyncSessionLocal
from app.models.logging import LogEvent, AuditLog, LogLevelEnum, LogCategoryEnum, ActorTypeEnum

# Standard Python logger for fallback
std_logger = logging.getLogger("hcrobot.logger_service")

# In-memory listeners for live WebSocket log streaming (if any)
_active_log_listeners = []

def register_log_listener(callback):
    """Register a callback for realtime log broadcasting."""
    if callback not in _active_log_listeners:
        _active_log_listeners.append(callback)

def unregister_log_listener(callback):
    """Unregister a realtime log callback."""
    if callback in _active_log_listeners:
        _active_log_listeners.remove(callback)

def generate_correlation_id(prefix: str = "SR") -> str:
    """
    Generates a human-traceable correlation ID.
    Example: SR-20260830-4821 or AUTH-20260830-1092
    """
    today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d")
    rand_suffix = f"{random.randint(1000, 9999)}"
    return f"{prefix}-{today_str}-{rand_suffix}"

def log_event(
    level: str | LogLevelEnum = LogLevelEnum.INFO,
    category: str | LogCategoryEnum = LogCategoryEnum.SYSTEM,
    event_type: str = "SYSTEM_EVENT",
    module: str = "app",
    message: str = "",
    actor_type: str | ActorTypeEnum = ActorTypeEnum.SYSTEM,
    actor_id: Optional[str] = None,
    robot_id: str = "RC-001",
    staff_id: Optional[int] = None,
    guest_id: Optional[str] = None,
    service_request_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    request_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    db: Optional[AsyncSession] = None,
):
    """
    Core structured log recording method.
    Non-blocking / Safe Exception Isolation: Never crashes business transactions if logging fails.
    """
    # Sanitize enums
    if isinstance(level, str):
        try:
            level = LogLevelEnum(level.upper())
        except ValueError:
            level = LogLevelEnum.INFO

    if isinstance(category, str):
        try:
            category = LogCategoryEnum(category.upper())
        except ValueError:
            category = LogCategoryEnum.SYSTEM

    if isinstance(actor_type, str):
        try:
            actor_type = ActorTypeEnum(actor_type.upper())
        except ValueError:
            actor_type = ActorTypeEnum.SYSTEM

    log_entry = LogEvent(
        timestamp=datetime.datetime.now(datetime.timezone.utc),
        level=level,
        category=category,
        event_type=event_type,
        module=module,
        message=message,
        actor_type=actor_type,
        actor_id=str(actor_id) if actor_id is not None else None,
        robot_id=robot_id or "RC-001",
        staff_id=staff_id,
        guest_id=guest_id,
        service_request_id=str(service_request_id) if service_request_id is not None else None,
        conversation_id=conversation_id,
        correlation_id=correlation_id,
        request_id=request_id,
        trace_id=trace_id,
        metadata_payload=metadata or {},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    # Broadcast in-memory
    for listener in _active_log_listeners:
        try:
            listener(log_entry)
        except Exception:
            pass

    # If active session provided, add directly
    if db is not None:
        try:
            db.add(log_entry)
        except Exception as e:
            std_logger.error(f"[LOG_ERROR] Could not add log event: {e}")
    else:
        # Standalone insert
        import asyncio
        async def _save_async():
            try:
                async with AsyncSessionLocal() as session:
                    session.add(log_entry)
                    await session.commit()
            except Exception as err:
                std_logger.error(f"[LOG_ASYNC_ERROR] Failed saving log: {err}")

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(_save_async())
            else:
                loop.run_until_complete(_save_async())
        except Exception:
            pass

    return log_entry

def audit(
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    actor_type: str | ActorTypeEnum = ActorTypeEnum.ADMIN,
    actor_id: str = "admin",
    actor_name: Optional[str] = None,
    before_state: Optional[Dict[str, Any]] = None,
    after_state: Optional[Dict[str, Any]] = None,
    correlation_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    db: Optional[AsyncSession] = None,
):
    """
    Dedicated method for security, authentication, configuration, and data modification audit trail.
    """
    if isinstance(actor_type, str):
        try:
            actor_type = ActorTypeEnum(actor_type.upper())
        except ValueError:
            actor_type = ActorTypeEnum.ADMIN

    audit_entry = AuditLog(
        timestamp=datetime.datetime.now(datetime.timezone.utc),
        actor_type=actor_type,
        actor_id=str(actor_id),
        actor_name=actor_name,
        action=action.upper(),
        resource_type=resource_type.upper(),
        resource_id=str(resource_id) if resource_id is not None else None,
        before_state=before_state,
        after_state=after_state,
        correlation_id=correlation_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    if db is not None:
        try:
            db.add(audit_entry)
        except Exception as e:
            std_logger.error(f"[AUDIT_ERROR] Could not add audit entry: {e}")
    else:
        import asyncio
        async def _save_audit_async():
            try:
                async with AsyncSessionLocal() as session:
                    session.add(audit_entry)
                    await session.commit()
            except Exception as err:
                std_logger.error(f"[AUDIT_ASYNC_ERROR] Failed saving audit: {err}")

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(_save_audit_async())
            else:
                loop.run_until_complete(_save_audit_async())
        except Exception:
            pass

    # Also log operational log
    log_event(
        level=LogLevelEnum.INFO,
        category=LogCategoryEnum.AUDIT,
        event_type=f"AUDIT_{action.upper()}",
        module="app.core.audit",
        message=f"[{actor_type.value}] {actor_id} performed {action.upper()} on {resource_type.upper()}:{resource_id or 'N/A'}",
        actor_type=actor_type,
        actor_id=str(actor_id),
        correlation_id=correlation_id,
        metadata={"resource_type": resource_type, "action": action},
        ip_address=ip_address,
        user_agent=user_agent,
        db=db,
    )

    return audit_entry

async def query_logs_async(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    level: Optional[str] = None,
    category: Optional[str] = None,
    actor_type: Optional[str] = None,
    department: Optional[str] = None,
    robot_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    service_request_id: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime.datetime] = None,
    date_to: Optional[datetime.datetime] = None,
) -> Dict[str, Any]:
    """
    Search and paginate log events using AsyncSession.
    """
    query = select(LogEvent)

    if level and level.upper() != "ALL":
        try:
            query = query.where(LogEvent.level == LogLevelEnum(level.upper()))
        except ValueError:
            pass

    if category and category.upper() != "ALL":
        try:
            query = query.where(LogEvent.category == LogCategoryEnum(category.upper()))
        except ValueError:
            pass

    if actor_type and actor_type.upper() != "ALL":
        try:
            query = query.where(LogEvent.actor_type == ActorTypeEnum(actor_type.upper()))
        except ValueError:
            pass

    if robot_id and robot_id.upper() != "ALL":
        query = query.where(LogEvent.robot_id == robot_id)

    if correlation_id:
        query = query.where(LogEvent.correlation_id == correlation_id)

    if service_request_id:
        query = query.where(LogEvent.service_request_id == service_request_id)

    if date_from:
        query = query.where(LogEvent.timestamp >= date_from)

    if date_to:
        query = query.where(LogEvent.timestamp <= date_to)

    if department and department.upper() != "ALL":
        dept_term = f"%{department}%"
        query = query.where(
            or_(
                LogEvent.module.ilike(dept_term),
                LogEvent.message.ilike(dept_term),
                LogEvent.event_type.ilike(dept_term),
            )
        )

    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                LogEvent.message.ilike(search_term),
                LogEvent.event_type.ilike(search_term),
                LogEvent.module.ilike(search_term),
                LogEvent.correlation_id.ilike(search_term),
                LogEvent.actor_id.ilike(search_term),
                LogEvent.service_request_id.ilike(search_term),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    count_res = await db.execute(count_query)
    total = count_res.scalar_one()

    # Paginate
    paged_query = query.order_by(desc(LogEvent.timestamp)).offset(skip).limit(limit)
    items_res = await db.execute(paged_query)
    items = items_res.scalars().all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": items,
    }

async def get_log_statistics_async(db: AsyncSession) -> Dict[str, Any]:
    """
    Returns aggregated KPIs using AsyncSession.
    """
    total = (await db.execute(select(func.count(LogEvent.id)))).scalar_one() or 0
    errors = (await db.execute(select(func.count(LogEvent.id)).where(LogEvent.level == LogLevelEnum.ERROR))).scalar_one() or 0
    critical = (await db.execute(select(func.count(LogEvent.id)).where(LogEvent.level == LogLevelEnum.CRITICAL))).scalar_one() or 0
    warnings = (await db.execute(select(func.count(LogEvent.id)).where(LogEvent.level == LogLevelEnum.WARNING))).scalar_one() or 0
    ai_requests = (await db.execute(select(func.count(LogEvent.id)).where(LogEvent.category == LogCategoryEnum.AI_VOICE))).scalar_one() or 0
    robot_events = (await db.execute(select(func.count(LogEvent.id)).where(LogEvent.category == LogCategoryEnum.ROBOT))).scalar_one() or 0
    dispatch_events = (await db.execute(select(func.count(LogEvent.id)).where(LogEvent.category == LogCategoryEnum.DISPATCH))).scalar_one() or 0

    return {
        "total": total,
        "errors": errors,
        "critical": critical,
        "warnings": warnings,
        "ai_requests": ai_requests,
        "robot_events": robot_events,
        "dispatch_events": dispatch_events,
    }

async def get_trace_by_correlation_id_async(db: AsyncSession, correlation_id: str) -> List[LogEvent]:
    """
    Retrieves chronological lifecycle chain for a specific correlation ID.
    """
    res = await db.execute(
        select(LogEvent)
        .where(LogEvent.correlation_id == correlation_id)
        .order_by(LogEvent.timestamp.asc())
    )
    return res.scalars().all()
