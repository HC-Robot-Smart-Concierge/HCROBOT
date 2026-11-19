import asyncio
import logging
import random
import re
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_

from app.core.database import get_db
from app.services.notification_manager import notification_manager
from app.models import (
    Staff,
    ManagementDirective,
    HumanSupportSession,
    ChatSession,
    ChatMessage,
    SupportRequest,
    RoomServiceOrder,
    Room,
    Feedback,
)
from app.schemas.operations import (
    AdminOperationsSummary,
    AdminTaskDispatchCreate,
    HumanSupportSessionResponse,
    DirectiveCreate,
    DirectiveResponse,
)
from app.repositories import (
    SupportRequestRepository,
    get_support_request_repository,
    DirectiveRepository,
    get_directive_repository,
    RoomServiceRepository,
    get_room_service_repository,
    StaffRepository,
    get_staff_repository,
    SupportSessionRepository,
    get_support_session_repository,
)
from .shared import TAG_ADMIN, TAG_OPS, _fetch_all_raw_requests, create_department_notification

logger = logging.getLogger(__name__)

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
        elif "f&b" in dept or "room service" in dept or "kitchen" in dept:
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


def _normalize_task_record(t: Dict[str, Any]) -> Dict[str, Any]:
    """Chuẩn hóa bản ghi nhiệm vụ/dịch vụ sang dạng dict tương thích camelCase & snake_case."""
    guest_val = t.get("guestName") or t.get("guest_name") or "Hotel Guest"
    assigned_val = t.get("assignedTo") or t.get("assigned_to")
    notes_val = t.get("notes") or t.get("description") or ""
    raw_ticket = t.get("ticket_code") or t.get("raw_id") or t["id"]
    clean_ticket = str(raw_ticket).replace("REQ-", "")

    return {
        "id": t["id"],
        "raw_id": t["raw_id"],
        "ticket_code": t.get("ticket_code") or clean_ticket,
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
    }


