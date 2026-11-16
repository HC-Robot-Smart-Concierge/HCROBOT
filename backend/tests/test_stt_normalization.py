import pytest
from app.services.ai.stt_service import normalize_hotel_stt_transcript, HOTEL_STT_INITIAL_PROMPT


def test_stt_room_number_spoken_normalization():
    # Chuẩn hóa các cách nói số phòng thông dụng tiếng Việt
    assert normalize_hotel_stt_transcript("Tôi ở pha không một cần khăn tắm") == "Tôi ở 301 cần khăn tắm"
    assert normalize_hotel_stt_transcript("Cho tôi hỏi phòng ba linh một ở đâu") == "Cho tôi hỏi phòng 301 ở đâu"
    assert normalize_hotel_stt_transcript("phòng ba không một") == "phòng 301"
    assert normalize_hotel_stt_transcript("phòng bốn lẻ hai cần dọn") == "phòng 402 cần dọn"
    assert normalize_hotel_stt_transcript("tôi ở bốn linh chín") == "tôi ở 409"
    assert normalize_hotel_stt_transcript("gọi món lên bốn trăm mười") == "gọi món lên 410"
    assert normalize_hotel_stt_transcript("phòng ba một không") == "phòng 310"


def test_stt_acoustic_error_and_typo_correction():
    # Sửa lỗi âm học "pha 401" -> "phòng 401"
    assert normalize_hotel_stt_transcript("dẫn tôi lên pha 401") == "dẫn tôi lên phòng 401"
    # Sửa lỗi âm học "bar" bị nghe nhầm thành "ba"
    assert normalize_hotel_stt_transcript("ba ở đâu") == "quầy bar ở đâu"
    assert normalize_hotel_stt_transcript("cho tôi hỏi ba ở đâu") == "cho tôi hỏi quầy bar ở đâu"
    assert normalize_hotel_stt_transcript("quầy ba ở tầng mấy") == "quầy bar ở tầng mấy"
    assert normalize_hotel_stt_transcript("chỉ đường lên sky ba") == "chỉ đường lên sky bar"
    # Sửa lỗi từ mượn phổ biến
    assert normalize_hotel_stt_transcript("cho tôi hỏi tolet ở đâu") == "cho tôi hỏi toilet ở đâu"
    assert normalize_hotel_stt_transcript("tôi muốn gọi rum sơ vít") == "tôi muốn gọi room service"
    assert normalize_hotel_stt_transcript("cho xin pát wifi của sảnh") == "cho xin pass wifi của sảnh"


def test_stt_whisper_hallucination_stripping():
    # Loại bỏ câu ảo giác lặp của Whisper khi thu âm tạp âm/im lặng
    raw = "Cho tôi hỏi lễ tân ở đâu Cảm ơn các bạn đã theo dõi"
    assert normalize_hotel_stt_transcript(raw) == "Cho tôi hỏi lễ tân ở đâu"

    raw_yt = "phòng 301 Thank you for watching"
    assert normalize_hotel_stt_transcript(raw_yt) == "phòng 301"


def test_stt_initial_prompt_contains_hotel_entities():
    # Đảm bảo initial_prompt chứa danh sách phòng khách sạn
    assert "301" in HOTEL_STT_INITIAL_PROMPT
    assert "410" in HOTEL_STT_INITIAL_PROMPT
    assert "Aurora Grand" in HOTEL_STT_INITIAL_PROMPT

