import pytest
from app.services.ai.persona_service import PersonaService, DEFAULT_PERSONA


def test_persona_service_defaults():
    service = PersonaService()
    cfg = service.get_persona()
    assert cfg["bot_name"] == "Rora"
    assert cfg["hotel_name"] == "Aurora Grand Hotel"
    assert cfg["star_rating"] == 5
    assert cfg["tone_style"] == "luxury"


def test_persona_service_update():
    service = PersonaService()
    updated = service.update_persona({
        "bot_name": "Luna",
        "hotel_name": "Grand Palace Resort",
        "star_rating": 6,
        "tone_style": "warm",
    })
    assert updated["bot_name"] == "Luna"
    assert updated["hotel_name"] == "Grand Palace Resort"
    assert updated["star_rating"] == 6
    assert updated["tone_style"] == "warm"

    # Verify get_persona reflects the updates
    cfg = service.get_persona()
    assert cfg["bot_name"] == "Luna"

    # Reset back to defaults
    reset = service.reset_defaults()
    assert reset["bot_name"] == "Rora"
    assert reset["hotel_name"] == "Aurora Grand Hotel"


def test_persona_prompt_generation_vietnamese():
    service = PersonaService()
    service.reset_defaults()
    prompt_vi = service.get_persona_prompt("vi-VN")

    assert "Bạn là Rora" in prompt_vi
    assert "Aurora Grand Hotel" in prompt_vi
    assert "5 sao" in prompt_vi
    assert "quét mã QR" in prompt_vi


def test_persona_prompt_generation_english():
    service = PersonaService()
    service.reset_defaults()
    prompt_en = service.get_persona_prompt("en-US")

    assert "You are Rora" in prompt_en
    assert "Aurora Grand Hotel" in prompt_en
    assert "5-star" in prompt_en
    assert "scan the QR code" in prompt_en


def test_unhappy_empathy_and_out_of_scope():
    service = PersonaService()
    service.reset_defaults()

    empathy_vi = service.get_unhappy_empathy("vi-VN")
    assert "khó chịu" in empathy_vi

    empathy_en = service.get_unhappy_empathy("en-US")
    assert "annoyed" in empathy_en or "dissatisfied" in empathy_en

    rejection_vi = service.get_out_of_scope_reply("vi-VN")
    assert "Rora" in rejection_vi
    assert "Aurora Grand Hotel" in rejection_vi

    rejection_en = service.get_out_of_scope_reply("en-US")
    assert "Rora" in rejection_en
    assert "Aurora Grand Hotel" in rejection_en