def _filter_task_records(
    tasks: List[Dict[str, Any]],
    room_number: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Áp dụng bộ lọc phòng, phòng ban, trạng thái và từ khóa tìm kiếm trên danh sách task."""
    if isinstance(room_number, str) and room_number.strip():
        clean_rn = room_number.upper().replace("ROOM", "").replace("PHÒNG", "").strip()
        tasks = [
            item for item in tasks
            if clean_rn in str(item.get("room_number") or "").upper().strip()
            or clean_rn in str(item.get("location") or "").upper().strip()
            or clean_rn == str(item.get("room_number") or "").upper().strip()
        ]

    if isinstance(department, str) and department.strip().lower() != "all":
        dept_q = department.strip().lower()
        filtered = []
        for item in tasks:
            d = (item.get("department") or "").lower()
            if dept_q in ["f&b", "fb", "room service", "room_service", "kitchen"]:
                if "f&b" in d or "room service" in d or "fb" in d or "kitchen" in d:
                    filtered.append(item)
            elif dept_q in ["bell", "bell services", "bell_services", "bellman"]:
                if "bell" in d:
                    filtered.append(item)
            elif dept_q in ["concierge", "live support"]:
                if "concierge" in d or "live" in d:
                    filtered.append(item)
            elif dept_q in ["taxi", "đặt xe", "vận chuyển"]:
                if "taxi" in d:
                    filtered.append(item)
            elif dept_q in ["directive", "directives", "chỉ thị", "chỉ thị điều phối"]:
                if "directive" in d or item.get("table_type") == "directive":
                    filtered.append(item)
            elif dept_q in d:
                filtered.append(item)
        tasks = filtered

    if isinstance(status, str) and status.strip().lower() != "all":
        st_q = status.strip().lower()
        filtered = []
        for item in tasks:
            s = (item.get("status") or "").lower()
            if st_q == "pending":
                if s in ["pending", "unassigned", "waiting", "pending action", "chờ tiếp nhận", "chờ xử lý"] or "pending" in s or "unassigned" in s:
                    filtered.append(item)
            elif st_q in ["in progress", "in_progress", "progress"]:
                if s in ["in progress", "in_progress", "sent to kitchen", "ready", "cooking", "delivering", "đang xử lý", "đang giao"] or "progress" in s or "kitchen" in s or "ready" in s or "cooking" in s or "delivering" in s:
                    filtered.append(item)
            elif st_q in ["completed", "done"]:
                if s in ["completed", "closed", "delivered", "done", "hoàn tất", "hoàn thành"] or "completed" in s:
                    filtered.append(item)
            elif st_q in ["cancelled", "rejected"]:
                if s in ["cancelled", "canceled", "rejected", "đã hủy", "từ chối"] or "cancel" in s or "reject" in s:
                    filtered.append(item)
            elif st_q in s:
                filtered.append(item)
        tasks = filtered

    if isinstance(search, str) and search.strip():
        sq = search.strip().lower()
        filtered = []
        for item in tasks:
            searchable = (
                f"{item.get('id', '')} {item.get('ticket_code', '')} {item.get('title', '')} "
                f"{item.get('location', '')} {item.get('room_number', '')} {item.get('guest_name', '')} "
                f"{item.get('notes', '')} {item.get('assigned_to', '')}"
            ).lower()
            if sq in searchable:
                filtered.append(item)
        tasks = filtered

    return tasks


@router.get(
    "/tasks",
    tags=TAG_OPS,
    summary="Danh sách tất cả yêu cầu dịch vụ / Tasks toàn khách sạn",
)
@router.get(
    "/admin/tasks",
    include_in_schema=False,
)
async def get_tasks(
    department: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    room_number: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Trả về danh sách đầy đủ tất cả các yêu cầu dịch vụ (Service Requests) toàn khách sạn cho Admin Portal.
    Hỗ trợ bộ lọc linh hoạt theo phòng ban, trạng thái, số phòng và từ khóa tìm kiếm.
    """
    raw_list = await _fetch_all_raw_requests(db)
    tasks = [_normalize_task_record(t) for t in raw_list]
    tasks = _filter_task_records(
        tasks,
        room_number=room_number,
        department=department,
        status=status,
        search=search,
    )

    if isinstance(offset, int) and offset > 0:
        tasks = tasks[offset:]
    if isinstance(limit, int) and limit > 0:
        tasks = tasks[:limit]

    return tasks


@router.get(
    "/tasks/{ticket_id}",
    tags=TAG_OPS,
    summary="Xem chi tiết một phiếu yêu cầu / Task",
)
@router.get(
    "/admin/tasks/{ticket_id}",
    include_in_schema=False,
)
async def get_task_detail(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
):
    raw_list = await _fetch_all_raw_requests(db)
    target_id = ticket_id.strip()
    target_clean = re.sub(r"^(REQ-)?", "", target_id, flags=re.IGNORECASE).strip()

    for t in raw_list:
        t_id = str(t.get("id", "")).strip()
        t_raw = str(t.get("raw_id", "")).strip()
        clean_tid = re.sub(r"^(REQ-)?", "", t_id, flags=re.IGNORECASE).strip()

        if target_id == t_id or target_id == t_raw or target_clean == clean_tid or target_clean in t_id:
            guest_val = t.get("guestName") or t.get("guest_name") or "Hotel Guest"
            assigned_val = t.get("assignedTo") or t.get("assigned_to")
            notes_val = t.get("notes") or t.get("description") or ""
            return {
                "id": t["id"],
                "raw_id": t["raw_id"],
                "department": t["department"],
                "table_type": t.get("table_type"),
                "title": t["title"],
                "location": t["location"],
                "room_number": t.get("room_number") or "",
                "guest_name": guest_val,
                "guestName": guest_val,
                "status": t.get("status") or "Pending",
                "time": t.get("time") or "Recent",
                "assigned_to": assigned_val,
                "assignedTo": assigned_val,
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
            }

    raise HTTPException(status_code=404, detail=f"Không tìm thấy yêu cầu #{ticket_id}")


# Python aliases for backward compatibility
get_admin_tasks = get_tasks
get_admin_task_detail = get_task_detail


@router.post(
    "/admin/dispatch",
    tags=TAG_ADMIN,
    summary="Admin: Tạo lệnh điều phối công việc toàn khách sạn",
)
async def dispatch_admin_task(
    payload: AdminTaskDispatchCreate,
    db: AsyncSession = Depends(get_db),
):
    dept_map = {
        "housekeeping": ("DEP-HOUSEKEEPING", "ST-HOUSEKEEPING", "HK"),
        "reception": ("DEP-RECEPTION", "ST-RECEPTION", "REC"),
        "f&b": ("DEP-ROOMSERVICE", "ST-ROOM_SERVICE", "ORD"),
        "room service": ("DEP-ROOMSERVICE", "ST-ROOM_SERVICE", "ORD"),
        "bell services": ("DEP-BELL", "ST-BELL", "BS"),
        "bell": ("DEP-BELL", "ST-BELL", "BS"),
        "maintenance": ("DEP-MAINTENANCE", "ST-MAINTENANCE", "MN"),
        "taxi": ("DEP-TAXI", "ST-TAXI", "TX"),
        "concierge": ("DEP-CONCIERGE", "ST-CONCIERGE", "CCG"),
    }
    norm_dept = payload.department.strip().lower()
    dep_id, st_id, prefix = dept_map.get(norm_dept, ("DEP-EXECUTIVE", None, "OP"))

    ticket_code = f"{prefix}-{random.randint(1000, 9999)}"
    initial_status = "In Progress" if payload.assigned_staff_name else "Pending"

    new_req = SupportRequest(
        ticket_code=ticket_code,
        title=payload.title,
        room_number=payload.room_number,
        description=payload.description or "",
        guest_name=payload.guest_name or "Hotel Guest",
        department_id=dep_id,
        service_type_id=st_id,
        status=initial_status,
        source="Admin Operations Dispatch",
        assigned_staff_name=payload.assigned_staff_name or None,
        assigned_robot_id=payload.assigned_robot_code or None,
    )
    db.add(new_req)

    # Persistent notification to department
    try:
        await create_department_notification(
            db=db,
            department=payload.department,
            title=f"Lệnh điều phối từ Admin: #{ticket_code}",
            description=f"{payload.room_number}: {payload.title}. {payload.description or ''}".strip(),
            request_id=new_req.id,
            request_type=payload.department.lower(),
            type="Request",
        )
    except Exception as e:
        logger.warning(f"Error creating notification during dispatch: {e}")

    await db.commit()
    await db.refresh(new_req)

    return {
        "success": True,
        "id": f"REQ-{new_req.ticket_code}",
        "ticket_code": new_req.ticket_code,
        "raw_id": new_req.id,
        "title": new_req.title,
        "department": payload.department,
        "status": new_req.status,
    }


@router.patch(
    "/tasks/{ticket_id}",
    tags=TAG_OPS,
    summary="Cập nhật trạng thái và phân công xử lý yêu cầu nghiệp vụ / Task toàn khách sạn",
)
@router.put(
    "/tasks/{ticket_id}",
    include_in_schema=False,
)
async def update_task_status(
    ticket_id: str,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    update_in: Optional[Dict[str, Any]] = None,
    db: AsyncSession = Depends(get_db),
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    directive_repo: DirectiveRepository = Depends(get_directive_repository),
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
    staff_repo: StaffRepository = Depends(get_staff_repository),
):
    """
    Cập nhật trạng thái phiếu công việc (Pending, In Progress, Completed...) và nhân viên phụ trách.
    Đồng bộ trên toàn bộ cơ sở dữ liệu: bảng SupportRequest, RoomServiceOrder, và ManagementDirective.
    Hỗ trợ tất cả các phòng ban: Buồng phòng, Lễ tân, F&B/Room Service, Bellman, Kỹ thuật bảo trì, Taxi.
    """
    target_status = status if isinstance(status, str) else None
    target_assigned_to = assigned_to if isinstance(assigned_to, str) else None
    target_assigned_robot = None
    target_note = None
    target_progress_in = None

    payload = update_in if isinstance(update_in, dict) else (
        update_in.dict() if hasattr(update_in, "dict") else {}
    ) if update_in is not None else {}

    if payload:
        if not target_status:
            target_status = payload.get("status")
        if not target_assigned_to:
            target_assigned_to = (
                payload.get("assigned_to")
                or payload.get("assigned_staff_name")
                or payload.get("assigned_staff")
                or payload.get("assigned_driver")
                or payload.get("assigned_technician")
            )
        target_assigned_robot = (
            payload.get("assigned_robot")
            or payload.get("assigned_robot_id")
            or payload.get("assigned_robot_code")
        )
        target_note = (
            payload.get("reject_reason")
            or payload.get("rejection_reason")
            or payload.get("reason")
            or payload.get("cancel_reason")
            or payload.get("note")
            or payload.get("notes")
            or payload.get("description")
        )
        target_progress_in = payload.get("progress")

    if not target_status and target_assigned_to is None and target_assigned_robot is None and target_note is None and target_progress_in is None:
        raise HTTPException(status_code=400, detail="Không có thông tin cập nhật hợp lệ")

    raw_id = ticket_id.strip()
    no_req_id = raw_id[4:].strip() if raw_id.upper().startswith("REQ-") else raw_id
    core_id = re.sub(r"^(REQ-)?(ORD-|HK-|BS-|MN-|REC-|DIR-|OP-)?", "", raw_id, flags=re.IGNORECASE).strip()

    # 1. Tra cứu và cập nhật bảng SupportRequest (HK, Room Service, Bellman, Maintenance, Taxi, Reception...)
    sr = await sr_repo.get_by_id_or_code(raw_id)
    if not sr and no_req_id:
        sr = await sr_repo.get_by_id_or_code(no_req_id)
    if not sr and core_id and len(core_id) >= 2:
        sr = await sr_repo.get_by_id_or_code(core_id)

    st_lower = target_status.lower().strip() if target_status else ""
    is_pending = st_lower in ["pending", "unassigned", "waiting", "chờ tiếp nhận"]

    # Map progress percentage based on restaurant / room-service lifecycle
    if target_progress_in is not None:
        try:
            target_progress = int(target_progress_in)
        except (ValueError, TypeError):
            target_progress = 50
    elif st_lower in ["completed", "delivered", "done", "hoàn tất", "hoàn thành"]:
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
        if target_status:
            sr.status = target_status
            sr.progress = target_progress
        if target_assigned_to is not None:
            sr.assigned_staff_name = None if str(target_assigned_to).lower() in ("", "null", "none") else target_assigned_to
        elif is_pending and target_status:
            sr.assigned_staff_name = None
        if target_assigned_robot is not None:
            sr.assigned_robot_id = None if str(target_assigned_robot).lower() in ("", "null", "none") else target_assigned_robot
        if target_note is not None and str(target_note).strip():
            clean_note_str = str(target_note).strip()
            sr.description = clean_note_str
            if st_lower in ["rejected", "cancelled"]:
                new_extra = dict(sr.extra_data or {})
                new_extra["reject_reason"] = clean_note_str
                sr.extra_data = new_extra
                try:
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(sr, "extra_data")
                except Exception:
                    pass

        # Cập nhật account_id nếu tìm thấy nhân viên tương ứng
        staff_ident = (payload.get("assigned_staff_id") if payload else None) or target_assigned_to
        if staff_ident and str(staff_ident).lower() not in ("", "null", "none"):
            found_staff = await staff_repo.get_by_identifier(str(staff_ident))
            if found_staff:
                sr.account_id = found_staff.id
        elif is_pending and target_status:
            sr.account_id = None

        sr.updated_at = datetime.utcnow()

        # Đồng bộ sang RoomServiceOrder nếu là đơn hàng ẩm thực
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
                rs_order.assigned_staff_name = None if str(target_assigned_to).lower() in ("", "null", "none") else target_assigned_to
            elif is_pending and target_status:
                rs_order.assigned_staff_name = None
            rs_order.updated_at = datetime.utcnow()

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
        sr_result = {
            "success": True,
            "type": "support_request",
            "id": sr.id,
            "raw_id": sr.id,
            "ticket_code": sr.ticket_code or sr.id,
            "status": sr.status,
            "progress": sr.progress,
            "assigned_to": sr.assigned_staff_name,
            "assigned_staff": sr.assigned_staff_name,
            "assigned_staff_name": sr.assigned_staff_name,
            "assigned_driver": sr.assigned_staff_name,
            "assigned_technician": sr.assigned_staff_name,
            "assigned_robot": sr.assigned_robot_id,
            "notes": sr.description,
            "note": sr.description,
            "description": sr.description,
            "title": sr.title,
            "room_number": sr.room_number or "",
            "guest_name": sr.guest_name or "Hotel Guest",
            "guestName": sr.guest_name or "Hotel Guest",
            "guest_phone": getattr(sr, "guest_phone", None) or (sr.extra_data or {}).get("guest_phone"),
            "guestPhone": getattr(sr, "guest_phone", None) or (sr.extra_data or {}).get("guest_phone"),
            "room_phone": getattr(sr, "room_phone", None) or (sr.extra_data or {}).get("room_phone") or (f"Ext {sr.room_number}" if sr.room_number else None),
            "roomPhone": getattr(sr, "room_phone", None) or (sr.extra_data or {}).get("room_phone") or (f"Ext {sr.room_number}" if sr.room_number else None),
            "department_id": sr.department_id,
            "department": sr.department_id,
            "request_type": sr.service_type_id or "General",
            "created_at": sr.created_at.isoformat() if sr.created_at else None,
            "updated_at": sr.updated_at.isoformat() if sr.updated_at else None,
        }
        asyncio.create_task(
            notification_manager.broadcast_status_update(sr_result, department="All")
        )
        return sr_result

    # 2. Tra cứu và cập nhật bảng ManagementDirective (Chỉ thị vận hành)
    d = await directive_repo.get_by_id_or_code(raw_id)
    if not d and no_req_id:
        d = await directive_repo.get_by_id_or_code(no_req_id)
    if not d and core_id:
        d = await directive_repo.get_by_id_or_code(core_id)

    if d:
        if target_status:
            d.status = target_status
        if target_assigned_to:
            d.assigned_staff_name = target_assigned_to
        if target_note is not None and str(target_note).strip():
            d.description = str(target_note).strip()
        await db.commit()
        await db.refresh(d)
        d_result = {
            "success": True,
            "type": "directive",
            "id": d.id,
            "raw_id": d.id,
            "code": d.code,
            "ticket_code": d.code,
            "status": d.status,
            "assigned_to": d.assigned_staff_name,
            "notes": d.description,
            "note": d.description,
            "title": d.title,
            "department": d.department,
        }
        asyncio.create_task(
            notification_manager.broadcast_status_update(d_result, department="All")
        )
        return d_result

    # 3. Tra cứu trực tiếp bảng RoomServiceOrder (nếu không có trong SupportRequest)
    rso = await rs_repo.get_order_by_id_or_number(raw_id)
    if not rso and no_req_id:
        rso = await rs_repo.get_order_by_id_or_number(no_req_id)
    if not rso and core_id:
        rso = await rs_repo.get_order_by_id_or_number(core_id)

    if rso:
        if target_status:
            rso.status = target_status
            if target_status.lower() in ["completed", "ready", "delivered", "done"]:
                rso.progress = 100
        if target_note is not None and str(target_note).strip():
            rso.note = str(target_note).strip()
        if target_assigned_to:
            rso.assigned_staff_name = target_assigned_to

        # Dong bo nguoc sang SupportRequest neu don co support_request_id lien ket
        if rso.support_request_id:
            sr_linked = await sr_repo.get_by_id_or_code(rso.support_request_id)
            if sr_linked:
                if target_status:
                    sr_linked.status = target_status
                    sr_linked.progress = rso.progress
                if target_note is not None and str(target_note).strip():
                    sr_linked.description = str(target_note).strip()
                    if target_status and target_status.lower() in ["rejected", "cancelled"]:
                        new_extra = dict(sr_linked.extra_data or {})
                        new_extra["reject_reason"] = str(target_note).strip()
                        sr_linked.extra_data = new_extra
                        try:
                            from sqlalchemy.orm.attributes import flag_modified
                            flag_modified(sr_linked, "extra_data")
                        except Exception:
                            pass
                sr_linked.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(rso)
        rso_result = {
            "success": True,
            "type": "room_service_order",
            "id": rso.id,
            "raw_id": rso.id,
            "order_number": rso.order_number,
            "ticket_code": rso.order_number,
            "status": rso.status,
            "progress": rso.progress,
            "assigned_to": rso.assigned_staff_name,
            "room_number": rso.room_number,
            "note": rso.note,
            "notes": rso.note,
            "reject_reason": rso.note,
            "department": "F&B",
        }
        asyncio.create_task(
            notification_manager.broadcast_status_update(rso_result, department="All")
        )
        return rso_result

    raise HTTPException(status_code=404, detail=f"Không tìm thấy yêu cầu #{ticket_id}")


# Python alias for backward compatibility
update_generic_request_status = update_task_status


@router.post(
    "/directives",
    response_model=DirectiveResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_OPS,
    summary="Phát chỉ thị điều hành quản lý liên bộ phận",
)
async def create_operational_directive(
    dir_in: DirectiveCreate,
    dir_repo: DirectiveRepository = Depends(get_directive_repository),
):
    """Phát hành chỉ thị điều phối đặc biệt từ Ban Quản lý Khách sạn."""
    code = f"OP-{random.randint(104, 999)}"
    new_dir = ManagementDirective(
        code=code,
        title=dir_in.title,
        department=dir_in.department,
        priority=dir_in.priority,
        location=dir_in.location,
        reported_time_label="Directive Just Issued",
        description=dir_in.description,
        status="Unassigned",
        type=dir_in.type,
        created_by="System Administrator",
    )
    await dir_repo.create(new_dir, autocommit=True)
    return new_dir


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
    db: AsyncSession = Depends(get_db),
    staff_repo: StaffRepository = Depends(get_staff_repository),
    session_repo: SupportSessionRepository = Depends(get_support_session_repository),
):
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

    # Sessions & Messages via repository
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


