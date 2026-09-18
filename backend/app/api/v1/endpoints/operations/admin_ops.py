import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.models import (
    Staff,
    RoomServiceOrder,
    HousekeepingRequest,
    BellRequest,
    MaintenanceRequest,
    ManagementDirective,
    ReceptionRequest,
    HumanSupportSession,
    ChatSession,
    ChatMessage,
)
from app.schemas.operations import (
    UnifiedOperationTask,
    AdminTaskDispatchCreate,
    AdminTaskStatusUpdate,
    AdminOperationsSummary,
    HumanSupportSessionResponse,
    RoomServiceOrderResponse,
    HousekeepingRequestResponse,
)
from .shared import TAG_ADMIN, TAG_OPS, _fetch_all_raw_requests, create_department_notification

router = APIRouter()

@router.get("/admin/tasks", response_model=List[UnifiedOperationTask], tags=TAG_ADMIN, summary="Admin: Danh sách tất cả các Task dịch vụ toàn khách sạn")
async def get_admin_tasks(
    department: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    Truy vấn danh sách công việc tập trung của toàn khách sạn cho Admin Operations.
    Hỗ trợ lọc theo phòng ban (department), trạng thái (status), tìm kiếm (search: phòng/khách/mã ticket).
    """
    raw_list = await _fetch_all_raw_requests(db)

    # Filter by department
    if department and department.lower() != "all":
        dep_clean = department.lower().strip()
        dept_mapping = {
            "f&b": ["f&b", "room service", "phục vụ phòng"],
            "room service": ["f&b", "room service"],
            "housekeeping": ["housekeeping", "buồng phòng"],
            "bell services": ["bell services", "bellman", "hành lý"],
            "maintenance": ["maintenance", "kỹ thuật", "bảo trì"],
            "reception": ["reception", "lễ tân"],
            "directive": ["directive", "executive", "chỉ thị"],
        }
        valid_matches = dept_mapping.get(dep_clean, [dep_clean])
        raw_list = [t for t in raw_list if any(m in t["department"].lower() for m in valid_matches)]

    # Filter by status
    if status and status.lower() != "all":
        st_clean = status.lower().strip()
        raw_list = [t for t in raw_list if st_clean in t["status"].lower()]

    # Filter by search term
    if search and search.strip():
        q = search.lower().strip()
        raw_list = [
            t for t in raw_list
            if (
                q in t["id"].lower()
                or q in t["title"].lower()
                or q in t["location"].lower()
                or q in t["guestName"].lower()
                or (t["notes"] and q in t["notes"].lower())
            )
        ]

    # Pagination
    paged = raw_list[offset : offset + limit]

    return [
        UnifiedOperationTask(
            id=item["id"],
            raw_id=item["raw_id"],
            department=item["department"],
            table_type=item["table_type"],
            title=item["title"],
            location=item["location"],
            guest_name=item["guestName"],
            priority=item["priority"],
            status=item["status"],
            time=item["time"],
            assigned_to=item.get("assignedTo"),
            assigned_robot=item.get("assigned_robot"),
            notes=item.get("notes"),
            source=item.get("source", "Robot / Staff"),
            created_at=item.get("created_at"),
        )
        for item in paged
    ]


@router.get("/admin/summary", response_model=AdminOperationsSummary, tags=TAG_ADMIN, summary="Admin: Thống kê số lượng ticket theo bộ phận")
async def get_admin_operations_summary(db: AsyncSession = Depends(get_db)):
    """Trả về số lượng ticket theo từng bộ phận và tổng số công việc đang xử lý."""
    raw_list = await _fetch_all_raw_requests(db)

    summary = AdminOperationsSummary(all_count=len(raw_list))

    for t in raw_list:
        dept = t["department"].lower()
        st = t["status"].lower()
        if st not in ["completed", "cancelled", "rejected"]:
            summary.total_active += 1

        if "reception" in dept:
            summary.reception_count += 1
        elif "housekeeping" in dept:
            summary.housekeeping_count += 1
        elif "f&b" in dept or "room service" in dept:
            summary.room_service_count += 1
        elif "bell" in dept:
            summary.bell_services_count += 1
        elif "maintenance" in dept:
            summary.maintenance_count += 1
        else:
            summary.directives_count += 1

    return summary


@router.post("/admin/dispatch", response_model=UnifiedOperationTask, tags=TAG_ADMIN, summary="Admin: Phát lệnh điều phối tạo Task mới")
async def admin_dispatch_task(
    task_in: AdminTaskDispatchCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin chủ động tạo yêu cầu dịch vụ hoặc chỉ thị điều phối.
    Dữ liệu sẽ tự động lưu vào đúng bảng CSDL của bộ phận tương ứng.
    """
    dep = task_in.department.lower().strip()
    rand_suffix = random.randint(1000, 9999)

    if "housekeeping" in dep or "buồng phòng" in dep:
        code = f"HK-{rand_suffix}"
        room = task_in.room_number.upper().replace("ROOM", "").strip()
        item = HousekeepingRequest(
            ticket_code=code,
            source="From Admin Portal",
            time_label="Just now",
            title=task_in.title,
            room_number=room,
            description=task_in.description,
            guest_name=task_in.guest_name,
            status="In Progress" if task_in.assigned_staff_name or task_in.assigned_robot_code else "Unassigned",
            assigned_staff_name=task_in.assigned_staff_name or task_in.assigned_robot_code,
        )
        db.add(item)
        await create_department_notification(
            db=db,
            department="Housekeeping",
            title=f"Yêu cầu Buồng phòng mới: {item.title}",
            description=f"{task_in.room_number}: {task_in.description or 'Chỉ thị từ quản trị viên'}",
            request_id=item.id,
            request_type="housekeeping",
            type="Request",
        )
        await db.commit()
        await db.refresh(item)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=item.id,
            department="Housekeeping",
            table_type="housekeeping",
            title=item.title,
            location=f"ROOM {item.room_number}",
            guest_name=item.guest_name or "Guest",
            priority="NORMAL",
            status=item.status,
            time="Just now",
            assigned_to=item.assigned_staff_name,
            assigned_robot=task_in.assigned_robot_code,
            notes=item.description,
            source=item.source,
            created_at=item.created_at,
        )

    elif "f&b" in dep or "room service" in dep:
        code = str(rand_suffix)
        order = RoomServiceOrder(
            order_number=code,
            room_number=task_in.room_number,
            status="Delivering" if task_in.assigned_robot_code else "Pending",
            items=[{"name": task_in.title, "qty": 1}],
            note=task_in.description,
            assigned_staff_name=task_in.assigned_staff_name,
        )
        db.add(order)
        await create_department_notification(
            db=db,
            department="F&B",
            title=f"Đơn Room Service mới #{code}",
            description=f"{task_in.room_number}: {task_in.title}",
            request_id=order.id,
            request_type="room_service",
            type="Request",
        )
        await db.commit()
        await db.refresh(order)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=order.id,
            department="F&B",
            table_type="room_service",
            title=task_in.title,
            location=order.room_number,
            guest_name=task_in.guest_name or "Room Guest",
            priority="NORMAL",
            status=order.status,
            time="Just now",
            assigned_to=order.assigned_staff_name,
            assigned_robot=task_in.assigned_robot_code,
            notes=order.note,
            source="From Admin Portal",
            created_at=order.created_at,
        )

    elif "bell" in dep:
        code = f"BS-{random.randint(500, 999)}"
        bell = BellRequest(
            ticket_code=code,
            title=task_in.title,
            location=task_in.room_number,
            guest_name=task_in.guest_name,
            reporter="Admin Dispatch",
            description=task_in.description,
            status="In Progress" if task_in.assigned_staff_name or task_in.assigned_robot_code else "Pending",
            assigned_to=task_in.assigned_staff_name or task_in.assigned_robot_code,
        )
        db.add(bell)
        await create_department_notification(
            db=db,
            department="Bell Services",
            title=f"Yêu cầu Bellman mới: {bell.title}",
            description=f"{bell.location}: {bell.description or 'Yêu cầu điều phối từ Quản trị'}",
            request_id=bell.id,
            request_type="bell_service",
            type="Request",
        )
        await db.commit()
        await db.refresh(bell)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=bell.id,
            department="Bell Services",
            table_type="bell",
            title=bell.title,
            location=bell.location,
            guest_name=bell.guest_name or "Guest",
            priority="NORMAL",
            status=bell.status,
            time="Just now",
            assigned_to=bell.assigned_to,
            assigned_robot=task_in.assigned_robot_code,
            notes=bell.description,
            source="From Admin Portal",
            created_at=bell.created_at,
        )

    elif "maintenance" in dep or "bảo trì" in dep:
        code = f"MN-{random.randint(400, 999)}"
        maint = MaintenanceRequest(
            ticket_code=code,
            title=task_in.title,
            reported_time_label="Just now",
            location=task_in.room_number,
            description=task_in.description,
            source="Admin Dispatch",
            status="In Progress" if task_in.assigned_staff_name else "Pending",
            assigned_to=task_in.assigned_staff_name,
        )
        db.add(maint)
        await create_department_notification(
            db=db,
            department="Maintenance",
            title=f"Yêu cầu Kỹ thuật mới: {maint.title}",
            description=f"{maint.location}: {maint.description or 'Yêu cầu bảo trì từ Quản trị'}",
            request_id=maint.id,
            request_type="maintenance",
            type="Request",
        )
        await db.commit()
        await db.refresh(maint)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=maint.id,
            department="Maintenance",
            table_type="maintenance",
            title=maint.title,
            location=maint.location,
            guest_name="Staff Reported",
            priority="NORMAL",
            status=maint.status,
            time="Just now",
            assigned_to=maint.assigned_to,
            assigned_robot=None,
            notes=maint.description,
            source="From Admin Portal",
            created_at=maint.created_at,
        )

    elif "reception" in dep or "lễ tân" in dep:
        code = f"REC-{random.randint(100, 999)}"
        rec = ReceptionRequest(
            ticket_code=code,
            title=task_in.title,
            created_label="Just now",
            location=task_in.room_number,
            guest_name=task_in.guest_name or "Hotel Guest",
            status="Pending Action",
            description=task_in.description or "",
            assigned_to=task_in.assigned_staff_name,
        )
        db.add(rec)
        await create_department_notification(
            db=db,
            department="Reception",
            title=f"Yêu cầu Lễ tân mới: {rec.title}",
            description=f"{rec.location}: {rec.description or 'Yêu cầu hỗ trợ từ Quản trị'}",
            request_id=rec.id,
            request_type="reception",
            type="Request",
        )
        await db.commit()
        await db.refresh(rec)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=rec.id,
            department="Reception",
            table_type="reception",
            title=rec.title,
            location=rec.location,
            guest_name=rec.guest_name,
            priority="NORMAL",
            status=rec.status,
            time="Just now",
            assigned_to=rec.assigned_to,
            assigned_robot=None,
            notes=rec.description,
            source="From Admin Portal",
            created_at=rec.created_at,
        )

    else:
        code = f"OP-{random.randint(100, 999)}"
        d = ManagementDirective(
            code=code,
            title=task_in.title,
            department=task_in.department,
            priority=task_in.priority,
            location=task_in.room_number,
            reported_time_label="Just now",
            description=task_in.description,
            status="In Progress" if task_in.assigned_staff_name else "Unassigned",
            assigned_staff_name=task_in.assigned_staff_name or task_in.assigned_robot_code,
            created_by="Admin Portal",
        )
        db.add(d)
        await create_department_notification(
            db=db,
            department=task_in.department or "All",
            title=f"Chỉ thị điều hành mới: {d.title}",
            description=f"{d.location}: {d.description or 'Chỉ thị công việc từ Quản lý'}",
            request_id=d.id,
            request_type="directive",
            type="Directive",
        )
        await db.commit()
        await db.refresh(d)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=d.id,
            department=d.department,
            table_type="directive",
            title=d.title,
            location=d.location,
            guest_name="Operations Directive",
            priority=d.priority,
            status=d.status,
            time="Just now",
            assigned_to=d.assigned_staff_name,
            assigned_robot=task_in.assigned_robot_code,
            notes=d.description,
            source=f"Admin ({d.created_by})",
            created_at=d.created_at,
        )


