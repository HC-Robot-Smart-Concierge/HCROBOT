import logging
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
    AdminTaskDispatchCreate,
    HumanSupportSessionResponse,
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

    # Normalize fields for frontend compatibility (both camelCase and snake_case)
    tasks = []
    for t in raw_list:
        guest_val = t.get("guestName") or t.get("guest_name") or "Hotel Guest"
        assigned_val = t.get("assignedTo") or t.get("assigned_to")
        notes_val = t.get("notes") or t.get("description") or ""
        raw_ticket = t.get("ticket_code") or t.get("raw_id") or t["id"]
        clean_ticket = str(raw_ticket).replace("REQ-", "")

        tasks.append({
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
            "priority": t.get("priority") or "NORMAL",
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
        })

    # Room number filter
    if isinstance(room_number, str) and room_number.strip():
        clean_rn = room_number.upper().replace("ROOM", "").replace("PHÒNG", "").strip()
        filtered = []
        for item in tasks:
            item_rn = str(item.get("room_number") or "").upper().strip()
            item_loc = str(item.get("location") or "").upper().strip()
            if clean_rn in item_rn or clean_rn in item_loc or clean_rn == item_rn:
                filtered.append(item)
        tasks = filtered

    # Department filter
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

    # Status filter
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
            elif st_q in s:
                filtered.append(item)
        tasks = filtered

    # Search query filter
    if isinstance(search, str) and search.strip():
        sq = search.strip().lower()
        filtered = []
        for item in tasks:
            searchable = (
                f"{item.get('id', '')} {item.get('title', '')} {item.get('location', '')} "
                f"{item.get('room_number', '')} {item.get('guest_name', '')} {item.get('notes', '')} "
                f"{item.get('assigned_to', '')}"
            ).lower()
            if sq in searchable:
                filtered.append(item)
        tasks = filtered

    # Offset & Limit slicing
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
                "priority": t.get("priority") or "NORMAL",
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
        priority=payload.priority or "HIGH PRIORITY",
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
        target_note = payload.get("note") or payload.get("notes") or payload.get("description")
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
            sr.description = str(target_note).strip()

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
        return {
            "success": True,
            "type": "support_request",
            "id": sr.id,
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
            "department_id": sr.department_id,
            "request_type": sr.service_type_id or "General",
            "priority": sr.priority or "NORMAL",
            "created_at": sr.created_at,
            "updated_at": sr.updated_at,
        }

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
        return {
            "success": True,
            "type": "directive",
            "id": d.id,
            "code": d.code,
            "status": d.status,
            "assigned_to": d.assigned_staff_name,
            "notes": d.description,
            "note": d.description,
        }

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
        if target_assigned_to:
            rso.assigned_staff_name = target_assigned_to
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


# Python alias for backward compatibility
update_generic_request_status = update_task_status



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
