"""TTS text normalization and HTTP/EdgeTTS synthesis provider helpers."""

import asyncio
import base64
import logging
import re
from typing import Any, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)


def clean_text_for_tts(text: str) -> str:
    """Strip markdown/emoji and normalize punctuation so speech sounds natural."""
    if not text:
        return ""
    t = re.sub(r"[*#_`\[\]()~]", "", text)
    t = re.sub(r"[\U00010000-\U0010ffff]", "", t)
    t = re.sub(r"^[\s*•\-–—]+\s*", "", t, flags=re.MULTILINE)
    t = re.sub(r":\s*", ", ", t)
    t = re.sub(r"\s*;\s*", ", ", t)
    t = re.sub(r"\.{2,}", ".", t)
    t = re.sub(r"!{2,}", "!", t)
    t = re.sub(r"\?{2,}", "?", t)
    return re.sub(r"\s+", " ", t).strip()


def rate_float_to_percentage(rate: float) -> str:
    """Convert float speech rate (0.5 - 2.0) into EdgeTTS percentage string."""
    clamped = max(0.5, min(2.0, float(rate)))
    diff = round((clamped - 1.0) * 100)
    return f"+{diff}%" if diff >= 0 else f"{diff}%"


def is_vietnamese(text: str) -> bool:
    """Check whether input text appears to be Vietnamese."""
    if not text:
        return True
    if re.search(
        r"[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]",
        text,
        re.IGNORECASE,
    ):
        return True
    vi_words = [
        r"\bdạ\b", r"\bem\b", r"\banh\b", r"\bchị\b",
        r"\bquý khách\b", r"\bphòng\b", r"\bkhách sạn\b", r"\bạ\b",
    ]
    return any(re.search(w, text, re.IGNORECASE) for w in vi_words)


async def _collect_edge_audio(communicate: Any) -> bytes:
    """Drain audio chunks from an EdgeTTS Communicate stream."""
    audio_bytes = b""
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio":
            audio_bytes += chunk.get("data", b"")
    return audio_bytes


