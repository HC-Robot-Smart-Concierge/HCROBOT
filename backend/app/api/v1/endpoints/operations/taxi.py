import random
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import Staff, SupportRequest, Room
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
    extra = req.extra_data if isinstance(req.extra_data, dict) else {}

    destination = extra.get("destination")
    pickup_time = extra.get("pickup_time")
    party_size = extra.get("party_size")
    vehicle_type = extra.get("vehicle_type")
    pickup_location = extra.get("pickup_location")

    desc_lower = desc_str.lower()
    if extra.get("booking_mode") != "assistance" and not extra.get("destination") and ("điểm đến:" in desc_lower or "diem den:" in desc_lower):
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

    arrangement = extra.get("arrangement") if isinstance(extra.get("arrangement"), dict) else {}

    return TaxiRequestResponse(
        id=req.id,
        ticket_code=req.ticket_code,
        booking_mode=extra.get("booking_mode") or ("trip" if destination else "assistance"),
        guest_name=req.guest_name or "Hotel Guest",
        guest_phone=req.guest_phone,
        room_phone=req.room_phone,
        pickup_location=pickup_location,
        room_number=req.room_number,
        destination=destination,
        pickup_time=pickup_time,
        party_size=party_size,
        vehicle_type=vehicle_type,
        status=req.status or "Pending",
        assigned_driver=req.assigned_staff_name,
        license_plate=extra.get("license_plate"),
        notes=desc_str,
        taxi_company=arrangement.get("taxi_company"),
        driver_phone=arrangement.get("driver_phone"),
        arranged_pickup_time=arrangement.get("pickup_time"),
        arranged_vehicle_type=arrangement.get("vehicle_type"),
        arrangement_note=arrangement.get("note"),
        arranged_by=arrangement.get("arranged_by"),
        arranged_at=arrangement.get("arranged_at"),
        created_at=req.created_at or datetime.now(timezone.utc).replace(tzinfo=None),
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
    raw_requests = await sr_repo.list_taxi_requests(limit=100)
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
    assistance = req_in.booking_mode == "assistance"
    resolved_room = req_in.room_number
    if not resolved_room and (req_in.pickup_location or "").strip().isdigit():
        resolved_room = req_in.pickup_location.strip()
    room = None
    if resolved_room:
        room = (await db.execute(select(Room).where(Room.room_number == resolved_room))).scalar_one_or_none()
    if assistance and (room is None or (room.status or "").upper() != "OCCUPIED"):
        raise HTTPException(status_code=400, detail="Room must be checked in before requesting taxi assistance")
    ticket_code = f"TX-{random.randint(10000, 99999)}"
    title = (f"Nhờ đặt xe: Phòng {resolved_room}" if assistance else
             f"Taxi: {resolved_room or req_in.pickup_location or 'Guest'} -> {req_in.destination}")
    description = (req_in.description or "").strip()
    if not assistance:
        trip_details = [f"Điểm đến: {req_in.destination}"]
        if req_in.pickup_time:
            trip_details.append(f"Thời gian đón: {req_in.pickup_time}")
        if req_in.party_size:
            trip_details.append(f"Số lượng khách: {req_in.party_size}")
        if req_in.vehicle_type:
            trip_details.append(f"Loại xe: {req_in.vehicle_type}")
        description = " | ".join(trip_details + ([description] if description else []))
    guest_name = (room.current_guest_name if room else None) or req_in.guest_name

    dep_id, svc_id = await sr_repo.ensure_taxi_catalog()
    new_req = SupportRequest(
        ticket_code=ticket_code,
        title=title,
        room_number=(resolved_room or req_in.pickup_location or "Main Lobby")[:50],
        guest_name=guest_name,
        guest_phone=room.current_guest_phone if room else None,
        room_phone=room.room_phone if room else None,
        source="From HCRobot",
        description=description,
        department_id=dep_id,
        service_type_id=svc_id,
        status="Pending",
        extra_data={
            "request_type": "taxi",
            "booking_mode": req_in.booking_mode,
            "pickup_location": None if assistance else req_in.pickup_location,
            "destination": None if assistance else req_in.destination,
            "pickup_time": None if assistance else req_in.pickup_time,
            "party_size": req_in.party_size,
            "vehicle_type": req_in.vehicle_type,
        },
    )
    await sr_repo.create(new_req)
    await create_department_notification(
        db=db,
        department="Concierge" if assistance else "Taxi",
        title=f"Yêu cầu Đặt xe mới #{ticket_code}",
        description=f"Phòng {resolved_room or req_in.pickup_location}: {description or title}",
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
    raw_requests = await sr_repo.list_taxi_requests(limit=limit, skip=skip)
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
        req.assigned_staff_name = update_in.assigned_driver.strip()
    if update_in.license_plate:
        req.extra_data = {**(req.extra_data or {}), "license_plate": update_in.license_plate.strip()}
    if update_in.note:
        clean_note = update_in.note.strip()
        req.description = f"{req.description or ''} | Ghi chú: {clean_note}".strip(" |")

    # Thông tin xe Concierge đã đặt giúp khách: lưu riêng, không ghi đè nhu cầu/ghi chú của khách.
    arrangement_fields = {
        "taxi_company": update_in.taxi_company,
        "driver_phone": update_in.driver_phone,
        "pickup_time": update_in.pickup_time,
        "vehicle_type": update_in.vehicle_type,
        "note": update_in.arrangement_note,
    }
    arrangement_fields = {k: v.strip() for k, v in arrangement_fields.items() if isinstance(v, str) and v.strip()}
    if arrangement_fields:
        extra = dict(req.extra_data or {})
        arrangement = {
            **arrangement_fields,
            "arranged_by": (update_in.arranged_by or "").strip() or None,
            "arranged_at": datetime.now(timezone.utc).isoformat(),
        }
        extra["arrangement"] = arrangement
        # Bảng đặt xe gửi đầy đủ các trường: trường để trống nghĩa là xóa giá trị cũ khi sửa.
        extra["license_plate"] = (update_in.license_plate or "").strip() or None
        req.assigned_staff_name = (update_in.assigned_driver or "").strip() or None
        req.extra_data = extra

    req.updated_at = datetime.utcnow()
    await sr_repo.commit()
    await sr_repo.refresh(req)
    return _format_taxi_request(req)

