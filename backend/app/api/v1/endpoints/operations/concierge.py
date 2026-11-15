import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import SupportRequest
from app.models.support import HumanSupportSession
from app.schemas.operations import (
    ConciergeLiveRequestCreate,
    ConciergeLiveRequestUpdate,
    ConciergeLiveRequestResponse,
    ConciergeDashboardResponse,
    ConciergeEmotionAlertCreate,
    ConciergeEmotionAlertUpdate,
    ConciergeEmotionAlertResponse,
)
from app.repositories import (
    SupportRequestRepository,
    get_support_request_repository,
    SupportSessionRepository,
    get_support_session_repository,
)
from app.services.video_call_manager import video_call_manager
from .shared import TAG_CONCIERGE, create_department_notification

logger = logging.getLogger(__name__)
router = APIRouter()

from .concierge_sessions_ws import router as concierge_sessions_ws_router


# =====================================================================
# 17. CONCIERGE & LIVE SUPPORT DASHBOARD (TRỢ LÝ CONCIERGE & LIVE CALL)
# =====================================================================

@router.get(
    "/dashboard/concierge",
    response_model=ConciergeDashboardResponse,
    tags=TAG_CONCIERGE,
    summary="Dashboard Concierge: Phiên hỗ trợ Live Call và trợ giúp khách hàng mới nhất",
)
async def get_concierge_dashboard(
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    Truy vấn phiên hỗ trợ trực tuyến (Live Call / Video Assistance) mới nhất khi khách hàng tương tác với Robot Kiosk:
    - Cuộc gọi video cần nhân viên can thiệp trực tiếp (Human-in-the-loop)
    - Tự động đóng các phiên gọi nhỡ / quá hạn (> 5 phút không ai nhấc máy)
    - Chỉ trả về cuộc gọi đang thực sự kết nối hoặc đang reo chuông
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    five_minutes_ago = now - timedelta(minutes=5)
    twenty_minutes_ago = now - timedelta(minutes=20)

    # 1. Tự động đóng các phiên gọi Pending đã quá 5 phút thành 'Missed'
    await sr_repo.close_expired_pending(
        department_ids=["DEP-CONCIERGE"],
        service_type_ids=["ST-CONCIERGE"],
        cutoff_time=five_minutes_ago,
        new_status="Missed",
    )

    # 1.1 Tự động dọn dẹp các phiên In Progress / Connected bị treo quá 20 phút thành 'Closed'
    await sr_repo.close_stale_active_calls(
        department_ids=["DEP-CONCIERGE"],
        service_type_ids=["ST-CONCIERGE"],
        cutoff_time=twenty_minutes_ago,
        new_status="Closed",
    )

    # 2. Chỉ lấy cuộc gọi đang chờ bắt máy (mới tạo < 5 phút) hoặc đang diễn ra
    current_req = await sr_repo.get_active_live_call(
        department_ids=["DEP-CONCIERGE"],
        service_type_ids=["ST-CONCIERGE"],
    )

    # Đếm số phiên đang active thực sự
    active_count = await sr_repo.count_active_live_calls(
        department_ids=["DEP-CONCIERGE"],
        service_type_ids=["ST-CONCIERGE"],
    )
    active_emotion_alerts_count = await sr_repo.count_active_emotion_alerts()

    return {
        "current_request": current_req,
        "active_sessions_count": active_count,
        "active_emotion_alerts_count": active_emotion_alerts_count,
    }


@router.post(
    "/concierge/requests",
    response_model=ConciergeLiveRequestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_CONCIERGE,
    summary="Khởi tạo phiên hỗ trợ Live Call / Video Call từ Robot Kiosk",
)
@router.post(
    "/concierge/calls",
    response_model=ConciergeLiveRequestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_CONCIERGE,
    include_in_schema=False,
)
async def create_concierge_live_request(
    request_in: ConciergeLiveRequestCreate,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    session_repo: SupportSessionRepository = Depends(get_support_session_repository),
    db: AsyncSession = Depends(get_db),
):
    """
    Robot Kiosk hoặc ứng dụng khách phát tín hiệu cần nhân viên Concierge can thiệp hỗ trợ trực tuyến:
    - Khởi tạo cuộc gọi Video Call hai chiều
    - Tự động tạo bản ghi SupportRequest và HumanSupportSession liên kết
    - Phát thông báo LiveAssistance tới Dashboard Concierge
    """
    code_num = random.randint(1000, 99999)
    ticket_code = f"CCG-{code_num}"
    room_loc = request_in.room_number or "Main Lobby Kiosk"
    guest = request_in.guest_name or "Hotel Guest"

    new_request = SupportRequest(
        ticket_code=ticket_code,
        title=request_in.title,
        description=request_in.description or "Yêu cầu can thiệp hỗ trợ thoại trực tiếp từ Robot",
        department_id="DEP-CONCIERGE",
        service_type_id="ST-CONCIERGE",
        room_number=room_loc,
        guest_name=guest,
        source="Robot Voice Assistant",
        priority="High",
        status="Pending",
    )
    await sr_repo.create(new_request)

    # Tạo song song phiên HumanSupportSession để sẵn sàng lưu vết cuộc gọi và Cloudinary recording
    human_session = HumanSupportSession(
        session_code=f"LIVE-{code_num}",
        room_number=room_loc,
        guest_name=guest,
        category="Live Call Support",
        origin_robot_code="RC-001 (Main Lobby)",
        sentiment="Neutral",
        status="Active",
        recording_status="none",
        linked_request_id=new_request.id,
        call_started_at=datetime.now(timezone.utc).replace(tzinfo=None),
        messages=request_in.transcript or [],
    )
    await session_repo.create(human_session)

    # Gửi thông báo khẩn tới tổng đài viên Concierge (chỉ gửi khi notify=True)
    if request_in.notify:
        await create_department_notification(
            db,
            department="Concierge",
            title=f"Cuộc gọi hỗ trợ mới: {ticket_code}",
            description=f"Khách tại {new_request.room_number} cần kết nối Live Call với Concierge",
            request_id=new_request.id,
            request_type="concierge",
            type="LiveAssistance",
        )

    await sr_repo.commit()
    await sr_repo.refresh(new_request)

    # Đăng ký các alias (ticket_code, req.id, human_session.id) vào VideoCallManager
    video_call_manager.register_alias(
        ticket_code,
        new_request.id,
        human_session.id,
        human_session.session_code,
    )

    return new_request


@router.get(
    "/concierge/requests",
    response_model=List[ConciergeLiveRequestResponse],
    tags=TAG_CONCIERGE,
    summary="Danh sách toàn bộ yêu cầu hỗ trợ Concierge & Live Call",
)
async def list_concierge_requests(
    status: Optional[str] = Query(None, description="Lọc theo trạng thái yêu cầu"),
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """Lấy danh sách các phiên hỗ trợ và yêu cầu can thiệp từ khách hàng tại bộ phận Concierge."""
    return await sr_repo.list_by_department_and_status(
        department_ids=["DEP-CONCIERGE"],
        service_type_ids=["ST-CONCIERGE"],
        status=status,
        exclude_emotion_alerts=True,
    )


@router.get(
    "/concierge/requests/{request_id}",
    response_model=ConciergeLiveRequestResponse,
    tags=TAG_CONCIERGE,
    summary="Xem chi tiết một phiên yêu cầu hỗ trợ Concierge",
    responses={
        200: {"description": "Lấy thông tin phiên hỗ trợ Concierge thành công."},
        404: {"description": "Không tìm thấy phiên hỗ trợ Concierge."},
    },
)
@router.get(
    "/concierge/calls/{request_id}",
    response_model=ConciergeLiveRequestResponse,
    tags=TAG_CONCIERGE,
    include_in_schema=False,
)
async def get_concierge_request(
    request_id: str,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tra cứu chi tiết một phiên gọi hỗ trợ trực tiếp Concierge / Robot Kiosk theo `request_id` (ID hệ thống hoặc mã `ticket_code` như `CCG-12345`).
    """
    request = await sr_repo.get_by_id_or_code(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên hỗ trợ Concierge")
    return request


@router.patch(
    "/concierge/requests/{request_id}",
    response_model=ConciergeLiveRequestResponse,
    tags=TAG_CONCIERGE,
    summary="Cập nhật trạng thái cuộc gọi, phân công hoặc đóng phiên Live Call Concierge",
)
@router.patch(
    "/concierge/calls/{request_id}",
    response_model=ConciergeLiveRequestResponse,
    tags=TAG_CONCIERGE,
    include_in_schema=False,
)
async def update_concierge_request(
    request_id: str,
    update_in: ConciergeLiveRequestUpdate,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    session_repo: SupportSessionRepository = Depends(get_support_session_repository),
):
    """
    Tổng đài viên Concierge tiếp nhận cuộc gọi, đổi trạng thái (`Connected`, `In Progress`, `Completed`), ghi chú và kết thúc phiên làm việc.
    """
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên hỗ trợ Concierge")

    if update_in.status is not None:
        req.status = update_in.status
    if update_in.assigned_to is not None:
        req.assigned_staff_name = update_in.assigned_to

    req.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Đồng bộ trạng thái sang HumanSupportSession tương ứng
    hs = await session_repo.get_by_linked_request(req.id)
    if hs:
        if update_in.status in ["Completed", "Closed"]:
            hs.status = "Resolved"
            if not hs.call_ended_at:
                hs.call_ended_at = datetime.now(timezone.utc).replace(tzinfo=None)
        elif update_in.status in ["Connected", "In Progress"]:
            hs.status = "Active"

    await sr_repo.commit()
    await sr_repo.refresh(req)
    return req


# =====================================================================
# UNHAPPY GUEST / EMOTION ALERTS (XỬ LÝ KHÁCH CÓ BIỂU CẢM KHÓ CHỊU)
# =====================================================================

@router.get(
    "/concierge/emotion-alerts",
    response_model=List[ConciergeEmotionAlertResponse],
    tags=TAG_CONCIERGE,
    summary="Danh sách cảnh báo khách hàng có biểu cảm khó chịu cho bộ phận Concierge",
)
async def list_concierge_emotion_alerts(
    status_q: Optional[str] = Query(None, alias="status", description="Lọc theo trạng thái: Pending, In Progress, Completed"),
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """Truy vấn danh sách cảnh báo khi khách hàng có biểu cảm khó chịu từ Camera AI Kiosk hoặc nhân viên Concierge."""
    return await sr_repo.list_concierge_emotion_alerts(status=status_q)


@router.post(
    "/concierge/emotion-alerts",
    response_model=ConciergeEmotionAlertResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_CONCIERGE,
    summary="Tạo cảnh báo xử lý khi khách có biểu cảm khó chịu (Concierge)",
)
async def create_concierge_emotion_alert(
    req_in: ConciergeEmotionAlertCreate,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    db: AsyncSession = Depends(get_db),
):
    """Tiếp nhận cảnh báo từ Camera AI Robot Kiosk hoặc ghi nhận trực tiếp để bộ phận Concierge tiếp cận hỗ trợ khách."""
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=90)
    existing = await sr_repo.find_recent_emotion_alert(req_in.location, since=cutoff)
    if existing:
        return ConciergeEmotionAlertResponse.model_validate(existing).model_copy(update={"duplicate": True})

    ticket_code = f"EA-{random.randint(1000, 99999)}"
    new_req = SupportRequest(
        ticket_code=ticket_code,
        title=req_in.title,
        room_number=req_in.location,
        guest_name=req_in.guest_name or "Khách tại Sảnh Kiosk",
        source=req_in.reporter or "HCRobot Emotion AI",
        description=req_in.description
        or "Camera AI phát hiện khách có biểu cảm khó chịu. Cần nhân viên Concierge tiếp cận hỗ trợ trực tiếp ngay.",
        department_id="DEP-CONCIERGE",
        service_type_id="ST-CONCIERGE",
        status="Pending",
        priority="High",
        request_type="emotion_alert",
    )
    await sr_repo.create(new_req)

    await create_department_notification(
        db=db,
        department="Concierge",
        title=f"Cảnh báo Khách có biểu cảm khó chịu #{ticket_code}",
        description=f"{req_in.location}: {req_in.title} - {req_in.description or req_in.guest_name or ''}".strip(" -"),
        request_id=new_req.id,
        request_type="concierge",
        type="Alert",
    )

    await sr_repo.commit()
    await sr_repo.refresh(new_req)
    return new_req


@router.patch(
    "/concierge/emotion-alerts/{request_id}",
    response_model=ConciergeEmotionAlertResponse,
    tags=TAG_CONCIERGE,
    summary="Cập nhật trạng thái xử lý cảnh báo khách hàng khó chịu (Concierge)",
)
async def update_concierge_emotion_alert(
    request_id: str,
    update_in: ConciergeEmotionAlertUpdate,
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """Nhân viên Concierge tiếp nhận hỗ trợ (In Progress) hoặc hoàn tất xoa dịu khách hàng (Completed)."""
    req = await sr_repo.get_by_id_or_code(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy cảnh báo Concierge")

    if update_in.status is not None:
        req.status = update_in.status
    staff_val = update_in.assigned_to or update_in.assigned_staff
    if staff_val is not None:
        req.assigned_staff_name = staff_val
    req.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    await sr_repo.commit()
    await sr_repo.refresh(req)
    return req


from .concierge_recordings import router as concierge_recordings_router

router.include_router(concierge_sessions_ws_router)
router.include_router(concierge_recordings_router)
