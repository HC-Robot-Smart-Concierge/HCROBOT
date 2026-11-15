import io
import re
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Optional, Dict, Any, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy loaded whisper model to save RAM until first use
_whisper_model = None
_whisper_load_attempted = False

VI_DIACRITICS_RE = re.compile(
    r"[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]",
    re.IGNORECASE,
)

VI_ANCHOR_WORDS_RE = re.compile(
    r"\b(dạ|vâng|không|tôi|mình|bạn|anh|chị|em|quý khách|phòng|khách sạn|xin chào|chào|"
    r"cảm ơn|ở đâu|bao nhiêu|thế nào|cho tôi|giúp|nhé|nha|ạ|ơi|với|được|muốn|cần|lễ tân|"
    r"hồ bơi|nhà hàng|ăn sáng|khăn tắm|dọn phòng|tầng|thang máy)\b",
    re.IGNORECASE,
)

EN_ANCHOR_WORDS_RE = re.compile(
    r"\b(the|is|are|was|were|where|what|when|how|who|why|can|could|would|will|should|"
    r"you|your|please|thank|thanks|hello|hi|hey|yes|no|room|hotel|pool|restaurant|breakfast|"
    r"towel|towels|water|clean|cleaning|service|help|need|want|have|check|in|out|key|card|"
    r"floor|elevator|wifi|password|reception|staff|english|vietnamese)\b",
    re.IGNORECASE,
)


HOTEL_STT_INITIAL_PROMPT = (
    "Khách sạn Aurora Grand. Các phòng lưu trú: 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, "
    "401, 402, 403, 404, 405, 406, 407, 408, 409, 410. "
    "Dịch vụ: lễ tân, buồng phòng, dọn phòng, khăn tắm, bàn ủi, nước suối, hồ bơi vô cực, "
    "nhà hàng, thực đơn, menu, gọi món, taxi, đón xe, spa, gym, toilet, WC, wifi."
)

WORD_TO_DIGIT_D1 = {"ba": "3", "pha": "3", "bốn": "4", "bon": "4", "tư": "4"}
WORD_TO_DIGIT_D3 = {
    "một": "1", "mot": "1", "mốt": "1", "1": "1",
    "hai": "2", "2": "2",
    "ba": "3", "3": "3",
    "bốn": "4", "bon": "4", "tư": "4", "4": "4",
    "năm": "5", "nam": "5", "lăm": "5", "lam": "5", "5": "5",
    "sáu": "6", "sau": "6", "6": "6",
    "bảy": "7", "bay": "7", "bẩy": "7", "7": "7",
    "tám": "8", "tam": "8", "8": "8",
    "chín": "9", "chin": "9", "9": "9",
}

WHISPER_HALLUCINATION_PATTERNS = [
    re.compile(r"cảm ơn (?:quý vị |các bạn )?đã theo dõi.*", re.IGNORECASE),
    re.compile(r"hãy like và subscribe.*", re.IGNORECASE),
    re.compile(r"thank you for watching.*", re.IGNORECASE),
    re.compile(r"thanks for watching.*", re.IGNORECASE),
    re.compile(r"subtitles by.*", re.IGNORECASE),
]


