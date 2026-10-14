import asyncio
import json
import logging
import re
from typing import Dict, Any, List, Optional, Tuple, AsyncGenerator
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiService:
    """
    Google Gemini AI Service cho HCRobot Concierge.
    Hỗ trợ sinh câu trả lời tốc độ cao, streaming token thời gian thực (SSE),
    bóc tách ý định (Intent Extraction) và tự động phục hồi khi gặp sự cố tải.
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL or "gemini-flash-latest"
        # Danh sách model dự phòng ưu tiên các model phản hồi ổn định nhất (đã test 200 OK)
        self.fallback_models = [
            self.model,
            "gemini-3-flash-preview",
            "gemini-3.1-flash-lite-preview",
            "gemini-flash-latest",
        ]
        # Loại bỏ trùng lặp mà vẫn giữ thứ tự ưu tiên
        seen = set()
        self.candidate_models = [m for m in self.fallback_models if not (m in seen or seen.add(m))]

    @property
    def is_configured(self) -> bool:
        """Kiểm tra xem Gemini API key đã được cấu hình hay chưa."""
        return bool(self.api_key and self.api_key.strip())

    @staticmethod
    def detect_language(text: str) -> Tuple[str, str]:
        """
        Tự động phân tích câu nói của khách để nhận diện ngôn ngữ và mã lang_code cho TTS.
        """
        if not text or not text.strip():
            return "Tiếng Việt", "vi-VN"

        if re.search(r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', text, re.IGNORECASE):
            return "Tiếng Việt", "vi-VN"

        lower_text = text.lower().strip()

        cjk_chars = re.findall(r'[\u4e00-\u9fff]', text)
        latin_chars = re.findall(r'[a-zA-Z]', text)
        if len(cjk_chars) > 0 and len(cjk_chars) > len(latin_chars):
            return "Tiếng Trung", "zh-CN"

        if re.search(r'[\u3040-\u30ff]', text):
            return "Tiếng Nhật", "ja-JP"

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
        if lang_code == "en-US":
            prompt = (
                "You are Rora - a smart, charming, and courteous AI Concierge Robot at the 5-star Aurora Grand Hotel.\n"
                "CONVERSATIONAL GUIDELINES:\n"
                "1. Always communicate naturally, warmly, and politely in 2 to 3 clear, complete sentences.\n"
                "2. Speak directly and helpfully as a professional 5-star concierge. Answer questions accurately and concisely.\n"
                "3. Never use emojis, markdown formatting (*, #, _, -), or bulleted lists to ensure smooth speech synthesis.\n"
                "4. State times clearly in full words (e.g., 'from 6:00 AM to 10:00 PM', '12:00 PM noon').\n"
                "AURORA GRAND HOTEL AMENITIES & FACTS:\n"
                "- Level 1: Main Lobby, Front Desk 24/7 (dial 0 from room telephone), and ATM.\n"
                "- Level 2: Aurora Restaurant (serves breakfast buffet from 6:30 AM to 10:00 AM).\n"
                "- Level 3: Conference Center & Executive Meeting Rooms.\n"
                "- Level 4: Infinity Pool (open 6:00 AM to 10:00 PM, free towels) & 24/7 Fitness Center / Gym.\n"
                "- Level 5: Aurora Luxury Spa & Sauna (open 9:00 AM to 10:00 PM).\n"
                "- Basement B1: Complimentary parking for staying guests.\n"
                "- Wi-Fi: Network name 'Aurora_Guest', password 'aurora2026'.\n"
                "- Hours: Standard check-in from 2:00 PM, check-out before 12:00 PM noon."
            )
        else:
            prompt = (
                "Bạn là Rora - Trợ lý Robot Concierge thông minh, lễ phép, duyên dáng và hiếu khách tại khách sạn 5 sao Aurora Grand Hotel.\n"
                "PHONG CÁCH GIAO TIẾP VÀ TRÒ CHUYỆN TỰ NHIÊN:\n"
                "1. Luôn xưng 'Dạ em' hoặc 'Rora' và gọi người trò chuyện là 'quý khách' hoặc 'anh/chị'.\n"
                "2. Trò chuyện một cách tự nhiên, gần gũi, ấm áp, lưu loát như một nhân viên lễ tân 5 sao chuyên nghiệp.\n"
                "3. Trả lời đúng trọng tâm, súc tích trong 2 đến 3 câu văn gãy gọn, hoàn chỉnh để phát giọng đọc mượt mà và người nghe dễ nắm bắt nhất.\n"
                "4. BẮT BUỘC dùng 100% tiếng Việt tự nhiên, chuẩn mực. Tuyệt đối không chèn từ ngoại ngữ vô nghĩa.\n"
                "5. Tuyệt đối KHÔNG dùng emoji, ký hiệu markdown (*, #, _, -) hay gạch đầu dòng.\n"
                "6. Viết thời gian rõ ràng: luôn viết bằng chữ như 'từ 6 giờ sáng đến 22 giờ tối', '12 giờ trưa', không viết tắt '6-22h'.\n\n"
                "THÔNG TIN TIỆN ÍCH KHÁCH SẠN AURORA GRAND (ĐỂ TƯ VẤN CHO KHÁCH):\n"
                "- Tầng 1: Sảnh chính, Quầy Lễ tân 24/7 (từ điện thoại phòng bấm phím 0) và máy ATM rút tiền.\n"
                "- Tầng 2: Nhà hàng Aurora (phục vụ buffet sáng từ 6 giờ 30 đến 10 giờ sáng).\n"
                "- Tầng 3: Trung tâm hội nghị & phòng họp sự kiện cao cấp.\n"
                "- Tầng 4: Hồ bơi vô cực ngoài trời (mở từ 6 giờ sáng đến 22 giờ tối, khăn tắm miễn phí) và Phòng Gym (mở cửa 24/7).\n"
                "- Tầng 5: Aurora Spa thư giãn (mở từ 9 giờ sáng đến 22 giờ tối).\n"
                "- Tầng hầm B1: Bãi đỗ xe ô tô và xe máy miễn phí cho khách lưu trú.\n"
                "- Wi-Fi miễn phí: Tên mạng 'Aurora_Guest', mật khẩu là 'aurora2026'.\n"
                "- Thời gian lưu trú: Nhận phòng từ 14 giờ chiều, trả phòng trước 12 giờ trưa."
            )

        if stored_room_number:
            prompt += f"\n[Thông tin phòng]: Quý khách ở phòng {stored_room_number}."

        emotion_str = (emotion or "").lower()
        if emotion_str in ["annoyed", "angry", "upset"]:
            prompt += "\n[Cảm xúc khách]: Khách đang chưa hài lòng, hãy phản hồi với thái độ xin lỗi và xoa dịu ân cần."
        elif emotion_str in ["happy", "pleased"]:
            prompt += "\n[Cảm xúc khách]: Khách đang rất vui vẻ, hãy phản hồi tươi vui và nhiệt tình."

        if rag_context:
            prompt += f"\n[Thông tin bổ sung]:\n{rag_context}"

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

    async def generate_response_stream(
        self,
        prompt: str,
        rag_context: Optional[str] = None,
        language: Optional[str] = None,
        emotion: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        stored_room_number: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Streaming token thời gian thực từ Gemini qua Server-Sent Events (SSE).
        Yield từng token ngay khi API sinh ra.
        """
        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"

        system_prompt = self._build_system_prompt(
            lang_code=lang_code,
            emotion=emotion,
            stored_room_number=stored_room_number,
            rag_context=rag_context,
        )

        payload = self._format_gemini_payload(
            prompt=prompt,
            system_prompt=system_prompt,
            chat_history=chat_history,
        )

        # Thử lần lượt các candidate model nếu có lỗi
        for model in self.candidate_models:
            stream_url = f"{GEMINI_API_BASE}/models/{model}:streamGenerateContent?alt=sse&key={self.api_key}"
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)) as client:
                    async with client.stream("POST", stream_url, json=payload, headers={"Content-Type": "application/json"}) as resp:
                        if resp.status_code == 200:
                            async for raw_line in resp.aiter_lines():
                                if not raw_line or not raw_line.startswith("data: "):
                                    continue
                                line_data = raw_line[6:].strip()
                                if not line_data or line_data == "[DONE]":
                                    continue
                                try:
                                    chunk_json = json.loads(line_data)
                                    candidates = chunk_json.get("candidates", [])
                                    if candidates:
                                        parts = candidates[0].get("content", {}).get("parts", [])
                                        for p in parts:
                                            text_token = p.get("text", "")
                                            if text_token:
                                                yield text_token
                                except Exception as e_parse:
                                    logger.debug(f"[GeminiService] Chunk parse error: {e_parse}")
                            return  # Thành công, kết thúc stream
                        else:
                            err_text = await resp.aread()
                            logger.warning(f"[GeminiService] Model '{model}' stream status {resp.status_code}: {err_text.decode('utf-8', errors='ignore')[:150]}")
            except Exception as e_stream:
                logger.warning(f"[GeminiService] Model '{model}' streaming failed: {e_stream}")

        # Nếu tất cả model Gemini đều không phản hồi, ném ngoại lệ để OllamaService tự động fallback sang Llama
        raise RuntimeError("Tất cả candidate models của Gemini đều không phản hồi streaming")

    async def generate_response(
        self,
        prompt: str,
        rag_context: Optional[str] = None,
        language: Optional[str] = None,
        emotion: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        stored_room_number: Optional[str] = None,
    ) -> Tuple[str, str, str]:
        """
        Sinh câu trả lời hội thoại tức thì từ Gemini cho Concierge Robot.
        """
        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"

        system_prompt = self._build_system_prompt(
            lang_code=lang_code,
            emotion=emotion,
            stored_room_number=stored_room_number,
            rag_context=rag_context,
        )

        payload = self._format_gemini_payload(
            prompt=prompt,
            system_prompt=system_prompt,
            chat_history=chat_history,
        )

        for model in self.candidate_models:
            url = f"{GEMINI_API_BASE}/models/{model}:generateContent?key={self.api_key}"
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)) as client:
                    resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                    if resp.status_code == 200:
                        res_json = resp.json()
                        candidates = res_json.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                reply = parts[0].get("text", "").strip()
                                # Làm sạch ký tự markdown và tiếng Trung không mong muốn nếu cần
                                if lang_code != "zh-CN":
                                    reply = re.sub(r'[\u4e00-\u9fff\u3400-\u4dbf]+', '', reply).strip()
                                reply = re.sub(r'[*#_`\[\]]', '', reply).strip()
                                final_lang_name, final_lang_code = self.detect_language(reply)
                                return reply, final_lang_name, final_lang_code
                    else:
                        logger.warning(f"[GeminiService] Model '{model}' status {resp.status_code}: {resp.text[:150]}")
            except Exception as e:
                logger.warning(f"[GeminiService] Request error with model '{model}': {e}")

        # Nếu tất cả model Gemini đều không phản hồi, ném ngoại lệ để OllamaService tự động fallback sang Llama
        raise RuntimeError("Tất cả candidate models của Gemini đều không phản hồi generateContent")

    async def extract_intent(self, user_speech: str) -> Dict[str, Any]:
        """
        Bóc tách Ý định (Intent) & Thực thể (Entities) từ câu nói của khách hàng ra JSON chuẩn.
        """
        # Làm sạch wake-up word 'Rora' nếu có ở đầu câu nói
        user_speech = re.sub(r'^(?:hey rora|chào rora|chao rora|rora ơi|rora oi|hello rora|hi rora|rora)[\,\.\!\s]*', '', user_speech, flags=re.IGNORECASE).strip() or user_speech

        room_match = re.search(r'(?:phòng|p\.|p|phong)\s*([0-9]{3,4})|^(?:tôi ở|ở)\s*([0-9]{3,4})$', user_speech, re.IGNORECASE)
        extracted_room_regex = None
        if room_match:
            extracted_room_regex = room_match.group(1) or room_match.group(2)

        lower_speech = user_speech.lower()
        fast_action = None
        if any(k in lower_speech for k in ["khăn", "khan", "tắm", "tam", "dọn phòng", "don phong", "gối", "goi", "chăn", "chan", "nệm", "nem", "towel", "clean"]):
            fast_action = "housekeeping"
        elif any(k in lower_speech for k in ["cơm", "com", "nước", "nuoc", "ăn", "an", "uống", "uong", "đồ ăn", "do an", "trà", "tra", "cà phê", "ca phe", "pizza", "phở", "pho", "bánh", "banh", "food", "drink"]):
            fast_action = "room_service"
        elif any(k in lower_speech for k in ["hành lý", "hanh ly", "vali", "túi", "tui", "chuyển phòng", "chuyen phong", "mang đồ", "mang do", "luggage", "bag"]):
            fast_action = "bellman"
        elif any(k in lower_speech for k in ["hỏng", "hong", "sửa", "sua", "điều hòa", "dieu hoa", "bóng đèn", "bong den", "nước rò", "nuoc ro", "máy lạnh", "may lanh", "tủ lạnh", "tu lanh", "fix", "repair"]):
            fast_action = "maintenance"
        elif any(k in lower_speech for k in ["đặt bàn", "dat ban", "đặt món", "dat mon", "bàn ăn", "ban an", "nhà hàng", "nha hang", "table", "restaurant"]):
            fast_action = "restaurant"
        elif any(k in lower_speech for k in ["taxi", "đặt xe", "dat xe", "gọi xe", "goi xe", "sân bay", "san bay", "cab", "ride"]):
            fast_action = "taxi"
        elif any(k in lower_speech for k in ["concierge", "gặp người", "gap nguoi", "nhân viên hỗ trợ", "live call", "video call", "tổng đài", "tong dai", "trợ giúp trực tiếp"]):
            fast_action = "concierge"
        elif any(k in lower_speech for k in ["lễ tân", "le tan", "check out", "checkout", "check in", "checkin", "đổi phòng", "doi phong", "trả phòng", "tra phong", "front desk", "reception"]):
            fast_action = "reception"

        if fast_action:
            clean_items = user_speech
            if extracted_room_regex:
                clean_items = re.sub(r'^(?:tôi ở|ở|phòng|p\.|p|phong)?\s*' + re.escape(extracted_room_regex) + r'\s*(?:cần|muốn|cho|lấy|gửi)?\s*', '', clean_items, flags=re.IGNORECASE).strip()
            return {
                "action": fast_action,
                "room_number": extracted_room_regex,
                "items": clean_items or user_speech,
            }

        # Fast-Path Chào hỏi / Cảm ơn / Tạm biệt
        if any(re.search(p, lower_speech) for p in [r"^(xin chào|chào|hi|hello|helo|alo)\b", r"\b(cảm ơn|thanks|thank you)\b", r"\b(tạm biệt|bye|goodbye)\b", r"\b(bạn là ai|mày là ai|bạn tên gì)\b"]):
            return {
                "action": "unknown",
                "room_number": extracted_room_regex,
                "items": None,
            }

        system_prompt = (
            "Bạn là hệ thống trích xuất dữ liệu tự động cho dịch vụ khách sạn. "
            "Hãy phân tích câu nói của khách và trả về kết quả dưới định dạng JSON với các field sau:\n"
            "- action: một trong các giá trị ['housekeeping', 'room_service', 'bellman', 'maintenance', 'taxi', 'concierge', 'reception', 'restaurant', 'provide_room_number', 'faq', 'unknown']\n"
            "- room_number: số phòng nếu được nhắc tới (VD: '302', '502'), nếu không có để null\n"
            "- items: chi tiết món đồ/món ăn/dịch vụ yêu cầu (VD: '2 cái khăn tắm', '1 dĩa cơm chiên'), nếu không có để null\n"
            "Chỉ trả về JSON thuần túy, không có văn bản giải thích."
        )

        payload = self._format_gemini_payload(
            prompt=user_speech,
            system_prompt=system_prompt,
            json_mode=True,
        )

        for model in self.candidate_models:
            url = f"{GEMINI_API_BASE}/models/{model}:generateContent?key={self.api_key}"
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=12.0, write=5.0, pool=5.0)) as client:
                    resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                    if resp.status_code == 200:
                        content = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                        parsed_json = json.loads(content)
                        if extracted_room_regex and not parsed_json.get("room_number"):
                            parsed_json["room_number"] = extracted_room_regex
                        return parsed_json
            except Exception as e:
                logger.warning(f"[GeminiService Intent] Error with model '{model}': {e}")

        # Fallback Heuristic
        fallback_action = "unknown"
        if extracted_room_regex:
            fallback_action = "provide_room_number"

        return {
            "action": fallback_action,
            "room_number": extracted_room_regex,
            "items": user_speech,
        }


# Singleton Instance
gemini_service = GeminiService()
