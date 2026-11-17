import pytest
from app.services.ai.tts_service import tts_service


def test_voice_settings_contains_boosted_volume():
    settings = tts_service.get_voice_settings()
    assert "volume" in settings
    assert settings["volume"] in ["+30%", "+35%", "+40%", "+50%"]
    assert settings["vi_voice"] in ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"]


def test_update_voice_settings_volume():
    updated = tts_service.update_voice_settings(volume="+40%")
    assert updated["volume"] == "+40%"
    # Restore to default
    restored = tts_service.update_voice_settings(volume="+35%")
    assert restored["volume"] == "+35%"


def test_clean_text_preserves_clean_vietnamese():
    cleaned = tts_service.clean_text_for_tts("Dạ vâng, Rora rất vui được phục vụ quý khách ạ!")
    assert "Rora" in cleaned or "Ro-ra" in cleaned
    assert "*" not in cleaned
    assert "#" not in cleaned
