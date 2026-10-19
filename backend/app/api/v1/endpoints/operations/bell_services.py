import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Staff, SupportRequest
from app.schemas.operations import (
    BellRequestCreate,
    BellRequestStatusUpdate,
    BellRequestResponse,
    BellServicesDashboardResponse,
)
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
    requests = await sr_repo.get_recent_by_department(
        department_ids=["DEP-BELL"],
        service_type_ids=["ST-BELL"],
        limit=100,
    )

    pending_count = sum(1 for r in requests if r.status in ["Pending", "Unassigned"])
    on_job_count = sum(1 for r in requests if r.status == "In Progress")
    completed_count = sum(1 for r in requests if r.status == "Completed")

    bell_staff = await staff_repo.list_staff(department="Bell Services")

    team_status = [
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
    summary="Tạo mới yêu cầu hỗ trợ hành lý / Bellman",
    responses={
        201: {"description": "Tạo ticket hành lý thành công và lưu vào bảng support_requests."}
    },
)
async def create_bell_request(
    req_in: BellRequestCreate,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Tiếp nhận yêu cầu dịch vụ Bellman (chuyển hành lý, nhận đồ tại sảnh, hỗ trợ đổi phòng).
    Bản ghi được tự động lưu vào bảng `support_requests` với `department_id = 'DEP-BELL'` và `service_type_id = 'ST-BELL'`.
    """
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
    )
    await sr_repo.create(new_req)
    await create_department_notification(
        db=db,
        department="Bell Services",
        title=f"Yêu cầu Bellman mới: {req_in.title}",
        description=f"{req_in.location}: {req_in.description or req_in.guest_name or 'Yêu cầu hỗ trợ hành lý'}",
        request_id=new_req.id,
        request_type="bell_service",
        type="Request",
    )
    await sr_repo.commit()
    await sr_repo.refresh(new_req)
    return new_req


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
    Tra cứu chi tiết một yêu cầu dịch vụ Bellman / hành lý theo `request_id` (ID hệ thống hoặc mã `ticket_code` như `BS-504`).
    """
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu Bell Services")
    return req


