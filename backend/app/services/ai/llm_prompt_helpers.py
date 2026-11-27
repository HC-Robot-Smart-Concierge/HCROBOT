"""Shared bilingual language detection, Concierge system prompt assembly, and Groq API helpers."""

import asyncio
import json
import logging
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import httpx

from app.services.ai.prompt_guard import (
    format_safe_rag_context,
    format_safe_user_prompt,
    get_immutability_directives,
)

logger = logging.getLogger(__name__)

_VI_DIACRITICS_RE = re.compile(
    r"[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]",
    re.IGNORECASE,
)

COMMON_EN_WORDS = frozenset("""
the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she
or an will my one all would there their what so up out if about who get which go me when make can like time no
just him know take people into year your good some could them see other than then now look only come its over
think also back after use two how our work first well way even new want because any these give day most us
is are was were am been being has had did does doing
hotel room rooms pool swimming gym spa bar restaurant food drink coffee tea breakfast lunch dinner
towel towels blanket pillow pillows bed beds sleep key card door light lights ac air conditioner
tv phone wifi internet password luggage bag taxi car airport flight bill pay price cost cash credit
check checkout checkin help assist please thank thanks hello hi hey morning afternoon evening night bye
welcome book order service staff receptionist reception front desk lobby floor elevator lift stairs
toilet restroom bathroom shower water bath soap shampoo toothbrush toothpaste slippers hair dryer
clean cleaning dirty fix repair broken working open close hours time today tomorrow tonight tour
beach sea view map location guide doctor emergency cold hot warm quiet noisy extra free cancel
turn on off late bag board instructions gel bottle wine size ancient town city
yes ok okay sure fine sir madam recommend direction where what when why who how which whose
can could would should will do does did is are was were have has had may might must
luggage baggage towel water food drink restaurant taxi airport service need want
show tell guide find open close order call bring get take clean go see look give pay cost price menu
coffee tea beer bar cocktail floor lobby elevator lift toilet restroom bathroom door card key bill
now today tonight tomorrow time later yes no ok okay sure fine sir madam assist recommend direction
attraction attractions sightseeing places visit night market sea view ocean view lake view street
broken not working leak leaking noisy loud dark cold freeze freezing hot boiled
pillow blanket mattress sheet sheets hanger iron iron board adapter plug charger socket
slippers bathrobe bathrobes umbrella laundry dry dry cleaning laundry bag wash washing
room rate price list deposit receipt invoice luggage storage bellman wake up wake call
service request amenities facility facilities elevator gym pool swimming pool
""".split())

COMMON_VI_WORDS = frozenset("""
la cua va co khong duoc cho voi ve tu den o trong tai cac nhung mot hai ba bon nam sau bay tam chin muoi
phong khach san toi minh ban anh em chi chu bac da roi chua dang se muon can xin hoi giup lam on cam
chao hen gap lai bao nhieu tien gia may gio dau nao sao nhu the dat mang them giat ui sua ket bi hong
hu mat dep tot xau ngon do an uong nuoc tra cafe ca phe an sang com goi xe dua don san bay thang may
ve sinh nha tam khan men chieu nem giuong chia khoa the tu mat khau be boi ho boi le tan buong phong
""".split())

EN_SUBSTRING_PATTERNS = [
    r"\b(wh[a-z]+|th[a-z]+|sh[a-z]+|ch[a-z]+)\b",
    r"[a-z]+(tion|sion|ment|ness|able|ible|less|ful|ing|ed)\b",
    r"\b[a-z]+(ck|ght|ould|ight)\b",
]

_ENGLISH_PHRASE_PATTERNS = [
    r"\b(where|what|when|why|who|how|which|whose)\b",
    r"\b(can|could|would|should|will|do|does|did|is|are|was|were|have|has|had)\b",
    r"\b(i|you|he|she|it|we|they|my|your|his|her|its|our|their|me|him|them|us)\b",
    r"\b(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|goodbye|bye)\b",
    r"\b(thank\s+you|thanks|please|excuse\s+me|sorry|pardon)\b",
    r"\b(hotel|room|pool|swimming|wifi|password|breakfast|checkout|checkin|gym|spa)\b",
    r"\b(luggage|baggage|towel|water|food|drink|restaurant|taxi|airport|service|help|need|want)\b",
]

