from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import ChatMessage, ChatSession
from app.repositories import (
    StaffRepository,
    SupportSessionRepository,
    get_staff_repository,
    get_support_session_repository,
)
from app.schemas.operations import HumanSupportSessionResponse
from .shared import TAG_ADMIN, _fetch_all_raw_requests

router = APIRouter()


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
    session_repo: SupportSessionRepository = Depends(get_support_session_repository),
):
    """
    Trả về danh sách các phiên hỗ trợ / hội thoại giữa Robot Concierge và khách hàng.
    Hỗ trợ chế độ chỉ xem (View-only) cho Admin giám sát.
    """
    return await session_repo.list_sessions(status=status)


@router.get(
    "/admin/conversations/{session_id}",
    response_model=HumanSupportSessionResponse,
    tags=TAG_ADMIN,
    summary="Admin: Xem chi tiết toàn bộ lịch sử đàm thoại song ngữ của 1 phiên",
)
async def get_admin_conversation_detail(
    session_id: str,
    session_repo: SupportSessionRepository = Depends(get_support_session_repository),
):
    """
    Lấy chi tiết toàn bộ các lượt nói (turns), văn bản gốc đa ngữ,
    và bản dịch song ngữ Tiếng Việt / Tiếng Anh của phiên hỗ trợ.
    """
    session_item = await session_repo.get_by_id_or_code(session_id)
    if not session_item:
        raise HTTPException(status_code=404, detail=f"Conversation session {session_id} not found")
    return session_item


@router.get("/analytics/summary", tags=TAG_ADMIN, summary="Admin: Thống kê phân tích số liệu thực tế từ Database")
async def get_analytics_summary(
    period: str = Query("all", pattern="^(all|weekly|monthly)$", description="Khoảng thời gian: all, weekly, monthly"),
    db: AsyncSession = Depends(get_db),
    staff_repo: StaffRepository = Depends(get_staff_repository),
    session_repo: SupportSessionRepository = Depends(get_support_session_repository),
):
    """Trả về số liệu phân tích vận hành thực tế 100% từ cơ sở dữ liệu."""
    raw_list = await _fetch_all_raw_requests(db)

    cutoff: Optional[datetime] = None
    if period == "weekly":
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)
    elif period == "monthly":
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)

    if cutoff is not None:
        filtered_list = []
        for item in raw_list:
            created = item.get("created_at")
            if isinstance(created, datetime):
                created_naive = created.astimezone(timezone.utc).replace(tzinfo=None) if created.tzinfo else created
                if created_naive >= cutoff:
                    filtered_list.append(item)
        raw_list = filtered_list

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

    # Sessions & Messages via repository (filtered by cutoff if weekly/monthly)
    if cutoff is not None:
        sess_res = await db.execute(select(func.count(ChatSession.id)).where(ChatSession.created_at >= cutoff))
        msg_res = await db.execute(select(func.count(ChatMessage.id)).where(ChatMessage.created_at >= cutoff))
        total_sessions = sess_res.scalar() or 0
        total_messages = msg_res.scalar() or 0
    else:
        total_sessions = await session_repo.count_chat_sessions()
        total_messages = await session_repo.count_chat_messages()

    # Staff metrics via repository
    total_staff = await staff_repo.count_active()
    fallback_staff = await staff_repo.count_fallback_agents()

    # Robot units
    total_robots = 1

    # Recent 5 activities from real tasks
    recent_activities = [
        {
            "id": item["id"],
            "title": item["title"],
            "department": item["department"],
            "location": item["location"],
            "status": item["status"],
            "assigned_to": item.get("assigned_robot") or item.get("assignedTo") or "Chưa gán",
            "time": item.get("time") or "Gần đây",
        }
        for item in raw_list[:5]
    ]

    completion_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 100.0
    robot_rate = round((robot_assigned_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

    return {
        "period": period,
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
