import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_

from app.core.database import get_db
from app.models import Staff, SupportRequest
from app.schemas.operations import (
    TaxiRequestCreate,
    TaxiRequestStatusUpdate,
    TaxiRequestResponse,
    TaxiDashboardResponse,
)
from .shared import TAG_TAXI, create_department_notification

router = APIRouter()


def _format_taxi_request(req: SupportRequest) -> TaxiRequestResponse:
    """Helper to parse a SupportRequest into a TaxiRequestResponse."""
    desc_str = req.description or ""
    # Extract destination if present
    destination = "Da Nang International Airport (DAD)"
    pickup_time = "Immediate"
    party_size = 2
    vehicle_type = "4-Seater Sedan"

    if "Điểm đến:" in desc_str:
        try:
            parts = desc_str.split("|")
            for part in parts:
                p = part.strip()
                if p.startswith("Điểm đến:"):
                    destination = p.replace("Điểm đến:", "").strip()
                elif p.startswith("Thời gian đón:"):
                    pickup_time = p.replace("Thời gian đón:", "").strip()
                elif p.startswith("Số lượng khách:"):
                    party_size = int(p.replace("Số lượng khách:", "").strip())
                elif p.startswith("Loại xe:"):
                    vehicle_type = p.replace("Loại xe:", "").strip()
        except Exception:
            pass

    return TaxiRequestResponse(
        id=req.id,
        ticket_code=req.ticket_code,
        guest_name=req.guest_name or "Hotel Guest",
        pickup_location=req.room_number or "Main Lobby & Front Entrance",
        destination=destination,
        pickup_time=pickup_time,
        party_size=party_size,
        vehicle_type=vehicle_type,
        status=req.status or "Pending",
        assigned_driver=req.assigned_staff_name,
        license_plate="43A-888.99" if req.assigned_staff_name else None,
        notes=desc_str,
        created_at=req.created_at,
    )


# =====================================================================
# 16. TAXI & TRANSPORTATION DASHBOARD & REQUESTS (ĐẶT XE & VẬN CHUYỂN)
# =====================================================================

@router.get(
    "/dashboard/taxi",
    response_model=TaxiDashboardResponse,
    tags=TAG_TAXI,
    summary="Dashboard điều phối Đặt xe & Vận chuyển (Taxi & Transportation)",
    responses={
        200: {"description": "Lấy thông tin Dashboard điều phối xe taxi thành công."}
    },
)
async def get_taxi_dashboard(db: AsyncSession = Depends(get_db)):
    """
    ### Mô tả nghiệp vụ:
    Bảng điều khiển trung tâm của bộ phận **Đặt xe & Vận chuyển (Taxi & Transportation)**.
    Quản lý các yêu cầu gọi xe sân bay, taxi tham quan, xe đưa đón theo lịch trình từ Concierge Robot hoặc Lễ tân.
    Dữ liệu được lưu trữ chuẩn hóa trong bảng `support_requests` với `service_type_id = 'ST-TAXI'` và `department_id = 'DEP-TAXI'`.
    """
    stmt = (
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-TAXI",
                SupportRequest.service_type_id == "ST-TAXI",
            )
        )
        .order_by(desc(SupportRequest.created_at))
    )
    res = await db.execute(stmt)
    raw_requests = res.scalars().all()
    requests = [_format_taxi_request(r) for r in raw_requests]

    pending_count = sum(1 for r in requests if r.status in ["Pending", "Unassigned"])
    active_count = sum(1 for r in requests if r.status in ["In Progress", "Driver Assigned", "On The Way"])
    completed_count = sum(1 for r in requests if r.status == "Completed")

    # Staff / drivers
    staff_res = await db.execute(
        select(Staff).where(
            or_(Staff.department_id == "DEP-TAXI", Staff.department == "Taxi"),
            Staff.is_active == True,
        )
    )
    taxi_staff = staff_res.scalars().all()

    fleet_status = [
        {
            "id": s.id,
            "driver_name": s.full_name,
            "vehicle": "Toyota Camry 2024 (4-Seater)",
            "license_plate": "43A-688.88",
            "status": "Available" if s.status == "available" else "On Trip",
            "phone": s.phone or "+84 90 123 4567",
        }
        for s in taxi_staff
    ]
    if not fleet_status:
        fleet_status = [
            {
                "id": "DRV-01",
                "driver_name": "Nguyễn Văn Hùng",
                "vehicle": "Toyota Innova (7-Seater SUV)",
                "license_plate": "43A-999.88",
                "status": "Available",
                "phone": "+84 90 511 2233",
            },
            {
                "id": "DRV-02",
                "driver_name": "Mai Linh Taxi Partner",
                "vehicle": "Hyundai Elantra (4-Seater)",
                "license_plate": "43A-777.66",
                "status": "Available",
                "phone": "+84 236 3 56 56 56",
            },
        ]

    available_drivers_count = sum(1 for f in fleet_status if f.get("status") == "Available")

    kpis = {
        "pendingRides": pending_count,
        "activeRides": active_count,
        "completedToday": completed_count,
        "availableDrivers": available_drivers_count,
    }

    announcement = {
        "title": "Tình hình giao thông Sân bay Đà Nẵng",
        "subtitle": "Khu vực ga đến quốc nội đang thông thoáng. Thời gian di chuyển trung bình từ khách sạn: 15 phút.",
        "status": "Normal Traffic",
    }

    return {
        "kpis": kpis,
        "requests": requests,
        "fleet_status": fleet_status,
        "announcement": announcement,
    }