def normalize_hotel_stt_transcript(text: str) -> str:
    """
    Chuẩn hóa văn bản đầu ra từ STT cho ngữ cảnh khách sạn:
    1. Chuyển đổi số phòng nói tiếng Việt (ba không một, ba linh hai, pha không một, bốn lẻ ba...) thành số chuẩn (301, 302, 403).
    2. Sửa lỗi âm học thường gặp (pha 401 -> phòng 401, tolet -> toilet, rum sơ vít -> room service).
    3. Loại bỏ ảo giác lặp từ (hallucination loops) của Whisper trên âm thanh rỗng/nhiễu.
    """
    if not text:
        return ""
    clean = text.strip()

    for pat in WHISPER_HALLUCINATION_PATTERNS:
        clean = pat.sub("", clean).strip()

    def _rep_room_3digits(m: re.Match) -> str:
        d1 = WORD_TO_DIGIT_D1.get(m.group(1).lower(), "3")
        d3 = WORD_TO_DIGIT_D3.get(m.group(2).lower(), "1")
        return f"{d1}0{d3}"

    # 1. Chuyển đổi số phòng ba chữ số: [ba|pha|bốn] [linh|không|lẻ] [một..chín] -> 301..409
    clean = re.sub(
        r'\b(ba|pha|bốn|bon|tư)\s+(?:trăm\s+)?(?:linh|không|khong|lẻ|le)\s+(một|mot|mốt|hai|ba|bốn|bon|tư|năm|nam|lăm|sáu|sau|bảy|bay|bẩy|tám|tam|chín|chin|[1-9])\b',
        _rep_room_3digits,
        clean,
        flags=re.IGNORECASE,
    )

    # 2. Chuyển đổi phòng 310, 410: [ba|bốn] [mười|một không] -> 310 / 410
    clean = re.sub(
        r'\b(ba|pha|bốn|bon|tư)\s+(?:trăm\s+)?(?:mười|muoi|mươi|một không|mot khong)\b',
        lambda m: "310" if m.group(1).lower() in ["ba", "pha"] else "410",
        clean,
        flags=re.IGNORECASE,
    )

    # 3. Sửa lỗi âm học "pha" đứng trước số phòng -> "phòng"
    clean = re.sub(r'\bpha\s+(?:phòng\s+)?([34][01][0-9])\b', r'phòng \1', clean, flags=re.IGNORECASE)

    # 4. Sửa lỗi âm học tiếng Việt: "bar" bị nghe nhầm thành "ba"
    clean = re.sub(r'\b(sky|rooftop)\s+ba\b', r'\1 bar', clean, flags=re.IGNORECASE)
    clean = re.sub(r'\b(quầy|quay|quán|quan)\s+ba\b', r'\1 bar', clean, flags=re.IGNORECASE)
    clean = re.sub(r'\b(lên|ra|đi|vào|uống ở)\s+ba\b', r'\1 bar', clean, flags=re.IGNORECASE)
    clean = re.sub(r'\bba\s+(ở đâu|o dau|chỗ nào|cho nao|tầng mấy|tang may|hướng nào|huong nao|lối nào|loi nao)\b', r'quầy bar \1', clean, flags=re.IGNORECASE)

    # 5. Sửa lỗi chính tả/từ mượn tiếng Anh phổ biến
    clean = re.sub(r'\b(tolet|to lét|toa lét|toilét|toalet)\b', 'toilet', clean, flags=re.IGNORECASE)
    clean = re.sub(r'\b(rum sơ vít|room sơ vít|room sơ vit|rum sơ vit)\b', 'room service', clean, flags=re.IGNORECASE)
    clean = re.sub(r'\b(pát wifi|bát wifi|mật khẩu goai phai)\b', 'pass wifi', clean, flags=re.IGNORECASE)

    return clean.strip()


def get_whisper_model():
    global _whisper_model, _whisper_load_attempted
    if _whisper_model is None and not _whisper_load_attempted:
        _whisper_load_attempted = True
        preferred_model = getattr(settings, "WHISPER_MODEL", "base") or "base"
        try:
            import faster_whisper
            logger.info(f"[STT Service] Loading faster_whisper {preferred_model} model on CPU...")
            _whisper_model = faster_whisper.WhisperModel(preferred_model, device="cpu", compute_type="int8")
            logger.info(f"[STT Service] faster_whisper {preferred_model} model loaded successfully.")
        except Exception as e:
            if preferred_model != "tiny":
                try:
                    import faster_whisper
                    logger.warning(f"[STT Service] Failed to load {preferred_model} ({e}), falling back to tiny model on CPU...")
                    _whisper_model = faster_whisper.WhisperModel("tiny", device="cpu", compute_type="int8")
                    logger.info("[STT Service] faster_whisper tiny model loaded successfully as fallback.")
                    return _whisper_model
                except Exception as e_tiny:
                    logger.info(f"[STT Service] faster_whisper unavailable ({e_tiny}); using Google Bilingual STT.")
                    return None
            else:
                logger.info(f"[STT Service] faster_whisper unavailable ({e}); using Google Bilingual STT.")
                return None
    return _whisper_model


def _parse_google_result(raw_res: Any) -> Tuple[str, float]:
    """Trích xuất (transcript, confidence) từ kết quả recognize_google(..., with_confidence=True)."""
    if not raw_res:
        return "", 0.0
    if isinstance(raw_res, tuple) and len(raw_res) >= 1:
        text = str(raw_res[0] or "").strip()
        conf = float(raw_res[1]) if len(raw_res) > 1 and raw_res[1] is not None else 0.75
        return text, conf
    if isinstance(raw_res, dict):
        alts = raw_res.get("alternative", [])
        if alts and isinstance(alts, list):
            best = alts[0]
            return str(best.get("transcript", "")).strip(), float(best.get("confidence", 0.75))
    if isinstance(raw_res, str):
        return raw_res.strip(), 0.75
    return "", 0.0