def _normalize_room_key(raw_room: Optional[str]) -> str:
    """Chuẩn hóa mã phòng để gom nhóm hồ sơ dịch vụ khách hàng nhất quán."""
    if not raw_room:
        return "Main Lobby"
    txt = str(raw_room).strip()
    low = txt.lower()
    if not txt or "lobby" in low or "sảnh" in low or "kiosk" in low:
        return "Main Lobby"
    cleaned = re.sub(r"^(room|phòng)\s*", "", txt, flags=re.IGNORECASE).strip()
    return cleaned or "Main Lobby"


def _parse_iso_date(date_str: Optional[str]) -> Optional[date]:
    if not date_str or not isinstance(date_str, str):
        return None
    try:
        return datetime.strptime(date_str.strip()[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _classify_record_status(status_val: Optional[str]) -> str:
    s = (status_val or "").strip().lower()
    if any(k in s for k in ("cancel", "reject", "hủy", "từ chối")):
        return "cancelled"
    if any(k in s for k in ("complet", "closed", "done", "deliver", "hoàn tất", "hoàn thành")):
        return "completed"
    return "active"


def _is_generic_guest_name(name: Optional[str]) -> bool:
    if not name:
        return True
    return str(name).strip().lower() in {
        "hotel guest",
        "quý khách",
        "khách lưu trú",
        "khách hàng",
        "khách tại sảnh",
        "khách",
        "guest",
    }


@router.get(
    "/admin/guest-service-records",
    tags=TAG_ADMIN,
    summary="Admin: Hồ sơ Dịch vụ Khách hàng toàn diện (Guest Service Records)",
)
async def get_guest_service_records(
    department: Optional[str] = None,
    status: Optional[str] = None,
    room_number: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Tổng hợp toàn bộ Hồ sơ Dịch vụ Khách hàng (Guest Service Records) cho Admin Portal:
    - Danh sách chi tiết từng yêu cầu dịch vụ / đơn đặt phòng / đơn F&B / đặt xe / hỗ trợ kỹ thuật.
    - Hồ sơ tổng hợp theo từng Phòng & Khách lưu trú (kèm đánh giá Feedback, phiên chat AI & video call).
    - Các chỉ số thống kê hiệu suất phục vụ, doanh thu dịch vụ và tỉ lệ hài lòng.
    """
    raw_list = await _fetch_all_raw_requests(db)

    # Chỉ lấy các bản ghi dịch vụ phục vụ khách (loại bỏ chỉ thị nội bộ ManagementDirective)
    guest_raw = [t for t in raw_list if t.get("table_type") != "directive"]
    records = [_normalize_task_record(t) for t in guest_raw]
    records = _filter_task_records(
        records,
        room_number=room_number,
        department=department,
        status=status,
        search=search,
    )

    if isinstance(source, str) and source.strip() and source.strip().lower() != "all":
        src_q = source.strip().lower()
        filtered_src = []
        for rec in records:
            rec_src = (rec.get("source") or "").lower()
            if src_q == "robot":
                if "robot" in rec_src or "kiosk" in rec_src:
                    filtered_src.append(rec)
            elif src_q in rec_src:
                filtered_src.append(rec)
        records = filtered_src

    start_d = _parse_iso_date(start_date)
    end_d = _parse_iso_date(end_date)
    if start_d or end_d:
        date_filtered = []
        for rec in records:
            dt = rec.get("created_at")
            if isinstance(dt, str):
                try:
                    dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
                except ValueError:
                    dt = None
            if not isinstance(dt, datetime):
                continue
            rec_date = dt.date()
            if start_d and rec_date < start_d:
                continue
            if end_d and rec_date > end_d:
                continue
            date_filtered.append(rec)
        records = date_filtered

    # Truy vấn dữ liệu bổ trợ: Room, Feedback, HumanSupportSession, ChatSession
    rooms_by_key: Dict[str, Room] = {}
    feedbacks_list: List[Feedback] = []
    support_sessions: List[HumanSupportSession] = []
    chat_sessions: List[ChatSession] = []

    try:
        rooms_res = await db.execute(select(Room).order_by(Room.room_number))
        for r in rooms_res.scalars().all():
            rooms_by_key[_normalize_room_key(r.room_number)] = r
    except Exception as exc:
        logger.warning(f"[GuestServiceRecords] Failed to query Room: {exc}")

    try:
        fb_res = await db.execute(select(Feedback).order_by(desc(Feedback.created_at)))
        feedbacks_list = list(fb_res.scalars().all())
    except Exception as exc:
        logger.warning(f"[GuestServiceRecords] Failed to query Feedback: {exc}")

    try:
        sup_res = await db.execute(select(HumanSupportSession))
        support_sessions = list(sup_res.scalars().all())
    except Exception as exc:
        logger.warning(f"[GuestServiceRecords] Failed to query HumanSupportSession: {exc}")

    try:
        chat_res = await db.execute(select(ChatSession))
        chat_sessions = list(chat_res.scalars().all())
    except Exception as exc:
        logger.warning(f"[GuestServiceRecords] Failed to query ChatSession: {exc}")

    # Chuẩn hóa records để trả JSON an toàn + tính metrics
    completed_records = 0
    active_records = 0
    cancelled_records = 0
    total_revenue = 0.0
    robot_assisted_count = 0

    serialized_records: List[Dict[str, Any]] = []
    for rec in records:
        dt = rec.get("created_at")
        iso_dt = dt.isoformat() if isinstance(dt, datetime) else (str(dt) if dt else None)
        room_key = _normalize_room_key(rec.get("room_number") or rec.get("location"))
        is_robot = bool(
            rec.get("assigned_robot")
            or "robot" in (rec.get("source") or "").lower()
            or "kiosk" in (rec.get("source") or "").lower()
        )
        cls_status = _classify_record_status(rec.get("status"))
        if cls_status == "completed":
            completed_records += 1
        elif cls_status == "cancelled":
            cancelled_records += 1
        else:
            active_records += 1

        if is_robot:
            robot_assisted_count += 1
        total_revenue += float(rec.get("total_amount") or 0)

        item_out = {
            **rec,
            "created_at": iso_dt,
            "room_key": room_key,
            "status_group": cls_status,
            "is_robot_assisted": is_robot,
        }
        serialized_records.append(item_out)

    # Gom hồ sơ theo Khách hàng & Lượt lưu trú / Vãng lai (Guest Dossiers)
    # Tách biệt: (1) Khách đăng ký phòng theo từng tên khách (tránh gộp nhầm khi đổi khách ở cùng phòng),
    #            (2) Khách vãng lai tại sảnh (theo tên/SĐT hoặc nhóm vãng lai chưa định danh).
    profiles_map: Dict[str, Dict[str, Any]] = {}
    room_dossiers_index: Dict[str, List[str]] = {}

    def _resolve_dossier_identity(
        rk: str,
        raw_guest_name: Optional[str],
        raw_phone: Optional[str] = None,
    ) -> Dict[str, Any]:
        room_obj = rooms_by_key.get(rk)
        is_occupied = bool(room_obj and (room_obj.status or "").upper() == "OCCUPIED")
        current_room_guest = (room_obj.current_guest_name or "").strip() if room_obj and is_occupied else ""
        current_room_guest_low = current_room_guest.lower()

        clean_name = (raw_guest_name or "").strip()
        if _is_generic_guest_name(clean_name):
            clean_name = ""

        clean_phone = re.sub(r"\s+", "", str(raw_phone or ""))

        if rk == "Main Lobby":
            guest_type = "walkin"
            stay_status = "WALK_IN"
            if clean_phone:
                d_key = f"walkin::phone::{clean_phone}"
                display_name = clean_name or f"Khách vãng lai ({clean_phone})"
            elif clean_name:
                d_key = f"walkin::name::{clean_name.lower()}"
                display_name = clean_name
            else:
                d_key = "walkin::anonymous"
                display_name = "Khách vãng lai (Sảnh)"
            return {
                "dossier_key": d_key,
                "guest_type": guest_type,
                "stay_status": stay_status,
                "display_name": display_name,
            }

        # Khách đăng ký phòng
        guest_type = "registered"
        if not clean_name and current_room_guest:
            clean_name = current_room_guest

        if clean_name:
            name_low = clean_name.lower()
            d_key = f"room::{rk}::{name_low}"
            is_current = bool(is_occupied and current_room_guest_low == name_low)
            stay_status = "CURRENT_STAY" if is_current else "PAST_STAY"
            display_name = clean_name
        else:
            d_key = f"room::{rk}::anonymous"
            stay_status = "PAST_STAY"
            display_name = f"Khách phòng {rk}"

        return {
            "dossier_key": d_key,
            "guest_type": guest_type,
            "stay_status": stay_status,
            "display_name": display_name,
        }

    def _ensure_profile(rk: str, identity: Dict[str, Any]) -> Dict[str, Any]:
        d_key = identity["dossier_key"]
        if d_key not in profiles_map:
            room_obj = rooms_by_key.get(rk)
            is_walkin = identity["guest_type"] == "walkin"
            is_current_stay = identity["stay_status"] == "CURRENT_STAY"
            profiles_map[d_key] = {
                "dossier_key": d_key,
                "room_key": rk,
                "room_number": "Kiosk / Sảnh chính" if is_walkin else f"Phòng {rk}",
                "room_type": "Khách vãng lai" if is_walkin else (room_obj.room_type if room_obj else "Standard"),
                "room_status": room_obj.status if (room_obj and not is_walkin) else "N/A",
                "guest_type": identity["guest_type"],
                "stay_status": identity["stay_status"],
                "guest_name": identity["display_name"],
                "guest_phone": (room_obj.current_guest_phone if room_obj and is_current_stay else None),
                "room_phone": room_obj.room_phone if (room_obj and not is_walkin) else None,
                "total_services": 0,
                "completed_services": 0,
                "active_services": 0,
                "total_spend": 0.0,
                "video_call_count": 0,
                "chat_session_count": 0,
                "feedbacks": [],
                "avg_rating": None,
                "latest_activity_at": None,
                "services": [],
            }
            room_dossiers_index.setdefault(rk, []).append(d_key)
        return profiles_map[d_key]

    for rec in serialized_records:
        rk = rec["room_key"]
        identity = _resolve_dossier_identity(rk, rec.get("guest_name"), rec.get("guest_phone"))
        rec["dossier_key"] = identity["dossier_key"]
        rec["guest_type"] = identity["guest_type"]

        prof = _ensure_profile(rk, identity)
        prof["services"].append(rec)
        prof["total_services"] += 1
        if rec["status_group"] == "completed":
            prof["completed_services"] += 1
        elif rec["status_group"] == "active":
            prof["active_services"] += 1
        prof["total_spend"] += float(rec.get("total_amount") or 0)

        if not prof["guest_phone"] and rec.get("guest_phone"):
            prof["guest_phone"] = rec["guest_phone"]

        rec_dt = rec.get("created_at")
        if rec_dt and (not prof["latest_activity_at"] or rec_dt > prof["latest_activity_at"]):
            prof["latest_activity_at"] = rec_dt

    def _match_dossier_key(rk: str, guest_name: Optional[str]) -> Optional[str]:
        ident = _resolve_dossier_identity(rk, guest_name)
        if ident["dossier_key"] in profiles_map:
            return ident["dossier_key"]
        candidates = room_dossiers_index.get(rk, [])
        if len(candidates) == 1:
            return candidates[0]
        # Ưu tiên khớp vào hồ sơ CURRENT_STAY của phòng đó nếu có
        for ck in candidates:
            if profiles_map[ck]["stay_status"] == "CURRENT_STAY":
                return ck
        return candidates[0] if candidates else None

    # Gắn Feedback vào đúng hồ sơ khách hàng
    serialized_feedbacks: List[Dict[str, Any]] = []
    for fb in feedbacks_list:
        rk = _normalize_room_key(fb.room_number)
        fb_obj = {
            "id": fb.id,
            "room_number": fb.room_number or rk,
            "room_key": rk,
            "guest_name": fb.guest_name or "Hotel Guest",
            "rating": fb.rating,
            "category": fb.category,
            "comment": fb.comment,
            "created_at": fb.created_at.isoformat() if fb.created_at else None,
        }
        serialized_feedbacks.append(fb_obj)
        matched_key = _match_dossier_key(rk, fb.guest_name)
        if matched_key and matched_key in profiles_map:
            profiles_map[matched_key]["feedbacks"].append(fb_obj)

    for sup in support_sessions:
        rk = _normalize_room_key(sup.room_number)
        matched_key = _match_dossier_key(rk, getattr(sup, "guest_name", None))
        if matched_key and matched_key in profiles_map:
            profiles_map[matched_key]["video_call_count"] += 1

    for cs in chat_sessions:
        rk = _normalize_room_key(cs.room_number)
        matched_key = _match_dossier_key(rk, getattr(cs, "guest_name", None))
        if matched_key and matched_key in profiles_map:
            profiles_map[matched_key]["chat_session_count"] += 1

    # Tính điểm đánh giá trung bình theo từng phòng và tổng thể
    for prof in profiles_map.values():
        fbs = prof["feedbacks"]
        if fbs:
            prof["avg_rating"] = round(sum(f["rating"] for f in fbs) / len(fbs), 1)
        prof["total_spend"] = round(prof["total_spend"], 0)

    guest_profiles = sorted(
        profiles_map.values(),
        key=lambda p: (p["latest_activity_at"] or "", p["total_services"]),
        reverse=True,
    )

    total_records = len(serialized_records)
    completion_rate = round((completed_records / total_records) * 100, 1) if total_records > 0 else 100.0
    robot_rate = round((robot_assisted_count / total_records) * 100, 1) if total_records > 0 else 0.0
    avg_rating = (
        round(sum(f["rating"] for f in serialized_feedbacks) / len(serialized_feedbacks), 1)
        if serialized_feedbacks
        else None
    )

    return {
        "metrics": {
            "total_records": total_records,
            "completed_records": completed_records,
            "active_records": active_records,
            "cancelled_records": cancelled_records,
            "completion_rate": completion_rate,
            "total_revenue": round(total_revenue, 0),
            "robot_assisted_count": robot_assisted_count,
            "robot_rate": robot_rate,
            "total_feedbacks": len(serialized_feedbacks),
            "avg_rating": avg_rating,
            "total_rooms_served": len(room_dossiers_index),
            "total_dossiers": len(guest_profiles),
        },
        "records": serialized_records,
        "guest_profiles": guest_profiles,
        "feedbacks": serialized_feedbacks[:50],
    }