@router.get("/admin/tasks/{ticket_id}", response_model=UnifiedOperationTask, tags=TAG_OPS, summary="Admin: Xem chi tiết 1 Task")
async def get_admin_task_detail(ticket_id: str, db: AsyncSession = Depends(get_db)):
    """Lấy chi tiết đầy đủ của một Task qua mã ticket (ví dụ: 'REQ-1042', 'HK-1042', hoặc ID CSDL)."""
    clean_id = ticket_id.replace("REQ-", "").strip()
    raw_list = await _fetch_all_raw_requests(db)

    for item in raw_list:
        if (
            item["id"] == ticket_id
            or item["id"] == f"REQ-{clean_id}"
            or item["raw_id"] == clean_id
            or clean_id in item["id"]
        ):
            return UnifiedOperationTask(
                id=item["id"],
                raw_id=item["raw_id"],
                department=item["department"],
                table_type=item["table_type"],
                title=item["title"],
                location=item["location"],
                guest_name=item["guestName"],
                priority=item["priority"],
                status=item["status"],
                time=item["time"],
                assigned_to=item.get("assignedTo"),
                assigned_robot=item.get("assigned_robot"),
                notes=item.get("notes"),
                source=item.get("source", "Robot / Staff"),
                created_at=item.get("created_at"),
            )

    raise HTTPException(status_code=404, detail=f"Task with ID {ticket_id} not found")


