import pytest
from app.services.ai.gemini_service import GeminiService
from app.services.ai.ollama_service import OllamaService


def test_gemini_system_prompt_no_hardcoded_facts():
    """Kiểm tra GeminiService không còn khối tiện ích hardcode tĩnh."""
    service = GeminiService()
    
    # Kiểm tra tiếng Việt
    vi_prompt = service._build_system_prompt(lang_code="vi-VN")
    assert "THÔNG TIN TIỆN ÍCH KHÁCH SẠN AURORA GRAND (ĐỂ TƯ VẤN CHO KHÁCH)" not in vi_prompt
    assert "Tầng 1 (Trệt): Sảnh chính" not in vi_prompt
    assert "NGUYÊN TẮC BẢO TOÀN THÔNG TIN (RAG VÀ FAST-PATH)" in vi_prompt

    # Kiểm tra tiếng Anh
    en_prompt = service._build_system_prompt(lang_code="en-US")
    assert "AURORA GRAND HOTEL AMENITIES & FACTS:" not in en_prompt
    assert "Level 1 (Ground): Main Lobby" not in en_prompt
    assert "KNOWLEDGE INTEGRITY (STRICT RAG & FACTS)" in en_prompt


def test_ollama_system_prompt_no_hardcoded_facts():
    """Kiểm tra OllamaService không còn khối tiện ích hardcode tĩnh."""
    service = OllamaService()
    
    # Kiểm tra tiếng Việt
    vi_prompt = service._build_system_prompt(lang_code="vi-VN")
    assert "THÔNG TIN TIỆN ÍCH KHÁCH SẠN AURORA GRAND (ĐỂ TƯ VẤN CHO KHÁCH)" not in vi_prompt
    assert "Tầng 1 (Trệt): Sảnh chính" not in vi_prompt
    assert "NGUYÊN TẮC BẢO TOÀN THÔNG TIN (RAG VÀ FAST-PATH)" in vi_prompt

    # Kiểm tra tiếng Anh
    en_prompt = service._build_system_prompt(lang_code="en-US")
    assert "AURORA GRAND HOTEL AMENITIES & FACTS:" not in en_prompt
    assert "Level 1 (Ground): Main Lobby" not in en_prompt
    assert "KNOWLEDGE INTEGRITY (STRICT RAG & FACTS)" in en_prompt
