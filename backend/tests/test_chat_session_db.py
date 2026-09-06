import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.init_db import init_db
from app.core.database import AsyncSessionLocal
from app.services.ai.session_manager import SessionMemoryManager, session_manager
from app.models.chat_session import ChatSession, ChatMessage
from sqlalchemy.future import select


@pytest.mark.asyncio
async def test_chat_session_memory_manager():
    """Test SessionMemoryManager add turn and memory caching"""
    mgr = SessionMemoryManager()
    sid = "test_session_123"
    mgr.add_turn(sid, "user", "Xin chào robot")
    mgr.add_turn(sid, "assistant", "Xin chào quý khách!")

    history = mgr.get_history(sid)
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[0]["content"] == "Xin chào robot"
    assert history[1]["role"] == "assistant"
    assert history[1]["content"] == "Xin chào quý khách!"


import uuid


@pytest.mark.asyncio
async def test_chat_session_db_persistence_and_api():
    """Test ChatSession & ChatMessage persistence in Database and REST API"""
    await init_db()
    sid = f"test_db_session_{uuid.uuid4()}"
    
    try:
        async with AsyncSessionLocal() as db_session:
            await session_manager.save_turn_to_db(db_session, sid, "user", "Khách sạn có hồ bơi không?", room_number="502")
            await session_manager.save_turn_to_db(db_session, sid, "assistant", "Dạ hồ bơi ở Tầng 4 ạ.", room_number="502")

            # Verify session created in DB
            result = await db_session.execute(select(ChatSession).where(ChatSession.id == sid))
            session = result.scalars().first()
            assert session is not None
            assert session.room_number == "502"

            # Verify messages created in DB
            result_msgs = await db_session.execute(select(ChatMessage).where(ChatMessage.session_id == sid))
            messages = result_msgs.scalars().all()
            assert len(messages) == 2
            assert messages[0].sender == "user"

        # Test GET /api/v1/ai/sessions and GET /api/v1/ai/sessions/{session_id}/messages REST APIs
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            sessions_res = await ac.get("/api/v1/ai/sessions")
            assert sessions_res.status_code == 200
            assert isinstance(sessions_res.json(), list)

            msgs_res = await ac.get(f"/api/v1/ai/sessions/{sid}/messages")
            assert msgs_res.status_code == 200
            msgs_data = msgs_res.json()
            assert len(msgs_data) == 2
            assert msgs_data[0]["text"] == "Khách sạn có hồ bơi không?"
    finally:
        from app.core.database import engine
        await engine.dispose()
