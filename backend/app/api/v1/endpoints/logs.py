import io
import csv
import json
import datetime
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.logging import LogEvent, AuditLog
from app.services.logger_service import (
    query_logs_async,
    get_log_statistics_async,
    get_trace_by_correlation_id_async,
)

router = APIRouter(prefix="/logs")

def serialize_log(log: LogEvent) -> dict:
    return {
        "id": log.id,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "level": log.level.value if hasattr(log.level, "value") else str(log.level),
        "category": log.category.value if hasattr(log.category, "value") else str(log.category),
        "event_type": log.event_type,
        "module": log.module,
        "message": log.message,
        "actor_type": log.actor_type.value if hasattr(log.actor_type, "value") else str(log.actor_type),
        "actor_id": log.actor_id,
        "robot_id": log.robot_id,
        "staff_id": log.staff_id,
        "guest_id": log.guest_id,
        "service_request_id": log.service_request_id,
        "conversation_id": log.conversation_id,
        "correlation_id": log.correlation_id,
        "request_id": log.request_id,
        "trace_id": log.trace_id,
        "metadata": log.metadata_payload or {},
        "ip_address": log.ip_address,
        "user_agent": log.user_agent,
    }

def serialize_audit(audit: AuditLog) -> dict:
    return {
        "id": audit.id,
        "timestamp": audit.timestamp.isoformat() if audit.timestamp else None,
        "actor_type": audit.actor_type.value if hasattr(audit.actor_type, "value") else str(audit.actor_type),
        "actor_id": audit.actor_id,
        "actor_name": audit.actor_name,
        "action": audit.action,
        "resource_type": audit.resource_type,
        "resource_id": audit.resource_id,
        "before_state": audit.before_state,
        "after_state": audit.after_state,
        "correlation_id": audit.correlation_id,
        "ip_address": audit.ip_address,
    }

@router.get("")
async def get_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
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
    db: AsyncSession = Depends(get_db),
):
    """
    Query, filter, and paginate operational log events.
    """
    skip = (page - 1) * limit
    result = await query_logs_async(
        db=db,
        skip=skip,
        limit=limit,
        level=level,
        category=category,
        actor_type=actor_type,
        department=department,
        robot_id=robot_id,
        correlation_id=correlation_id,
        service_request_id=service_request_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )

    return {
        "status": "success",
        "total": result["total"],
        "page": page,
        "limit": limit,
        "total_pages": (result["total"] + limit - 1) // limit if result["total"] > 0 else 1,
        "items": [serialize_log(item) for item in result["items"]],
    }

@router.get("/statistics")
async def get_statistics(db: AsyncSession = Depends(get_db)):
    """
    Get aggregated KPIs for the Admin Logs dashboard.
    """
    stats = await get_log_statistics_async(db)
    return {
        "status": "success",
        "data": stats,
    }

@router.get("/trace/{correlation_id}")
async def get_trace(correlation_id: str, db: AsyncSession = Depends(get_db)):
    """
    Trace full lifecycle of a business transaction by its correlation_id.
    """
    logs = await get_trace_by_correlation_id_async(db, correlation_id)
    if not logs:
        raise HTTPException(status_code=404, detail=f"No logs found with correlation_id '{correlation_id}'")

    return {
        "status": "success",
        "correlation_id": correlation_id,
        "total_steps": len(logs),
        "timeline": [serialize_log(log) for log in logs],
    }

@router.get("/audit-logs")
async def get_audit_trail(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = None,
    actor_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Query dedicated security and configuration audit logs.
    """
    query = select(AuditLog)
    if action:
        query = query.where(AuditLog.action == action.upper())
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type.upper())

    count_res = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_res.scalar_one()

    paged_query = query.order_by(AuditLog.timestamp.desc()).offset((page - 1) * limit).limit(limit)
    items_res = await db.execute(paged_query)
    items = items_res.scalars().all()

    return {
        "status": "success",
        "total": total,
        "page": page,
        "limit": limit,
        "items": [serialize_audit(i) for i in items],
    }

@router.get("/export")
async def export_logs(
    format: str = Query("csv", pattern="^(csv|json)$"),
    level: Optional[str] = None,
    category: Optional[str] = None,
    actor_type: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Export filtered logs as CSV or JSON.
    """
    result = await query_logs_async(
        db=db,
        skip=0,
        limit=2000,
        level=level,
        category=category,
        actor_type=actor_type,
        department=department,
        search=search,
    )

    serialized = [serialize_log(item) for item in result["items"]]
    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    if format == "json":
        json_data = json.dumps(serialized, indent=2, ensure_ascii=False)
        return Response(
            content=json_data,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=hcrobot_logs_{timestamp_str}.json"},
        )
    else:
        # CSV Export
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Timestamp", "Level", "Category", "Event Type", "Module", "Actor Type", "Actor ID", "Robot ID", "Correlation ID", "Message"
        ])
        for row in serialized:
            writer.writerow([
                row["timestamp"],
                row["level"],
                row["category"],
                row["event_type"],
                row["module"],
                row["actor_type"],
                row["actor_id"],
                row["robot_id"],
                row["correlation_id"] or "",
                row["message"],
            ])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=hcrobot_logs_{timestamp_str}.csv"},
        )