async def synthesize_edge_tts_detailed(
    text: str,
    voice: str,
    *,
    rate: Optional[str] = None,
    default_volume: str = "+0%",
    attempt_timeout: Optional[float] = None,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Synthesize MP3 audio via EdgeTTS Neural with bounded per-attempt timeout and same-voice retry."""
    clean_text = clean_text_for_tts(text)
    if not clean_text:
        return None, "TTS_INPUT_EMPTY", "Cleaned text is empty"

    selected_rate = rate or getattr(settings, "TTS_RATE", "+0%")
    if not re.match(r"^[+-]\d+%$", str(selected_rate)):
        selected_rate = "+0%"
    # Luôn dùng +0% khi gọi EdgeTTS để tránh lỗi NoAudioReceived; khuếch đại âm lượng được xử lý qua GainNode ở frontend.
    selected_volume = "+0%"
    per_attempt_timeout = max(0.02, float(attempt_timeout)) if attempt_timeout is not None else 10.0

    try:
        import edge_tts as _edge_tts
    except ImportError:
        logger.info("[TTSService] edge_tts library not installed.")
        return None, "TTS_PROVIDER_ERROR", "edge_tts library not installed"

    last_err_code = "TTS_AUDIO_EMPTY"
    last_err_detail = f"EdgeTTS returned 0 bytes for voice={voice}"

    for attempt in range(3):
        current_voice = voice
        if attempt > 0:
            logger.info(f"[TTSService] EdgeTTS attempt {attempt + 1}: Retrying same voice {current_voice}")

        try:
            communicate = _edge_tts.Communicate(
                clean_text, current_voice, rate=selected_rate, volume=selected_volume, pitch="+0Hz"
            )
            audio_bytes = await asyncio.wait_for(
                _collect_edge_audio(communicate),
                timeout=per_attempt_timeout,
            )
            if audio_bytes and len(audio_bytes) > 100:
                return base64.b64encode(audio_bytes).decode("utf-8"), None, None
            last_err_code = "TTS_AUDIO_EMPTY"
            last_err_detail = f"EdgeTTS returned {len(audio_bytes)} bytes (voice={current_voice}, attempt={attempt + 1})"
        except asyncio.CancelledError:
            raise
        except asyncio.TimeoutError:
            last_err_code = "TTS_TIMEOUT"
            last_err_detail = f"EdgeTTS attempt {attempt + 1} timed out after {per_attempt_timeout:.1f}s (voice={current_voice})"
            log_fn = logger.warning if attempt == 2 else logger.info
            log_fn(f"[TTSService] {last_err_detail}")
        except Exception as e:
            last_err_code = "TTS_PROVIDER_ERROR"
            last_err_detail = f"{type(e).__name__}: {e} (voice={current_voice}, attempt={attempt + 1})"
            log_fn = logger.warning if attempt == 2 else logger.info
            log_fn(f"[TTSService] EdgeTTS attempt {attempt + 1} error: {last_err_detail}")
        if attempt < 2:
            await asyncio.sleep(0.3 * (attempt + 1))

    return None, last_err_code, last_err_detail


def common_warmup_phrases(target_vi: str, target_en: str):
    return [
        ("Dạ đợi em một tí nhé ạ.", "vi-VN", target_vi),
        ("Please wait a moment.", "en-US", target_en),
        ("Dạ đợi em một tí ạ.", "vi-VN", target_vi),
        ("Dạ vâng, em có thể hỗ trợ gì thêm cho quý khách ạ?", "vi-VN", target_vi),
        ("Quý khách có muốn em hỗ trợ gì thêm không ạ?", "vi-VN", target_vi),
        ("Would you like any further assistance?", "en-US", target_en),
        ("Dạ em có thể hỗ trợ thêm gì cho quý khách nữa không ạ?", "vi-VN", target_vi),
        ("Quý khách có cần em hỗ trợ thêm gì cho quý khách nữa không ạ?", "vi-VN", target_vi),
        ("You are welcome! How may I assist you further?", "en-US", target_en),
        ("Dạ vâng, Rora rất vui được hỗ trợ quý khách! Quý khách dành chút thời gian đánh giá dịch vụ giúp em nhé ạ.", "vi-VN", target_vi),
        ("Rora is delighted to assist you! Please take a quick moment to rate our service.", "en-US", target_en),
        ("Dạ, đây là danh bạ hotline các hãng taxi uy tín tại Đà Nẵng ạ.", "vi-VN", target_vi),
        ("Dạ em đã hủy yêu cầu đặt xe. Quý khách cần em hỗ trợ gì thêm không ạ?", "vi-VN", target_vi),
        ("Rora cảm ơn quý khách! Quý khách chấm điểm dịch vụ giúp em nhé.", "vi-VN", target_vi),
        ("Rora cảm ơn quý khách! Chúc quý khách kỳ nghỉ tuyệt vời.", "vi-VN", target_vi),
        ("Rora xin ghi nhận ý kiến để hoàn thiện hơn. Cảm ơn quý khách.", "vi-VN", target_vi),
        ("Dạ đây là toàn bộ cơ sở vật chất và tiện ích 5 sao của khách sạn ạ.", "vi-VN", target_vi),
        ("Xin lỗi quý khách, không thể kết nối tới AI Server.", "vi-VN", target_vi),
        ("Xác thực phòng thành công! Đơn phục vụ đã được tạo.", "vi-VN", target_vi),
        ("Quý khách có thể quét mã QR trên màn hình để lưu lại chỉ dẫn đường đi trên điện thoại nhé ạ.", "vi-VN", target_vi),
        ("You can scan the QR code on the screen to save directions on your mobile phone.", "en-US", target_en),
        ("Dạ em đã hiểu ạ.", "vi-VN", target_vi),
        ("I understand.", "en-US", target_en),
    ]
