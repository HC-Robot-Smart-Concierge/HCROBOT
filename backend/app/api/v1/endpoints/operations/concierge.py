import os
import json
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    WebSocket,
    WebSocketDisconnect,
    Query,
    UploadFile,
    File,
    Form,
    BackgroundTasks,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
from app.services.cloudinary_service import cloudinary_service
from app.services.video_call_manager import video_call_manager
from .shared import TAG_CONCIERGE, create_department_notification

logger = logging.getLogger(__name__)
router = APIRouter()


class HumanSupportSessionItem(BaseModel):
    id: str
    session_code: str
    room_number: str
    guest_name: str
    category: str
    origin_robot_code: str
    sentiment: str
    wait_time_label: str
    status: str
    linked_request_id: Optional[str] = None
    account_id: Optional[str] = None
    recording_url: Optional[str] = None
    recording_public_id: Optional[str] = None
    recording_duration: Optional[int] = None
    recording_status: Optional[str] = "none"
    thumbnail_url: Optional[str] = None
    call_started_at: Optional[datetime] = None
    call_ended_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RecordingUploadResponse(BaseModel):
    session_id: str
    recording_url: Optional[str] = None
    public_id: Optional[str] = None
    duration: int = 0
    thumbnail_url: Optional[str] = None
    storage_provider: str = "pending"
    status: str = "Saving"
    recording_status: str = "saving"
    message: str


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

    # Gửi thông báo khẩn tới tổng đài viên Concierge
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


# =====================================================================
# HUMAN SUPPORT SESSIONS & VIDEO RECORDINGS (CLOUDINARY)
# =====================================================================

@router.get(
    "/concierge/sessions",
    response_model=List[HumanSupportSessionItem],
    tags=TAG_CONCIERGE,
    summary="Lấy danh sách các phiên hỗ trợ người thật & video call đã ghi hình",
)
async def get_human_support_sessions(
    limit: int = Query(50, ge=1, le=500, description="Số lượng bản ghi tối đa"),
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua (Offset)"),
    status_filter: Optional[str] = None,
    session_repo: SupportSessionRepository = Depends(get_support_session_repository),
):
    """
    Truy vấn danh sách các phiên HumanSupportSession bao gồm link video Cloudinary, thời lượng, trạng thái
    hỗ trợ phân trang SQL Limit/Offset.
    """
    return await session_repo.list_sessions(limit=limit, skip=skip, status_filter=status_filter)


@router.get(
    "/concierge/video-calls/metrics",
    tags=TAG_CONCIERGE,
    summary="Thống kê số liệu Video Call & Bản ghi WF-04 phục vụ Admin và Quản trị",
)
async def get_video_calls_metrics(
    start_date: Optional[str] = Query(None, description="ISO format: YYYY-MM-DD hoặc YYYY-MM-DDTHH:MM:SS"),
    end_date: Optional[str] = Query(None, description="ISO format: YYYY-MM-DD hoặc YYYY-MM-DDTHH:MM:SS"),
    db: AsyncSession = Depends(get_db),
):
    """
    Thống kê số liệu thực tế từ Database cho WF-04:
    - total_calls: Tổng số phiên gọi duy nhất
    - ready_recordings: Số bản ghi sẵn sàng (sẵn link xem)
    - saving_recordings: Số bản ghi đang lưu ngầm
    - failed_recordings: Số bản ghi lưu thất bại
    - no_recordings: Số phiên không có bản ghi
    """
    stmt = select(HumanSupportSession)
    if start_date:
        try:
            s_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00")).replace(tzinfo=None)
            stmt = stmt.where(HumanSupportSession.created_at >= s_dt)
        except Exception:
            pass
    if end_date:
        try:
            e_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00")).replace(tzinfo=None)
            stmt = stmt.where(HumanSupportSession.created_at <= e_dt)
        except Exception:
            pass

    res = await db.execute(stmt)
    sessions = res.scalars().all()
    total_calls = len(sessions)
    ready_count = 0
    saving_count = 0
    failed_count = 0
    no_rec_count = 0

    for s in sessions:
        r_stat = (s.recording_status or "").lower()
        has_url = bool(s.recording_url and s.recording_url.strip())
        if r_stat == "saving":
            saving_count += 1
        elif r_stat == "failed":
            failed_count += 1
        elif has_url:
            ready_count += 1
        else:
            no_rec_count += 1

    return {
        "total_calls": total_calls,
        "ready_recordings": ready_count,
        "saving_recordings": saving_count,
        "failed_recordings": failed_count,
        "no_recordings": no_rec_count,
    }


