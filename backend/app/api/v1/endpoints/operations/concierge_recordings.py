import json
import logging
import os
import random
import time
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.models.support import HumanSupportSession
from app.repositories import (
    SupportRequestRepository,
    SupportSessionRepository,
    get_support_request_repository,
    get_support_session_repository,
)
from app.services.cloudinary_service import cloudinary_service
from app.core.time import utc_now_naive
from .concierge_sessions_ws import RecordingUploadResponse
from .shared import TAG_CONCIERGE

logger = logging.getLogger(__name__)
router = APIRouter()


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
    from app.repositories.support_session_repository import SupportSessionRepository as _SSR

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
            repo = _SSR(db_session)
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
                repo = _SSR(db_session)
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
                created_at=created_dt or utc_now_naive(),
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
                        created_at=utc_now_naive(),
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
    content_type = video_file.content_type or ""
    if content_type and not any(ct in content_type for ct in ("video", "octet-stream")):
        raise HTTPException(status_code=400, detail="Định dạng file không hợp lệ, yêu cầu file video")

    file_bytes = await video_file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File video trống không có dữ liệu")

    if len(file_bytes) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File video vượt quá giới hạn 100MB")

    temp_dir = os.path.join(os.getcwd(), "uploaded_recordings", "temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_filename = f"temp_{int(time.time())}_{random.randint(1000, 9999)}_{video_file.filename or 'call.webm'}"
    temp_path = os.path.join(temp_dir, temp_filename)
    with open(temp_path, "wb") as f:
        f.write(file_bytes)

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
    h_session.call_ended_at = utc_now_naive()

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

    if h_session.linked_request_id:
        req = await sr_repo.get_by_id_or_code(h_session.linked_request_id)
        if req:
            req.status = "Completed"
            req.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    await session_repo.commit()
    await session_repo.refresh(h_session)

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
