import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Staff, SupportRequest
from app.schemas.operations import (
    TaxiRequestCreate,
    TaxiRequestStatusUpdate,
    TaxiRequestResponse,
    TaxiDashboardResponse,
)
from app.repositories import (
    SupportRequestRepository,
    get_support_request_repository,
    StaffRepository,
    get_staff_repository,
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

    desc_lower = desc_str.lower()
    if "điểm đến:" in desc_lower or "diem den:" in desc_lower:
        try:
            parts = desc_str.split("|")
            for part in parts:
                p = part.strip()
                p_lower = p.lower()
                if p_lower.startswith("điểm đến:") or p_lower.startswith("diem den:"):
                    destination = p.split(":", 1)[1].strip().rstrip(".")
                elif p_lower.startswith("thời gian đón:") or p_lower.startswith("thoi gian don:"):
                    pickup_time = p.split(":", 1)[1].strip().rstrip(".")
                elif p_lower.startswith("số lượng khách:") or p_lower.startswith("so luong khach:"):
                    party_size = int(p.split(":", 1)[1].strip().rstrip("."))
                elif p_lower.startswith("loại xe:") or p_lower.startswith("loai xe:"):
                    vehicle_type = p.split(":", 1)[1].strip().rstrip(".")
        except Exception:
            pass

    return TaxiRequestResponse(
        id=req.id,
        ticket_code=req.ticket_code,
        guest_name=req.guest_name or "Hotel Guest",
        pickup_location=req.room_number or "Main Lobby & Front Entrance",
        room_number=req.room_number,
        destination=destination,
        pickup_time=pickup_time,
        party_size=party_size,
        vehicle_type=vehicle_type,
        status=req.status or "Pending",
        assigned_driver=req.assigned_staff_name,
        license_plate="43A-888.99" if req.assigned_staff_name else None,
        notes=desc_str,
        created_at=req.created_at or datetime.utcnow(),
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
async def get_taxi_dashboard(
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    staff_repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Bảng điều khiển trung tâm của bộ phận **Đặt xe & Vận chuyển (Taxi & Transportation)**.
    Quản lý các yêu cầu gọi xe sân bay, taxi tham quan, xe đưa đón theo lịch trình từ Concierge Robot hoặc Lễ tân.
    Dữ liệu được lưu trữ chuẩn hóa trong bảng `support_requests` với `service_type_id = 'ST-TAXI'` và `department_id = 'DEP-TAXI'`.
    """
    raw_requests = await sr_repo.get_recent_by_department(
        department_ids=["DEP-TAXI"],
        service_type_ids=["ST-TAXI"],
        limit=100,
    )
    requests = [_format_taxi_request(r) for r in raw_requests]

    pending_count = sum(1 for r in requests if (r.status or "").lower() in ["pending", "unassigned", "chờ tiếp nhận", "missed"])
    calling_count = sum(1 for r in requests if (r.status or "").lower() in ["calling", "in progress", "driver assigned", "on the way", "đang gọi"])
    completed_count = sum(1 for r in requests if (r.status or "").lower() in ["completed", "thành công", "success", "done"])

    taxi_staff = await staff_repo.list_staff(department="Taxi")

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
        "totalRequests": len(requests),
        "pendingRequests": pending_count,
        "callingRequests": calling_count,
        "activeTrips": calling_count,
        "completedTrips": completed_count,
        "pendingRides": pending_count,
        "activeRides": calling_count,
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
async def create_taxi_request(
    req_in: TaxiRequestCreate,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Tiếp nhận yêu cầu gọi xe từ Khách hàng hoặc Concierge Robot.
    Tự động gắn mã dịch vụ `ST-TAXI` và phòng ban `DEP-TAXI` vào bảng `support_requests`.
    """
    resolved_room = req_in.room_number or (req_in.pickup_location if any(c.isdigit() for c in req_in.pickup_location) else None)
    ticket_code = f"TX-{random.randint(10000, 99999)}"
    title = f"Taxi: Phòng {resolved_room} -> {req_in.destination}" if resolved_room else f"Taxi: {req_in.pickup_location} -> {req_in.destination}"
    description = (
        f"Điểm đến: {req_in.destination} | Thời gian đón: {req_in.pickup_time or 'Immediate'} | "
        f"Số lượng khách: {req_in.party_size} | Loại xe: {req_in.vehicle_type}. "
        f"{req_in.description or ''}"
    ).strip()

    new_req = SupportRequest(
        ticket_code=ticket_code,
        title=title,
        room_number=resolved_room or req_in.pickup_location,
        guest_name=req_in.guest_name,
        source="From HCRobot",
        description=description,
        department_id="DEP-TAXI",
        service_type_id="ST-TAXI",
        status="Pending",
    )
    await sr_repo.create(new_req)
    await create_department_notification(
        db=db,
        department="Concierge",
        title=f"Yêu cầu Đặt xe mới #{ticket_code}",
        description=f"Phòng {resolved_room or req_in.pickup_location}: {req_in.destination} ({req_in.vehicle_type})",
        request_id=new_req.id,
        request_type="taxi",
        type="Request",
    )
    await create_department_notification(
        db=db,
        department="Taxi",
        title=f"Yêu cầu Đặt xe mới #{ticket_code}",
        description=f"Phòng {resolved_room or req_in.pickup_location}: {req_in.destination} ({req_in.vehicle_type})",
        request_id=new_req.id,
        request_type="taxi",
        type="Request",
    )
    await sr_repo.commit()
    await sr_repo.refresh(new_req)
    return _format_taxi_request(new_req)


@router.get(
    "/taxi/requests",
    response_model=List[TaxiRequestResponse],
    tags=TAG_TAXI,
    summary="Lấy danh sách các yêu cầu đặt xe Taxi",
    responses={
        200: {"description": "Lấy danh sách yêu cầu gọi xe thành công."}
    },
)
async def list_taxi_requests(
    search: Optional[str] = Query(None, description="Tìm kiếm theo số phòng, mã vé, điểm đón, điểm đến hoặc tên khách"),
    status: Optional[str] = Query(None, description="Lọc theo trạng thái chuyến xe"),
    limit: int = Query(50, ge=1, le=100, description="Số lượng bản ghi tối đa"),
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua (Offset)"),
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu danh sách các cuốc xe taxi / đưa đón do Robot hoặc Lễ tân tạo ra.
    Hỗ trợ phân trang chuẩn SQL (offset/limit), lọc theo từ khóa tìm kiếm (số phòng, mã vé, điểm đến) và trạng thái.
    """
    raw_requests = await sr_repo.get_recent_by_department(
        department_ids=["DEP-TAXI"],
        service_type_ids=["ST-TAXI"],
        limit=limit,
        skip=skip,
    )
    formatted = [_format_taxi_request(r) for r in raw_requests]
    if search:
        s = search.lower().strip()
        formatted = [
            r for r in formatted
            if s in (r.ticket_code or "").lower()
            or s in (r.pickup_location or "").lower()
            or s in (r.guest_name or "").lower()
            or (r.room_number and s in r.room_number.lower())
            or s in (r.destination or "").lower()
        ]
    if status and status != "All":
        formatted = [r for r in formatted if (r.status or "").lower() == status.lower()]
    return formatted


@router.get(
    "/taxi/requests/{request_id}",
    response_model=TaxiRequestResponse,
    tags=TAG_TAXI,
    summary="Xem chi tiết một yêu cầu đặt xe Taxi",
    responses={
        200: {"description": "Lấy chi tiết yêu cầu đặt xe thành công."},
        404: {"description": "Không tìm thấy yêu cầu đặt xe Taxi."},
    },
)
async def get_taxi_request(
    request_id: str,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết một cuốc xe / yêu cầu di chuyển taxi theo `request_id` (ID hệ thống hoặc mã `ticket_code` như `TX-12345`).
    """
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu đặt xe Taxi")
    return _format_taxi_request(req)


@router.patch(
    "/taxi/requests/{request_id}",
    response_model=TaxiRequestResponse,
    tags=TAG_TAXI,
    summary="Cập nhật trạng thái yêu cầu gọi xe taxi (Concierge tiếp nhận và gọi)",
)
@router.patch(
    "/taxi/requests/{request_id}/status",
    response_model=TaxiRequestResponse,
    tags=TAG_TAXI,
    include_in_schema=False,
)
async def update_taxi_request_status(
    request_id: str,
    update_in: TaxiRequestStatusUpdate = Body(...),
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    db: AsyncSession = Depends(get_db),
):
    """
    Concierge tiếp nhận và cập nhật trạng thái yêu cầu gọi xe taxi:
    1. Khi Concierge nhận yêu cầu: Chuyển trạng thái sang Calling (Đang gọi).
    2. Khi Concierge đã gọi xong cho khách: Chuyển trạng thái sang Completed (Thành công).
    """
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu đặt xe Taxi")

    target_st = (update_in.status or "").strip()
    st_lower = target_st.lower()

    if st_lower in ["calling", "đang gọi"]:
        req.status = "Calling"
        req.progress = 50
    elif st_lower in ["completed", "thành công", "success", "done"]:
        req.status = "Completed"
        req.progress = 100
    elif st_lower in ["cancelled", "đã hủy", "rejected"]:
        req.status = "Cancelled"
    elif st_lower in ["pending", "chờ tiếp nhận", "unassigned"]:
        req.status = "Pending"
        req.progress = 0
    else:
        req.status = target_st

    if update_in.assigned_driver:
        req.assigned_staff_name = update_in.assigned_driver
    if update_in.note:
        clean_note = update_in.note.strip()
        req.description = f"{req.description or ''} | Ghi chú: {clean_note}".strip(" |")

    req.updated_at = datetime.utcnow()
    await sr_repo.commit()
    await sr_repo.refresh(req)
    return _format_taxi_request(req)