@router.get(
    "/taxi/requests",
    response_model=List[TaxiRequestResponse],
    tags=TAG_TAXI,
    summary="Danh sách toàn bộ các yêu cầu đặt xe taxi",
)
async def list_taxi_requests(
    status_filter: Optional[str] = Query(None, description="Lọc theo trạng thái chuyến xe ('Pending', 'In Progress', 'Completed', 'Cancelled')"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các chuyến xe taxi đã tiếp nhận."""
    stmt = (
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-TAXI",
                SupportRequest.service_type_id == "ST-TAXI",
            )
        )
        .order_by(desc(SupportRequest.created_at))
    )
    if status_filter and status_filter not in ("All", ""):
        stmt = stmt.where(SupportRequest.status == status_filter)

    res = await db.execute(stmt)
    return [_format_taxi_request(r) for r in res.scalars().all()]


@router.post(
    "/taxi/requests",
    response_model=TaxiRequestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_TAXI,
    summary="Tạo mới yêu cầu gọi xe taxi / đưa đón sân bay",
    responses={
        201: {"description": "Tạo yêu cầu gọi xe thành công và lưu vào bảng support_requests."}
    },
)
async def create_taxi_request(req_in: TaxiRequestCreate, db: AsyncSession = Depends(get_db)):
    """
    ### Mô tả nghiệp vụ:
    Tiếp nhận yêu cầu gọi xe từ Khách hàng hoặc Concierge Robot.
    Tự động gắn mã dịch vụ `ST-TAXI` và phòng ban `DEP-TAXI` vào bảng `support_requests`.
    """
    ticket_code = f"TX-{random.randint(10000, 99999)}"
    title = f"Taxi: {req_in.pickup_location} -> {req_in.destination}"
    description = (
        f"Điểm đến: {req_in.destination} | Thời gian đón: {req_in.pickup_time or 'Immediate'} | "
        f"Số lượng khách: {req_in.party_size} | Loại xe: {req_in.vehicle_type}. "
        f"{req_in.description or ''}"
    ).strip()

    new_req = SupportRequest(
        ticket_code=ticket_code,
        title=title,
        room_number=req_in.pickup_location,
        guest_name=req_in.guest_name,
        source="From HCRobot",
        description=description,
        department_id="DEP-TAXI",
        service_type_id="ST-TAXI",
        status="Pending",
        priority="NORMAL",
    )
    db.add(new_req)
    await create_department_notification(
        db=db,
        department="Taxi",
        title=f"Yêu cầu Đặt xe mới #{ticket_code}",
        description=f"{req_in.pickup_location} -> {req_in.destination} ({req_in.vehicle_type})",
        request_id=new_req.id,
        request_type="taxi",
        type="Request",
    )
    await db.commit()
    await db.refresh(new_req)
    return _format_taxi_request(new_req)


@router.patch(
    "/taxi/requests/{request_id}/status",
    response_model=TaxiRequestResponse,
    tags=TAG_TAXI,
    summary="Cập nhật trạng thái chuyến xe và điều phối tài xế",
    responses={
        200: {"description": "Cập nhật trạng thái chuyến xe thành công."},
        404: {"description": "Không tìm thấy yêu cầu đặt xe."}
    },
)
@router.patch(
    "/taxi/requests/{request_id}",
    response_model=TaxiRequestResponse,
    tags=TAG_TAXI,
    include_in_schema=False,
)
async def update_taxi_request_status(
    request_id: str,
    update_in: TaxiRequestStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Điều phối viên gán tài xế, cập nhật trạng thái chuyến đi (`Driver Assigned`, `On The Way`, `Completed`, `Cancelled`).
    """
    clean_id = request_id.replace("REQ-", "").replace("TX-", "").strip()
    res = await db.execute(
        select(SupportRequest).where(
            or_(
                SupportRequest.id == request_id,
                SupportRequest.ticket_code == request_id,
                SupportRequest.id == clean_id,
                SupportRequest.ticket_code == clean_id,
                SupportRequest.ticket_code == f"TX-{clean_id}",
            )
        )
    )
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu đặt xe Taxi")

    req.status = update_in.status
    if update_in.assigned_driver:
        req.assigned_staff_name = update_in.assigned_driver
    req.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(req)
    return _format_taxi_request(req)
