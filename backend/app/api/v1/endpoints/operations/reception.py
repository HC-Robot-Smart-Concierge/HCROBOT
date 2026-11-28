"""Reception / Front Desk dashboard & support request routes (mounts room auth routes)."""

import random

from datetime import timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Room, RoomServiceOrder, SupportRequest
from app.repositories import SupportRequestRepository, get_support_request_repository
from app.schemas.operations import (
    ReceptionDashboardResponse,
    ReceptionRequestCreate,
    ReceptionRequestResponse,
    ServiceBillResponse,
)
from .reception_rooms import router as rooms_router
from .shared import TAG_REC, create_department_notification

router = APIRouter()
router.include_router(rooms_router)


# =====================================================================
# 0. RECEPTION / FRONT DESK DASHBOARD & REQUESTS (LỄ TÂN & ĐẶT PHÒNG)
# =====================================================================

@router.get(
    "/dashboard/reception",
    response_model=ReceptionDashboardResponse,
    tags=TAG_REC,
    summary="Dashboard Lễ tân: Danh sách yêu cầu đặt phòng và hỗ trợ tiền sảnh",
    responses={200: {"description": "Lấy thông tin yêu cầu của khách tại quầy lễ tân thành công."}},
)
async def get_reception_dashboard(
    repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn các yêu cầu khách hàng cần Lễ tân xử lý:
    - Hỗ trợ đặt phòng (Room Booking / Reservations)
    - Thủ tục Check-in / Check-out / Gia hạn lưu trú
    - Đổi phòng và thông tin dịch vụ lưu trú

    Dữ liệu được truy vấn chuẩn hóa từ bảng `support_requests` có `department_id = 'DEP-RECEPTION'` hoặc `service_type_id = 'ST-RECEPTION'`.
    """
    current_req = await repo.get_active_by_department(
        department_ids=["DEP-RECEPTION"],
        service_type_ids=["ST-RECEPTION"],
    )
    all_reqs = await repo.get_recent_by_department(
        department_ids=["DEP-RECEPTION"],
        service_type_ids=["ST-RECEPTION"],
        limit=10,
    )

    return {
        "current_request": current_req,
        "recent_requests": all_reqs,
    }


@router.post(
    "/reception/requests",
    response_model=ReceptionRequestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_REC,
    summary="Tạo mới yêu cầu Lễ tân & Đặt phòng",
    responses={
        201: {"description": "Tạo yêu cầu lễ tân / đặt phòng thành công."},
        400: {"description": "Dữ liệu yêu cầu không hợp lệ."},
    },
)
async def create_reception_request(
    request_in: ReceptionRequestCreate,
    repo: SupportRequestRepository = Depends(get_support_request_repository),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Khách hàng (qua Robot Kiosk) hoặc Nhân viên quầy tạo mới một yêu cầu Lễ tân:
    - Đặt phòng mới hoặc giữ chỗ phòng nghỉ
    - Yêu cầu check-in sớm / check-out muộn
    - Hỗ trợ thủ tục hóa đơn hoặc đổi phòng

    Hệ thống tự động gắn mã dịch vụ `ST-RECEPTION` và phòng ban `DEP-RECEPTION`.
    """
    req_type = (request_in.request_type or "reception").strip().lower()
    prefix = "WU" if req_type == "wake_up" else "REC"
    ticket_code = f"{prefix}-{random.randint(1000, 99999)}"
    room_num = (request_in.room_number or request_in.location or "Lobby Desk").strip()

    resolved_guest_name = request_in.guest_name or "Hotel Guest"
    resolved_guest_phone = request_in.guest_phone
    if room_num and room_num not in ("Lobby Desk", "Lobby"):
        room_res = await db.execute(select(Room).where(Room.room_number == room_num))
        room_obj = room_res.scalars().first()
        if room_obj:
            if room_obj.current_guest_phone and not resolved_guest_phone:
                resolved_guest_phone = room_obj.current_guest_phone
            if room_obj.current_guest_name and (not request_in.guest_name or request_in.guest_name in ("Hotel Guest", f"Guest (Room {room_num})", f"Khách Phòng {room_num}")):
                resolved_guest_name = room_obj.current_guest_name

    new_request = SupportRequest(
        ticket_code=ticket_code,
        title=request_in.title,
        description=request_in.description,
        department_id="DEP-RECEPTION",
        service_type_id="ST-RECEPTION",
        request_type=req_type,
        room_number=room_num,
        guest_name=resolved_guest_name,
        guest_phone=resolved_guest_phone,
        source=request_in.source or "Front Desk / Robot Kiosk",
        status="Pending",
    )
    await repo.create(new_request)

    phone_note = f" • SĐT: {resolved_guest_phone}" if resolved_guest_phone else ""
    notif_title = (
        f"Robot AI: Yêu cầu Báo thức mới #{ticket_code}"
        if req_type == "wake_up"
        else f"Yêu cầu lễ tân mới: {ticket_code}"
    )
    await create_department_notification(
        db,
        department="Reception",
        title=notif_title,
        description=f"Khách {new_request.guest_name} (Phòng {new_request.room_number}{phone_note}): {new_request.title}",
        request_id=new_request.id,
        request_type=req_type,
    )

    await repo.commit()
    await repo.refresh(new_request)
    return new_request


@router.get(
    "/reception/requests/{request_id}",
    response_model=ReceptionRequestResponse,
    tags=TAG_REC,
    summary="Xem chi tiết một yêu cầu Lễ tân & Đặt phòng",
    responses={
        200: {"description": "Lấy chi tiết yêu cầu Lễ tân thành công."},
        404: {"description": "Không tìm thấy yêu cầu Lễ tân."},
    },
)
async def get_reception_request(
    request_id: str,
    repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết một yêu cầu Lễ tân & Đặt phòng theo `request_id` (ID hệ thống hoặc mã `ticket_code` như `REC-12345`).
    """
    request = await repo.get_by_id_or_code(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu Lễ tân")
    return request


@router.get(
    "/reception/service-bills",
    response_model=List[ServiceBillResponse],
    tags=TAG_REC,
    summary="Danh sách hóa đơn (bill) dịch vụ phòng & gọi món đã giao hoàn thành chuyển về Lễ tân",
)
async def get_reception_service_bills(
    service_type: Optional[str] = Query("all", description="Lọc theo loại: all, food, service"),
    room_number: Optional[str] = Query(None, description="Lọc theo số phòng"),
    settlement_status: Optional[str] = Query("all", description="Lọc trạng thái check-out: unsettled, settled, all"),
    db: AsyncSession = Depends(get_db),
):
    """Trả về toàn bộ đơn gọi món bếp và dịch vụ phòng đã hoàn thành (Completed) hoặc đã check-out (Settled) kèm tên khách, SĐT, món đặt và tổng tiền."""
    if settlement_status == "unsettled":
        allowed_statuses = ["Completed"]
    elif settlement_status == "settled":
        allowed_statuses = ["Settled"]
    else:
        allowed_statuses = ["Completed", "Settled"]

    stmt = (
        select(RoomServiceOrder)
        .options(selectinload(RoomServiceOrder.order_items), selectinload(RoomServiceOrder.room))
        .where(RoomServiceOrder.status.in_(allowed_statuses))
        .order_by(RoomServiceOrder.updated_at.desc(), RoomServiceOrder.created_at.desc())
    )
    if service_type == "food":
        stmt = stmt.where(RoomServiceOrder.is_service_request.is_(False))
    elif service_type == "service":
        stmt = stmt.where(RoomServiceOrder.is_service_request.is_(True))
    if room_number:
        stmt = stmt.where(RoomServiceOrder.room_number == room_number.strip())

    orders = (await db.execute(stmt)).scalars().all()
    if not orders:
        return []

    rooms_by_num = {}
    missing_phone_rooms = {o.room_number for o in orders if o.room_number and not (o.room and o.room.current_guest_phone)}
    if missing_phone_rooms:
        room_rows = (await db.execute(select(Room).where(Room.room_number.in_(missing_phone_rooms)))).scalars().all()
        rooms_by_num = {r.room_number: r for r in room_rows}

    bills = []
    for o in orders:
        linked_room = o.room or rooms_by_num.get(o.room_number)
        guest_name = o.guest_name or (linked_room.current_guest_name if linked_room else None) or f"Khách Phòng {o.room_number}"
        guest_phone = o.guest_phone or o.room_phone or (linked_room.current_guest_phone if linked_room else None)
        bill_items = [
            {
                "name": oi.item_name,
                "qty": oi.quantity,
                "unit_price": float(oi.unit_price or 0.0),
                "subtotal": float(oi.subtotal or 0.0),
            }
            for oi in (o.order_items or [])
        ]
        summary = ", ".join(f"{it['qty']}x {it['name']}" for it in bill_items) or (o.note or "")
        created_dt = o.created_at.replace(tzinfo=timezone.utc) if (o.created_at and o.created_at.tzinfo is None) else o.created_at
        completed_raw = o.updated_at or o.created_at
        completed_dt = completed_raw.replace(tzinfo=timezone.utc) if (completed_raw and completed_raw.tzinfo is None) else completed_raw
        bills.append(
            {
                "id": o.id,
                "order_number": o.order_number,
                "created_at": created_dt,
                "completed_at": completed_dt,
                "room_number": o.room_number,
                "guest_name": guest_name,
                "guest_phone": guest_phone,
                "service_category": "Dịch vụ phòng (Room Service)" if o.is_service_request else "Gọi món (Bếp)",
                "is_service_request": bool(o.is_service_request),
                "is_settled": o.status == "Settled",
                "status": o.status,
                "items": bill_items,
                "items_summary": summary,
                "total_amount": float(o.total_amount or 0.0),
                "assigned_staff_name": o.assigned_staff_name,
                "note": o.note,
            }
        )
    return bills