@router.get(
    "/concierge/sessions/{session_id}",
    response_model=HumanSupportSessionItem,
    tags=TAG_CONCIERGE,
    summary="Chi tiết một phiên HumanSupportSession",
)
async def get_human_support_session_detail(
    session_id: str,
    session_repo: SupportSessionRepository = Depends(get_support_session_repository),
):
    session_item = await session_repo.get_by_id_or_code(session_id)
    if not session_item:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên hỗ trợ")
    return session_item


async def _background_upload_video(
    session_id: str,
    temp_file_path: str,
    filename: str,
    duration: int,
):
    """
    Task chạy ngầm: Tải file từ vùng nhớ tạm lên Cloudinary (có fallback local) và cập nhật CSDL.
    Sau khi hoàn thành, tự động dọn sạch file tạm.
    """
    from app.core.database import AsyncSessionLocal
    from app.repositories.support_session_repository import SupportSessionRepository

    try:
        if not os.path.exists(temp_file_path):
            logger.error(f"[BackgroundRecording] Temp file does not exist: {temp_file_path}")
            return

        with open(temp_file_path, "rb") as f:
            file_bytes = f.read()

        cloud_result = await cloudinary_service.upload_video_recording(
            file_bytes=file_bytes,
            filename=filename,
            duration=duration,
        )

        async with AsyncSessionLocal() as db_session:
            repo = SupportSessionRepository(db_session)
            h_session = await repo.get_by_id_or_code(session_id)
            if h_session:
                h_session.recording_url = cloud_result.get("secure_url")
                h_session.recording_public_id = cloud_result.get("public_id")
                h_session.recording_duration = cloud_result.get("duration") or duration
                h_session.thumbnail_url = cloud_result.get("thumbnail_url")
                h_session.recording_status = "ready" if cloud_result.get("secure_url") else "failed"
                await repo.commit()
                logger.info(f"[BackgroundRecording] Successfully stored session {session_id} to {cloud_result.get('storage_provider')}")
    except Exception as ex:
        logger.error(f"[BackgroundRecording] Error processing background recording for {session_id}: {ex}")
        try:
            async with AsyncSessionLocal() as db_session:
                repo = SupportSessionRepository(db_session)
                h_session = await repo.get_by_id_or_code(session_id)
                if h_session:
                    h_session.recording_status = "failed"
                    await repo.commit()
        except Exception:
            pass
    finally:
        # Dọn sạch file tạm
        try:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        except Exception:
            pass


