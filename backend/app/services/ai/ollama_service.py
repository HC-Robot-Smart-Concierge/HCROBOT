import asyncio
import datetime
import json
import logging
import re
from typing import Dict, Any, List, Optional, Tuple

import ollama

from app.core.config import settings

logger = logging.getLogger(__name__)


class OllamaService:
    def __init__(self):
        self.host = settings.OLLAMA_HOST
        self.model = settings.OLLAMA_MODEL
        self.embed_model = settings.OLLAMA_EMBED_MODEL
        self._client = ollama.AsyncClient(host=self.host)

    @staticmethod
    def detect_language(text: str) -> Tuple[str, str]:
        """
        Tự động phân tích câu nói của khách để nhận diện ngôn ngữ và mã lang_code cho TTS.
        Mặc định ưu tiên Tiếng Việt (vi-VN) cho mọi tương tác.
        Chỉ chuyển sang Tiếng Anh nếu khách sử dụng câu thoại tiếng Anh rõ ràng.
        """
        if not text:
            return "Tiếng Việt", "vi-VN"

        # 1. Ký tự có dấu tiếng Việt đặc trưng HOẶC từ vựng Tiếng Việt phổ biến -> Ưu tiên Tiếng Việt 100%
        if re.search(r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõõôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', text, re.IGNORECASE):
            return "Tiếng Việt", "vi-VN"

        vi_keywords = [
            r'\bphong\b', r'\bphồng\b', r'\btoi\b', r'\bmuon\b', r'\bcan\b', r'\bkhan\b', r'\btam\b',
            r'\bdon\b', r'\ban\b', r'\buong\b', r'\bgiup\b', r'\bo dau\b', r'\bkhach\b', r'\bsan\b',
            r'\ble tan\b', r'\bbao tri\b', r'\bsua\b', r'\bnuoc\b', r'\bcom\b', r'\bban\b'
        ]
        lower_text = text.lower()
        if any(re.search(pattern, lower_text) for pattern in vi_keywords):
            return "Tiếng Việt", "vi-VN"

        # 2. Chỉ coi là Tiếng Trung nếu toàn bộ hoặc đa số văn bản là chữ Hán (Tránh rò rỉ 1-2 ký tự rác của Qwen)
        cjk_chars = re.findall(r'[\u4e00-\u9fff]', text)
        latin_chars = re.findall(r'[a-zA-Z]', text)
        if len(cjk_chars) > 0 and len(cjk_chars) > len(latin_chars):
            return "Tiếng Trung", "zh-CN"

        # 3. Chữ Hiragana / Katakana / Tiếng Nhật
        if re.search(r'[\u3040-\u30ff]', text):
            return "Tiếng Nhật", "ja-JP"

        # 4. Kiểm tra cấu trúc câu tiếng Anh giao tiếp rõ ràng
        english_phrases = [
            r'\bwhere is\b', r'\bwhat time\b', r'\bhow to\b', r'\bhow can\b',
            r'\bcan i\b', r'\bcould you\b', r'\bi want\b', r'\bi need\b', r'\bi would like\b',
            r'\bis there\b', r'\bare there\b', r'\bwhen does\b', r'\bwhat is\b', r'\bthank you\b',
            r'\bgood morning\b', r'\bgood evening\b', r'\bhello robot\b'
        ]
        if any(re.search(pattern, lower_text) for pattern in english_phrases):
            return "English", "en-US"

        # Mặc định tất cả các trường hợp khác đều trả về Tiếng Việt
        return "Tiếng Việt", "vi-VN"

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
        Sinh câu trả lời thoại cho Concierge Robot dựa trên câu hỏi của khách, lịch sử phiên và ngữ cảnh RAG.
        Tự động phát hiện ngôn ngữ nếu language không được chỉ định hoặc là 'auto'.
        """
        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"

        # Lời chào động theo thời gian thực (Buổi sáng / Buổi trưa / Buổi tối)
        hour = datetime.datetime.now().hour
        if 5 <= hour < 11:
            time_greeting = "Dạ em chào buổi sáng quý khách! Chúc quý khách một ngày mới nhiều năng lượng tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
        elif 11 <= hour < 18:
            time_greeting = "Dạ em chào quý khách! Chúc quý khách một buổi chiều vui vẻ tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
        else:
            time_greeting = "Dạ em chào buổi tối quý khách! Chúc quý khách một buổi tối thư thái tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"

        # 0. Fast-Path Instant Response Cache (Tốc độ phản hồi < 1ms cho câu chào & câu hỏi phổ biến)
        prompt_lower = prompt.lower().strip()
        fast_path_cache = [
            (r"^(xin chào|chào em|chào robot|chào bạn|chào|hi|hello|helo)\b", time_greeting),
            (r"\b(cảm ơn|cảm ơn em|cảm ơn robot|thank you|thanks)\b", "Dạ không có gì ạ! Chúc quý khách một kỳ nghỉ thật tuyệt vời tại khách sạn Aurora. Quý khách cần em hỗ trợ gì nữa không ạ?"),
            (r"\b(hồ bơi|swimming pool|hồ bơi ở đâu)\b", "Dạ hồ bơi vô cực nằm ở Tầng 4 của khách sạn, mở cửa từ 6 giờ sáng đến 10 giờ tối ạ. Quý khách có cần em gọi nước uống lên hồ bơi không ạ?"),
            (r"\b(wifi|mật khẩu wifi|pass wifi|mạng internet)\b", "Dạ wifi miễn phí tại sảnh và các phòng là 'Aurora_Guest', mật khẩu kết nối là 'aurora2026' ạ."),
            (r"\b(giờ trả phòng|trả phòng|check out|checkout)\b", "Dạ giờ trả phòng chuẩn của khách sạn là 12 giờ trưa. Quý khách có muốn em đặt xe đưa đón sân bay không ạ?"),
            (r"\b(ăn sáng|nhà hàng|bữa sáng|breakfast)\b", "Dạ nhà hàng ăn sáng Buffet nằm ở Tầng 2, phục vụ từ 6 giờ đến 10 giờ sáng hàng ngày ạ."),
        ]

        for pattern, fast_reply in fast_path_cache:
            if re.search(pattern, prompt_lower, re.IGNORECASE):
                logger.info(f"[OllamaService Fast-Path Hit] Matched pattern '{pattern}' in < 1ms!")
                return fast_reply, lang_name, lang_code

        if lang_code == "en-US":
            system_prompt = (
                "You are HCRobot - an intelligent, polite, and friendly hotel concierge assistant at Aurora Grand Hotel. "
                "STRICT REQUIREMENT: Answer 100% in fluent English based on the hotel context provided. "
                "Keep your response concise (max 2 sentences), warm, and clear for voice speech playback. "
                "Do not use emojis or markdown formatting."
            )
        else:
            system_prompt = (
                "Bạn là HCRobot - Trợ lý Robot Concierge thông minh, tinh tế và lịch sự tại khách sạn Aurora Grand Hotel.\n"
                "QUY TẮC PHẢN HỒI GIAO TIẾP:\n"
                "1. Luôn xưng 'Dạ em' hoặc 'Em' và gọi người dùng là 'Quý khách' hoặc 'Anh/chị'.\n"
                "2. Trả lời thuần 100% Tiếng Việt chuẩn, văn phong tự nhiên, ấm áp, súc tích (tối đa 2 câu) để phát ra loa thoại.\n"
                "3. Khi phù hợp, hãy kết thúc bằng một câu gợi mở dịch vụ nhẹ nhàng (Ví dụ: 'Quý khách có cần em hỗ trợ gì thêm không ạ?').\n"
                "4. Tuyệt đối KHÔNG dùng biểu tượng cảm xúc (emoji), dấu gạch ngang markdown, hoặc chêm từ tiếng Anh."
            )

        if stored_room_number:
            system_prompt += f"\n\n[SỐ PHÒNG ĐÃ GHI NHỚ TRONG SESSION]: Khách hàng đang ở Phòng {stored_room_number}."

        emotion_str = (emotion or "").lower()
        if emotion_str in ["annoyed", "angry", "upset"]:
            system_prompt += "\n\n[LƯU Ý CẢM XÚC KHÁCH HÀNG]: Khách hàng đang thể hiện biểu cảm KHÔNG HÀI LÒNG / GIẬN DỮ. Hãy phản hồi với thái độ CỰC KỲ XIN LỖI, THÂN THIỆN, LỊCH SỰ VÀ XOA DỊU CHÂN THÀNH."
        elif emotion_str in ["happy", "pleased"]:
            system_prompt += "\n\n[LƯU Ý CẢM XÚC KHÁCH HÀNG]: Khách hàng đang VUI VẺ, THÂN THIỆN. Hãy phản hồi với thái độ TƯƠI VUI, THÂN THIỆN VÀ NĂNG LƯỢNG."

        if rag_context:
            system_prompt += f"\n\n[Thông tin tra cứu từ hệ thống khách sạn / Hotel Context]:\n{rag_context}"

        messages = [{"role": "system", "content": system_prompt}]

        # Gộp lịch sử hội thoại các lượt trước trong session
        if chat_history:
            for turn in chat_history:
                if turn.get("role") in ["user", "assistant"] and turn.get("content"):
                    messages.append({"role": turn["role"], "content": turn["content"]})

        messages.append({"role": "user", "content": prompt})

        try:
            response = await asyncio.wait_for(
                self._client.chat(
                    model=self.model,
                    messages=messages,
                    options={
                        "temperature": 0.2,
                        "top_p": 0.85,
                        "num_predict": 35,
                        "num_ctx": 512,
                        "num_thread": 8,
                    },
                    keep_alive="60m"
                ),
                timeout=15.0
            )

            reply = response["message"]["content"].strip()
            # Lọc bỏ ký tự chữ Hán / Tiếng Trung rò rỉ ngẫu nhiên của Qwen khi đang tương tác Tiếng Việt/Anh
            if lang_code != "zh-CN":
                reply = re.sub(r'[\u4e00-\u9fff\u3400-\u4dbf]+', '', reply).strip()

            final_lang_name, final_lang_code = self.detect_language(reply)
            return reply, final_lang_name, final_lang_code
        except Exception as e:
            logger.error(f"[OllamaService Error] Lỗi khi sinh câu trả lời LLM: {str(e)}")
            fallback = "Xin lỗi quý khách, hiện không thể kết nối tới AI Server." if lang_code == "vi-VN" else "Sorry, cannot connect to AI Server."
            return fallback, lang_name, lang_code

    async def extract_intent(self, user_speech: str) -> Dict[str, Any]:
        """
        Bóc tách Ý định (Intent) & Thực thể (Entities) từ câu nói của khách hàng ra JSON chuẩn.
        """
        # Regex kiểm tra nhanh số phòng trực tiếp (Ví dụ: "phòng 502", "p.304", "502", "tôi ở 402")
        room_match = re.search(r'(?:phòng|p\.|p|phong)\s*([0-9]{3,4})|^(?:tôi ở|ở)\s*([0-9]{3,4})$', user_speech, re.IGNORECASE)
        extracted_room_regex = None
        if room_match:
            extracted_room_regex = room_match.group(1) or room_match.group(2)

        # Fast-Path Keyword Check (Nếu khớp từ khóa dịch vụ rõ ràng -> Trả về luôn siêu tốc < 1ms)
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

        if fast_action:
            clean_items = user_speech
            if extracted_room_regex:
                clean_items = re.sub(r'^(?:tôi ở|ở|phòng|p\.|p|phong)?\s*' + re.escape(extracted_room_regex) + r'\s*(?:cần|muốn|cho|lấy|gửi)?\s*', '', clean_items, flags=re.IGNORECASE).strip()
            return {
                "action": fast_action,
                "room_number": extracted_room_regex,
                "items": clean_items or user_speech,
            }

        system_prompt = (
            "Bạn là hệ thống trích xuất dữ liệu tự động cho dịch vụ khách sạn. "
            "Hãy phân tích câu nói của khách và trả về kết quả dưới định dạng JSON duy nhất với các field sau:\n"
            "- action: một trong các giá trị ['housekeeping', 'room_service', 'bellman', 'maintenance', 'restaurant', 'provide_room_number', 'faq', 'unknown']\n"
            "- room_number: số phòng nếu được nhắc tới (VD: '302', '502'), nếu không có để null\n"
            "- items: chi tiết món đồ/món ăn/dịch vụ yêu cầu (VD: '2 cái khăn tắm', '1 dĩa cơm chiên'), nếu không có để null\n\n"
            "Chỉ trả về JSON thuần túy, không kèm bất kỳ câu giải thích nào."
        )

        try:
            response = await asyncio.wait_for(
                self._client.chat(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_speech}
                    ],
                    format="json",
                    options={"temperature": 0.0, "num_predict": 35, "num_ctx": 512}
                ),
                timeout=3.0
            )
            content = response["message"]["content"].strip()
            parsed_json = json.loads(content)
            
            if extracted_room_regex and not parsed_json.get("room_number"):
                parsed_json["room_number"] = extracted_room_regex

            return parsed_json
        except Exception as e:
            logger.warning(f"[OllamaService Warning] Lỗi hoặc Timeout khi bóc tách intent: {str(e)}")
            
            # Keyword-based Intent Fallback khi LLM offline/timeout
            fallback_action = "unknown"
            lower_speech = user_speech.lower()
            if any(k in lower_speech for k in ["khăn", "tắm", "dọn phòng", "gối", "chăn", "nệm", "dọn", "towel", "clean"]):
                fallback_action = "housekeeping"
            elif any(k in lower_speech for k in ["cơm", "nước", "ăn", "uống", "đồ ăn", "trà", "cà phê", "pizza", "phở", "bánh", "food", "drink"]):
                fallback_action = "room_service"
            elif any(k in lower_speech for k in ["hành lý", "vali", "túi", "chuyển phòng", "mang đồ", "luggage", "bag"]):
                fallback_action = "bellman"
            elif any(k in lower_speech for k in ["hỏng", "sửa", "điều hòa", "bóng đèn", "nước rò", "máy lạnh", "tủ lạnh", "fix", "repair"]):
                fallback_action = "maintenance"
            elif any(k in lower_speech for k in ["đặt bàn", "đặt món trước", "bàn ăn", "nhà hàng", "table", "restaurant"]):
                fallback_action = "restaurant"
            elif extracted_room_regex:
                fallback_action = "provide_room_number"

            return {
                "action": fallback_action,
                "room_number": extracted_room_regex,
                "items": user_speech,
            }

    async def get_embedding(self, text: str) -> List[float]:
        """
        Tạo Vector Embedding từ đoạn văn bản để lưu/tìm kiếm trong ChromaDB Vector Store.
        """
        try:
            response = await self._client.embeddings(
                model=self.embed_model,
                prompt=text
            )
            return response["embedding"]
        except Exception as e:
            logger.error(f"[OllamaService Error] Lỗi tạo vector embedding: {str(e)}")
            raise RuntimeError(f"Lỗi khi tạo embedding qua Ollama ({self.embed_model}): {str(e)}")


# Singleton Instance
ollama_service = OllamaService()