@router.patch("/admin/tasks/{ticket_id}", tags=TAG_OPS, summary="Admin: Cập nhật trạng thái và điều phối Task")
async def update_admin_task(
    ticket_id: str,
    update_in: AdminTaskStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật trạng thái, người phụ trách hoặc Robot cho bất kỳ Task nào trong hệ thống."""
    clean_id = ticket_id.replace("REQ-", "").strip()
    upper_id = ticket_id.upper()

    # 1. Housekeeping check if HK in ticket_id
    if "HK" in upper_id:
        res = await db.execute(
            select(HousekeepingRequest).where(
                (HousekeepingRequest.ticket_code == clean_id)
                | (HousekeepingRequest.id == clean_id)
                | (HousekeepingRequest.ticket_code == ticket_id)
                | (HousekeepingRequest.id == ticket_id)
                | (HousekeepingRequest.ticket_code.ilike(f"%{clean_id}%"))
            )
        )
        hk = res.scalar_one_or_none()
        if hk:
            hk.status = update_in.status
            if update_in.assigned_to:
                hk.assigned_staff_name = update_in.assigned_to
            if update_in.note:
                hk.description = f"{hk.description or ''} | Note: {update_in.note}"
            await db.commit()
            return {"success": True, "type": "housekeeping", "id": hk.id, "status": hk.status}

    # 2. Bell Services check if BS in ticket_id
    if "BS" in upper_id or "BELL" in upper_id:
        res = await db.execute(
            select(BellRequest).where(
                (BellRequest.ticket_code == clean_id)
                | (BellRequest.id == clean_id)
                | (BellRequest.ticket_code == ticket_id)
                | (BellRequest.id == ticket_id)
                | (BellRequest.ticket_code.ilike(f"%{clean_id}%"))
            )
        )
        bell = res.scalar_one_or_none()
        if bell:
            bell.status = update_in.status
            if update_in.assigned_to:
                bell.assigned_to = update_in.assigned_to
            await db.commit()
            return {"success": True, "type": "bell", "id": bell.id, "status": bell.status}

    # 3. Maintenance check if MN in ticket_id
    if "MN" in upper_id or "MAINT" in upper_id:
        res = await db.execute(
            select(MaintenanceRequest).where(
                (MaintenanceRequest.ticket_code == clean_id)
                | (MaintenanceRequest.id == clean_id)
                | (MaintenanceRequest.ticket_code == ticket_id)
                | (MaintenanceRequest.id == ticket_id)
                | (MaintenanceRequest.ticket_code.ilike(f"%{clean_id}%"))
            )
        )
        maint = res.scalar_one_or_none()
        if maint:
            maint.status = update_in.status
            if update_in.assigned_to:
                maint.assigned_to = update_in.assigned_to
            await db.commit()
            return {"success": True, "type": "maintenance", "id": maint.id, "status": maint.status}

    # 4. Reception check if RC in ticket_id
    if "RC" in upper_id or "REC" in upper_id:
        res = await db.execute(
            select(ReceptionRequest).where(
                (ReceptionRequest.ticket_code == clean_id)
                | (ReceptionRequest.id == clean_id)
                | (ReceptionRequest.ticket_code == ticket_id)
                | (ReceptionRequest.id == ticket_id)
                | (ReceptionRequest.ticket_code.ilike(f"%{clean_id}%"))
            )
        )
        rec = res.scalar_one_or_none()
        if rec:
            rec.status = update_in.status
            if update_in.assigned_to:
                rec.assigned_to = update_in.assigned_to
            await db.commit()
            return {"success": True, "type": "reception", "id": rec.id, "status": rec.status}

    # 5. Directive check if DIR in ticket_id
    if "DIR" in upper_id:
        res = await db.execute(
            select(ManagementDirective).where(
                (ManagementDirective.code == clean_id)
                | (ManagementDirective.id == clean_id)
                | (ManagementDirective.code == ticket_id)
                | (ManagementDirective.id == ticket_id)
                | (ManagementDirective.code.ilike(f"%{clean_id}%"))
            )
        )
        dir_item = res.scalar_one_or_none()
        if dir_item:
            dir_item.status = update_in.status
            if update_in.assigned_to:
                dir_item.assigned_staff_name = update_in.assigned_to
            await db.commit()
            return {"success": True, "type": "directive", "id": dir_item.id, "status": dir_item.status}

    # 6. Room Service (Default for orders or numeric IDs like REQ-1042)
    res = await db.execute(
        select(RoomServiceOrder).where(
            (RoomServiceOrder.order_number == clean_id)
            | (RoomServiceOrder.id == clean_id)
            | (RoomServiceOrder.order_number == ticket_id)
            | (RoomServiceOrder.id == ticket_id)
            | (RoomServiceOrder.id.ilike(f"%{clean_id}%"))
        )
    )
    order = res.scalar_one_or_none()
    if order:
        order.status = update_in.status
        if update_in.assigned_to:
            order.assigned_staff_name = update_in.assigned_to
        if update_in.note:
            order.note = update_in.note
        await db.commit()
        return {"success": True, "type": "room_service", "id": order.id, "status": order.status}

    # Fallback search across all other tables if no prefix matched
    for model, type_name, id_col, staff_col in [
        (HousekeepingRequest, "housekeeping", HousekeepingRequest.ticket_code, "assigned_staff_name"),
        (BellRequest, "bell", BellRequest.ticket_code, "assigned_to"),
        (MaintenanceRequest, "maintenance", MaintenanceRequest.ticket_code, "assigned_to"),
        (ReceptionRequest, "reception", ReceptionRequest.ticket_code, "assigned_to"),
        (ManagementDirective, "directive", ManagementDirective.code, "assigned_staff_name"),
    ]:
        res = await db.execute(
            select(model).where(
                (id_col == clean_id)
                | (model.id == clean_id)
                | (id_col == ticket_id)
                | (model.id == ticket_id)
                | (id_col.ilike(f"%{clean_id}%"))
            )
        )
        item = res.scalar_one_or_none()
        if item:
            item.status = update_in.status
            if update_in.assigned_to:
                setattr(item, staff_col, update_in.assigned_to)
            await db.commit()
            return {"success": True, "type": type_name, "id": item.id, "status": item.status}

    raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")


# Backwards compatibility endpoints
@router.get("/all-requests", tags=TAG_OPS, summary="Legacy: Lấy tất cả request")
async def get_all_unified_requests(db: AsyncSession = Depends(get_db)):
    return await _fetch_all_raw_requests(db)


@router.patch("/generic-request/{ticket_id}/status", tags=TAG_OPS, summary="Legacy: Cập nhật status request")
async def update_generic_request_status(
    ticket_id: str,
    status: str,
    assigned_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    update_data = AdminTaskStatusUpdate(status=status, assigned_to=assigned_to)
    return await update_admin_task(ticket_id=ticket_id, update_in=update_data, db=db)
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
        "Housekeeping": 0,
        "F&B": 0,
        "Bell Services": 0,
        "Maintenance": 0,
    }
    for t in raw_list:
        d = t["department"].lower()
        if "reception" in d:
            dept_distribution["Reception"] += 1
        elif "housekeeping" in d:
            dept_distribution["Housekeeping"] += 1
        elif "f&b" in d or "room service" in d:
            dept_distribution["F&B"] += 1
        elif "bell" in d:
            dept_distribution["Bell Services"] += 1
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
