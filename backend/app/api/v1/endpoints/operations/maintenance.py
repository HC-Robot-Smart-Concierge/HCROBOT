import random
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.core.database import get_db
from app.models import Staff, SupportRequest
from app.models.maintenance import MaintenanceCatalogItem
from app.schemas.operations import (
    MaintenanceRequestCreate,
    MaintenanceRequestStatusUpdate,
    MaintenanceRequestResponse,
    MaintenanceDashboardResponse,
    MaintenanceCatalogItemCreate,
    MaintenanceCatalogItemUpdate,
    MaintenanceCatalogItemResponse,
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
from app.schemas.response import NotFoundResponseSchema

router = APIRouter()

DEFAULT_MAINTENANCE_CATALOG = [
    {
        "id": "MNT-AC01",
        "name_vi": "Điều hòa không mát / Chỉ có gió",
        "name_en": "AC not cooling / Fan only",
        "category": "hvac",
        "priority": "HIGH",
        "description_vi": "Điều hòa đang bật nhưng không tỏa hơi lạnh, phòng bị hầm bí.",
        "description_en": "AC is running but blowing warm air, room feels stuffy.",
        "estimated_fix_time": 15,
        "is_active": True,
        "display_order": 1,
    },
    {
        "id": "MNT-AC02",
        "name_vi": "Điều hòa kêu to / Rung lắc",
        "name_en": "AC noisy / Heavy vibration",
        "category": "hvac",
        "priority": "NORMAL",
        "description_vi": "Cánh đảo gió hoặc quạt gió phát ra tiếng ồn khó chịu khi ngủ.",
        "description_en": "Loud rattling or fan noise disturbing guest rest.",
        "estimated_fix_time": 20,
        "is_active": True,
        "display_order": 2,
    },
    {
        "id": "MNT-AC03",
        "name_vi": "Điều hòa chảy nước trong phòng",
        "name_en": "AC leaking water inside room",
        "category": "hvac",
        "priority": "HIGH",
        "description_vi": "Nước nhỏ giọt từ máng lạnh xuống sàn hoặc bàn phòng.",
        "description_en": "Water dripping from the indoor unit onto the floor.",
        "estimated_fix_time": 15,
        "is_active": True,
        "display_order": 3,
    },
    {
        "id": "MNT-PL01",
        "name_vi": "Rò rỉ vòi nước / Vòi sen tắm",
        "name_en": "Faucet / Shower head leaking",
        "category": "plumbing",
        "priority": "NORMAL",
        "description_vi": "Vòi rửa mặt hoặc sen tắm rỉ nước liên tục gây đọng nước.",
        "description_en": "Continuous dripping from vanity faucet or shower head.",
        "estimated_fix_time": 15,
        "is_active": True,
        "display_order": 4,
    },
    {
        "id": "MNT-PL02",
        "name_vi": "Nghẹt bồn rửa / Thoát nước chậm",
        "name_en": "Sink clogged / Slow bathroom drainage",
        "category": "plumbing",
        "priority": "HIGH",
        "description_vi": "Bồn rửa mặt hoặc sàn tắm thoát nước rất chậm.",
        "description_en": "Water pooling and draining very slowly in the bathroom.",
        "estimated_fix_time": 20,
        "is_active": True,
        "display_order": 5,
    },
    {
        "id": "MNT-PL03",
        "name_vi": "Không có nước nóng tắm",
        "name_en": "No hot water in bathroom",
        "category": "plumbing",
        "priority": "HIGH",
        "description_vi": "Hệ thống nước nóng trung tâm không cấp nước nóng.",
        "description_en": "No hot water coming from shower or bathtub.",
        "estimated_fix_time": 15,
        "is_active": True,
        "display_order": 6,
    },
    {
        "id": "MNT-EL01",
        "name_vi": "Bóng đèn phòng bị hỏng / Chớp nháy",
        "name_en": "Room lighting not working / Flickering",
        "category": "electrical",
        "priority": "LOW",
        "description_vi": "Đèn ngủ hoặc đèn phòng tắm bị đứt bóng hoặc chập chờn.",
        "description_en": "Nightstand or bathroom light bulb burnt out or flickering.",
        "estimated_fix_time": 10,
        "is_active": True,
        "display_order": 7,
    },
    {
        "id": "MNT-EL02",
        "name_vi": "Ổ cắm điện không có điện",
        "name_en": "Wall electrical outlet not working",
        "category": "electrical",
        "priority": "NORMAL",
        "description_vi": "Ổ cắm cạnh giường hoặc bàn làm việc không sạc được điện.",
        "description_en": "Bedside or desk power socket has no power output.",
        "estimated_fix_time": 15,
        "is_active": True,
        "display_order": 8,
    },
    {
        "id": "MNT-EL03",
        "name_vi": "Mất điện toàn bộ phòng",
        "name_en": "Total room power outage",
        "category": "electrical",
        "priority": "URGENT",
        "description_vi": "Aptomat phòng bị nhảy, mất toàn bộ điện chiếu sáng và ổ cắm.",
        "description_en": "Circuit breaker tripped, room completely in darkness.",
        "estimated_fix_time": 10,
        "is_active": True,
        "display_order": 9,
    },
    {
        "id": "MNT-LK01",
        "name_vi": "Khóa thẻ từ phòng báo lỗi / Nháy đỏ",
        "name_en": "Keycard door lock error / Flashing red",
        "category": "door_lock",
        "priority": "URGENT",
        "description_vi": "Quẹt thẻ từ cửa phòng không kêu tít và không mở được chốt.",
        "description_en": "Door reader flashes red and refuses to unlock latch.",
        "estimated_fix_time": 10,
        "is_active": True,
        "display_order": 10,
    },
    {
        "id": "MNT-NW01",
        "name_vi": "Wifi phòng chập chờn / Không kết nối được",
        "name_en": "Room Wifi weak / Connection failure",
        "category": "media_network",
        "priority": "NORMAL",
        "description_vi": "Bộ phát Wifi tại phòng mất tín hiệu hoặc sóng rất yếu.",
        "description_en": "In-room access point disconnected or extremely weak signal.",
        "estimated_fix_time": 10,
        "is_active": True,
        "display_order": 11,
    },
    {
        "id": "MNT-NW02",
        "name_vi": "Tivi phòng không lên tín hiệu",
        "name_en": "Smart TV no signal / Cannot turn on",
        "category": "media_network",
        "priority": "LOW",
        "description_vi": "Màn hình TV báo không có tín hiệu cáp hoặc mất remote.",
        "description_en": "TV shows no signal screen or remote control unresponsive.",
        "estimated_fix_time": 15,
        "is_active": True,
        "display_order": 12,
    },
]


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
    requests = await sr_repo.get_recent_by_department(
        department_ids=["DEP-MAINTENANCE"],
        service_type_ids=["ST-MAINTENANCE"],
        limit=100,
    )

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
    await sr_repo.create(new_req)
    await create_department_notification(
        db=db,
        department="Maintenance",
        title=f"Yêu cầu Kỹ thuật mới: {req_in.title}",
        description=f"{req_in.location}: {req_in.description or 'Cần bảo trì kỹ thuật'}",
        request_id=new_req.id,
        request_type="maintenance",
        type="Request",
    )
    await sr_repo.commit()
    await sr_repo.refresh(new_req)
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

    req.updated_at = datetime.utcnow()
    await sr_repo.commit()
    await sr_repo.refresh(req)
    return req


# =====================================================================
# 4B. MAINTENANCE CATALOG MANAGEMENT (CRUD DANH MỤC SỰ CỐ BẢO TRÌ)
# =====================================================================

@router.get(
    "/maintenance/catalog",
    response_model=List[MaintenanceCatalogItemResponse],
    tags=TAG_MNT,
    summary="Danh sách danh mục mẫu các sự cố kỹ thuật thường gặp (Song ngữ Anh-Việt)",
)
async def get_maintenance_catalog(
    category: Optional[str] = Query(None, description="Lọc theo phân loại: hvac, plumbing, electrical, door_lock, media_network"),
    is_active: Optional[bool] = Query(None, description="Lọc sự cố đang bật phục vụ"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh mục các sự cố kỹ thuật bảo trì định sẵn.
    Nếu bảng CSDL chưa có dữ liệu, tự động khởi tạo dữ liệu mẫu song ngữ.
    """
    try:
        query = select(MaintenanceCatalogItem).order_by(MaintenanceCatalogItem.display_order.asc(), MaintenanceCatalogItem.created_at.asc())
        if category:
            query = query.where(MaintenanceCatalogItem.category == category)
        if is_active is not None:
            query = query.where(MaintenanceCatalogItem.is_active == is_active)

        result = await db.execute(query)
        items = list(result.scalars().all())

        # Auto-seed if database is empty and no specific filter
        if not items and category is None and is_active is None:
            for seed in DEFAULT_MAINTENANCE_CATALOG:
                db_item = MaintenanceCatalogItem(**seed)
                db.add(db_item)
            await db.commit()
            res_after = await db.execute(query)
            items = list(res_after.scalars().all())

        return items
    except Exception:
        # Fallback to in-memory default catalog if DB schema is still migrating
        filtered = DEFAULT_MAINTENANCE_CATALOG
        if category:
            filtered = [i for i in filtered if i.get("category") == category]
        if is_active is not None:
            filtered = [i for i in filtered if i.get("is_active") == is_active]
        return [
            {
                **item,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            for item in filtered
        ]


@router.post(
    "/maintenance/catalog",
    response_model=MaintenanceCatalogItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_MNT,
    summary="Tạo sự cố mẫu mới cho danh mục bảo trì",
)
async def create_maintenance_catalog_item(
    item_in: MaintenanceCatalogItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Nhân viên Kỹ thuật thêm sự cố thường gặp mới với tên tiếng Việt và tiếng Anh.
    """
    new_item = MaintenanceCatalogItem(
        id=f"MNT-{uuid.uuid4().hex[:6].upper()}",
        name_vi=item_in.name_vi.strip(),
        name_en=item_in.name_en.strip(),
        category=item_in.category.strip().lower(),
        priority=item_in.priority.strip().upper(),
        description_vi=item_in.description_vi.strip() if item_in.description_vi else None,
        description_en=item_in.description_en.strip() if item_in.description_en else None,
        estimated_fix_time=item_in.estimated_fix_time,
        is_active=item_in.is_active,
        display_order=item_in.display_order,
    )
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    return new_item


@router.put(
    "/maintenance/catalog/{item_id}",
    response_model=MaintenanceCatalogItemResponse,
    tags=TAG_MNT,
    summary="Cập nhật thông tin sự cố mẫu trong danh mục",
)
async def update_maintenance_catalog_item(
    item_id: str,
    item_in: MaintenanceCatalogItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Cập nhật tên, mô tả, phân loại, độ ưu tiên hoặc thời gian ước tính của sự cố.
    """
    stmt = select(MaintenanceCatalogItem).where(MaintenanceCatalogItem.id == item_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy sự cố trong danh mục")

    update_data = item_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(item, field, val)

    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)
    return item


@router.delete(
    "/maintenance/catalog/{item_id}",
    tags=TAG_MNT,
    summary="Xóa sự cố khỏi danh mục mẫu",
)
async def delete_maintenance_catalog_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Xóa hẳn một sự cố kỹ thuật khỏi danh mục mẫu.
    """
    stmt = select(MaintenanceCatalogItem).where(MaintenanceCatalogItem.id == item_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy sự cố trong danh mục")

    await db.delete(item)
    await db.commit()
    return {"message": "Đã xóa sự cố khỏi danh mục thành công", "id": item_id}


@router.patch(
    "/maintenance/catalog/{item_id}/toggle",
    response_model=MaintenanceCatalogItemResponse,
    tags=TAG_MNT,
    summary="Bật / tắt trạng thái khả dụng của sự cố",
)
async def toggle_maintenance_catalog_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Chuyển đổi trạng thái is_active giữa True và False.
    """
    stmt = select(MaintenanceCatalogItem).where(MaintenanceCatalogItem.id == item_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy sự cố trong danh mục")

    item.is_active = not item.is_active
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)
    return item


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
    clean_room = room_number.strip()
    if clean_room.lower().startswith("room "):
        clean_room = clean_room[5:].strip()

    all_dept_reqs = await sr_repo.get_recent_by_department(
        department_ids=["DEP-MAINTENANCE"],
        service_type_ids=["ST-MAINTENANCE"],
        limit=100,
    )

    room_reqs = []
    for r in all_dept_reqs:
        r_num = str(r.room_number or "").strip()
        if r_num.lower().startswith("room "):
            r_num = r_num[5:].strip()
        if r_num.lower() == clean_room.lower() or clean_room.lower() in str(r.room_number or "").lower():
            room_reqs.append(r)

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
            created_at=r.created_at or datetime.utcnow(),
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
