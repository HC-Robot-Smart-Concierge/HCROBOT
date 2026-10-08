import random
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_

from app.core.database import get_db
from app.models import (
    Staff,
    ManagementDirective,
    HumanSupportSession,
    ChatSession,
    ChatMessage,
    SupportRequest,
    RoomServiceOrder,
)
from app.schemas.operations import (
    AdminOperationsSummary,
    HumanSupportSessionResponse,
)
from .shared import TAG_ADMIN, TAG_OPS, _fetch_all_raw_requests, create_department_notification

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


@router.get(
    "/rooms/{room_number}/all-requests",
    tags=TAG_OPS,
    summary="Tra cứu toàn bộ yêu cầu & dịch vụ của một phòng trên toàn hệ thống (All Departments)",
)
async def get_room_all_requests(
    room_number: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Tra cứu tổng hợp tất cả các đơn hàng, yêu cầu dịch vụ (Room Service, Buồng phòng, Bellman, Taxi, Kỹ thuật...)
    mà khách tại một phòng cụ thể đã phát sinh.
    """
    clean_room = room_number.upper().replace("ROOM", "").replace("PHÒNG", "").strip()
    all_reqs = await _fetch_all_raw_requests(db)
    
    room_reqs = [
        r for r in all_reqs
        if clean_room in str(r.get("location", "")).upper()
        or clean_room in str(r.get("room_number", "")).upper()
    ]
    return {
        "room_number": room_number,
        "total_requests": len(room_reqs),
        "requests": room_reqs,
    }


@router.patch(
    "/generic-request/{ticket_id}/status",
    tags=TAG_OPS,
    summary="Cập nhật trạng thái và phân công xử lý yêu cầu nghiệp vụ / Task",
)
@router.put(
    "/generic-request/{ticket_id}/status",
    tags=TAG_OPS,
    include_in_schema=False,
)
async def update_generic_request_status(
    ticket_id: str,
    status: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    update_in: Optional[Dict[str, Any]] = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Cập nhật trạng thái phiếu công việc (Pending, In Progress, Completed...) và nhân viên phụ trách.
    Đồng bộ trên toàn bộ cơ sở dữ liệu: bảng SupportRequest, RoomServiceOrder, và ManagementDirective.
    """
    target_status = status
    target_assigned_to = assigned_to
    if update_in and isinstance(update_in, dict):
        if not target_status:
            target_status = update_in.get("status")
        if not target_assigned_to:
            target_assigned_to = update_in.get("assigned_to") or update_in.get("assigned_staff_name")

    if not target_status:
        raise HTTPException(status_code=400, detail="Trạng thái (status) không được để trống")

    raw_id = ticket_id.strip()
    no_req_id = raw_id[4:].strip() if raw_id.upper().startswith("REQ-") else raw_id
    core_id = re.sub(r"^(REQ-)?(ORD-|HK-|BS-|MN-|REC-|DIR-|OP-)?", "", raw_id, flags=re.IGNORECASE).strip()

    # 1. Tra cứu và cập nhật bảng SupportRequest (HK, Room Service, Bellman, Maintenance, Taxi...)
    conditions = [
        SupportRequest.id == raw_id,
        SupportRequest.ticket_code == raw_id,
        SupportRequest.id == no_req_id,
        SupportRequest.ticket_code == no_req_id,
    ]
    if no_req_id:
        conditions.append(SupportRequest.ticket_code.ilike(f"%{no_req_id}%"))
        conditions.append(SupportRequest.id.ilike(f"%{no_req_id}%"))
    if core_id and len(core_id) >= 2:
        conditions.append(SupportRequest.ticket_code.ilike(f"%{core_id}%"))
        conditions.append(SupportRequest.id.ilike(f"%{core_id}%"))

    sr_res = await db.execute(select(SupportRequest).where(or_(*conditions)))
    sr = sr_res.scalars().first()

    st_lower = target_status.lower().strip()
    is_pending = st_lower in ["pending", "unassigned", "waiting", "chờ tiếp nhận"]

    # Map progress percentage based on restaurant / room-service lifecycle
    if st_lower in ["completed", "delivered", "done", "hoàn tất", "hoàn thành"]:
        target_progress = 100
    elif st_lower in ["delivering", "đang giao", "giao phòng"]:
        target_progress = 85
    elif st_lower in ["ready", "food ready", "đã nấu xong", "sẵn sàng", "món đã xong"]:
        target_progress = 75
    elif st_lower in ["cooking", "in preparation", "đang nấu", "đang chế biến"]:
        target_progress = 50
    elif st_lower in ["sent to kitchen", "sent_to_kitchen", "chờ bếp", "chuyển bếp"]:
        target_progress = 25
    elif is_pending:
        target_progress = 0
    else:
        target_progress = 50

    if sr:
        sr.status = target_status
        sr.progress = target_progress
        if target_assigned_to is not None:
            sr.assigned_staff_name = None if str(target_assigned_to).lower() in ("", "null", "none") else target_assigned_to
        elif is_pending:
            sr.assigned_staff_name = None

        # Đồng bộ sang RoomServiceOrder nếu là đơn hàng ẩm thực
        rs_conditions = [
            RoomServiceOrder.support_request_id == sr.id,
            RoomServiceOrder.id == sr.id,
        ]
        if no_req_id:
            rs_conditions.append(RoomServiceOrder.order_number == no_req_id)
        if core_id:
            rs_conditions.append(RoomServiceOrder.order_number == core_id)

        rs_res = await db.execute(select(RoomServiceOrder).where(or_(*rs_conditions)))
        rs_order = rs_res.scalars().first()
        if rs_order:
            rs_order.status = target_status
            rs_order.progress = target_progress
            if target_assigned_to is not None:
                rs_order.assigned_staff_name = None if str(target_assigned_to).lower() in ("", "null", "none") else target_assigned_to
            elif is_pending:
                rs_order.assigned_staff_name = None

        # Tự động gửi thông báo liên phòng ban theo chu trình Room Service & Kitchen
        ticket_label = sr.ticket_code or sr.id
        room_label = sr.room_number or "phòng khách"
        try:
            if st_lower in ["sent to kitchen", "sent_to_kitchen", "chờ bếp", "chuyển bếp"]:
                await create_department_notification(
                    db,
                    department="Kitchen",
                    title=f"Đơn Room Service #{ticket_label} chuyển Bếp",
                    description=f"{room_label}: {sr.title}. Bếp vui lòng tiếp nhận và làm món.",
                    request_id=sr.id,
                    request_type="Room Service",
                )
            elif st_lower in ["ready", "food ready", "đã nấu xong", "sẵn sàng", "món đã xong"]:
                await create_department_notification(
                    db,
                    department="Room Service",
                    title=f"Bếp đã làm xong món #{ticket_label}!",
                    description=f"Món ăn {room_label} đã sẵn sàng. Room Service vui lòng lấy món và chuẩn bị dụng cụ giao lên phòng.",
                    request_id=sr.id,
                    request_type="Room Service",
                )
            elif st_lower in ["completed", "delivered", "done", "hoàn tất", "hoàn thành"]:
                await create_department_notification(
                    db,
                    department="Room Service",
                    title=f"Đơn #{ticket_label} hoàn tất",
                    description=f"Đã giao món thành công lên {room_label}.",
                    request_id=sr.id,
                    request_type="Room Service",
                )
        except Exception:
            pass

        await db.commit()
        await db.refresh(sr)
        return {
            "success": True,
            "type": "support_request",
            "id": sr.id,
            "ticket_code": sr.ticket_code,
            "status": sr.status,
            "progress": sr.progress,
            "assigned_to": sr.assigned_staff_name,
        }

    # 2. Tra cứu và cập nhật bảng ManagementDirective (Chỉ thị vận hành)
    dir_conditions = [
        ManagementDirective.id == raw_id,
        ManagementDirective.code == raw_id,
        ManagementDirective.id == no_req_id,
        ManagementDirective.code == no_req_id,
    ]
    if no_req_id:
        dir_conditions.append(ManagementDirective.code.ilike(f"%{no_req_id}%"))
        dir_conditions.append(ManagementDirective.id.ilike(f"%{no_req_id}%"))

    dir_res = await db.execute(select(ManagementDirective).where(or_(*dir_conditions)))
    d = dir_res.scalars().first()
    if d:
        d.status = target_status
        if target_assigned_to:
            d.assigned_staff_name = target_assigned_to
        await db.commit()
        await db.refresh(d)
        return {
            "success": True,
            "type": "directive",
            "id": d.id,
            "code": d.code,
            "status": d.status,
            "assigned_to": d.assigned_staff_name,
        }

    # 3. Tra cứu trực tiếp bảng RoomServiceOrder (nếu không có trong SupportRequest)
    rso_conditions = [
        RoomServiceOrder.id == raw_id,
        RoomServiceOrder.order_number == raw_id,
        RoomServiceOrder.id == no_req_id,
        RoomServiceOrder.order_number == no_req_id,
    ]
    if core_id:
        rso_conditions.append(RoomServiceOrder.order_number == core_id)

    rso_res = await db.execute(select(RoomServiceOrder).where(or_(*rso_conditions)))
    rso = rso_res.scalars().first()
    if rso:
        rso.status = target_status
        if target_assigned_to:
            rso.assigned_staff_name = target_assigned_to
        if target_status.lower() in ["completed", "ready", "delivered", "done"]:
            rso.progress = 100
        await db.commit()
        await db.refresh(rso)
        return {
            "success": True,
            "type": "room_service_order",
            "id": rso.id,
            "order_number": rso.order_number,
            "status": rso.status,
            "assigned_to": rso.assigned_staff_name,
        }

    raise HTTPException(status_code=404, detail=f"Không tìm thấy yêu cầu #{ticket_id}")



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
