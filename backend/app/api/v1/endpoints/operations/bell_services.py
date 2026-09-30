import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_

from app.core.database import get_db
from app.models import Staff, SupportRequest
from app.schemas.operations import (
    BellRequestCreate,
    BellRequestStatusUpdate,
    BellRequestResponse,
    BellServicesDashboardResponse,
)
from .shared import TAG_BELL, create_department_notification

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
async def get_bell_services_dashboard(db: AsyncSession = Depends(get_db)):
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
    stmt = (
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-BELL",
                SupportRequest.service_type_id == "ST-BELL",
            )
        )
        .order_by(desc(SupportRequest.created_at))
    )
    res = await db.execute(stmt)
    requests = res.scalars().all()

    pending_count = sum(1 for r in requests if r.status in ["Pending", "Unassigned"])
    on_job_count = sum(1 for r in requests if r.status == "In Progress")
    completed_count = sum(1 for r in requests if r.status == "Completed")

    staff_res = await db.execute(
        select(Staff).where(
            or_(Staff.department_id == "DEP-BELL", Staff.department == "Bell Services"),
            Staff.is_active == True,
        )
    )
    bell_staff = staff_res.scalars().all()

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
async def create_bell_request(req_in: BellRequestCreate, db: AsyncSession = Depends(get_db)):
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
        priority="NORMAL",
    )
    db.add(new_req)
    await create_department_notification(
        db=db,
        department="Bell Services",
        title=f"Yêu cầu Bellman mới: {req_in.title}",
        description=f"{req_in.location}: {req_in.description or req_in.guest_name or 'Yêu cầu hỗ trợ hành lý'}",
        request_id=new_req.id,
        request_type="bell_service",
        type="Request",
    )
    await db.commit()
    await db.refresh(new_req)
    return new_req


@router.patch(
    "/bell-services/requests/{request_id}/status",
    response_model=BellRequestResponse,
    tags=TAG_BELL,
    summary="Cập nhật trạng thái và tiếp nhận nhiệm vụ Bellman",
    responses={
        200: {"description": "Cập nhật trạng thái nhiệm vụ Bellman thành công."},
        404: {"description": "Không tìm thấy yêu cầu với ID hoặc ticket_code được cung cấp."}
    },
)
async def update_bell_request_status(
    request_id: str,
    update_in: BellRequestStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Nhân viên Bellman bấm **Nhận việc (Accept)** hoặc **Hoàn thành (Complete)** trên giao diện Dashboard.
    Cập nhật trạng thái trực tiếp trong bảng `support_requests`.
    """
    clean_id = request_id.replace("REQ-", "").strip()
    res = await db.execute(
        select(SupportRequest).where(
            or_(
                SupportRequest.id == request_id,
                SupportRequest.ticket_code == request_id,
                SupportRequest.id == clean_id,
                SupportRequest.ticket_code == clean_id,
            )
        )
    )
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu Bell Services")

    req.status = update_in.status
    if update_in.assigned_to:
        req.assigned_staff_name = update_in.assigned_to
    req.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(req)
    return req
