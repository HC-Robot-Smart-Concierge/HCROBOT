"""Human support sessions, video call metrics, and WebRTC signaling WebSocket hub."""

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


def _parse_iso_naive(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


async def _resolve_video_call_aliases(clean_session: str) -> None:
    """Resolve and register VideoCallManager aliases from DB when not already cached."""
    if clean_session in video_call_manager.aliases or clean_session.startswith("CCG-"):
        return
    try:
        from app.core.database import AsyncSessionLocal

        async with AsyncSessionLocal() as db_lookup:
            if clean_session.startswith("REQ-"):
                res = await db_lookup.execute(
                    select(SupportRequest.ticket_code).where(SupportRequest.id == clean_session)
                )
                ticket = res.scalar_one_or_none()
                if ticket:
                    video_call_manager.register_alias(ticket, clean_session)
            elif clean_session.startswith(("SUP-", "LIVE-")):
                res = await db_lookup.execute(
                    select(HumanSupportSession.linked_request_id, HumanSupportSession.session_code).where(
                        (HumanSupportSession.id == clean_session)
                        | (HumanSupportSession.session_code == clean_session)
                    )
                )
                row = res.first()
                if row and row[0]:
                    res2 = await db_lookup.execute(
                        select(SupportRequest.ticket_code).where(SupportRequest.id == row[0])
                    )
                    ticket = res2.scalar_one_or_none()
                    if ticket:
                        video_call_manager.register_alias(ticket, clean_session, row[0], row[1])
    except Exception as e:
        logger.warning(f"[VideoCall] On-demand DB alias resolution error: {e}")


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
    start_dt = _parse_iso_naive(start_date)
    if start_dt:
        stmt = stmt.where(HumanSupportSession.created_at >= start_dt)
    end_dt = _parse_iso_naive(end_date)
    if end_dt:
        stmt = stmt.where(HumanSupportSession.created_at <= end_dt)

    sessions = (await db.execute(stmt)).scalars().all()
    ready_count = saving_count = failed_count = no_rec_count = 0

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
        "total_calls": len(sessions),
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
    result = {}
    for sid, peers in video_call_manager.rooms.items():
        result[sid] = {}
        for role, p in peers.items():
            ws = p.get("ws")
            client_host = ws.client.host if ws and ws.client else None
            client_port = ws.client.port if ws and ws.client else None
            headers = dict(ws.headers) if ws and hasattr(ws, "headers") else {}
            cf_ip = headers.get("cf-connecting-ip") or headers.get("x-forwarded-for")
            result[sid][role] = {
                "name": p.get("name"),
                "client_ip": client_host,
                "client_port": client_port,
                "forwarded_ip": cf_ip,
            }
    return {"rooms": result}


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
    await _resolve_video_call_aliases(clean_session)
    await video_call_manager.connect(websocket, clean_session, role=role, name=name)

    try:
        while True:
            text_data = await websocket.receive_text()
            try:
                msg_json = json.loads(text_data)
            except Exception:
                continue

            if msg_json.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            await video_call_manager.forward_signaling_message(websocket, clean_session, msg_json)
    except WebSocketDisconnect:
        video_call_manager.disconnect(websocket, clean_session)
    except Exception:
        video_call_manager.disconnect(websocket, clean_session)