_GEMINI_VI_PHRASES = [
    r"\bphong\s*[0-9]", r"\bphong\b", r"\btoi\b", r"\bmuon\b", r"\bkhan\s*tam\b",
    r"\bdon\s*phong\b", r"\bo\s*dau\b", r"\bkhach\s*san\b", r"\ble\s*tan\b",
    r"\bbao\s*tri\b", r"\bcam\s*on\b", r"\bchao\s*em\b", r"\bxin\s*chao\b",
    r"\bquy\s*khach\b", r"\btra\s*phong\b", r"\bnhan\s*phong\b",
    r"\bgoi\s*xe\b", r"\bthang\s*may\b", r"\bho\s*boi\b", r"\bbe\s*boi\b",
]


def has_vietnamese_diacritics(text: str) -> bool:
    return bool(_VI_DIACRITICS_RE.search(text or ""))


def resolve_request_language(
    prompt: str,
    language: Optional[str],
    detect_fn,
) -> Tuple[str, str]:
    from .speech_language import select_turn_language
    return select_turn_language(prompt, language)


def resolve_reply_language(reply: str, lang_code: str, detect_fn) -> Tuple[str, str]:
    from .speech_language import language_pair
    # A proper name or borrowed word in a reply must not select another speaker.
    return language_pair(lang_code)


def detect_bilingual_language(text: str, *, mode: str = "ollama", preferred_language: Optional[str] = None) -> Tuple[str, str]:
    from .speech_language import detect_turn_language
    return detect_turn_language(text, preferred_language)


