import asyncio
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
        Trả về: Tuple[language_display_name, lang_code]
        Ví dụ: ("English", "en-US"), ("Tiếng Việt", "vi-VN"), ("Tiếng Trung", "zh-CN"), ("Tiếng Nhật", "ja-JP").
        """
        if not text:
            return "Tiếng Việt", "vi-VN"

        # 1. Chữ Hán / Tiếng Trung
        if re.search(r'[\u4e00-\u9fff]', text):
            return "Tiếng Trung", "zh-CN"

        # 2. Chữ Hiragana / Katakana / Tiếng Nhật
        if re.search(r'[\u3040-\u30ff]', text):
            return "Tiếng Nhật", "ja-JP"

        # 3. Ký tự có dấu tiếng Việt đặc trưng
        if re.search(r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', text, re.IGNORECASE):
            return "Tiếng Việt", "vi-VN"

        # 4. Kiểm tra các từ tiếng Anh phổ biến
        english_keywords = {
            'where', 'what', 'how', 'when', 'who', 'why', 'is', 'are', 'the', 'pool', 'room',
            'hotel', 'breakfast', 'check', 'can', 'you', 'help', 'please', 'toilet', 'gym',
            'spa', 'bar', 'wifi', 'price', 'menu', 'time', 'open', 'close'
        }
        words = set(re.findall(r'\b\w+\b', text.lower()))
        if english_keywords.intersection(words):
            return "English", "en-US"

        return "Tiếng Việt", "vi-VN"

    async def generate_response(
        self,
        prompt: str,
        rag_context: Optional[str] = None,
        language: Optional[str] = None,
        emotion: Optional[str] = None
    ) -> Tuple[str, str, str]:
        """
        Sinh câu trả lời thoại cho Concierge Robot dựa trên câu hỏi của khách và ngữ cảnh RAG.
        Tự động phát hiện ngôn ngữ nếu language không được chỉ định hoặc là 'auto'.
        Trả về: Tuple[reply_text, language_name, lang_code]
        """
        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"

        if lang_code == "en-US":
            system_prompt = (
                "You are HCRobot - an intelligent and friendly hotel concierge assistant at Aurora Grand Hotel. "
                "STRICT REQUIREMENT: Answer 100% in fluent English based on the hotel context provided. "
                "Keep your response concise (max 2-3 sentences), polite, and clear for voice speech playback. "
                "Do not use emojis or markdown formatting."
            )
        elif lang_code == "zh-CN":
            system_prompt = (
                "You are HCRobot - an intelligent and friendly hotel concierge assistant at Aurora Grand Hotel. "
                "STRICT REQUIREMENT: Answer 100% in fluent Simplified Chinese based on the hotel context provided. "
                "Keep your response concise (max 2-3 sentences), polite, and clear for voice speech playback. "
                "Do not use emojis or markdown formatting."
            )
        elif lang_code == "ja-JP":
            system_prompt = (
                "You are HCRobot - an intelligent and friendly hotel concierge assistant at Aurora Grand Hotel. "
                "STRICT REQUIREMENT: Answer 100% in fluent Japanese based on the hotel context provided. "
                "Keep your response concise (max 2-3 sentences), polite, and clear for voice speech playback. "
                "Do not use emojis or markdown formatting."
            )
        else:
            system_prompt = (
                "Bạn là HCRobot - Lễ tân Robot thông minh và thân thiện tại khách sạn Aurora Grand Hotel. "
                "BẮT BUỘC TRẢ LỜI 100% BẰNG TIẾNG VIỆT CHUẨN dựa trên ngữ cảnh khách sạn được cung cấp. "
                "Tuyệt đối KHÔNG sử dụng tiếng Trung (Chinese characters), tiếng Anh hay ngôn ngữ khác trong câu trả lời. "
                "Hãy trả lời ngắn gọn (tối đa 2-3 câu), lịch sự, đúng trọng tâm bằng tiếng Việt để phát thành giọng nói. "
                "Không sử dụng biểu tượng cảm xúc (emoji) hoặc định dạng markdown phức tạp."
            )

        emotion_str = (emotion or "").lower()
        if emotion_str in ["annoyed", "angry", "upset"]:
            system_prompt += "\n\n[LƯU Ý CẢM XÚC KHÁCH HÀNG]: Khách hàng đang thể hiện biểu cảm KHÔNG HÀI LÒNG / GIẬN DỮ. Hãy phản hồi với thái độ CỰC KỲ XIN LỖI, THÂN THIỆN, LỊCH SỰ VÀ XOA DỊU CHÂN THÀNH."
        elif emotion_str in ["happy", "pleased"]:
            system_prompt += "\n\n[LƯU Ý CẢM XÚC KHÁCH HÀNG]: Khách hàng đang VUI VẺ, THÂN THIỆN. Hãy phản hồi với thái độ TƯƠI VUI, THÂN THIỆN VÀ NĂNG LƯỢNG."

        if rag_context:
            system_prompt += f"\n\n[Thông tin tra cứu từ hệ thống khách sạn / Hotel Context]:\n{rag_context}"

        try:
            response = await asyncio.wait_for(
                self._client.chat(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    options={
                        "temperature": 0.3,
                        "top_p": 0.9,
                        "num_predict": 100
                    }
                ),
                timeout=60.0
            )

            reply = response["message"]["content"].strip()
            return reply, lang_name, lang_code
        except Exception as e:
            logger.error(f"[OllamaService Error] Lỗi khi sinh câu trả lời LLM: {str(e)}")
            fallback = "Xin lỗi ông chủ, hiện không thể kết nối tới AI Server." if lang_code == "vi-VN" else "Sorry, cannot connect to AI Server."
            return fallback, lang_name, lang_code

    async def extract_intent(self, user_speech: str) -> Dict[str, Any]:
        """
        Bóc tách Ý định (Intent) & Thực thể (Entities) từ câu nói của khách hàng ra JSON chuẩn.
        """
        system_prompt = (
            "Bạn là hệ thống trích xuất dữ liệu tự động cho dịch vụ khách sạn. "
            "Hãy phân tích câu nói của khách và trả về kết quả dưới định dạng JSON duy nhất với các field sau:\n"
            "- action: một trong các giá trị ['housekeeping', 'room_service', 'taxi', 'faq', 'unknown']\n"
            "- room_number: số phòng nếu được nhắc tới (VD: '302'), nếu không có để null\n"
            "- items: chi tiết món đồ/dịch vụ yêu cầu (VD: '2 cái khăn tắm'), nếu không có để null\n\n"
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
                    options={"temperature": 0.1}
                ),
                timeout=5.0
            )
            content = response["message"]["content"].strip()
            parsed_json = json.loads(content)
            return parsed_json
        except Exception as e:
            logger.warning(f"[OllamaService Warning] Lỗi hoặc Timeout khi bóc tách intent: {str(e)}")
            return {"action": "unknown", "room_number": None, "items": None}

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
