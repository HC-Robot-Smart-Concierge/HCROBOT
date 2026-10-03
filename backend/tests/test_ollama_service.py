import pytest
from unittest.mock import AsyncMock, patch
from app.services.ai.ollama_service import OllamaService


@pytest.mark.asyncio
async def test_generate_response_success():
    """Unit test kiểm tra hàm generate_response của OllamaService với mock client"""
    mock_chat_response = {
        "message": {
            "content": "Xin chào! Tôi có thể giúp gì cho ông chủ hôm nay?"
        }
    }

    with patch("ollama.AsyncClient.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_chat_response

        service = OllamaService()
        reply, lang_name, lang_code = await service.generate_response(
            prompt="Khách sạn có dịch vụ giặt ủi không?",
            rag_context="Khách sạn có dịch vụ ăn sáng từ 6h-10h"
        )

        assert reply == "Xin chào! Tôi có thể giúp gì cho ông chủ hôm nay?"
        assert lang_name == "Tiếng Việt"
        assert lang_code == "vi-VN"
        assert mock_chat.called



@pytest.mark.asyncio
async def test_extract_intent_json_parsing():
    """Unit test kiểm tra hàm bóc tách intent JSON từ OllamaService"""
    mock_intent_response = {
        "message": {
            "content": '{"action": "housekeeping", "room_number": "302", "items": "2 cái khăn tắm"}'
        }
    }

    with patch("ollama.AsyncClient.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_intent_response

        service = OllamaService()
        intent = await service.extract_intent(user_speech="Phòng 302 cần 2 cái khăn tắm")

        assert intent["action"] == "housekeeping"
        assert intent["room_number"] == "302"
        assert intent["items"] == "2 cái khăn tắm"


def test_detect_language_vietnamese_and_english():
    """Unit test kiểm tra khả năng tự động phân biệt tiếng Anh và tiếng Việt"""
    service = OllamaService()

    # Tiếng Việt có dấu
    name, code = service.detect_language("Chào em, hồ bơi ở đâu vậy?")
    assert name == "Tiếng Việt" and code == "vi-VN"

    # Tiếng Việt không dấu
    name, code = service.detect_language("phong 302 can don dep ngay")
    assert name == "Tiếng Việt" and code == "vi-VN"

    # Tiếng Anh câu hỏi vị trí & tiện ích
    name, code = service.detect_language("Where is the swimming pool?")
    assert name == "English" and code == "en-US"

    # Tiếng Anh câu hỏi dịch vụ / wifi
    name, code = service.detect_language("Do you have free wifi password?")
    assert name == "English" and code == "en-US"

    # Tiếng Anh câu chào
    name, code = service.detect_language("Good morning robot, how are you?")
    assert name == "English" and code == "en-US"


def test_bilingual_fast_path_responses():
    """Unit test kiểm tra Fast-Path phản hồi song ngữ Anh - Việt chính xác"""
    service = OllamaService()

    # Fast-path tiếng Việt
    vi_hit = service.check_fast_path("pass wifi là gì")
    assert vi_hit is not None
    vi_reply, vi_name, vi_code = vi_hit
    assert vi_code == "vi-VN"
    assert "Aurora_Guest" in vi_reply
    assert "Dạ" in vi_reply

    # Fast-path tiếng Anh
    en_hit = service.check_fast_path("wifi password")
    assert en_hit is not None
    en_reply, en_name, en_code = en_hit
    assert en_code == "en-US"
    assert "Aurora_Guest" in en_reply
    assert "Complimentary Wi-Fi" in en_reply

