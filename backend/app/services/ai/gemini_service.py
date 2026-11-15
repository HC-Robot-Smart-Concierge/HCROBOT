import asyncio
import json
import logging
import re
from typing import Dict, Any, List, Optional, Tuple, AsyncGenerator
import httpx

from app.core.config import settings
from app.services.ai.gemini_prompt_fallback_mixin import GeminiPromptFallbackMixin

logger = logging.getLogger(__name__)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiService(GeminiPromptFallbackMixin):
    """
    Google Gemini AI Service cho HCRobot Concierge.
    Hỗ trợ sinh câu trả lời tốc độ cao, streaming token thời gian thực (SSE),
    bóc tách ý định (Intent Extraction) và tự động phục hồi khi gặp sự cố tải.
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL or "gemini-2.5-flash"
        # Danh sach model du phong uu tien model on dinh nhat (gemini-2.5-flash, gemini-1.5-flash)
        self.fallback_models = [
            self.model,
            "gemini-flash-lite-latest",
            "gemini-2.5-flash",
            "gemini-1.5-flash",
            "gemini-flash-latest",
        ]
        # Loai bo trung lap ma van giu thu tu uu tien
        seen = set()
        self.candidate_models = [m for m in self.fallback_models if not (m in seen or seen.add(m))]

    @property
    def current_api_key(self) -> str:
        return self.api_key or settings.GEMINI_API_KEY or ""

    @property
    def is_configured(self) -> bool:
        """Kiem tra xem Gemini API key da duoc cau hinh hay chua."""
        return bool(self.current_api_key.strip())

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
        Tự động fallback sang Groq Cloud Stream nếu Gemini gặp lỗi và chưa emit token nào.
        """
        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if (language.lower().startswith("en") or "english" in language.lower()) else "vi-VN"

        # Tự động truy vấn tri thức RAG từ ChromaDB nếu chưa có sẵn
        if rag_context is None:
            try:
                from app.services.rag.chroma import query_rag_context
                rag_context = await query_rag_context(prompt)
            except Exception:
                rag_context = ""

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

        has_yielded = False
        # Thu lan luot cac candidate model neu co loi
        for model in self.candidate_models:
            stream_url = f"{GEMINI_API_BASE}/models/{model}:streamGenerateContent?alt=sse&key={self.current_api_key}"
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
                                                has_yielded = True
                                                yield text_token
                                except Exception as e_parse:
                                    logger.debug(f"[GeminiService] Chunk parse error: {e_parse}")
                            if has_yielded:
                                return  # Thành công, kết thúc stream
                        else:
                            err_text = await resp.aread()
                            logger.warning(f"[GeminiService] Model '{model}' stream status {resp.status_code}: {err_text.decode('utf-8', errors='ignore')[:150]}")
            except Exception as e_stream:
                logger.warning(f"[GeminiService] Model '{model}' streaming failed: {e_stream}")

        # Fallback sang Groq Cloud Stream nếu Gemini lỗi và chưa emit token nào
        if not has_yielded and settings.is_groq_active:
            logger.info("[GeminiService Stream] Tất cả candidate Gemini thất bại, fallback sang Groq Cloud Stream...")
            try:
                async for token in self._stream_groq_fallback(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    chat_history=chat_history,
                ):
                    has_yielded = True
                    yield token
                if has_yielded:
                    return
            except Exception as e_groq:
                logger.warning(f"[GeminiService Stream] Groq fallback stream thất bại: {e_groq}")
                if has_yielded:
                    return

        # Nếu cả Gemini và Groq đều không phản hồi streaming
        raise RuntimeError("Tất cả candidate models của Gemini và Groq đều không phản hồi streaming")

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
            lang_code = "en-US" if (language.lower().startswith("en") or "english" in language.lower()) else "vi-VN"

        # Tự động truy vấn tri thức RAG từ ChromaDB nếu chưa có sẵn
        if rag_context is None:
            try:
                from app.services.rag.chroma import query_rag_context
                rag_context = await query_rag_context(prompt)
            except Exception:
                rag_context = ""

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
            url = f"{GEMINI_API_BASE}/models/{model}:generateContent?key={self.current_api_key}"
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

        # Fallback sang Groq Cloud nếu tất cả candidate Gemini lỗi
        if settings.is_groq_active:
            logger.info("[GeminiService] Tất cả candidate Gemini thất bại, fallback sang Groq Cloud...")
            groq_reply = await self._call_groq_fallback(
                prompt=prompt,
                system_prompt=system_prompt,
                chat_history=chat_history,
                max_tokens=150,
            )
            if groq_reply and groq_reply.strip():
                clean_reply = re.sub(r'[*#_`\[\]]', '', groq_reply.strip()).strip()
                final_lang_name, final_lang_code = self.detect_language(clean_reply)
                return clean_reply, final_lang_name, final_lang_code

        # Nếu cả Gemini và Groq đều không phản hồi, ném ngoại lệ để OllamaService tự động fallback sang Llama
        raise RuntimeError("Tất cả candidate models của Gemini và Groq đều không phản hồi generateContent")

    async def generate_reply(self, prompt: str, timeout: float = 8.0) -> str:
        """
        Sinh phản hồi văn bản thuần túy (dành cho TranslationService).
        """
        try:
            res = await asyncio.wait_for(self.generate_response(prompt=prompt), timeout=timeout)
            return res[0] if isinstance(res, tuple) else str(res)
        except Exception as e:
            logger.warning(f"[GeminiService] generate_reply error: {e}")
            return ""

    async def extract_intent(self, user_speech: str) -> Dict[str, Any]:
        """
        Bóc tách Ý định (Intent) & Thực thể (Entities) từ câu nói của khách hàng ra JSON chuẩn.
        """
        # Làm sạch wake-up word 'Rora' nếu có ở đầu câu nói
        user_speech = re.sub(r'^(?:hey rora|chào rora|chao rora|rora ơi|rora oi|hello rora|hi rora|rora)[\,\.\!\s]*', '', user_speech, flags=re.IGNORECASE).strip() or user_speech

        # Bóc tách nhanh số phòng linh hoạt
        from app.services.ai.session_manager import extract_room_number
        extracted_room_regex = extract_room_number(user_speech, is_answering_room=True)

        # Fast-Path Keyword Check từ Centralized Constants (< 1ms)
        from app.services.ai.constants import SERVICE_KEYWORDS
        lower_speech = user_speech.lower()
        fast_action = None
        for act, kws in SERVICE_KEYWORDS.items():
            if any(k in lower_speech for k in kws):
                fast_action = act
                break

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
            url = f"{GEMINI_API_BASE}/models/{model}:generateContent?key={self.current_api_key}"
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

        # Fallback sang Groq Cloud Intent Extraction nếu Gemini lỗi
        if settings.is_groq_active:
            logger.info("[GeminiService Intent] Gemini thất bại, fallback sang Groq Intent Extraction...")
            groq_intent = await self._call_groq_fallback(
                prompt=user_speech,
                system_prompt=system_prompt,
                json_mode=True,
                max_tokens=150,
            )
            if groq_intent:
                try:
                    parsed_groq = json.loads(groq_intent.strip())
                    if extracted_room_regex and not parsed_groq.get("room_number"):
                        parsed_groq["room_number"] = extracted_room_regex
                    return parsed_groq
                except Exception as e_groq_json:
                    logger.warning(f"[GeminiService Intent] Groq JSON parse error: {e_groq_json}")

        # Fallback Heuristic từ Centralized Constants
        fallback_action = "unknown"
        for act, kws in SERVICE_KEYWORDS.items():
            if any(k in lower_speech for k in kws):
                fallback_action = act
                break
        if fallback_action == "unknown" and extracted_room_regex:
            fallback_action = "provide_room_number"

        return {
            "action": fallback_action,
            "room_number": extracted_room_regex,
            "items": user_speech,
        }


# Singleton Instance
gemini_service = GeminiService()
