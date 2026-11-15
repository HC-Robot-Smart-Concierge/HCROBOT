import json
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import SupportRequest
from app.models.support import HumanSupportSession
from app.repositories import SupportSessionRepository, get_support_session_repository
from app.services.video_call_manager import video_call_manager
from .shared import TAG_CONCIERGE

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
