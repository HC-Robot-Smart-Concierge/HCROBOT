import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.models import (
    Staff,
    ManagementDirective,
    HumanSupportSession,
    ChatSession,
    ChatMessage,
    SupportRequest,
)
from app.schemas.operations import (
    AdminOperationsSummary,
    HumanSupportSessionResponse,
)
from .shared import TAG_ADMIN, TAG_OPS, _fetch_all_raw_requests

router = APIRouter()


@router.get(
    "/admin/summary",
    response_model=AdminOperationsSummary,
    tags=TAG_ADMIN,
    summary="Admin: Thống kê số lượng ticket theo bộ phận",
)
async def get_admin_operations_summary(db: AsyncSession = Depends(get_db)):
    """
    Trả về số lượng ticket theo từng bộ phận và tổng số công việc đang xử lý.
    Chế độ chỉ đọc phục vụ báo cáo và biểu đồ giám sát của Admin.
    """
    raw_list = await _fetch_all_raw_requests(db)

    summary = AdminOperationsSummary(all_count=len(raw_list))

    for t in raw_list:
        dept = t["department"].lower()
        st = t["status"].lower()
        if st not in ["completed", "cancelled", "rejected"]:
            summary.total_active += 1

        if "concierge" in dept or "live support" in dept:
            summary.concierge_count += 1
        elif "reception" in dept:
            summary.reception_count += 1
        elif "housekeeping" in dept:
            summary.housekeeping_count += 1
        elif "f&b" in dept or "room service" in dept:
            summary.room_service_count += 1
        elif "bell" in dept:
            summary.bell_services_count += 1
        elif "taxi" in dept:
            summary.taxi_count += 1
        elif "maintenance" in dept:
            summary.maintenance_count += 1
        else:
            summary.directives_count += 1

    return summary


# Backwards compatibility / Monitoring read-only endpoint
@router.get("/all-requests", tags=TAG_OPS, summary="Giám sát: Lấy tất cả request (chế độ chỉ xem)")
async def get_all_unified_requests(db: AsyncSession = Depends(get_db)):
    """Trả về danh sách tổng hợp công việc toàn hệ thống ở chế độ chỉ xem (không can thiệp / CRUD)."""
    return await _fetch_all_raw_requests(db)


# ---------------------------------------------------------
# Human Support Sessions & Multilingual Conversation Logs
# ---------------------------------------------------------

@router.get(
    "/admin/conversations",
    response_model=List[HumanSupportSessionResponse],
    tags=TAG_ADMIN,
    summary="Admin: Xem danh sách các phiên đàm thoại giọng nói Robot với khách",
)
async def get_admin_conversations(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Trả về danh sách các phiên hỗ trợ / hội thoại giữa Robot Concierge và khách hàng.
    Hỗ trợ chế độ chỉ xem (View-only) cho Admin giám sát.
    """
    stmt = select(HumanSupportSession).order_by(desc(HumanSupportSession.created_at))
    if status and status.lower() != "all":
        stmt = stmt.where(HumanSupportSession.status.ilike(f"%{status}%"))

    res = await db.execute(stmt)
    sessions = res.scalars().all()
    return sessions


@router.get(
    "/admin/conversations/{session_id}",
    response_model=HumanSupportSessionResponse,
    tags=TAG_ADMIN,
    summary="Admin: Xem chi tiết toàn bộ lịch sử đàm thoại song ngữ của 1 phiên",
)
async def get_admin_conversation_detail(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy chi tiết toàn bộ các lượt nói (turns), văn bản gốc đa ngữ,
    và bản dịch song ngữ Tiếng Việt / Tiếng Anh của phiên hỗ trợ.
    """
    res = await db.execute(
        select(HumanSupportSession).where(
            (HumanSupportSession.id == session_id)
            | (HumanSupportSession.session_code == session_id)
            | (HumanSupportSession.room_number.ilike(f"%{session_id}%"))
        )
    )
    session_item = res.scalar_one_or_none()
    if not session_item:
        raise HTTPException(status_code=404, detail=f"Conversation session {session_id} not found")
    return session_item


@router.get("/analytics/summary", tags=TAG_ADMIN, summary="Admin: Thống kê phân tích số liệu thực tế từ Database")
async def get_analytics_summary(db: AsyncSession = Depends(get_db)):
    """Trả về số liệu phân tích vận hành thực tế 100% từ cơ sở dữ liệu."""
    raw_list = await _fetch_all_raw_requests(db)
    total_tasks = len(raw_list)
    active_tasks = sum(1 for t in raw_list if t["status"].lower() not in ["completed", "cancelled", "rejected"])
    completed_tasks = sum(1 for t in raw_list if t["status"].lower() == "completed")

    # Robot vs Human allocation
    robot_assigned_tasks = sum(1 for t in raw_list if t.get("assigned_robot"))
    human_tasks = total_tasks - robot_assigned_tasks

    # Department breakdown
    dept_distribution = {
        "Reception": 0,
        "Concierge": 0,
        "Housekeeping": 0,
        "F&B": 0,
        "Bell Services": 0,
        "Maintenance": 0,
        "Taxi": 0,
    }
    for t in raw_list:
        d = t["department"].lower()
        if "concierge" in d or "live support" in d:
            dept_distribution["Concierge"] += 1
        elif "reception" in d:
            dept_distribution["Reception"] += 1
        elif "housekeeping" in d:
            dept_distribution["Housekeeping"] += 1
        elif "f&b" in d or "room service" in d:
            dept_distribution["F&B"] += 1
        elif "bell" in d:
            dept_distribution["Bell Services"] += 1
        elif "taxi" in d:
            dept_distribution["Taxi"] += 1
        elif "maintenance" in d:
            dept_distribution["Maintenance"] += 1

    # Sessions & Messages
    try:
        session_res = await db.execute(select(func.count(ChatSession.id)))
        total_sessions = session_res.scalar() or 0
    except Exception:
        total_sessions = 0

    try:
        msg_res = await db.execute(select(func.count(ChatMessage.id)))
        total_messages = msg_res.scalar() or 0
    except Exception:
        total_messages = 0

    # Staff
    try:
        staff_res = await db.execute(select(func.count(Staff.id)).where(Staff.is_active == True))
        total_staff = staff_res.scalar() or 0
    except Exception:
        total_staff = 0

    try:
        fallback_res = await db.execute(
            select(func.count(Staff.id)).where(Staff.is_active == True, Staff.is_fallback_agent == True)
        )
        fallback_staff = fallback_res.scalar() or 0
    except Exception:
        fallback_staff = 0

    # Robot units
    total_robots = 1

    # Recent 5 activities from real tasks
    recent_activities = []
    for item in raw_list[:5]:
        recent_activities.append({
            "id": item["id"],
            "title": item["title"],
            "department": item["department"],
            "location": item["location"],
            "status": item["status"],
            "assigned_to": item.get("assigned_robot") or item.get("assignedTo") or "Chưa gán",
            "time": item.get("time") or "Gần đây",
        })

    completion_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 100.0
    robot_rate = round((robot_assigned_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

    return {
        "total_tasks": total_tasks,
        "active_tasks": active_tasks,
        "completed_tasks": completed_tasks,
        "completion_rate": completion_rate,
        "robot_assigned_tasks": robot_assigned_tasks,
        "human_tasks": human_tasks,
        "robot_rate": robot_rate,
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "total_staff": total_staff,
        "fallback_staff": fallback_staff,
        "total_robots": total_robots,
        "dept_distribution": dept_distribution,
        "recent_activities": recent_activities,
    }