def build_concierge_system_prompt(
    lang_code: str,
    *,
    emotion: Optional[str] = None,
    stored_room_number: Optional[str] = None,
    rag_context: Optional[str] = None,
    age_group: Optional[str] = None,
    gender: Optional[str] = None,
) -> str:
    """Assemble the bilingual Concierge system prompt with RAG facts, empathy, and security rules."""
    from app.services.ai.persona_service import persona_service
    from app.services.ai.scenario_service import scenario_service
    from app.services.rag.facilities_kb_service import get_kb_facts_prompt

    kb_facts = get_kb_facts_prompt(lang_code)
    hotel_facts = scenario_service.get_hotel_facts_prompt(lang_code)
    base_persona = persona_service.get_persona_prompt(lang_code)

    if lang_code == "en-US":
        prompt = (
            base_persona
            + "6. MANDATORY SERVICE & ROOM NUMBER RULES:\n"
            + "   - Whenever the guest makes a room service or amenity request (cleaning, towels, food, repairs, luggage, taxi):\n"
            + "     + If room number is NOT known yet (not in [Room Info]): ALWAYS politely ask for their room number first.\n"
            + "     + If room number IS ALREADY known (in [Room Info]): Confirm the request with their room number and NEVER ask for their room number again during this session.\n"
            + "7. KNOWLEDGE INTEGRITY (STRICT RAG & FACTS):\n"
            + "   - All factual details regarding hotel amenities, timings, room types, and services are strictly governed by [Hotel Knowledge Base (RAG)] and Admin-configured facts.\n"
            + "   - NEVER hallucinate or invent facilities not documented in the provided knowledge base.\n"
            + "   - If an amenity or inquiry is not found in the documentation, politely advise the guest to check with the Front Desk.\n"
            + "8. CONVERSATIONAL ENGAGEMENT & CONTINUATION RULE:\n"
            + "   - When the guest asks for directions to any hotel facility or room, reply directly with concise directions and NEVER ask if they want to open the map or QR code (the map and QR code open automatically on screen).\n"
            + "   - For non-direction inquiries, never end with an abrupt dead-end statement; conclude with ONE natural follow-up suggestion (e.g., menu/reservations for dining, amenities for room stay, or asking how else you may assist).\n"
        )
    else:
        prompt = (
            base_persona
            + "8. QUY TẮC BẮT BUỘC VỀ YÊU CẦU DỊCH VỤ LIÊN QUAN TỚI SỐ PHÒNG:\n"
            + "   - Khi khách yêu cầu bất kỳ dịch vụ phòng nào (khăn tắm, buồng phòng, dọn phòng, chăn gối, đồ dùng, đồ ăn thức uống room service, hành lý bellman, sửa chữa máy lạnh điện nước, đặt xe taxi, v.v.):\n"
            + "     + Nếu CHƯA BIẾT số phòng (chưa có trong [Thông tin phòng]): BẮT BUỘC Rora phải hỏi số phòng của quý khách trước (ví dụ: 'Dạ em sẽ hỗ trợ ... cho quý khách ngay ạ! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?').\n"
            + "     + Nếu ĐÃ BIẾT số phòng (đã có trong [Thông tin phòng] hoặc vừa được cung cấp): Ghi nhận yêu cầu KÈM SỐ PHÒNG của khách (ví dụ: 'Dạ Rora đã ghi nhận yêu cầu ... cho Phòng [X] rồi ạ, bộ phận chuyên trách sẽ hỗ trợ quý khách ngay!') và TUYỆT ĐỐI KHÔNG hỏi lại số phòng nữa trong suốt phiên trò chuyện.\n"
            + "   - Toàn bộ các yêu cầu dịch vụ tiếp theo trong phiên này đều tự động gắn với số phòng đã lưu đó.\n"
            + "9. NGUYÊN TẮC BẢO TOÀN THÔNG TIN (RAG VÀ FAST-PATH):\n"
            + "   - Toàn bộ thông tin về cơ sở vật chất, tiện ích, giờ hoạt động và quy định do [Cơ sở tri thức khách sạn (RAG)] và Admin quản lý.\n"
            + "   - Tuyệt đối KHÔNG tự ý suy diễn hoặc bịa đặt các dịch vụ không có trong tài liệu.\n"
            + "   - Nếu thông tin khách hỏi không có trong tài liệu, hãy lịch sự trả lời rằng Rora sẽ liên hệ nhân viên hoặc quầy lễ tân để hỗ trợ quý khách.\n"
            + "10. NGUYÊN TẮC DUY TRÌ HỘI THOẠI VÀ GỢI Ý MỞ (CONVERSATIONAL CONTINUATION):\n"
            + "   - Khi khách hỏi chỉ đường hoặc vị trí bên trong khách sạn: trả lời trực tiếp bằng chỉ dẫn ngắn gọn; TUYỆT ĐỐI KHÔNG hỏi khách 'có muốn mở bản đồ/QR không' (bản đồ và QR tự động hiển thị trên màn hình).\n"
            + "   - Với các câu hỏi khác (không phải chỉ đường), không kết thúc cụt lủn; luôn khép lại bằng MỘT câu gợi ý mở phù hợp (ví dụ: xem thực đơn/đặt món nếu hỏi ăn uống, tiện ích phòng nếu hỏi lưu trú, hoặc hỏi khách cần hỗ trợ thêm gì không).\n"
        )

    if kb_facts:
        prompt += f"\n{kb_facts}\n"
    if hotel_facts:
        prompt += f"\n{hotel_facts}\n"
    if stored_room_number:
        prompt += f"\n[Thông tin phòng]: Quý khách ở phòng {stored_room_number}."

    emotion_str = (emotion or "").lower()
    label_emo = "[Guest Emotion]" if lang_code == "en-US" else "[Cảm xúc khách]"
    if emotion_str in ["annoyed", "angry", "upset", "unhappy", "frustrated", "khó chịu", "kho chiu"]:
        prompt += f"\n{label_emo}: {persona_service.get_unhappy_empathy(lang_code)}"
    elif emotion_str in ["happy", "pleased"]:
        happy_msg = (
            "The guest is very happy, respond warmly and enthusiastically."
            if lang_code == "en-US"
            else "Khách đang rất vui vẻ, hãy phản hồi tươi vui và nhiệt tình."
        )
        prompt += f"\n{label_emo}: {happy_msg}"

    if age_group or gender:
        demo_parts = []
        if age_group and age_group != "unknown":
            demo_parts.append(f"Age Group: {age_group}")
        if gender and gender != "unknown":
            demo_parts.append(f"Gender: {gender}")
        if demo_parts:
            label_prof = "[Guest Profile]" if lang_code == "en-US" else "[Hồ sơ khách]"
            prompt += (
                f"\n{label_prof}: {', '.join(demo_parts)} "
                "(Naturally prioritize relevant amenities, dining, and activities matching this profile "
                "when the guest asks for recommendations, advice, or what to do)."
            )

    if rag_context:
        prompt += format_safe_rag_context(rag_context, lang_code)
    prompt += get_immutability_directives(lang_code)
    prompt += (
        "\nLANGUAGE POLICY: Understand the guest's complete request even when Vietnamese and English "
        "are mixed in one sentence. Respond entirely in "
        + ("English" if lang_code == "en-US" else "Vietnamese")
        + ". Keep proper names and necessary service names unchanged. Do not alternate languages "
        "or translate the answer into both languages.\n"
    )
    return prompt