def _score_bilingual_candidates(
    vi_text: str,
    vi_conf: float,
    en_text: str,
    en_conf: float,
    preferred_lang: str = "en",
) -> Tuple[str, str, float]:
    """
    Chấm điểm cặp ứng viên (vi-VN, en-US) từ tín hiệu âm thanh để chọn đúng ngôn ngữ thực tế.
    Trả về: (chosen_text, detected_lang, final_confidence)
    """
    vi_clean = (vi_text or "").strip()
    en_clean = (en_text or "").strip()

    if vi_clean and not en_clean:
        return vi_clean, "vi", round(vi_conf or 0.8, 3)
    if en_clean and not vi_clean:
        return en_clean, "en", round(en_conf or 0.8, 3)
    if not vi_clean and not en_clean:
        return "", preferred_lang if preferred_lang in ("vi", "en") else "en", 0.0

    vi_score = float(vi_conf or 0.75)
    en_score = float(en_conf or 0.75)

    has_vi_diacritics = bool(VI_DIACRITICS_RE.search(vi_clean))
    vi_anchor_matches = len(VI_ANCHOR_WORDS_RE.findall(vi_clean))
    en_anchor_matches = len(EN_ANCHOR_WORDS_RE.findall(en_clean))

    if has_vi_diacritics:
        vi_score += 0.22
    if vi_anchor_matches > 0:
        vi_score += min(0.20, vi_anchor_matches * 0.07)

    # Nếu bộ nhận diện vi-VN chỉ trả về chữ ASCII không dấu và không khớp từ tiếng Việt đặc trưng,
    # rất cao khả năng người nói đang nói tiếng Anh nhưng bị ép nhận diện bằng model vi-VN.
    if not has_vi_diacritics and vi_anchor_matches == 0:
        vi_score -= 0.28

    if en_anchor_matches > 0:
        en_score += min(0.22, en_anchor_matches * 0.07)

    vi_words = len(vi_clean.split())
    en_words = len(en_clean.split())

    # Ưu tiên bản nhận diện bắt được đầy đủ âm tiết của câu hơn (tránh trường hợp 1 bên chỉ bắt được 1-2 từ rác)
    if en_words >= max(3, vi_words * 2):
        en_score += 0.18
    elif vi_words >= max(3, en_words * 2):
        vi_score += 0.18

    if abs(vi_score - en_score) < 0.04:
        if preferred_lang == "vi":
            vi_score += 0.05
        else:
            en_score += 0.05

    if vi_score >= en_score:
        return vi_clean, "vi", round(min(0.99, max(vi_conf, 0.7)), 3)
    return en_clean, "en", round(min(0.99, max(en_conf, 0.7)), 3)


