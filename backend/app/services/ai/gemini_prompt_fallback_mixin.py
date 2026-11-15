"""Language detection, system prompt assembly, payload formatting, and Groq fallbacks for GeminiService."""

import asyncio
import json
import logging
import re
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings
from app.services.ai.prompt_guard import (
    format_safe_rag_context,
    format_safe_user_prompt,
    get_immutability_directives,
)

logger = logging.getLogger(__name__)


class GeminiPromptFallbackMixin:
    """Prompt building, language detection, and Groq cloud fallback helpers."""

    @staticmethod
    def detect_language(text: str) -> Tuple[str, str]:
        """
        Tự động phân tích câu nói của khách để nhận diện ngôn ngữ và mã lang_code cho TTS.
        Chỉ hỗ trợ song ngữ Tiếng Việt (vi-VN) và Tiếng Anh (en-US).
        """
        if not text or not text.strip():
            return "Tiếng Việt", "vi-VN"

        if re.search(r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', text, re.IGNORECASE):
            return "Tiếng Việt", "vi-VN"

        lower_text = text.lower().strip()

        vi_phrases = [
            r'\bphong\s*[0-9]', r'\bphong\b', r'\btoi\b', r'\bmuon\b', r'\bkhan\s*tam\b',
            r'\bdon\s*phong\b', r'\bo\s*dau\b', r'\bkhach\s*san\b', r'\ble\s*tan\b',
            r'\bbao\s*tri\b', r'\bcam\s*on\b', r'\bchao\s*em\b', r'\bxin\s*chao\b',
            r'\bquy\s*khach\b', r'\btra\s*phong\b', r'\bnhan\s*phong\b',
            r'\bgoi\s*xe\b', r'\bthang\s*may\b', r'\bho\s*boi\b', r'\bbe\s*boi\b'
        ]
        if any(re.search(pattern, lower_text) for pattern in vi_phrases):
            return "Tiếng Việt", "vi-VN"

        english_patterns = [
            r'\b(where|what|when|why|who|how|which|whose)\b',
            r'\b(can|could|would|should|will|do|does|did|is|are|was|were|have|has|had)\b',
            r'\b(i|you|he|she|it|we|they|my|your|his|her|its|our|their|me|him|them|us)\b',
            r'\b(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|goodbye|bye)\b',
            r'\b(thank\s+you|thanks|please|excuse\s+me|sorry|pardon)\b',
            r'\b(hotel|room|pool|swimming|wifi|password|breakfast|checkout|checkin|gym|spa)\b',
            r'\b(luggage|baggage|towel|water|food|drink|restaurant|taxi|airport|service|help|need|want)\b'
        ]
        if any(re.search(pattern, lower_text) for pattern in english_patterns):
            return "English", "en-US"

        return "Tiếng Việt", "vi-VN"

    def _build_system_prompt(
        self,
        lang_code: str,
        emotion: Optional[str] = None,
        stored_room_number: Optional[str] = None,
        rag_context: Optional[str] = None,
    ) -> str:
        """
        Xây dựng System Instruction tối ưu cho giao tiếp hội thoại tự nhiên của robot Concierge.
        """
        from app.services.ai.scenario_service import scenario_service
        from app.services.rag.facilities_kb_service import get_kb_facts_prompt
        from app.services.ai.persona_service import persona_service
        kb_facts = get_kb_facts_prompt(lang_code)
        hotel_facts = scenario_service.get_hotel_facts_prompt(lang_code)
        base_persona = persona_service.get_persona_prompt(lang_code)

        if lang_code == "en-US":
            prompt = (
                base_persona +
                "6. MANDATORY SERVICE & ROOM NUMBER RULES:\n"
                "   - Whenever the guest makes a room service or amenity request (cleaning, towels, food, repairs, luggage, taxi):\n"
                "     + If room number is NOT known yet (not in [Room Info]): ALWAYS politely ask for their room number first.\n"
                "     + If room number IS ALREADY known (in [Room Info]): Confirm the request with their room number and NEVER ask for their room number again during this session.\n"
                "7. KNOWLEDGE INTEGRITY (STRICT RAG & FACTS):\n"
                "   - All factual details regarding hotel amenities, timings, room types, and services are strictly governed by [Hotel Knowledge Base (RAG)] and Admin-configured facts.\n"
                "   - NEVER hallucinate or invent facilities not documented in the provided knowledge base.\n"
                "   - If an amenity or inquiry is not found in the documentation, politely advise the guest to check with the Front Desk.\n"
            )
            if kb_facts:
                prompt += f"\n{kb_facts}\n"
            if hotel_facts:
                prompt += f"\n{hotel_facts}\n"
        else:
            prompt = (
                base_persona +
                "8. QUY TẮC BẮT BUỘC VỀ YÊU CẦU DỊCH VỤ LIÊN QUAN TỚI SỐ PHÒNG:\n"
                "   - Khi khách yêu cầu bất kỳ dịch vụ phòng nào (khăn tắm, buồng phòng, dọn phòng, chăn gối, đồ dùng, đồ ăn thức uống room service, hành lý bellman, sửa chữa máy lạnh điện nước, đặt xe taxi, v.v.):\n"
                "     + Nếu CHƯA BIẾT số phòng (chưa có trong [Thông tin phòng]): BẮT BUỘC Rora phải hỏi số phòng của quý khách trước (ví dụ: 'Dạ em sẽ hỗ trợ ... cho quý khách ngay ạ! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?').\n"
                "     + Nếu ĐÃ BIẾT số phòng (đã có trong [Thông tin phòng] hoặc vừa được cung cấp): Ghi nhận yêu cầu KÈM SỐ PHÒNG của khách (ví dụ: 'Dạ Rora đã ghi nhận yêu cầu ... cho Phòng [X] rồi ạ, bộ phận chuyên trách sẽ hỗ trợ quý khách ngay!') và TUYỆT ĐỐI KHÔNG hỏi lại số phòng nữa trong suốt phiên trò chuyện.\n"
                "   - Toàn bộ các yêu cầu dịch vụ tiếp theo trong phiên này đều tự động gắn với số phòng đã lưu đó.\n"
                "9. NGUYÊN TẮC BẢO TOÀN THÔNG TIN (RAG VÀ FAST-PATH):\n"
                "   - Toàn bộ thông tin về cơ sở vật chất, tiện ích, giờ hoạt động và quy định do [Cơ sở tri thức khách sạn (RAG)] và Admin quản lý.\n"
                "   - Tuyệt đối KHÔNG tự ý suy diễn hoặc bịa đặt các dịch vụ không có trong tài liệu.\n"
                "   - Nếu thông tin khách hỏi không có trong tài liệu, hãy lịch sự trả lời rằng Rora sẽ liên hệ nhân viên hoặc quầy lễ tân để hỗ trợ quý khách.\n"
            )
            if kb_facts:
                prompt += f"\n{kb_facts}\n"
            if hotel_facts:
                prompt += f"\n{hotel_facts}\n"

        if stored_room_number:
            prompt += f"\n[Thông tin phòng]: Quý khách ở phòng {stored_room_number}."

        emotion_str = (emotion or "").lower()
        if emotion_str in ["annoyed", "angry", "upset", "unhappy", "frustrated", "khó chịu", "kho chiu"]:
            unhappy_msg = persona_service.get_unhappy_empathy(lang_code)
            label = "[Guest Emotion]" if lang_code == "en-US" else "[Cảm xúc khách]"
            prompt += f"\n{label}: {unhappy_msg}"
        elif emotion_str in ["happy", "pleased"]:
            label = "[Guest Emotion]" if lang_code == "en-US" else "[Cảm xúc khách]"
            happy_msg = "The guest is very happy, respond warmly and enthusiastically." if lang_code == "en-US" else "Khách đang rất vui vẻ, hãy phản hồi tươi vui và nhiệt tình."
            prompt += f"\n{label}: {happy_msg}"

        if rag_context:
            prompt += format_safe_rag_context(rag_context, lang_code)

        # Cung co nguyen tac bat bien bao mat chong Prompt Injection
        prompt += get_immutability_directives(lang_code)

        return prompt

    def _format_gemini_payload(
        self,
        prompt: str,
        system_prompt: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        json_mode: bool = False,
    ) -> Dict[str, Any]:
        """
        Định dạng payload chuẩn theo Google Gemini REST API.
        """
        contents = []
        if chat_history:
            for turn in chat_history:
                role = turn.get("role")
                content = turn.get("content")
                if content and role in ["user", "assistant", "model"]:
                    gemini_role = "user" if role == "user" else "model"
                    contents.append({
                        "role": gemini_role,
                        "parts": [{"text": content}]
                    })

        contents.append({
            "role": "user",
            "parts": [{"text": format_safe_user_prompt(prompt)}]
        })

        payload: Dict[str, Any] = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": contents,
            "generationConfig": {
                "temperature": 0.1 if json_mode else 0.7,
            }
        }

        if json_mode:
            payload["generationConfig"]["response_mime_type"] = "application/json"

        return payload

    async def _call_groq_fallback(
        self,
        prompt: str,
        system_prompt: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        json_mode: bool = False,
        max_tokens: int = 150,
    ) -> Optional[str]:
        """
        Gọi Groq Cloud API dự phòng (Tier 2/Fallback) khi Google Gemini bị Rate Limit 429 hoặc gặp sự cố.
        """
        if not settings.is_groq_active:
            return None
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.0.1",
        }
        messages = [{"role": "system", "content": system_prompt}]
        if chat_history:
            for turn in chat_history:
                role = turn.get("role")
                content = turn.get("content")
                if content and role in ["user", "assistant"]:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, Any] = {
            "model": settings.GROQ_MODEL or "qwen/qwen3.8-27b",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.0 if json_mode else 0.4,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
                elif res.status_code == 429:
                    logger.warning("[Groq Fallback 429] Rate limited, waiting 0.8s...")
                    await asyncio.sleep(0.8)
                    res_retry = await client.post(url, headers=headers, json=payload)
                    if res_retry.status_code == 200:
                        return res_retry.json()["choices"][0]["message"]["content"]
                logger.warning(f"[Groq Fallback] Status {res.status_code}: {res.text[:120]}")
                return None
        except Exception as e:
            logger.warning(f"[Groq Fallback Error]: {e}")
            return None

    async def _stream_groq_fallback(
        self,
        prompt: str,
        system_prompt: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        max_tokens: int = 150,
    ) -> AsyncGenerator[str, None]:
        """
        Streaming token từ Groq Cloud API dự phòng khi Google Gemini bị Rate Limit.
        """
        if not settings.is_groq_active:
            return
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "User-Agent": "curl/8.0.1",
        }
        messages = [{"role": "system", "content": system_prompt}]
        if chat_history:
            for turn in chat_history:
                role = turn.get("role")
                content = turn.get("content")
                if content and role in ["user", "assistant"]:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, Any] = {
            "model": settings.GROQ_MODEL or "qwen/qwen3.8-27b",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.4,
            "stream": True,
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        err_text = await response.aread()
                        logger.warning(f"[Groq Stream Fallback] Status {response.status_code}: {err_text[:120].decode('utf-8', errors='ignore')}")
                        return
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                choices = chunk.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logger.warning(f"[Groq Stream Fallback Error]: {e}")
