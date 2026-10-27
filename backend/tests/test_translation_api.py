import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_quick_translate_en_to_vi():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/ai/translate",
            json={
                "text": "Where is the swimming pool?",
                "source_lang": "auto",
                "target_lang": "vi",
                "sender_role": "guest"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source_lang"] == "en"
        assert data["target_lang"] == "vi"
        assert data["needs_translation"] is True
        assert len(data["translated_text"]) > 0


@pytest.mark.asyncio
async def test_quick_translate_vi_bypass():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/ai/translate",
            json={
                "text": "Xin chào tôi muốn hỏi số phòng",
                "source_lang": "auto",
                "target_lang": "vi",
                "sender_role": "guest"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source_lang"] == "vi"
        assert data["needs_translation"] is False
        assert data["translated_text"] == "Xin chào tôi muốn hỏi số phòng"
