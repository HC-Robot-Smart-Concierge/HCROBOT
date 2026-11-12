import random
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import SupportRequest
from app.schemas.operations import (
    BellRequestCreate,
    BellRequestStatusUpdate,
    BellRequestResponse,
    BellRoomStatusResponse,
    BellServicesDashboardResponse,
)
from app.services.bell_request_service import (
    BELL_DEPARTMENT_ID,
    BELL_SERVICE_TYPE_ID,
    get_or_create_bell_request,
)
from app.services.maintenance_request_service import maintenance_room_filter, normalize_room
from app.repositories import (
    SupportRequestRepository,
    get_support_request_repository,
    StaffRepository,
    get_staff_repository,
)
from .shared import TAG_BELL, create_department_notification
from app.schemas.response import NotFoundResponseSchema

router = APIRouter()


# =====================================================================
# 3. BELL SERVICES DASHBOARD & REQUESTS (HÀNH LÝ & TIỀN SẢNH)
# =====================================================================

@router.get(
    "/dashboard/bell-services",
    response_model=BellServicesDashboardResponse,
    tags=TAG_BELL,
    summary="Dashboard vận hành bộ phận Bellman & Hành lý",
    responses={
        200: {"description": "Lấy dữ liệu Dashboard Bell Services thành công kèm KPI, danh sách yêu cầu và nhân sự trực."}
    },
)
async def get_bell_services_dashboard(
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    staff_repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn toàn bộ dữ liệu bảng điều khiển của bộ phận **Hành lý & Tiền sảnh (Bell Services)**.
    Dữ liệu được truy vấn trực tiếp từ bảng chuẩn hóa `support_requests` có `service_type_id = 'ST-BELL'` hoặc `department_id = 'DEP-BELL'`.

    ### Kết quả trả về:
    - **kpis**: Thống kê số lượng yêu cầu đang chờ (`pending`), đang xử lý (`onJob`), đã hoàn thành (`completed`) và xe cart/robot sẵn sàng.
    - **requests**: Danh sách các ticket hành lý, hỗ trợ đổi phòng, tìm đồ thất lạc mới nhất.
    - **team_status**: Danh sách nhân viên Bellman đang làm việc và xe vận chuyển tự hành.
    - **announcement**: Bản tin thông báo giờ cao điểm check-in / check-out.
    """
    raw_requests = await sr_repo.get_recent_by_department(
        department_ids=["DEP-BELL"],
        service_type_ids=["ST-BELL", "ST-LUGGAGE"],
        limit=100,
    )
    requests = [r for r in raw_requests if r.request_type != "emotion_alert"]

    pending_count = sum(1 for r in requests if r.status in ["Pending", "Unassigned"])
    on_job_count = sum(1 for r in requests if r.status == "In Progress")
    completed_count = sum(1 for r in requests if r.status == "Completed")
    luggage_count = sum(1 for r in requests if r.request_type in ["luggage", "room_move"])
    lost_found_count = sum(1 for r in requests if r.request_type == "lost_found")

    bell_staff = await staff_repo.list_staff(department="Bell Services")

    team_status: List[Dict[str, Any]] = [
        {"id": s.id, "name": s.full_name, "role": s.role, "status": s.status, "avatar": s.avatar_url}
        for s in bell_staff
    ]
    if not team_status:
        team_status = [
            {"id": "b1", "name": "Marcus T.", "role": "Bell Captain", "status": "available", "avatar": None},
        ]
    team_status.append(
        {
            "id": "bot-alpha",
            "name": "Bot Unit Alpha",
            "role": "Automated Cart",
            "status": "available",
            "isRobot": True,
        }
    )

    available_fleet_count = sum(1 for s in team_status if s.get("status") == "available")

    kpis = {
        "pending": pending_count,
        "onJob": on_job_count,
        "completed": completed_count,
        "activeFleet": available_fleet_count,
        "luggageCount": luggage_count,
        "lostFoundCount": lost_found_count,
    }

    announcement = {
        "title": "Peak Hours Approaching",
        "subtitle": "Expect high volume of check-outs between 10:00 AM and 12:00 PM.",
        "imageUrl": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&auto=format&fit=crop&q=80",
    }

    return {
        "kpis": kpis,
        "requests": requests,
        "team_status": team_status,
        "announcement": announcement,
    }


@router.post(
    "/bell-services/requests",
    response_model=BellRequestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_BELL,
    summary="Tạo mới yêu cầu hỗ trợ hành lý / báo cáo đồ thất lạc (Bellman)",
    responses={
        201: {"description": "Tạo ticket Bellman thành công và lưu vào bảng support_requests."}
    },
)
async def create_bell_request(
    req_in: BellRequestCreate,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Tiếp nhận yêu cầu dịch vụ Bellman thuộc 2 luồng chính:
    1. **Tiếp nhận yêu cầu hỗ trợ hành lý** (`request_type = 'luggage'` hoặc `'room_move'`)
    2. **Tiếp nhận báo cáo đồ thất lạc** (`request_type = 'lost_found'`)
    Bản ghi được tự động lưu vào bảng `support_requests` với `department_id = 'DEP-BELL'` và `service_type_id = 'ST-BELL'`.

    Menu Bellman trên robot gửi kèm `service_key`: nếu phòng đã có yêu cầu cùng dịch vụ đang mở,
    API trả lại phiếu đó với `duplicate = true` và không tạo phiếu mới.
    """
    if req_in.service_key:
        try:
            req, created = await get_or_create_bell_request(
                db,
                room_number=req_in.location,
                description=req_in.description or req_in.title,
                source=req_in.source or req_in.reporter or "HCRobot Kiosk Screen",
                service_key=req_in.service_key,
                guest_name=req_in.guest_name,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        await db.commit()
        await db.refresh(req)
        return BellRequestResponse.model_validate(req).model_copy(update={"duplicate": not created})

    req_type = (req_in.request_type or "luggage").strip().lower()
    text_blob = f"{req_in.title or ''} {req_in.description or ''}".lower()
    if req_type in ["luggage", "general", "bellman", "bell_service"]:
        if any(k in text_blob for k in ["thất lạc", "quên đồ", "mất đồ", "rơi đồ", "lost", "missing", "forgot"]):
            req_type = "lost_found"
        elif any(k in text_blob for k in ["đổi phòng", "chuyển phòng", "room move"]):
            req_type = "room_move"
        else:
            req_type = "luggage"

    ticket_code = f"BS-{random.randint(504, 9999)}"
    new_req = SupportRequest(
        ticket_code=ticket_code,
        title=req_in.title,
        room_number=req_in.location,
        guest_name=req_in.guest_name or "Hotel Guest",
        source=req_in.reporter or "Front Desk / Robot",
        description=req_in.description,
        department_id="DEP-BELL",
        service_type_id="ST-BELL",
        status="Pending",
        request_type=req_type,
    )
    await sr_repo.create(new_req)

    if req_type == "lost_found":
        notif_title = f"Báo cáo Đồ thất lạc mới #{ticket_code}"
    else:
        notif_title = f"Yêu cầu Hỗ trợ Hành lý mới #{ticket_code}"

    await create_department_notification(
        db=db,
        department="Bell Services",
        title=notif_title,
        description=f"{req_in.location}: {req_in.title} - {req_in.description or req_in.guest_name or ''}".strip(" -"),
        request_id=new_req.id,
        request_type="bell_service",
        type="Request",
    )
    await sr_repo.commit()
    await sr_repo.refresh(new_req)
    return new_req


@router.patch(
    "/bell-services/requests/{request_id}",
    response_model=BellRequestResponse,
    tags=TAG_BELL,
    summary="Cập nhật trạng thái và nhân viên xử lý yêu cầu Bell Services",
)
async def update_bell_request(
    request_id: str,
    update_in: BellRequestStatusUpdate,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu Bell Services")
    if update_in.status:
        req.status = update_in.status
    staff_val = update_in.assigned_to or update_in.assigned_staff
    if staff_val is not None:
        req.assigned_staff_name = staff_val
    await sr_repo.commit()
    await sr_repo.refresh(req)
    return req


@router.get(
    "/bell-services/requests/{request_id}",
    response_model=BellRequestResponse,
    tags=TAG_BELL,
    summary="Xem chi tiết một yêu cầu Bell Services",
    responses={
        200: {"description": "Lấy chi tiết yêu cầu Bellman / hành lý thành công."},
        404: {
            "model": NotFoundResponseSchema,
            "description": "Không tìm thấy yêu cầu Bell Services.",
        },
    },
)
async def get_bell_request(
    request_id: str,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết một yêu cầu dịch vụ Bellman / hành lý theo `request_id` (ID hệ thống hoặc mã `ticket_code` như `BS-501`).
    """
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu Bell Services")
    return req


@router.get(
    "/bell-services/rooms/{room_number}/status",
    response_model=BellRoomStatusResponse,
    tags=TAG_BELL,
    summary="Tra cứu tiến độ các yêu cầu Bellman của một phòng",
)
async def get_room_bell_status(room_number: str, db: AsyncSession = Depends(get_db)):
    """Robot kiosk (sau khi xác thực PIN phòng) xem các yêu cầu hành lý / chuyển phòng của phòng, mới nhất trước."""
    clean_room = normalize_room(room_number)
    room_reqs = (await db.execute(
        select(SupportRequest).where(
            or_(SupportRequest.department_id == BELL_DEPARTMENT_ID, SupportRequest.service_type_id == BELL_SERVICE_TYPE_ID),
            maintenance_room_filter(clean_room),
        ).order_by(SupportRequest.created_at.desc()).limit(30)
    )).scalars().all()
    statuses = [(r.status or "Pending").strip().lower() for r in room_reqs]
    return {
        "room_number": clean_room,
        "pending_count": sum(s in ("pending", "unassigned") for s in statuses),
        "in_progress_count": sum(s in ("in progress", "assigned") for s in statuses),
        "completed_count": sum(s in ("completed", "resolved", "done") for s in statuses),
        "requests": room_reqs,
    }


