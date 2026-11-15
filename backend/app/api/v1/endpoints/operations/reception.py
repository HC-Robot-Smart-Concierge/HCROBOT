import random
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import SupportRequest
from app.models.hotel import Room
from app.schemas.operations import (
    ReceptionRequestCreate,
    ReceptionRequestResponse,
    ReceptionDashboardResponse,
    RoomCheckInRequest,
    RoomInfoResponse,
)
from app.repositories import SupportRequestRepository, get_support_request_repository
from .shared import TAG_REC, create_department_notification

from .reception_auth import (
    PIN_LOCKOUT_DURATION_SEC as PIN_LOCKOUT_DURATION_SEC,
    PIN_LOCKOUT_MAX_ATTEMPTS as PIN_LOCKOUT_MAX_ATTEMPTS,
    ROOM_PIN_ATTEMPTS as ROOM_PIN_ATTEMPTS,
    router as reception_auth_router,
    verify_room_pin as verify_room_pin,
)

router = APIRouter()


# =====================================================================
# 0. RECEPTION / FRONT DESK DASHBOARD & REQUESTS (LỄ TÂN & ĐẶT PHÒNG)
# =====================================================================

@router.get(
    "/dashboard/reception",
    response_model=ReceptionDashboardResponse,
    tags=TAG_REC,
    summary="Dashboard Lễ tân: Danh sách yêu cầu đặt phòng và hỗ trợ tiền sảnh",
    responses={
        200: {"description": "Lấy thông tin yêu cầu của khách tại quầy lễ tân thành công."}
    },
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
    code_num = random.randint(1000, 99999)
    ticket_code = f"REC-{code_num}"

    new_request = SupportRequest(
        ticket_code=ticket_code,
        title=request_in.title,
        description=request_in.description,
        department_id="DEP-RECEPTION",
        service_type_id="ST-RECEPTION",
        room_number=request_in.room_number or request_in.location or "Lobby Desk",
        guest_name=request_in.guest_name or "Hotel Guest",
        source=request_in.source or "Front Desk / Robot Kiosk",
        status="Pending",
    )
    await repo.create(new_request)

    # Tạo thông báo thời gian thực gửi tới Bộ phận Lễ tân
    await create_department_notification(
        db,
        department="Reception",
        title=f"Yêu cầu lễ tân mới: {ticket_code}",
        description=f"Khách {new_request.guest_name} tại {new_request.room_number}: {new_request.title}",
        request_id=new_request.id,
        request_type="reception",
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


router.include_router(reception_auth_router)


@router.get(
    "/rooms",
    response_model=List[RoomInfoResponse],
    tags=TAG_REC,
    summary="Danh sách toàn bộ phòng và trạng thái check-in, mã PIN, tagCode",
)
async def list_all_rooms(db: AsyncSession = Depends(get_db)):
    """Trả về danh sách tất cả các phòng để phục vụ Lễ tân quản lý và xem mã PIN/CCCD/tagCode."""
    stmt = select(Room).order_by(Room.room_number)
    res = await db.execute(stmt)
    rooms = res.scalars().all()

    # Tự động đồng bộ với file RAG nếu chưa đủ 20 phòng chuẩn (301-310, 401-410)
    valid_rn = {f"{f}{i:02d}" for f in (3, 4) for i in range(1, 11)}
    current_rn = {r.room_number for r in rooms}
    if not rooms or not valid_rn.issubset(current_rn):
        from app.services.rag.room_sync_service import sync_rooms_with_rag
        await sync_rooms_with_rag(db)
        res = await db.execute(stmt)
        rooms = res.scalars().all()

    return rooms


@router.post(
    "/rooms/sync-rag",
    tags=TAG_REC,
    summary="Đồng bộ danh sách phòng từ file RAG hệ thống (Obsidian Vault)",
)
async def sync_rooms_from_rag_endpoint(db: AsyncSession = Depends(get_db)):
    """Đồng bộ trực tiếp danh sách phòng trong CSDL theo file RAG (301-310, 401-410)."""
    from app.services.rag.room_sync_service import sync_rooms_with_rag
    result = await sync_rooms_with_rag(db)
    return {"message": "Đồng bộ phòng từ file RAG thành công!", "detail": result}


@router.post(
    "/rooms/{room_id}/check-in",
    response_model=RoomInfoResponse,
    tags=TAG_REC,
    summary="Lễ tân thực hiện Check-in và cấp mã PIN, tagCode cho phòng",
)
async def check_in_room(
    room_id: str,
    payload: RoomCheckInRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Thủ tục Check-in phòng:
    - Gán tên khách, số CCCD/Hộ chiếu.
    - Cấp mã PIN 4 số (tự sinh ngẫu nhiên nếu không truyền).
    - Cấp thẻ phòng NFC (tagCode).
    - Đổi trạng thái phòng thành 'OCCUPIED'.
    """
    stmt = select(Room).where((Room.id == room_id) | (Room.room_number == room_id))
    res = await db.execute(stmt)
    room = res.scalars().first()

    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng")

    # Yêu cầu bắt buộc nhập CCCD / Hộ chiếu và tự động tạo mã PIN từ 4 số cuối CCCD
    clean_id = (payload.identity_number or "").strip()
    if not clean_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập số CCCD / Hộ chiếu của khách để làm thủ tục nhận phòng."
        )

    if not clean_id.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số CCCD / Hộ chiếu chỉ được chứa các chữ số (0-9)."
        )

    if len(clean_id) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số CCCD / Hộ chiếu phải có ít nhất 4 chữ số để tạo mã PIN phòng."
        )

    generated_pin = clean_id[-4:]

    room.current_guest_name = payload.guest_name.strip()
    if hasattr(room, 'current_guest_phone'):
        room.current_guest_phone = payload.guest_phone.strip() if payload.guest_phone else None
    if hasattr(room, 'room_phone'):
        room.room_phone = payload.room_phone.strip() if payload.room_phone else f"Ext {room.room_number}"
    if hasattr(room, 'identity_number'):
        room.identity_number = clean_id
    room.pin_code = generated_pin
    tag_val = payload.tag_code or payload.nfc_card_uid
    if tag_val is not None:
        room.tag_code = tag_val.strip() if tag_val.strip() else None
    room.status = payload.status or "OCCUPIED"

    await db.commit()
    await db.refresh(room)
    return room


@router.post(
    "/rooms/{room_id}/check-out",
    response_model=RoomInfoResponse,
    tags=TAG_REC,
    summary="Lễ tân thực hiện Check-out và xóa mã PIN, tagCode phòng",
)
async def check_out_room(
    room_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Thủ tục Check-out phòng:
    - Xóa tên khách, mã PIN, số CCCD và thẻ NFC tagCode để đảm bảo bảo mật.
    - Đổi trạng thái phòng thành 'CLEANING'.
    """
    stmt = select(Room).where((Room.id == room_id) | (Room.room_number == room_id))
    res = await db.execute(stmt)
    room = res.scalars().first()

    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng")

    room.current_guest_name = None
    if hasattr(room, 'current_guest_phone'):
        room.current_guest_phone = None
    room.identity_number = None
    room.pin_code = None
    room.tag_code = None
    room.status = "CLEANING"

    await db.commit()
    await db.refresh(room)
    return room
