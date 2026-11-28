"""Task filtering, status synchronization, and analytics computation helpers for Admin Ops."""

import asyncio
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.operations.shared import (
    _fetch_all_raw_requests,
    create_department_notification,
)
from app.models import ChatMessage, ChatSession
from app.repositories import (
    DirectiveRepository,
    RoomServiceRepository,
    StaffRepository,
    SupportRequestRepository,
    SupportSessionRepository,
)
from app.services.notification_manager import notification_manager


_DEPT_FILTERS = {
    "f&b": lambda d, _i: any(k in d for k in ("f&b", "room service", "fb", "kitchen")),
    "fb": lambda d, _i: any(k in d for k in ("f&b", "room service", "fb", "kitchen")),
    "room service": lambda d, _i: any(k in d for k in ("f&b", "room service", "fb", "kitchen")),
    "room_service": lambda d, _i: any(k in d for k in ("f&b", "room service", "fb", "kitchen")),
    "kitchen": lambda d, _i: any(k in d for k in ("f&b", "room service", "fb", "kitchen")),
    "bell": lambda d, _i: "bell" in d,
    "bell services": lambda d, _i: "bell" in d,
    "bell_services": lambda d, _i: "bell" in d,
    "bellman": lambda d, _i: "bell" in d,
    "concierge": lambda d, _i: "concierge" in d or "live" in d,
    "live support": lambda d, _i: "concierge" in d or "live" in d,
    "taxi": lambda d, _i: "taxi" in d,
    "đặt xe": lambda d, _i: "taxi" in d,
    "vận chuyển": lambda d, _i: "taxi" in d,
    "directive": lambda d, i: "directive" in d or i.get("table_type") == "directive",
    "directives": lambda d, i: "directive" in d or i.get("table_type") == "directive",
    "chỉ thị": lambda d, i: "directive" in d or i.get("table_type") == "directive",
    "chỉ thị điều phối": lambda d, i: "directive" in d or i.get("table_type") == "directive",
}


