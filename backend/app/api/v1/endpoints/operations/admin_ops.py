import logging
import random
import re
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import (
    ManagementDirective,
    SupportRequest,
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
from .admin_ops_helpers import (
    apply_admin_task_status_update,
    compute_admin_analytics_summary,
    fetch_and_filter_admin_tasks,
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
    return await fetch_and_filter_admin_tasks(
        db=db,
        department=department,
        status=status,
        search=search,
        room_number=room_number,
        limit=limit,
        offset=offset,
    )


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

    staff_ident = (payload.get("assigned_staff_id") if payload else None) or target_assigned_to
    return await apply_admin_task_status_update(
        ticket_id=ticket_id,
        target_status=target_status,
        target_assigned_to=target_assigned_to,
        target_assigned_robot=target_assigned_robot,
        target_note=target_note,
        target_progress_in=target_progress_in,
        db=db,
        sr_repo=sr_repo,
        directive_repo=directive_repo,
        rs_repo=rs_repo,
        staff_repo=staff_repo,
        staff_ident=staff_ident,
    )


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
    period: str = Query("all", pattern="^(all|weekly|monthly)$", description="Khoảng thời gian: all, weekly, monthly"),
    db: AsyncSession = Depends(get_db),
    staff_repo: StaffRepository = Depends(get_staff_repository),
    session_repo: SupportSessionRepository = Depends(get_support_session_repository),
):
    """Trả về số liệu phân tích vận hành thực tế 100% từ cơ sở dữ liệu."""
    return await compute_admin_analytics_summary(
        period=period,
        db=db,
        staff_repo=staff_repo,
        session_repo=session_repo,
    )
