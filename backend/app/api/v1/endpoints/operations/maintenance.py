import random
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.core.database import get_db
from app.models import Staff, SupportRequest
from app.services.maintenance_request_service import get_or_create_maintenance_request, maintenance_room_filter, normalize_room, maintenance_queue_order, TERMINAL_STATUSES
from app.api.v1.endpoints.auth import get_current_user
from app.schemas.operations import (
    MaintenanceRequestCreate,
    MaintenanceRequestStatusUpdate,
    MaintenanceRequestPriorityUpdate,
    MaintenanceRequestResponse,
    MaintenanceDashboardResponse,
    RoomMaintenanceStatusResponse,
    RoomMaintenanceRequestItem,
)
from app.repositories import (
    SupportRequestRepository,
    get_support_request_repository,
    StaffRepository,
    get_staff_repository,
)
from .shared import TAG_MNT, create_department_notification
from app.core.time import utc_now_naive

router = APIRouter()

from .maintenance_catalog import router as maintenance_catalog_router


# =====================================================================
# 4. MAINTENANCE DASHBOARD & REQUESTS (KỸ THUẬT & BẢO TRÌ)
# =====================================================================

@router.get(
    "/dashboard/maintenance",
    response_model=MaintenanceDashboardResponse,
    tags=TAG_MNT,
    summary="Dashboard vận hành bộ phận Kỹ thuật & Bảo trì",
    responses={
        200: {"description": "Lấy dữ liệu Dashboard Kỹ thuật kèm KPI sự cố, kỹ thuật viên trực và bản đồ khu vực."}
    },
)
async def get_maintenance_dashboard(
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    staff_repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn bảng điều khiển của bộ phận **Kỹ thuật & Bảo trì (Facility Maintenance)**.
    Dữ liệu được truy vấn trực tiếp từ bảng chuẩn hóa `support_requests` có `service_type_id = 'ST-MAINTENANCE'` hoặc `department_id = 'DEP-MAINTENANCE'`.
    """
    department_filter = or_(SupportRequest.department_id == "DEP-MAINTENANCE", SupportRequest.service_type_id == "ST-MAINTENANCE")
    closed = func.lower(func.trim(func.coalesce(SupportRequest.status, "Pending"))).in_(TERMINAL_STATUSES)
    # Do not hide old waiting tickets behind the latest 100 completed tickets.
    active = (await sr_repo.db.execute(select(SupportRequest).where(department_filter, ~closed).order_by(*maintenance_queue_order()))).scalars().all()
    history = (await sr_repo.db.execute(select(SupportRequest).where(department_filter, closed).order_by(SupportRequest.created_at.desc()).limit(100))).scalars().all()
    requests = [*active, *history]

    pending_count = sum(1 for r in requests if r.status in ["Pending", "Unassigned"])
    in_prog_count = sum(1 for r in requests if r.status == "In Progress")
    completed_count = sum(1 for r in requests if r.status == "Completed")

    maint_staff = await staff_repo.list_staff(department="Maintenance")

    staff_availability = [
        {
            "id": s.id,
            "name": s.full_name,
            "role": s.role,
            "status": "Available" if s.status == "available" else "Busy",
            "statusClass": "text-emerald-600" if s.status == "available" else "text-amber-600",
        }
        for s in maint_staff
    ]
    if not staff_availability:
        staff_availability = [
            {"id": "MNT", "name": "James Doe", "role": "HVAC Tech & Maintenance", "status": "Available", "statusClass": "text-emerald-600"}
        ]

    active_techs_count = sum(1 for s in staff_availability if s.get("status") == "Available")

    kpis = {
        "availableTechs": {"count": active_techs_count, "delta": "+0", "status": "good"},
        "pendingRequests": pending_count,
        "inProgress": in_prog_count,
        "completedToday": {"count": completed_count, "delta": "+0", "status": "good"},
    }

    facility_map = {
        "zone": "Zone Status",
        "description": "View active requests and technician locations on the floor plan.",
        "thumbnail": "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&auto=format&fit=crop&q=80",
    }

    return {
        "kpis": kpis,
        "requests": requests,
        "staff_availability": staff_availability,
        "facility_map": facility_map,
    }


@router.post(
    "/maintenance/requests",
    response_model=MaintenanceRequestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_MNT,
    summary="Tạo mới yêu cầu xử lý sự cố kỹ thuật",
    responses={
        201: {"description": "Tạo ticket sự cố kỹ thuật thành công và lưu vào bảng support_requests."}
    },
)
async def create_maintenance_request(
    req_in: MaintenanceRequestCreate,
    response: Response,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Tiếp nhận sự cố kỹ thuật (điều hòa hỏng, chập điện, rò rỉ nước, khóa cửa phòng).
    Bản ghi được tự động lưu vào bảng `support_requests` với `department_id = 'DEP-MAINTENANCE'` và `service_type_id = 'ST-MAINTENANCE'`.
    """
    ticket_code = f"MN-{random.randint(404, 9999)}"
    new_req = SupportRequest(
        ticket_code=ticket_code,
        title=req_in.title,
        room_number=req_in.location,
        description=req_in.description,
        source=req_in.source or "Staff / Guest",
        department_id="DEP-MAINTENANCE",
        service_type_id="ST-MAINTENANCE",
        status="Pending",
    )
    new_req, created, merged = await get_or_create_maintenance_request(db, new_req, req_in.catalog_item_id)
    if not created and not merged:
        result = MaintenanceRequestResponse.model_validate(new_req).model_copy(update={"duplicate": True})
        await db.commit()
        response.status_code = status.HTTP_200_OK
        return result
    await create_department_notification(
        db=db,
        department="Maintenance",
        title=f"Bổ sung sự cố #{new_req.ticket_code}: {req_in.title}" if merged else f"Yêu cầu Kỹ thuật mới: {req_in.title}",
        description=f"{req_in.location}: {req_in.description or 'Cần bảo trì kỹ thuật'}",
        request_id=new_req.id,
        request_type="maintenance",
        type="Request",
    )
    await sr_repo.commit()
    await sr_repo.refresh(new_req)
    if merged:
        response.status_code = status.HTTP_200_OK
        return MaintenanceRequestResponse.model_validate(new_req).model_copy(update={"merged": True})
    return new_req


@router.get(
    "/maintenance/requests/{request_id}",
    response_model=MaintenanceRequestResponse,
    tags=TAG_MNT,
    summary="Xem chi tiết một yêu cầu Kỹ thuật & Bảo trì",
    responses={
        200: {"description": "Lấy chi tiết yêu cầu sự cố kỹ thuật thành công."},
        404: {"description": "Không tìm thấy yêu cầu kỹ thuật."},
    },
)
async def get_maintenance_request(
    request_id: str,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết một sự cố hoặc yêu cầu kỹ thuật theo `request_id` (ID hệ thống hoặc mã `ticket_code` như `MN-101`).
    """
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu kỹ thuật")
    return req


@router.patch(
    "/maintenance/requests/{request_id}",
    response_model=MaintenanceRequestResponse,
    tags=TAG_MNT,
    summary="Cập nhật trạng thái sự cố bảo trì",
)
async def update_maintenance_request_status(
    request_id: str,
    update_in: MaintenanceRequestStatusUpdate,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    Cập nhật trạng thái sự cố (In Progress, Completed, Declined) và phân công kỹ thuật viên.
    """
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu kỹ thuật")

    if update_in.status:
        req.status = update_in.status
        if update_in.status.lower() in ("completed", "done", "resolved"):
            req.progress = 100
        elif update_in.status.lower() in ("in progress", "assigned", "in preparation"):
            req.progress = 50
    if update_in.assigned_to or update_in.assigned_technician:
        req.assigned_staff_name = update_in.assigned_to or update_in.assigned_technician

    req.updated_at = utc_now_naive()
    await sr_repo.commit()
    await sr_repo.refresh(req)
    return req


@router.patch(
    "/maintenance/requests/{request_id}/priority",
    response_model=MaintenanceRequestResponse,
    tags=TAG_MNT,
)
async def update_maintenance_request_priority(
    request_id: str,
    update_in: MaintenanceRequestPriorityUpdate,
    current_user=Depends(get_current_user),
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    if current_user.default_dashboard not in ("maintenance", "admin_portal"):
        raise HTTPException(status_code=403, detail="Only maintenance staff or administrators can set repair priority")
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req or not (req.department_id == "DEP-MAINTENANCE" or req.service_type_id == "ST-MAINTENANCE"):
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    # Serialize with incoming symptom updates before changing shared metadata.
    await sr_repo.db.refresh(req, with_for_update=True)
    if (req.status or "").strip().lower() in TERMINAL_STATUSES:
        raise HTTPException(status_code=409, detail="This repair request is already closed")
    req.priority = update_in.priority
    req.extra_data = {**(req.extra_data or {}), "priority_set_by": current_user.id}
    req.updated_at = utc_now_naive()
    await sr_repo.commit()
    await sr_repo.refresh(req)
    return req


router.include_router(maintenance_catalog_router)


# =====================================================================
# 4C. ROOM MAINTENANCE STATUS TRACKING (TRA CỨU TIẾN ĐỘ SỬA CHỮA PHÒNG)
# =====================================================================

@router.get(
    "/maintenance/rooms/{room_number}/status",
    response_model=RoomMaintenanceStatusResponse,
    tags=TAG_MNT,
    summary="Tra cứu toàn bộ trạng thái sự cố kỹ thuật của một phòng",
)
async def get_room_maintenance_status(
    room_number: str,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    Tra cứu tiến độ xử lý sự cố kỹ thuật theo số phòng (ví dụ: '402', '305', 'Room 402'):
    - Tổng số yêu cầu
    - Số lượng đang chờ, đang sửa, đã hoàn thành
    - Danh sách chi tiết các ticket kèm kỹ thuật viên phụ trách
    """
    clean_room = normalize_room(room_number)
    room_reqs = (await sr_repo.db.execute(
        select(SupportRequest).where(
            or_(SupportRequest.department_id == "DEP-MAINTENANCE", SupportRequest.service_type_id == "ST-MAINTENANCE"),
            maintenance_room_filter(clean_room),
        ).order_by(SupportRequest.created_at.desc())
    )).scalars().all()

    pending_count = sum(1 for r in room_reqs if r.status in ["Pending", "Unassigned", "Pending Action"])
    in_prog_count = sum(1 for r in room_reqs if r.status in ["In Progress", "In Preparation", "Assigned"])
    completed_count = sum(1 for r in room_reqs if r.status in ["Completed", "Resolved"])

    items = [
        RoomMaintenanceRequestItem(
            id=r.id,
            ticket_code=r.ticket_code or r.id,
            title=r.title or "Sự cố kỹ thuật",
            category=getattr(r, "category", "general") or "general",
            status=r.status or "Pending",
            priority=r.priority or "Normal",
            assigned_to=r.assigned_staff_name,
            created_at=r.created_at or utc_now_naive(),
            est_completion=r.est_completion or "15 mins",
            description=r.description,
        )
        for r in room_reqs
    ]

    return RoomMaintenanceStatusResponse(
        room_number=clean_room,
        total_requests=len(room_reqs),
        pending_count=pending_count,
        in_progress_count=in_prog_count,
        completed_count=completed_count,
        requests=items,
    )