async def fetch_and_filter_admin_tasks(
    db: AsyncSession,
    department: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    room_number: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Normalize and filter all hotel service requests for the Admin tasks endpoint."""
    raw_list = await _fetch_all_raw_requests(db)

    # Normalize fields for frontend compatibility (both camelCase and snake_case)
    tasks = []
    for t in raw_list:
        guest_val = t.get("guestName") or t.get("guest_name") or "Hotel Guest"
        assigned_val = t.get("assignedTo") or t.get("assigned_to")
        notes_val = t.get("notes") or t.get("description") or ""
        raw_ticket = t.get("ticket_code") or t.get("raw_id") or t["id"]
        tasks.append({
            "id": t["id"],
            "raw_id": t["raw_id"],
            "ticket_code": t.get("ticket_code") or str(raw_ticket).replace("REQ-", ""),
            "department": t["department"],
            "table_type": t.get("table_type"),
            "title": t["title"],
            "location": t["location"],
            "room_number": t.get("room_number") or "",
            "guest_name": guest_val,
            "guestName": guest_val,
            "status": t.get("status") or "Pending",
            "time": t.get("time") or "Recent",
            "time_label": t.get("time_label") or t.get("time") or "Recent",
            "assigned_to": assigned_val,
            "assignedTo": assigned_val,
            "assigned_staff_name": assigned_val,
            "assigned_robot": t.get("assigned_robot"),
            "notes": notes_val,
            "description": notes_val,
            "source": t.get("source") or "From HCRobot",
            "created_at": t.get("created_at"),
            "items": t.get("items") or [],
            "total_amount": t.get("total_amount") or 0,
            "progress": t.get("progress") or 0,
            "est_completion": t.get("est_completion"),
            "guest_phone": t.get("guest_phone") or t.get("guestPhone"),
            "guestPhone": t.get("guestPhone") or t.get("guest_phone"),
            "room_phone": t.get("room_phone") or t.get("roomPhone"),
            "roomPhone": t.get("roomPhone") or t.get("room_phone"),
            "is_service_request": bool(t.get("is_service_request")),
        })

    if isinstance(room_number, str) and room_number.strip():
        clean_rn = room_number.upper().replace("ROOM", "").replace("PHÒNG", "").strip()
        tasks = [
            item for item in tasks
            if clean_rn in str(item.get("room_number") or "").upper().strip()
            or clean_rn in str(item.get("location") or "").upper().strip()
        ]

    if isinstance(department, str) and department.strip().lower() != "all":
        dept_q = department.strip().lower()
        matcher = _DEPT_FILTERS.get(dept_q)
        tasks = [
            item for item in tasks
            if (matcher((item.get("department") or "").lower(), item) if matcher else dept_q in (item.get("department") or "").lower())
        ]

    if isinstance(status, str) and status.strip().lower() != "all":
        st_q = status.strip().lower()
        if st_q == "pending":
            tasks = [i for i in tasks if (s := (i.get("status") or "").lower()) in ("pending", "unassigned", "waiting", "pending action", "chờ tiếp nhận", "chờ xử lý") or "pending" in s or "unassigned" in s]
        elif st_q in ("in progress", "in_progress", "progress"):
            tasks = [i for i in tasks if (s := (i.get("status") or "").lower()) in ("in progress", "in_progress", "sent to kitchen", "ready", "cooking", "delivering", "đang xử lý", "đang giao") or any(k in s for k in ("progress", "kitchen", "ready", "cooking", "delivering"))]
        elif st_q in ("completed", "done"):
            tasks = [i for i in tasks if (s := (i.get("status") or "").lower()) in ("completed", "closed", "delivered", "done", "hoàn tất", "hoàn thành") or "completed" in s]
        else:
            tasks = [i for i in tasks if st_q in (i.get("status") or "").lower()]

    if isinstance(search, str) and search.strip():
        sq = search.strip().lower()
        tasks = [
            item for item in tasks
            if sq in f"{item.get('id', '')} {item.get('title', '')} {item.get('location', '')} {item.get('room_number', '')} {item.get('guest_name', '')} {item.get('notes', '')} {item.get('assigned_to', '')}".lower()
        ]

    if isinstance(offset, int) and offset > 0:
        tasks = tasks[offset:]
    if isinstance(limit, int) and limit > 0:
        tasks = tasks[:limit]
    return tasks


def _compute_target_progress(st_lower: str, is_pending: bool, target_progress_in: Any) -> int:
    if target_progress_in is not None:
        try:
            return int(target_progress_in)
        except (ValueError, TypeError):
            return 50
    if st_lower in ["completed", "delivered", "done", "hoàn tất", "hoàn thành"]:
        return 100
    if st_lower in ["delivering", "đang giao", "giao phòng"]:
        return 85
    if st_lower in ["ready", "food ready", "đã nấu xong", "sẵn sàng", "món đã xong"]:
        return 75
    if st_lower in ["cooking", "in preparation", "đang nấu", "đang chế biến"]:
        return 50
    if st_lower in ["sent to kitchen", "sent_to_kitchen", "chờ bếp", "chuyển bếp"]:
        return 25
    return 0 if is_pending else 50


async def _find_by_variants(getter, *candidates: Optional[str], min_last_len: int = 0):
    for idx, cand in enumerate(candidates):
        if not cand:
            continue
        if idx == len(candidates) - 1 and min_last_len and len(cand) < min_last_len:
            continue
        found = await getter(cand)
        if found:
            return found
    return None


def _clean_nullable(val: Optional[str]) -> Optional[str]:
    return None if str(val).lower() in ("", "null", "none") else val


def _set_reject_reason(sr_obj, note_str: str) -> None:
    new_extra = dict(sr_obj.extra_data or {})
    new_extra["reject_reason"] = note_str
    sr_obj.extra_data = new_extra
    try:
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(sr_obj, "extra_data")
    except Exception:
        pass


async def _finalize_task_update(db: AsyncSession, entity, result: Dict[str, Any]) -> Dict[str, Any]:
    await db.commit()
    await db.refresh(entity)
    asyncio.create_task(notification_manager.broadcast_status_update(result, department="All"))
    return result


async def _notify_kitchen_lifecycle(db: AsyncSession, st_lower: str, sr) -> None:
    ticket_label = sr.ticket_code or sr.id
    room_label = sr.room_number or "phòng khách"
    notif = None
    if st_lower in ["sent to kitchen", "sent_to_kitchen", "chờ bếp", "chuyển bếp"]:
        notif = ("Kitchen", f"Đơn Room Service #{ticket_label} chuyển Bếp", f"{room_label}: {sr.title}. Bếp vui lòng tiếp nhận và làm món.")
    elif st_lower in ["ready", "food ready", "đã nấu xong", "sẵn sàng", "món đã xong"]:
        notif = ("Room Service", f"Bếp đã làm xong món #{ticket_label}!", f"Món ăn {room_label} đã sẵn sàng. Room Service vui lòng lấy món và chuẩn bị dụng cụ giao lên phòng.")
    elif st_lower in ["completed", "delivered", "done", "hoàn tất", "hoàn thành"]:
        notif = ("Room Service", f"Đơn #{ticket_label} hoàn tất", f"Đã giao món thành công lên {room_label}.")
    if not notif:
        return
    try:
        await create_department_notification(db, department=notif[0], title=notif[1], description=notif[2], request_id=sr.id, request_type="Room Service")
    except Exception:
        pass


async def apply_admin_task_status_update(
    ticket_id: str,
    target_status: Optional[str],
    target_assigned_to: Optional[str],
    target_assigned_robot: Optional[str],
    target_note: Optional[str],
    target_progress_in: Any,
    db: AsyncSession,
    sr_repo: SupportRequestRepository,
    directive_repo: DirectiveRepository,
    rs_repo: RoomServiceRepository,
    staff_repo: StaffRepository,
    staff_ident: Optional[str] = None,
) -> Dict[str, Any]:
    """Update status/assignee across SupportRequest, ManagementDirective, and RoomServiceOrder."""
    raw_id = ticket_id.strip()
    no_req_id = raw_id[4:].strip() if raw_id.upper().startswith("REQ-") else raw_id
    core_id = re.sub(r"^(REQ-)?(ORD-|HK-|BS-|MN-|REC-|DIR-|OP-)?", "", raw_id, flags=re.IGNORECASE).strip()

    sr = await _find_by_variants(sr_repo.get_by_id_or_code, raw_id, no_req_id, core_id, min_last_len=2)
    st_lower = target_status.lower().strip() if target_status else ""
    is_pending = st_lower in ["pending", "unassigned", "waiting", "chờ tiếp nhận"]
    target_progress = _compute_target_progress(st_lower, is_pending, target_progress_in)

    if sr:
        if target_status:
            sr.status = target_status
            sr.progress = target_progress
        if target_assigned_to is not None:
            sr.assigned_staff_name = _clean_nullable(target_assigned_to)
        elif is_pending and target_status:
            sr.assigned_staff_name = None
        if target_assigned_robot is not None:
            sr.assigned_robot_id = _clean_nullable(target_assigned_robot)
        if target_note is not None and str(target_note).strip():
            clean_note_str = str(target_note).strip()
            sr.description = clean_note_str
            if st_lower in ["rejected", "cancelled"]:
                _set_reject_reason(sr, clean_note_str)

        eff_staff_ident = staff_ident or target_assigned_to
        if eff_staff_ident and str(eff_staff_ident).lower() not in ("", "null", "none"):
            found_staff = await staff_repo.get_by_identifier(str(eff_staff_ident))
            if found_staff:
                sr.account_id = found_staff.id
        elif is_pending and target_status:
            sr.account_id = None
        sr.updated_at = datetime.utcnow()

        rs_order = await rs_repo.find_order_by_linked_or_number(sr.id, raw_id)
        if not rs_order and no_req_id:
            rs_order = await rs_repo.find_order_by_linked_or_number(order_identifier=no_req_id)
        if not rs_order and core_id:
            rs_order = await rs_repo.find_order_by_linked_or_number(order_identifier=core_id)
        if rs_order:
            if target_status:
                rs_order.status = target_status
                rs_order.progress = target_progress
            if target_note is not None and str(target_note).strip():
                rs_order.note = str(target_note).strip()
            if target_assigned_to is not None:
                rs_order.assigned_staff_name = _clean_nullable(target_assigned_to)
            elif is_pending and target_status:
                rs_order.assigned_staff_name = None
            rs_order.updated_at = datetime.utcnow()

        await _notify_kitchen_lifecycle(db, st_lower, sr)
        guest_phone = getattr(sr, "guest_phone", None) or (sr.extra_data or {}).get("guest_phone")
        room_phone = getattr(sr, "room_phone", None) or (sr.extra_data or {}).get("room_phone") or (f"Ext {sr.room_number}" if sr.room_number else None)
        return await _finalize_task_update(db, sr, {
            "success": True, "type": "support_request", "id": sr.id, "raw_id": sr.id,
            "ticket_code": sr.ticket_code or sr.id, "status": sr.status, "progress": sr.progress,
            "assigned_to": sr.assigned_staff_name, "assigned_staff": sr.assigned_staff_name,
            "assigned_staff_name": sr.assigned_staff_name, "assigned_driver": sr.assigned_staff_name,
            "assigned_technician": sr.assigned_staff_name, "assigned_robot": sr.assigned_robot_id,
            "notes": sr.description, "note": sr.description, "description": sr.description, "title": sr.title,
            "room_number": sr.room_number or "", "guest_name": sr.guest_name or "Hotel Guest", "guestName": sr.guest_name or "Hotel Guest",
            "guest_phone": guest_phone, "guestPhone": guest_phone, "room_phone": room_phone, "roomPhone": room_phone,
            "department_id": sr.department_id, "department": sr.department_id, "request_type": sr.service_type_id or "General",
            "created_at": sr.created_at.isoformat() if sr.created_at else None,
            "updated_at": sr.updated_at.isoformat() if sr.updated_at else None,
        })

    d = await _find_by_variants(directive_repo.get_by_id_or_code, raw_id, no_req_id, core_id)
    if d:
        if target_status:
            d.status = target_status
        if target_assigned_to:
            d.assigned_staff_name = target_assigned_to
        if target_note is not None and str(target_note).strip():
            d.description = str(target_note).strip()
        return await _finalize_task_update(db, d, {
            "success": True, "type": "directive", "id": d.id, "raw_id": d.id,
            "code": d.code, "ticket_code": d.code, "status": d.status,
            "assigned_to": d.assigned_staff_name, "notes": d.description, "note": d.description,
            "title": d.title, "department": d.department,
        })

    rso = await _find_by_variants(rs_repo.get_order_by_id_or_number, raw_id, no_req_id, core_id)
    if rso:
        if target_status:
            rso.status = target_status
            if target_status.lower() in ["completed", "ready", "delivered", "done"]:
                rso.progress = 100
        if target_note is not None and str(target_note).strip():
            rso.note = str(target_note).strip()
        if target_assigned_to:
            rso.assigned_staff_name = target_assigned_to

        if rso.support_request_id:
            sr_linked = await sr_repo.get_by_id_or_code(rso.support_request_id)
            if sr_linked:
                if target_status:
                    sr_linked.status = target_status
                    sr_linked.progress = rso.progress
                if target_note is not None and str(target_note).strip():
                    sr_linked.description = str(target_note).strip()
                    if target_status and target_status.lower() in ["rejected", "cancelled"]:
                        _set_reject_reason(sr_linked, str(target_note).strip())
                sr_linked.updated_at = datetime.utcnow()

        return await _finalize_task_update(db, rso, {
            "success": True, "type": "room_service_order", "id": rso.id, "raw_id": rso.id,
            "order_number": rso.order_number, "ticket_code": rso.order_number,
            "status": rso.status, "progress": rso.progress, "assigned_to": rso.assigned_staff_name,
            "room_number": rso.room_number, "note": rso.note, "notes": rso.note,
            "reject_reason": rso.note, "department": "F&B",
        })

    raise HTTPException(status_code=404, detail=f"Không tìm thấy yêu cầu #{ticket_id}")


async def compute_admin_analytics_summary(
    period: str,
    db: AsyncSession,
    staff_repo: StaffRepository,
    session_repo: SupportSessionRepository,
) -> Dict[str, Any]:
    """Aggregate real-time operational KPIs, department distribution, and recent activities."""
    cutoff: Optional[datetime] = None
    if period == "weekly":
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)
    elif period == "monthly":
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)

    raw_list = await _fetch_all_raw_requests(db)
    if cutoff is not None:
        filtered_requests = []
        for item in raw_list:
            created = item.get("created_at")
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                except ValueError:
                    created = None
            if created is None:
                continue
            created_naive = (
                created.astimezone(timezone.utc).replace(tzinfo=None)
                if created.tzinfo is not None
                else created
            )
            if created_naive >= cutoff:
                filtered_requests.append(item)
        raw_list = filtered_requests

    total_tasks = len(raw_list)
    active_tasks = sum(1 for t in raw_list if t["status"].lower() not in ["completed", "cancelled", "rejected"])
    completed_tasks = sum(1 for t in raw_list if t["status"].lower() == "completed")

    # Robot vs Human allocation
    robot_assigned_tasks = sum(1 for t in raw_list if t.get("assigned_robot"))
    human_tasks = total_tasks - robot_assigned_tasks

    # Department breakdown (bao phủ toàn bộ bộ phận vận hành để tổng luôn khớp total_tasks)
    dept_distribution: Dict[str, int] = {
        "Reception": 0,
        "Concierge": 0,
        "F&B": 0,
        "Kitchen": 0,
        "Bell Services": 0,
        "Maintenance": 0,
        "Taxi": 0,
    }
    for t in raw_list:
        raw_dept = (t.get("department") or "").strip()
        d = raw_dept.lower()
        if "concierge" in d or "live support" in d:
            dept_distribution["Concierge"] += 1
        elif "reception" in d or "front desk" in d:
            dept_distribution["Reception"] += 1
        elif "kitchen" in d or "bếp" in d or "restaurant" in d:
            dept_distribution["Kitchen"] += 1
        elif "f&b" in d or "room service" in d or "housekeeping" in d:
            dept_distribution["F&B"] += 1
        elif "bell" in d:
            dept_distribution["Bell Services"] += 1
        elif "taxi" in d or "transport" in d:
            dept_distribution["Taxi"] += 1
        elif "maintenance" in d or "engineering" in d:
            dept_distribution["Maintenance"] += 1
        else:
            fallback_key = raw_dept or "Other"
            dept_distribution[fallback_key] = dept_distribution.get(fallback_key, 0) + 1

    # Sessions & Messages via repository (or period-filtered query)
    if cutoff is not None:
        sess_stmt = select(func.count(ChatSession.id)).where(ChatSession.created_at >= cutoff)
        msg_stmt = select(func.count(ChatMessage.id)).where(ChatMessage.created_at >= cutoff)
        total_sessions = int((await db.execute(sess_stmt)).scalar() or 0)
        total_messages = int((await db.execute(msg_stmt)).scalar() or 0)
    else:
        total_sessions = await session_repo.count_chat_sessions()
        total_messages = await session_repo.count_chat_messages()

    # Staff metrics via repository
    total_staff = await staff_repo.count_active()
    fallback_staff = await staff_repo.count_fallback_agents()

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
