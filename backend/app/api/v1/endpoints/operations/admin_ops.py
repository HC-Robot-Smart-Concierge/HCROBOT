import logging
import random
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import ManagementDirective, SupportRequest
from app.schemas.operations import (
    AdminOperationsSummary,
    AdminTaskDispatchCreate,
    DirectiveCreate,
    DirectiveResponse,
)
from app.repositories import (
    DirectiveRepository,
    get_directive_repository,
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


from .admin_ops_task_updates import router as admin_ops_task_updates_router

router.include_router(admin_ops_task_updates_router)


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


from .admin_ops_analytics import router as admin_ops_analytics_router

router.include_router(admin_ops_analytics_router)
