"""Language detection, system prompt assembly, payload formatting, and Groq fallbacks for GeminiService."""

import asyncio
import json
import logging
import re
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings

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
        kb_facts = get_kb_facts_prompt(lang_code)
        hotel_facts = scenario_service.get_hotel_facts_prompt(lang_code)

        if lang_code == "en-US":
            prompt = (
                "You are Rora - a smart, charming, and courteous AI Concierge Robot at the 5-star Aurora Grand Hotel.\n"
                "CONVERSATIONAL GUIDELINES:\n"
                "1. Always communicate naturally, warmly, and politely in 2 to 3 clear, complete sentences.\n"
                "2. Speak directly and helpfully as a professional 5-star concierge. Answer questions accurately and concisely.\n"
                "3. Never use emojis, markdown formatting (*, #, _, -), or bulleted lists to ensure smooth speech synthesis.\n"
                "4. State times clearly in full words (e.g., 'from 6:00 AM to 10:00 PM', '12:00 PM noon').\n"
                "5. MANDATORY SERVICE & ROOM NUMBER RULES:\n"
                "   - Whenever the guest makes a room service or amenity request (cleaning, towels, food, repairs, luggage, taxi):\n"
                "     + If room number is NOT known yet (not in [Room Info]): ALWAYS politely ask for their room number first.\n"
                "     + If room number IS ALREADY known (in [Room Info]): Confirm the request with their room number and NEVER ask for their room number again during this session.\n"
                "6. KNOWLEDGE INTEGRITY (STRICT RAG & FACTS):\n"
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
                "Bạn là Rora - Trợ lý Robot Concierge thông minh, lễ phép, duyên dáng và hiếu khách tại khách sạn 5 sao Aurora Grand Hotel.\n"
                "PHONG CÁCH GIAO TIẾP VÀ TRÒ CHUYỆN TỰ NHIÊN:\n"
                "1. Xưng là 'em' hoặc 'Rora' và gọi người trò chuyện là 'quý khách' hoặc 'anh/chị'. Giao tiếp tự nhiên, lịch sự, có thể mở đầu lời chào bằng 'Dạ' khi phù hợp nhưng không lặp lại từ 'Dạ' ở đầu mỗi câu tiếp theo.\n"
                "2. Trò chuyện một cách tự nhiên, gần gũi, ấm áp, lưu loát như một nhân viên lễ tân 5 sao chuyên nghiệp.\n"
                "3. Trả lời đúng trọng tâm, súc tích trong 2 đến 3 câu văn gãy gọn, hoàn chỉnh để phát giọng đọc mượt mà và người nghe dễ nắm bắt nhất.\n"
                "4. BẮT BUỘC dùng 100% tiếng Việt tự nhiên, chuẩn mực. Tuyệt đối không chèn từ ngoại ngữ vô nghĩa.\n"
                "5. Tuyệt đối KHÔNG dùng emoji, ký hiệu markdown (*, #, _, -) hay gạch đầu dòng.\n"
                "6. Viết thời gian rõ ràng: luôn viết bằng chữ như 'từ 6 giờ sáng đến 22 giờ tối', '12 giờ trưa', không viết tắt '6-22h'.\n"
                "7. Khi hướng dẫn chỉ đường hoặc giới thiệu vị trí một tiện ích, nhà vệ sinh hay phòng của khách sạn, ở cuối câu hãy luôn thêm câu mời: 'Ngoài ra, Quý khách có thể quét mã QR trên màn hình để lưu lại chỉ dẫn nhé ạ.'\n"
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
            prompt += "\n[Cảm xúc khách]: Khách đang có biểu cảm khó chịu hoặc chưa hài lòng, hãy phản hồi với thái độ xin lỗi chân thành, xoa dịu ân cần và cho biết nhân viên Concierge tại sảnh sẽ hỗ trợ ngay."
        elif emotion_str in ["happy", "pleased"]:
            prompt += "\n[Cảm xúc khách]: Khách đang rất vui vẻ, hãy phản hồi tươi vui và nhiệt tình."

        if rag_context:
            prompt += f"\n[Cơ sở tri thức khách sạn (RAG)]:\n{rag_context}"

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
            "parts": [{"text": prompt}]
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
