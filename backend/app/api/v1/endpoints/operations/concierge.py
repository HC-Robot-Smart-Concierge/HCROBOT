import os
import json
import random
from datetime import datetime
from typing import Optional, List, Dict, Any

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
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, func

from app.core.database import get_db
from app.models import SupportRequest
from app.models.support import HumanSupportSession
from app.schemas.operations import (
    ConciergeLiveRequestCreate,
    ConciergeLiveRequestUpdate,
    ConciergeLiveRequestResponse,
    ConciergeDashboardResponse,
)
from app.services.cloudinary_service import cloudinary_service
from app.services.video_call_manager import video_call_manager
from .shared import TAG_CONCIERGE, create_department_notification

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
    thumbnail_url: Optional[str] = None
    call_started_at: Optional[datetime] = None
    call_ended_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecordingUploadResponse(BaseModel):
    session_id: str
    recording_url: str
    public_id: Optional[str] = None
    duration: int
    thumbnail_url: Optional[str] = None
    storage_provider: str
    status: str
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
async def get_concierge_dashboard(db: AsyncSession = Depends(get_db)):
    """
    Truy vấn phiên hỗ trợ trực tuyến (Live Call / Video Assistance) mới nhất khi khách hàng tương tác với Robot Kiosk:
    - Cuộc gọi video cần nhân viên can thiệp trực tiếp (Human-in-the-loop)
    - Hội thoại thoại (`transcript`) giữa Robot và khách
    - Dữ liệu chuẩn hóa trong bảng `support_requests`.
    """
    result = await db.execute(
        select(SupportRequest)
        .where(
            or_(
                SupportRequest.department_id == "DEP-CONCIERGE",
                SupportRequest.service_type_id == "ST-CONCIERGE",
            )
        )
        .order_by(desc(SupportRequest.created_at))
        .limit(1)
    )
    current_req = result.scalar_one_or_none()

    # Đếm số phiên đang active
    count_res = await db.execute(
        select(func.count(SupportRequest.id))
        .where(
            or_(
                SupportRequest.department_id == "DEP-CONCIERGE",
                SupportRequest.service_type_id == "ST-CONCIERGE",
            ),
            SupportRequest.status.in_(["Pending", "In Progress", "Connected"]),
        )
    )
    active_count = count_res.scalar() or 0

    return {
        "current_request": current_req,
        "active_sessions_count": active_count,
    }


@router.post(
    "/concierge/requests",
    response_model=ConciergeLiveRequestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_CONCIERGE,
    summary="Khởi tạo phiên hỗ trợ Live Call / Video Call từ Robot Kiosk",
)
async def create_concierge_live_request(
    request_in: ConciergeLiveRequestCreate,
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
        priority="HIGH",
        status="Pending",
    )
    db.add(new_request)
    await db.flush()

    # Tạo song song phiên HumanSupportSession để sẵn sàng lưu vết cuộc gọi và Cloudinary recording
    human_session = HumanSupportSession(
        session_code=f"LIVE-{code_num}",
        room_number=room_loc,
        guest_name=guest,
        category="Live Call Support",
        origin_robot_code="RC-001 (Main Lobby)",
        sentiment="Neutral",
        status="Active",
        linked_request_id=new_request.id,
        call_started_at=datetime.utcnow(),
        messages=request_in.transcript or [],
    )
    db.add(human_session)
    await db.flush()

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

    await db.commit()
    await db.refresh(new_request)
    return new_request