def build_openai_messages(
    system_prompt: str,
    prompt: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
    *,
    sanitize_user: bool = True,
) -> List[Dict[str, str]]:
    messages = [{"role": "system", "content": system_prompt}]
    if chat_history:
        for turn in chat_history:
            if turn.get("role") in ["user", "assistant"] and turn.get("content"):
                messages.append({"role": turn["role"], "content": turn["content"]})
    user_content = format_safe_user_prompt(prompt) if sanitize_user else prompt
    messages.append({"role": "user", "content": user_content})
    return messages


_GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
_GROQ_FALLBACK_MODELS = ("openai/gpt-oss-120b", "openai/gpt-oss-20b")
_GROQ_MODEL_COOLDOWN_UNTIL: Dict[str, float] = {}


def _groq_candidate_models(primary: Optional[str]) -> List[str]:
    """Return ordered active Groq models, skipping models currently in 429 cooldown."""
    now = time.time()
    ordered: List[str] = []
    for candidate in (primary or "qwen/qwen3.8-27b", *_GROQ_FALLBACK_MODELS):
        if candidate and candidate not in ordered and _GROQ_MODEL_COOLDOWN_UNTIL.get(candidate, 0.0) <= now:
            ordered.append(candidate)
    return ordered


def _build_groq_payload(
    model_name: str,
    messages: List[Dict[str, str]],
    *,
    max_tokens: int,
    json_mode: bool = False,
    stream: bool = False,
) -> Dict[str, Any]:
    """Construct Groq payload with safe reasoning_effort/max_tokens defaults for gpt-oss models."""
    effective_max = max_tokens
    payload: Dict[str, Any] = {
        "model": model_name,
        "messages": messages,
        "temperature": 0.0 if json_mode else 0.4,
    }
    if "gpt-oss" in model_name:
        payload["reasoning_effort"] = "low"
        effective_max = max(max_tokens, 200)
    payload["max_tokens"] = effective_max
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    if stream:
        payload["stream"] = True
    return payload


def _handle_groq_429(
    model_name: str, headers: httpx.Headers, log_prefix: str
) -> Optional[float]:
    """Record cooldown on TPD/long 429s; return brief wait seconds only for short transient limits."""
    should_retry = headers.get("x-should-retry", "").strip().lower()
    raw_retry = headers.get("retry-after")
    retry_sec: Optional[float] = None
    if raw_retry:
        try:
            retry_sec = float(raw_retry)
        except ValueError:
            retry_sec = None

    if should_retry == "false" or (retry_sec is not None and retry_sec > 1.8):
        cooldown = min(retry_sec if retry_sec is not None else 120.0, 300.0)
        _GROQ_MODEL_COOLDOWN_UNTIL[model_name] = time.time() + cooldown
        logger.warning(
            f"{log_prefix} Model '{model_name}' rate limited (retry-after={raw_retry}, x-should-retry={should_retry or 'unset'}); "
            f"cooling down {cooldown:.0f}s and switching model immediately."
        )
        return None

    return max(0.3, min(retry_sec or 0.8, 1.0))