@router.post(
    "/concierge/recordings/sync-cloudinary",
    tags=TAG_CONCIERGE,
    summary="Đồng bộ các bản ghi video có sẵn từ Cloudinary về CSDL (Hướng 1)",
)
async def sync_cloudinary_recordings(
    session_repo: SupportSessionRepository = Depends(get_support_session_repository),
):
    """
    Quét kho lưu trữ Cloudinary trong folder quy định (hcrobot/call_recordings),
    tìm các file video đã có và liên kết/cập nhật vào các phiên HumanSupportSession tương ứng trong CSDL.
    """
    if not cloudinary_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Cloudinary chưa được cấu hình (thiếu CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET trong .env).",
        )

    # 1. Quét danh sách video từ Cloudinary
    cloud_resources = await cloudinary_service.list_video_recordings()
    if not cloud_resources:
        return {
            "success": True,
            "total_found": 0,
            "synced_count": 0,
            "message": "Không tìm thấy video nào trên Cloudinary trong thư mục chỉ định.",
        }

    # 2. Lấy danh sách session từ DB để đối soát và chuẩn hóa các trạng thái lệch
    sessions = list(await session_repo.list_sessions(limit=500))
    synced_count = 0
    normalized_count = 0

    for s in sessions:
        has_url = bool(s.recording_url and s.recording_url.strip())
        if not has_url and (s.recording_status or "").lower() == "ready":
            s.recording_status = "none"
            normalized_count += 1

    for res in cloud_resources:
        pub_id = res.get("public_id", "")
        sec_url = res.get("secure_url", "")
        fname = res.get("filename", "")
        duration = res.get("duration", 0)

        # Trích xuất token từ tên file (ví dụ: call_REQ-D88056C9 -> REQ-D88056C9, call_LIVE-1234 -> LIVE-1234)
        clean_token = fname
        if clean_token.startswith("call_"):
            clean_token = clean_token[5:]
        if "." in clean_token:
            clean_token = clean_token.rsplit(".", 1)[0]

        matched_session = None
        for s in sessions:
            if (
                (s.recording_public_id and s.recording_public_id == pub_id)
                or (s.recording_url and s.recording_url == sec_url)
                or (s.session_code and (s.session_code == clean_token or s.session_code in pub_id))
                or (s.linked_request_id and (s.linked_request_id == clean_token or s.linked_request_id in pub_id))
                or (s.id and (s.id == clean_token or s.id in pub_id))
            ):
                matched_session = s
                break

        if matched_session:
            if matched_session.recording_url != sec_url or matched_session.recording_status != "ready":
                matched_session.recording_url = sec_url
                matched_session.recording_public_id = pub_id
                if duration and (not matched_session.recording_duration or matched_session.recording_duration == 0):
                    matched_session.recording_duration = duration
                matched_session.thumbnail_url = sec_url.rsplit(".", 1)[0] + ".jpg" if "." in sec_url else sec_url
                matched_session.recording_status = "ready"
                synced_count += 1
        else:
            # Video này là bản ghi cũ trên Cloudinary nhưng chưa từng có phiên trong CSDL (trước khi làm chức năng tracking)
            # Tự động tạo phiên HumanSupportSession mới với đúng ngày tạo gốc để Admin có thể xem lại ngay lập tức!
            created_dt = None
            raw_created = res.get("created_at")
            if raw_created:
                try:
                    clean_iso = str(raw_created).replace("Z", "").split("+")[0]
                    created_dt = datetime.fromisoformat(clean_iso).replace(tzinfo=None)
                except Exception:
                    pass

            code_suffix = clean_token if clean_token and len(clean_token) <= 30 else f"REC-{random.randint(1000, 9999)}"
            session_code = code_suffix
            new_id = f"SUP-{code_suffix}" if not code_suffix.startswith("SUP-") else code_suffix

            new_session = HumanSupportSession(
                id=new_id,
                session_code=session_code,
                linked_request_id=clean_token if clean_token.startswith("REQ-") else None,
                room_number="Kiosk Sảnh (Lưu trữ Cloud)",
                guest_name="Khách lưu trú",
                category="Video Call Support",
                status="Resolved",
                recording_url=sec_url,
                recording_public_id=pub_id,
                recording_duration=duration or 0,
                thumbnail_url=sec_url.rsplit(".", 1)[0] + ".jpg" if "." in sec_url else sec_url,
                recording_status="ready",
                created_at=created_dt or datetime.utcnow(),
            )
            await session_repo.create(new_session)
            sessions.append(new_session)
            synced_count += 1

    # 3. Quét thêm thư mục lưu trữ cục bộ ./uploaded_recordings/ phòng trường hợp video cũ lưu local trước đây
    local_dir = os.path.join(os.getcwd(), "uploaded_recordings")
    if os.path.exists(local_dir):
        for f in os.listdir(local_dir):
            if f.endswith((".webm", ".mp4")) and not f.startswith("temp_"):
                full_f_path = os.path.join(local_dir, f)
                # Bỏ qua các file rác/hỏng có kích thước < 1KB
                try:
                    if not os.path.isfile(full_f_path) or os.path.getsize(full_f_path) < 1024:
                        continue
                except OSError:
                    continue
                local_url = f"/api/v1/operations/concierge/recordings/local/{f}"
                has_session = any(s.recording_url == local_url for s in sessions)
                if not has_session:
                    clean_f = f.replace("rec_", "").split(".")[0]
                    new_local_session = HumanSupportSession(
                        id=f"SUP-LOC-{clean_f[:25]}",
                        session_code=f"LIVE-LOC-{clean_f[:20]}",
                        room_number="Kiosk Sảnh (Lưu trữ Local)",
                        guest_name="Khách lưu trú",
                        category="Video Call Support",
                        status="Resolved",
                        recording_url=local_url,
                        recording_public_id=f"local_{f}",
                        recording_duration=0,
                        thumbnail_url=None,
                        recording_status="ready",
                        created_at=datetime.utcnow(),
                    )
                    await session_repo.create(new_local_session)
                    sessions.append(new_local_session)
                    synced_count += 1

    if synced_count > 0 or normalized_count > 0:
        await session_repo.commit()

    return {
        "success": True,
        "total_found": len(cloud_resources),
        "synced_count": synced_count,
        "message": f"Đã quét {len(cloud_resources)} video trên Cloudinary, đồng bộ thành công {synced_count} bản ghi vào hệ thống.",
    }