@router.patch(
    "/concierge/requests/{request_id}",
    response_model=ConciergeLiveRequestResponse,
    tags=TAG_CONCIERGE,
    summary="Cập nhật trạng thái cuộc gọi, phân công hoặc đóng phiên Live Call Concierge",
)
async def update_concierge_request(
    request_id: str,
    update_in: ConciergeLiveRequestUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Tổng đài viên Concierge tiếp nhận cuộc gọi, đổi trạng thái (`Connected`, `In Progress`, `Completed`), ghi chú và kết thúc phiên làm việc.
    """
    clean_id = request_id.replace("REQ-", "").strip()
    result = await db.execute(
        select(SupportRequest).where(
            or_(
                SupportRequest.id == request_id,
                SupportRequest.ticket_code == request_id,
                SupportRequest.id == clean_id,
                SupportRequest.ticket_code == clean_id,
            )
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên hỗ trợ Concierge")

    if update_in.status is not None:
        req.status = update_in.status
    if update_in.assigned_to is not None:
        req.assigned_staff_name = update_in.assigned_to

    req.updated_at = datetime.utcnow()

    # Đồng bộ trạng thái sang HumanSupportSession tương ứng
    hs_res = await db.execute(
        select(HumanSupportSession).where(HumanSupportSession.linked_request_id == req.id)
    )
    hs = hs_res.scalar_one_or_none()
    if hs:
        if update_in.status in ["Completed", "Closed"]:
            hs.status = "Resolved"
            if not hs.call_ended_at:
                hs.call_ended_at = datetime.utcnow()
        elif update_in.status in ["Connected", "In Progress"]:
            hs.status = "Active"

    await db.commit()
    await db.refresh(req)
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
    limit: int = 50,
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Truy vấn danh sách các phiên HumanSupportSession bao gồm link video Cloudinary, thời lượng, trạng thái.
    """
    query = select(HumanSupportSession).order_by(desc(HumanSupportSession.created_at)).limit(limit)
    if status_filter:
        query = query.where(HumanSupportSession.status == status_filter)

    res = await db.execute(query)
    return res.scalars().all()


@router.get(
    "/concierge/sessions/{session_id}",
    response_model=HumanSupportSessionItem,
    tags=TAG_CONCIERGE,
    summary="Chi tiết một phiên HumanSupportSession",
)
async def get_human_support_session_detail(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(HumanSupportSession).where(
            or_(
                HumanSupportSession.id == session_id,
                HumanSupportSession.session_code == session_id,
                HumanSupportSession.linked_request_id == session_id,
            )
        )
    )
    session_item = res.scalar_one_or_none()
    if not session_item:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên hỗ trợ")
    return session_item


@router.post(
    "/concierge/recordings/{session_id}",
    response_model=RecordingUploadResponse,
    tags=TAG_CONCIERGE,
    summary="Tải video ghi hình cuộc gọi lên Cloudinary và lưu vào HumanSupportSession",
)
async def upload_call_recording(
    session_id: str,
    video_file: UploadFile = File(..., description="File video ghi hình cuộc gọi (.webm / .mp4)"),
    duration: int = Form(0, description="Thời lượng cuộc gọi tính bằng giây"),
    call_started_at: Optional[str] = Form(None),
    call_ended_at: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Nghiệp vụ Ghi hình Cuộc gọi & Cloudinary:
    1. Nhận file video Blob từ WebRTC MediaRecorder client.
    2. Upload video lên Cloudinary (thư mục hcrobot/call_recordings) lấy URL an toàn & thumbnail.
    3. Lưu `recording_url`, `recording_public_id`, `recording_duration`, `thumbnail_url` vào bảng `HumanSupportSession`.
    4. Cập nhật trạng thái phiên thành `Resolved` và ticket `SupportRequest` liên quan thành `Completed`.
    """
    file_bytes = await video_file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File video trống không có dữ liệu")

    # 1. Upload lên Cloudinary (hoặc local fallback nếu chưa nhập Cloudinary API key)
    cloud_result = await cloudinary_service.upload_video_recording(
        file_bytes=file_bytes,
        filename=video_file.filename or f"call_{session_id}.webm",
        duration=duration,
    )

    # 2. Tìm HumanSupportSession tương ứng
    res = await db.execute(
        select(HumanSupportSession).where(
            or_(
                HumanSupportSession.id == session_id,
                HumanSupportSession.session_code == session_id,
                HumanSupportSession.linked_request_id == session_id,
            )
        )
    )
    h_session = res.scalar_one_or_none()

    # Nếu chưa có bản ghi (ví dụ cuộc gọi trực tiếp từ test/modal), tự động tạo mới
    if not h_session:
        h_session = HumanSupportSession(
            id=session_id if session_id.startswith("SUP-") else None,
            session_code=f"LIVE-{random.randint(1000, 99999)}",
            room_number="Main Lobby Kiosk",
            guest_name="Hotel Guest",
            category="Video Call Support",
            status="Resolved",
        )
        db.add(h_session)
        await db.flush()

    # 3. Ghi nhận dữ liệu video vào CSDL
    h_session.recording_url = cloud_result["secure_url"]
    h_session.recording_public_id = cloud_result["public_id"]
    h_session.recording_duration = cloud_result["duration"] or duration
    h_session.thumbnail_url = cloud_result.get("thumbnail_url")
    h_session.status = "Resolved"
    h_session.call_ended_at = datetime.utcnow()

    if call_started_at:
        try:
            h_session.call_started_at = datetime.fromisoformat(call_started_at.replace("Z", "+00:00"))
        except Exception:
            pass

    # 4. Cập nhật ticket SupportRequest liên kết nếu có
    if h_session.linked_request_id:
        req_res = await db.execute(
            select(SupportRequest).where(SupportRequest.id == h_session.linked_request_id)
        )
        req = req_res.scalar_one_or_none()
        if req:
            req.status = "Completed"
            req.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(h_session)

    return {
        "session_id": h_session.id,
        "recording_url": h_session.recording_url,
        "public_id": h_session.recording_public_id,
        "duration": h_session.recording_duration or 0,
        "thumbnail_url": h_session.thumbnail_url,
        "storage_provider": cloud_result.get("storage_provider", "cloudinary"),
        "status": "Resolved",
        "message": "Ghi hình cuộc gọi đã được lưu trữ thành công vào Cloudinary và CSDL!",
    }


@router.get(
    "/concierge/recordings/local/{filename}",
    tags=TAG_CONCIERGE,
    summary="Phát lại video ghi hình local fallback",
)
async def get_local_recording(filename: str):
    """Endpoint phục vụ stream lại video ghi hình local khi Cloudinary chạy chế độ offline fallback."""
    local_path = os.path.join(os.getcwd(), "uploaded_recordings", filename)
    if not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="File video không tồn tại")
    return FileResponse(local_path, media_type="video/webm")


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
    except Exception as e:
        video_call_manager.disconnect(websocket, clean_session)