async def call_groq_chat(
    messages: List[Dict[str, str]],
    *,
    api_key: str,
    model: Optional[str],
    json_mode: bool = False,
    max_tokens: int = 150,
    log_prefix: str = "[Groq API]",
) -> Optional[str]:
    """Call Groq chat completions with fast SLA-safe 429 cooldown and automatic model failover."""
    if not api_key:
        return None
    candidates = _groq_candidate_models(model)
    if not candidates:
        logger.warning(f"{log_prefix} All Groq models are in rate-limit cooldown, skipping to next tier.")
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "curl/8.0.1",
    }
    timeout = httpx.Timeout(connect=2.5, read=3.0, write=2.5, pool=2.5)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            for candidate in candidates:
                payload = _build_groq_payload(candidate, messages, max_tokens=max_tokens, json_mode=json_mode)
                for attempt in range(2):
                    res = await client.post(_GROQ_CHAT_URL, headers=headers, json=payload)
                    if res.status_code == 200:
                        content = (res.json()["choices"][0]["message"].get("content") or "").strip()
                        if content:
                            return content
                        logger.warning(f"{log_prefix} Model '{candidate}' returned empty content, trying next model...")
                        break
                    if res.status_code == 429:
                        wait_sec = _handle_groq_429(candidate, res.headers, log_prefix)
                        if wait_sec is None or attempt == 1 or len(candidates) > 1:
                            if wait_sec is not None:
                                _GROQ_MODEL_COOLDOWN_UNTIL[candidate] = time.time() + 15.0
                            break
                        await asyncio.sleep(wait_sec)
                        continue
                    logger.warning(f"{log_prefix} Warning ({candidate}) status={res.status_code}: {res.text[:120]}")
                    break
    except Exception as e:
        logger.warning(f"{log_prefix} Error: {e}")
    return None


async def stream_groq_chat(
    messages: List[Dict[str, str]],
    *,
    api_key: str,
    model: Optional[str],
    max_tokens: int = 150,
    log_prefix: str = "[Groq Stream]",
    raise_on_error: bool = True,
) -> AsyncGenerator[str, None]:
    """Stream tokens from Groq chat completions SSE endpoint with instant 429 failover."""
    if not api_key:
        return
    candidates = _groq_candidate_models(model)
    if not candidates:
        logger.warning(f"{log_prefix} All Groq models are in rate-limit cooldown, skipping to next tier.")
        return

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "User-Agent": "curl/8.0.1",
    }
    timeout = httpx.Timeout(connect=2.5, read=8.0, write=2.5, pool=2.5)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            for candidate in candidates:
                payload = _build_groq_payload(candidate, messages, max_tokens=max_tokens, stream=True)
                async with client.stream("POST", _GROQ_CHAT_URL, headers=headers, json=payload) as response:
                    if response.status_code == 429:
                        _handle_groq_429(candidate, response.headers, log_prefix)
                        continue
                    if response.status_code != 200:
                        err_text = await response.aread()
                        logger.warning(
                            f"{log_prefix} Warning ({candidate}) status={response.status_code}: "
                            f"{err_text[:120].decode('utf-8', errors='ignore')}"
                        )
                        continue
                    yielded = False
                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            choices = json.loads(data_str).get("choices", [])
                            if choices:
                                content = choices[0].get("delta", {}).get("content", "")
                                if content:
                                    yielded = True
                                    yield content
                        except json.JSONDecodeError:
                            continue
                    if yielded:
                        return
    except Exception as e:
        logger.warning(f"{log_prefix} Error: {e}")
        if raise_on_error:
            raise