def transcribe_audio_wav_detailed(
    wav_bytes: bytes,
    language: str = "auto",
    preferred_lang: str = "en",
) -> Dict[str, Any]:
    """
    Nhận diện giọng nói từ WAV bytes và trả về metadata chi tiết:
    {
        "text": str,
        "detected_language": "vi" | "en",
        "confidence": float,
        "provider": str
    }
    """
    pref = "vi" if str(preferred_lang or "").lower().startswith("vi") else "en"
    if not wav_bytes or len(wav_bytes) < 2000:
        return {"text": "", "detected_language": pref, "confidence": 0.0, "provider": "none"}

    is_auto = not language or str(language).lower() in ("auto", "bilingual", "all", "none")

    # --- 1. Chế độ Song ngữ Tự động (Auto Detect EN / VI từ Audio) ---
    if is_auto:
        try:
            model = get_whisper_model()
            if model:
                bio_whisper = io.BytesIO(wav_bytes)
                segments, info = model.transcribe(
                    bio_whisper,
                    language=None,
                    beam_size=2,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=400),
                    initial_prompt=HOTEL_STT_INITIAL_PROMPT,
                )
                results = [seg.text.strip() for seg in segments if seg.text.strip()]
                full_text = " ".join(results).strip()
                normalized_text = normalize_hotel_stt_transcript(full_text)
                if normalized_text:
                    # Kiểm tra nếu Whisper nhận diện sang chữ tượng hình ngoại lai (CJK) -> Bỏ qua kết quả hallucinate này để chuyển sang bộ chấm điểm song ngữ
                    if re.search(r'[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]', normalized_text):
                        logger.warning(
                            f"[STT Service - Whisper Auto] Rejected foreign script hallucination: '{normalized_text}'"
                        )
                    else:
                        whisper_raw_lang = str(getattr(info, "language", "")).lower()
                        if whisper_raw_lang.startswith("vi") or VI_DIACRITICS_RE.search(normalized_text):
                            det_lang = "vi"
                        elif whisper_raw_lang.startswith("en"):
                            det_lang = "en"
                        else:
                            # Nếu whisper trả về mã ngôn ngữ khác (ja, zh, ko, es...), dùng bộ phân tích song ngữ theo từ vựng
                            det_lang = "vi" if VI_ANCHOR_WORDS_RE.search(normalized_text) else "en"

                        prob = round(float(getattr(info, "language_probability", 0.85)), 3)
                        logger.info(
                            f"[STT Service - Whisper Auto] lang={det_lang} prob={prob} len={len(normalized_text)}"
                        )
                        return {
                            "text": normalized_text,
                            "detected_language": det_lang,
                            "confidence": prob,
                            "provider": "faster_whisper_auto",
                        }
        except Exception as e_wh:
            logger.warning(f"[STT Service - Whisper Auto] Error: {e_wh}")

        # Chạy song song Google Speech Recognition cho cả vi-VN và en-US kèm điểm tự tin âm học
        try:
            import speech_recognition as sr

            recognizer = sr.Recognizer()
            bio = io.BytesIO(wav_bytes)
            with sr.AudioFile(bio) as source:
                audio_data = recognizer.record(source)

            def _rec_lang(lang_code: str) -> Tuple[str, float]:
                try:
                    raw = recognizer.recognize_google(audio_data, language=lang_code, with_confidence=True)
                    return _parse_google_result(raw)
                except Exception:
                    return "", 0.0

            with ThreadPoolExecutor(max_workers=2) as executor:
                fut_vi = executor.submit(_rec_lang, "vi-VN")
                fut_en = executor.submit(_rec_lang, "en-US")
                try:
                    vi_text, vi_conf = fut_vi.result(timeout=3.2)
                except Exception:
                    vi_text, vi_conf = "", 0.0
                try:
                    en_text, en_conf = fut_en.result(timeout=3.2)
                except Exception:
                    en_text, en_conf = "", 0.0

            chosen_text, det_lang, final_conf = _score_bilingual_candidates(
                vi_text, vi_conf, en_text, en_conf, preferred_lang=pref
            )
            normalized_chosen = normalize_hotel_stt_transcript(chosen_text)
            if normalized_chosen:
                logger.info(
                    f"[STT Service - Google Bilingual] detected={det_lang} conf={final_conf} "
                    f"vi_len={len(vi_text)} en_len={len(en_text)}"
                )
                return {
                    "text": normalized_chosen,
                    "detected_language": det_lang,
                    "confidence": final_conf,
                    "provider": "google_bilingual",
                }
        except Exception as e_bi:
            logger.warning(f"[STT Service - Google Bilingual] Error: {e_bi}")

        return {"text": "", "detected_language": pref, "confidence": 0.0, "provider": "none"}

    # --- 2. Chế độ Ngôn ngữ Cố định ('vi' hoặc 'en') ---
    is_vi_target = str(language).lower().startswith("vi")
    lang_code = "vi-VN" if is_vi_target else "en-US"
    whisper_lang = "vi" if is_vi_target else "en"

    try:
        import speech_recognition as sr

        recognizer = sr.Recognizer()
        bio = io.BytesIO(wav_bytes)
        with sr.AudioFile(bio) as source:
            audio_data = recognizer.record(source)

            def _google_call():
                return recognizer.recognize_google(audio_data, language=lang_code, with_confidence=True)

            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_google_call)
                try:
                    raw = future.result(timeout=2.5)
                    text, conf = _parse_google_result(raw)
                    normalized_text = normalize_hotel_stt_transcript(text)
                    if normalized_text:
                        logger.info(f"[STT Service - Google {lang_code}] conf={conf:.2f} len={len(normalized_text)}")
                        return {
                            "text": normalized_text,
                            "detected_language": whisper_lang,
                            "confidence": round(conf, 3),
                            "provider": f"google_{whisper_lang}",
                        }
                except FuturesTimeoutError:
                    logger.warning("[STT Service - Google] Timeout after 2.5s, fallback to faster_whisper...")
    except Exception as e_sr:
        e_type = type(e_sr).__name__
        if "UnknownValueError" not in e_type:
            logger.warning(f"[STT Service - Google] Unavailable ({e_type}: {e_sr})")

    try:
        model = get_whisper_model()
        if model:
            bio_whisper = io.BytesIO(wav_bytes)
            segments, info = model.transcribe(
                bio_whisper,
                language=whisper_lang,
                beam_size=2,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=400),
                initial_prompt=HOTEL_STT_INITIAL_PROMPT,
            )
            results = [seg.text.strip() for seg in segments if seg.text.strip()]
            full_text = " ".join(results).strip()
            normalized_text = normalize_hotel_stt_transcript(full_text)
            if normalized_text:
                logger.info(f"[STT Service - Whisper {whisper_lang}] len={len(normalized_text)}")
                return {
                    "text": normalized_text,
                    "detected_language": whisper_lang,
                    "confidence": 0.85,
                    "provider": f"faster_whisper_{whisper_lang}",
                }
    except Exception as e_wh:
        logger.error(f"[STT Service] faster_whisper failed: {e_wh}")

    return {"text": "", "detected_language": whisper_lang, "confidence": 0.0, "provider": "none"}


def transcribe_audio_wav(wav_bytes: bytes, language: str = "auto") -> str:
    """
    Hàm tương thích ngược trả về chuỗi văn bản nhận diện được từ WAV bytes.
    """
    res = transcribe_audio_wav_detailed(wav_bytes, language=language)
    return res.get("text", "")
