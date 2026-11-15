import pytest
from app.services.ai.ollama_service import ollama_service
from app.services.ai.concierge_graph import concierge_graph


@pytest.mark.asyncio
async def test_detect_language_vietnamese_and_english():
    # 1. Phát hiện tiếng Việt
    vi_text = "Tôi muốn gọi cho nhân viên lễ tân hỗ trợ"
    lang_name, lang_code = ollama_service.detect_language(vi_text)
    assert lang_code == "vi-VN"

    # 2. Phát hiện tiếng Anh
    en_text = "Please connect me to human staff for assistance"
    lang_name, lang_code = ollama_service.detect_language(en_text)
    assert lang_code == "en-US"


@pytest.mark.asyncio
async def test_concierge_intent_routing_triggers_call():
    config = {"configurable": {"thread_id": "thread_call_vi"}}
    # Test câu thoại tiếng Việt: 'gọi cho nhân viên'
    state_vi = {
        "session_id": "test_call_session",
        "prompt": "Rora ơi gọi cho nhân viên giúp tôi với",
        "language": "auto",
        "room_number": "402",
        "chat_history": [],
        "rag_context": "",
    }
    result_vi = await concierge_graph.ainvoke(state_vi, config=config)
    assert result_vi.get("action") in ["concierge", "trigger_video_call"]
    assert result_vi.get("trigger_video_call") is True
    assert "nhân viên" in result_vi.get("response").lower()

    # Test câu thoại tiếng Anh: 'call staff'
    config_en = {"configurable": {"thread_id": "thread_call_en"}}
    state_en = {
        "session_id": "test_call_session_en",
        "prompt": "Hey Rora please call staff right now",
        "language": "auto",
        "room_number": None,
        "chat_history": [],
        "rag_context": "",
    }
    result_en = await concierge_graph.ainvoke(state_en, config=config_en)
    assert result_en.get("action") in ["concierge", "trigger_video_call"]
    assert result_en.get("trigger_video_call") is True
    assert "connecting" in result_en.get("response").lower() or "concierge" in result_en.get("response").lower()


@pytest.mark.asyncio
async def test_other_services_not_affected():
    config_hk = {"configurable": {"thread_id": "thread_hk"}}
    # Kiểm tra đảm bảo các dịch vụ khác (housekeeping, taxi) KHÔNG bị ảnh hưởng
    state_hk = {
        "session_id": "test_hk",
        "prompt": "Cho tôi xin thêm 2 cái khăn tắm",
        "language": "auto",
        "room_number": "301",
        "chat_history": [],
        "rag_context": "",
    }
    result_hk = await concierge_graph.ainvoke(state_hk, config=config_hk)
    assert result_hk.get("action") == "housekeeping"
    assert result_hk.get("trigger_video_call") is not True


@pytest.mark.asyncio
async def test_sync_cloudinary_recordings_endpoint(monkeypatch):
    import random
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.core.database import init_db, AsyncSessionLocal
    from app.services.cloudinary_service import cloudinary_service
    from app.repositories.support_session_repository import SupportSessionRepository
    from app.models.support import HumanSupportSession

    await init_db()

    # 1. Tạo session mẫu mới chưa có recording
    rand_id = random.randint(10000, 99999)
    test_code = f"SYNC-TEST-{rand_id}"
    sup_id = f"SUP-SYNC-{rand_id}"
    async with AsyncSessionLocal() as db:
        repo = SupportSessionRepository(db)
        new_session = HumanSupportSession(
            id=sup_id,
            session_code=test_code,
            room_number="Room 501",
            guest_name="Test Cloudinary Guest",
            category="Video Call Support",
            status="Resolved",
            recording_status="none",
            recording_url=None,
        )
        await repo.create(new_session)
        await repo.commit()

    # 2. Mock cloudinary_service với 2 video: 1 video khớp session có sẵn, 1 video cũ không có session trước đó
    old_orphan_code = f"HIST-OLD-{random.randint(10000, 99999)}"
    try:
        monkeypatch.setattr(cloudinary_service, "_is_configured", True)
        sample_resources = [
            {
                "public_id": f"hcrobot/call_recordings/call_{test_code}",
                "secure_url": f"https://res.cloudinary.com/test-cloud/video/upload/v1/hcrobot/call_recordings/call_{test_code}.webm",
                "duration": 42,
                "created_at": "2026-11-11T00:00:00Z",
                "format": "webm",
                "filename": f"call_{test_code}",
            },
            {
                "public_id": f"hcrobot/call_recordings/call_{old_orphan_code}",
                "secure_url": f"https://res.cloudinary.com/test-cloud/video/upload/v1/hcrobot/call_recordings/call_{old_orphan_code}.webm",
                "duration": 65,
                "created_at": "2026-10-25T10:00:00Z",
                "format": "webm",
                "filename": f"call_{old_orphan_code}",
            },
        ]

        async def mock_list(folder=None, max_results=100):
            return sample_resources

        monkeypatch.setattr(cloudinary_service, "list_video_recordings", mock_list)

        # 3. Gọi endpoint POST /api/v1/operations/concierge/recordings/sync-cloudinary
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/operations/concierge/recordings/sync-cloudinary")
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["synced_count"] >= 2
            assert data["total_found"] == 2

        # 4. Xác minh session có sẵn đã cập nhật URL
        async with AsyncSessionLocal() as db:
            repo = SupportSessionRepository(db)
            updated = await repo.get_by_id_or_code(test_code)
            assert updated is not None
            assert updated.recording_url == f"https://res.cloudinary.com/test-cloud/video/upload/v1/hcrobot/call_recordings/call_{test_code}.webm"
            assert updated.recording_status == "ready"
            assert updated.recording_duration == 42

            # 5. Xác minh video cũ chưa từng có session đã được tự động khởi tạo thành công
            orphan_session = await repo.get_by_id_or_code(old_orphan_code)
            assert orphan_session is not None
            assert orphan_session.recording_url == f"https://res.cloudinary.com/test-cloud/video/upload/v1/hcrobot/call_recordings/call_{old_orphan_code}.webm"
            assert orphan_session.recording_status == "ready"
            assert orphan_session.recording_duration == 65
    finally:
        # Dọn sạch dữ liệu test khỏi DB để không làm bẩn danh sách Admin
        from sqlalchemy import delete
        async with AsyncSessionLocal() as db:
            await db.execute(
                delete(HumanSupportSession).where(
                    HumanSupportSession.session_code.in_([test_code, old_orphan_code])
                )
            )
            await db.commit()