@router.post(
    "/concierge/recordings/{session_id}",
    response_model=RecordingUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=TAG_CONCIERGE,
    summary="Tiếp nhận video ghi hình cuộc gọi bất đồng bộ (Background Cloudinary Upload)",
)
async def upload_call_recording(
    session_id: str,
    background_tasks: BackgroundTasks,
    video_file: UploadFile = File(..., description="File video ghi hình cuộc gọi (.webm / .mp4)"),
    duration: int = Form(0, description="Thời lượng cuộc gọi tính bằng giây"),
    call_started_at: Optional[str] = Form(None),
    call_ended_at: Optional[str] = Form(None),
    messages: Optional[str] = Form(None, description="Danh sách JSON phụ đề và tin nhắn thoại song ngữ"),
    session_repo: SupportSessionRepository = Depends(get_support_session_repository),
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
):
    """
    ### Nghiệp vụ Ghi hình Cuộc gọi Bất đồng bộ (Async Background Storage):
    1. Tiếp nhận file video Blob (< 100MB) từ WebRTC MediaRecorder client.
    2. Lưu tạm vào thư mục `./uploaded_recordings/temp/`.
    3. Cập nhật ngay trạng thái phiên là `Resolved`, `recording_status='saving'`.
    4. Phản hồi HTTP 202 Accepted ngay lập tức để Kiosk đóng giao diện không bị giật lag.
    5. Đẩy tác vụ tải Cloudinary (hoặc local fallback) vào BackgroundTasks xử lý ngầm.
    """
    # 1. Kiểm tra kích thước và loại file
    content_type = video_file.content_type or ""
    if content_type and not any(ct in content_type for ct in ("video", "octet-stream")):
        raise HTTPException(status_code=400, detail="Định dạng file không hợp lệ, yêu cầu file video")

    file_bytes = await video_file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File video trống không có dữ liệu")

    if len(file_bytes) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File video vượt quá giới hạn 100MB")

    # 2. Lưu file tạm vào vùng lưu trữ an toàn
    temp_dir = os.path.join(os.getcwd(), "uploaded_recordings", "temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_filename = f"temp_{int(time.time())}_{random.randint(1000, 9999)}_{video_file.filename or 'call.webm'}"
    temp_path = os.path.join(temp_dir, temp_filename)
    with open(temp_path, "wb") as f:
        f.write(file_bytes)

    # 3. Tìm hoặc khởi tạo HumanSupportSession
    h_session = await session_repo.get_by_id_or_code(session_id)
    if not h_session:
        h_session = HumanSupportSession(
            id=session_id if session_id.startswith("SUP-") else None,
            session_code=f"LIVE-{random.randint(1000, 99999)}",
            room_number="Main Lobby Kiosk",
            guest_name="Hotel Guest",
            category="Video Call Support",
            status="Resolved",
            recording_status="saving",
        )
        await session_repo.create(h_session)
    else:
        h_session.status = "Resolved"
        h_session.recording_status = "saving"

    h_session.recording_duration = duration
    h_session.call_ended_at = datetime.utcnow()

    if messages:
        try:
            parsed_msgs = json.loads(messages)
            if isinstance(parsed_msgs, list):
                h_session.messages = parsed_msgs
        except Exception:
            pass

    if call_started_at:
        try:
            h_session.call_started_at = datetime.fromisoformat(call_started_at.replace("Z", "+00:00"))
        except Exception:
            pass

    # 4. Cập nhật ticket SupportRequest liên kết
    if h_session.linked_request_id:
        req = await sr_repo.get_by_id_or_code(h_session.linked_request_id)
        if req:
            req.status = "Completed"
            req.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    await session_repo.commit()
    await session_repo.refresh(h_session)

    # 5. Đẩy tác vụ upload ngầm vào BackgroundTasks
    background_tasks.add_task(
        _background_upload_video,
        session_id=h_session.id,
        temp_file_path=temp_path,
        filename=video_file.filename or f"call_{session_id}.webm",
        duration=duration,
    )

    return {
        "session_id": h_session.id,
        "recording_url": h_session.recording_url,
        "public_id": h_session.recording_public_id,
        "duration": h_session.recording_duration or duration,
        "thumbnail_url": h_session.thumbnail_url,
        "storage_provider": "pending",
        "status": "Resolved",
        "recording_status": "saving",
        "message": "Video đã được tiếp nhận và đang tiến hành lưu ngầm vào Cloudinary!",
    }


@router.get(
    "/concierge/recordings/local/{filename}",
    tags=TAG_CONCIERGE,
    summary="Phát lại video ghi hình local fallback",
)
async def get_local_recording(filename: str):
    """Endpoint phục vụ stream lại video ghi hình local khi Cloudinary chạy chế độ offline fallback."""
    safe_filename = os.path.basename(filename)
    local_path = os.path.join(os.getcwd(), "uploaded_recordings", safe_filename)
    if not os.path.exists(local_path) or not os.path.isfile(local_path):
        raise HTTPException(status_code=404, detail="File video không tồn tại trên máy chủ")
    if os.path.getsize(local_path) < 1024:
        raise HTTPException(status_code=422, detail="File bản ghi bị hỏng hoặc không có dữ liệu video hợp lệ")
    media_type = "video/mp4" if safe_filename.lower().endswith(".mp4") else "video/webm"
    return FileResponse(local_path, media_type=media_type)


@router.get("/concierge/ws/video-call/status")
async def get_video_rooms_status():
    return {
        "rooms": {
            sid: {role: p.get("name") for role, p in peers.items()}
            for sid, peers in video_call_manager.rooms.items()
        }
    }


# =====================================================================
# WEBRTC VIDEO CALL SIGNALING WEBSOCKET HUB
# =====================================================================

@router.websocket("/ws/video-call/{session_id}")
@router.websocket("/concierge/ws/video-call/{session_id}")
async def video_call_signaling_endpoint(
    websocket: WebSocket,
    session_id: str,
    role: str = Query("guest", description="'guest' (Robot/Khách) hoặc 'staff' (Tổng đài viên Concierge)"),
    name: str = Query("User", description="Tên người tham gia cuộc gọi"),
):
    """
    Kênh Signaling WebSocket thời gian thực trao đổi SDP Offer/Answer, ICE Candidate
    và trạng thái media (camera, mic, chuông gọi) giữa Robot Kiosk và Web Concierge.
    """
    clean_session = session_id.strip()

    # Tự động tra cứu DB nếu session_id chưa có trong alias map và không phải dạng canonical CCG-
    if clean_session not in video_call_manager.aliases and not clean_session.startswith("CCG-"):
        try:
            from app.core.database import AsyncSessionLocal

            async with AsyncSessionLocal() as db_lookup:
                if clean_session.startswith("REQ-"):
                    stmt = select(SupportRequest.ticket_code).where(SupportRequest.id == clean_session)
                    res = await db_lookup.execute(stmt)
                    ticket = res.scalar_one_or_none()
                    if ticket:
                        video_call_manager.register_alias(ticket, clean_session)
                elif clean_session.startswith("SUP-") or clean_session.startswith("LIVE-"):
                    stmt = select(HumanSupportSession.linked_request_id, HumanSupportSession.session_code).where(
                        (HumanSupportSession.id == clean_session) | (HumanSupportSession.session_code == clean_session)
                    )
                    res = await db_lookup.execute(stmt)
                    row = res.first()
                    if row and row[0]:
                        stmt2 = select(SupportRequest.ticket_code).where(SupportRequest.id == row[0])
                        res2 = await db_lookup.execute(stmt2)
                        ticket = res2.scalar_one_or_none()
                        if ticket:
                            video_call_manager.register_alias(ticket, clean_session, row[0], row[1])
        except Exception as e:
            logger.warning(f"[VideoCall] On-demand DB alias resolution error: {e}")

    await video_call_manager.connect(websocket, clean_session, role=role, name=name)

    try:
        while True:
            text_data = await websocket.receive_text()
            try:
                msg_json = json.loads(text_data)
            except Exception:
                continue

            msg_type = msg_json.get("type")
            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            # Chuyển tiếp tin hiệu SDP / ICE Candidate / Điều khiển Media tới Peer đối diện
            await video_call_manager.forward_signaling_message(websocket, clean_session, msg_json)

    except WebSocketDisconnect:
        video_call_manager.disconnect(websocket, clean_session)
    except Exception:
        video_call_manager.disconnect(websocket, clean_session)
