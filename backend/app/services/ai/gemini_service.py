"""Google Gemini AI service with Groq Cloud fallback for chat, streaming, and intent extraction."""

import asyncio
import json
import logging
import re
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings
from app.services.ai.llm_prompt_helpers import (
    build_concierge_system_prompt,
    build_openai_messages,
    call_groq_chat,
    detect_bilingual_language,
    resolve_request_language,
    stream_groq_chat,
)
from app.services.ai.prompt_guard import (
    check_prompt_injection,
    format_safe_user_prompt,
    get_rejection_reply,
)

logger = logging.getLogger(__name__)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiService:
    """Google Gemini REST API service with automatic model fallback and Groq fallback."""

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL or "gemini-2.5-flash"
        self.fallback_models = [
            self.model,
            "gemini-flash-lite-latest",
            "gemini-2.5-flash",
            "gemini-1.5-flash",
            "gemini-flash-latest",
        ]
        seen = set()
        self.candidate_models = [m for m in self.fallback_models if not (m in seen or seen.add(m))]

    @property
    def current_api_key(self) -> str:
        return self.api_key or settings.GEMINI_API_KEY or ""

    @property
    def is_configured(self) -> bool:
        if time.time() < getattr(self, "_quota_exhausted_until", 0):
            return False
        return bool(self.current_api_key.strip())

    @staticmethod
    def detect_language(text: str) -> Tuple[str, str]:
        return detect_bilingual_language(text, mode="gemini")

    def _build_system_prompt(
        self,
        lang_code: str,
        emotion: Optional[str] = None,
        stored_room_number: Optional[str] = None,
        rag_context: Optional[str] = None,
        age_group: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> str:
        return build_concierge_system_prompt(
            lang_code,
            emotion=emotion,
            stored_room_number=stored_room_number,
            rag_context=rag_context,
            age_group=age_group,
            gender=gender,
        )

    def _format_gemini_payload(
        self,
        prompt: str,
        system_prompt: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        json_mode: bool = False,
    ) -> Dict[str, Any]:
        """Format request payload for Google Gemini REST API."""
        contents = []
        if chat_history:
            for turn in chat_history:
                role = turn.get("role")
                content = turn.get("content")
                if content and role in ["user", "assistant", "model"]:
                    gemini_role = "user" if role == "user" else "model"
                    contents.append({"role": gemini_role, "parts": [{"text": content}]})

        contents.append({"role": "user", "parts": [{"text": format_safe_user_prompt(prompt)}]})

        payload: Dict[str, Any] = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.1 if json_mode else 0.7},
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
        if not settings.is_groq_active:
            return None
        messages = build_openai_messages(system_prompt, prompt, chat_history, sanitize_user=False)
        return await call_groq_chat(
            messages,
            api_key=settings.GROQ_API_KEY or "",
            model=settings.GROQ_MODEL,
            json_mode=json_mode,
            max_tokens=max_tokens,
            log_prefix="[Groq Fallback]",
        )

    async def _stream_groq_fallback(
        self,
        prompt: str,
        system_prompt: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        max_tokens: int = 150,
    ) -> AsyncGenerator[str, None]:
        if not settings.is_groq_active:
            return
        messages = build_openai_messages(system_prompt, prompt, chat_history, sanitize_user=False)
        async for token in stream_groq_chat(
            messages,
            api_key=settings.GROQ_API_KEY or "",
            model=settings.GROQ_MODEL,
            max_tokens=max_tokens,
            log_prefix="[Groq Stream Fallback]",
            raise_on_error=False,
        ):
            yield token

    async def _prepare_prompt_and_payload(
        self,
        prompt: str,
        rag_context: Optional[str],
        language: Optional[str],
        emotion: Optional[str],
        chat_history: Optional[List[Dict[str, str]]],
        stored_room_number: Optional[str],
        age_group: Optional[str],
        gender: Optional[str],
    ) -> Tuple[str, str, Dict[str, Any]]:
        _, lang_code = resolve_request_language(prompt, language, self.detect_language)
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
            age_group=age_group,
            gender=gender,
        )
        payload = self._format_gemini_payload(prompt=prompt, system_prompt=system_prompt, chat_history=chat_history)
        return lang_code, system_prompt, payload

    async def generate_response_stream(
        self,
        prompt: str,
        rag_context: Optional[str] = None,
        language: Optional[str] = None,
        emotion: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        stored_room_number: Optional[str] = None,
        age_group: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream SSE tokens from Gemini with Groq fallback when no token has been yielded yet."""
        if check_prompt_injection(prompt):
            lang_code = "en-US" if (language and (language == "English" or "en" in str(language).lower())) else "vi-VN"
            yield get_rejection_reply(lang_code)
            return

        _, system_prompt, payload = await self._prepare_prompt_and_payload(
            prompt, rag_context, language, emotion, chat_history, stored_room_number, age_group, gender
        )

        has_yielded = False
        for model in self.candidate_models:
            stream_url = f"{GEMINI_API_BASE}/models/{model}:streamGenerateContent?alt=sse&key={self.current_api_key}"
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)) as client:
                    async with client.stream("POST", stream_url, json=payload, headers={"Content-Type": "application/json"}) as resp:
                        if resp.status_code != 200:
                            err_text = await resp.aread()
                            logger.warning(
                                f"[GeminiService] Model '{model}' stream status {resp.status_code}: "
                                f"{err_text.decode('utf-8', errors='ignore')[:150]}"
                            )
                            continue
                        async for raw_line in resp.aiter_lines():
                            if not raw_line or not raw_line.startswith("data: "):
                                continue
                            line_data = raw_line[6:].strip()
                            if not line_data or line_data == "[DONE]":
                                continue
                            try:
                                candidates = json.loads(line_data).get("candidates", [])
                                if candidates:
                                    for p in candidates[0].get("content", {}).get("parts", []):
                                        text_token = p.get("text", "")
                                        if text_token:
                                            has_yielded = True
                                            yield text_token
                            except Exception as e_parse:
                                logger.debug(f"[GeminiService] Chunk parse error: {e_parse}")
                        if has_yielded:
                            return
            except Exception as e_stream:
                logger.warning(f"[GeminiService] Model '{model}' streaming failed: {e_stream}")

        if not has_yielded and settings.is_groq_active:
            logger.info("[GeminiService Stream] Tất cả candidate Gemini thất bại, fallback sang Groq Cloud Stream...")
            try:
                async for token in self._stream_groq_fallback(
                    prompt=prompt, system_prompt=system_prompt, chat_history=chat_history
                ):
                    has_yielded = True
                    yield token
                if has_yielded:
                    return
            except Exception as e_groq:
                logger.warning(f"[GeminiService Stream] Groq fallback stream thất bại: {e_groq}")
                if has_yielded:
                    return

        raise RuntimeError("Tất cả candidate models của Gemini và Groq đều không phản hồi streaming")

    async def generate_response(
        self,
        prompt: str,
        rag_context: Optional[str] = None,
        language: Optional[str] = None,
        emotion: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        stored_room_number: Optional[str] = None,
        age_group: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> Tuple[str, str, str]:
        """Generate a response from Gemini candidate models with Groq fallback."""
        if check_prompt_injection(prompt):
            lang_code = "en-US" if (language and (language == "English" or "en" in str(language).lower())) else "vi-VN"
            lang_name = "English" if lang_code == "en-US" else "Tiếng Việt"
            return get_rejection_reply(lang_code), lang_name, lang_code

        lang_code, system_prompt, payload = await self._prepare_prompt_and_payload(
            prompt, rag_context, language, emotion, chat_history, stored_room_number, age_group, gender
        )

        for model in self.candidate_models:
            url = f"{GEMINI_API_BASE}/models/{model}:generateContent?key={self.current_api_key}"
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)) as client:
                    resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                    if resp.status_code == 200:
                        candidates = resp.json().get("candidates", [])
                        parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
                        if parts:
                            reply = parts[0].get("text", "").strip()
                            if lang_code != "zh-CN":
                                reply = re.sub(r"[\u4e00-\u9fff\u3400-\u4dbf]+", "", reply).strip()
                            reply = re.sub(r"[*#_`\[\]]", "", reply).strip()
                            final_lang_name, final_lang_code = self.detect_language(reply)
                            return reply, final_lang_name, final_lang_code
                    else:
                        if resp.status_code == 429:
                            self._quota_exhausted_until = time.time() + 300
                            logger.warning(
                                f"[GeminiService] Model '{model}' status 429 (Quota Exhausted). Cooldown active for 5m: {resp.text[:120]}"
                            )
                        else:
                            logger.warning(f"[GeminiService] Model '{model}' status {resp.status_code}: {resp.text[:150]}")
            except Exception as e:
                logger.warning(f"[GeminiService] Request error with model '{model}': {e}")

        if settings.is_groq_active:
            logger.info("[GeminiService] Tất cả candidate Gemini thất bại, fallback sang Groq Cloud...")
            groq_reply = await self._call_groq_fallback(
                prompt=prompt, system_prompt=system_prompt, chat_history=chat_history, max_tokens=150
            )
            if groq_reply and groq_reply.strip():
                clean_reply = re.sub(r"[*#_`\[\]]", "", groq_reply.strip()).strip()
                final_lang_name, final_lang_code = self.detect_language(clean_reply)
                return clean_reply, final_lang_name, final_lang_code

        raise RuntimeError("Tất cả candidate models của Gemini và Groq đều không phản hồi generateContent")

    async def generate_reply(self, prompt: str, timeout: float = 8.0) -> str:
        """Plain text helper for TranslationService."""
        try:
            res = await asyncio.wait_for(self.generate_response(prompt=prompt), timeout=timeout)
            return res[0] if isinstance(res, tuple) else str(res)
        except Exception as e:
            logger.warning(f"[GeminiService] generate_reply error: {e}")
            return ""

    async def extract_intent(self, user_speech: str) -> Dict[str, Any]:
        """Extract service action, room number, and items JSON from guest speech."""
        user_speech = (
            re.sub(
                r"^(?:hey rora|chào rora|chao rora|rora ơi|rora oi|hello rora|hi rora|rora)[\,\.\!\s]*",
                "",
                user_speech,
                flags=re.IGNORECASE,
            ).strip()
            or user_speech
        )

        from app.services.ai.constants import SERVICE_KEYWORDS
        from app.services.ai.session_manager import extract_room_number

        extracted_room_regex = extract_room_number(user_speech, is_answering_room=True)
        lower_speech = user_speech.lower()
        fast_action = next(
            (act for act, kws in SERVICE_KEYWORDS.items() if any(k in lower_speech for k in kws)),
            None,
        )
        if fast_action:
            clean_items = user_speech
            if extracted_room_regex:
                clean_items = re.sub(
                    r"^(?:tôi ở|ở|phòng|p\.|p|phong)?\s*" + re.escape(extracted_room_regex) + r"\s*(?:cần|muốn|cho|lấy|gửi)?\s*",
                    "",
                    clean_items,
                    flags=re.IGNORECASE,
                ).strip()
            return {"action": fast_action, "room_number": extracted_room_regex, "items": clean_items or user_speech}

        smalltalk_patterns = [
            r"^(xin chào|chào|hi|hello|helo|alo)\b",
            r"\b(cảm ơn|thanks|thank you)\b",
            r"\b(tạm biệt|bye|goodbye)\b",
            r"\b(bạn là ai|mày là ai|bạn tên gì)\b",
        ]
        if any(re.search(p, lower_speech) for p in smalltalk_patterns):
            return {"action": "unknown", "room_number": extracted_room_regex, "items": None}

        system_prompt = (
            "Bạn là hệ thống trích xuất dữ liệu tự động cho dịch vụ khách sạn. "
            "Hãy phân tích câu nói của khách và trả về kết quả dưới định dạng JSON với các field sau:\n"
            "- action: một trong các giá trị ['housekeeping', 'room_service', 'bellman', 'maintenance', 'taxi', 'concierge', 'reception', 'restaurant', 'provide_room_number', 'faq', 'unknown']\n"
            "- room_number: số phòng nếu được nhắc tới (VD: '302', '502'), nếu không có để null\n"
            "- items: chi tiết món đồ/món ăn/dịch vụ yêu cầu (VD: '2 cái khăn tắm', '1 dĩa cơm chiên'), nếu không có để null\n"
            "Chỉ trả về JSON thuần túy, không có văn bản giải thích."
        )
        payload = self._format_gemini_payload(prompt=user_speech, system_prompt=system_prompt, json_mode=True)

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

        if settings.is_groq_active:
            logger.info("[GeminiService Intent] Gemini thất bại, fallback sang Groq Intent Extraction...")
            groq_intent = await self._call_groq_fallback(
                prompt=user_speech, system_prompt=system_prompt, json_mode=True, max_tokens=150
            )
            if groq_intent:
                try:
                    parsed_groq = json.loads(groq_intent.strip())
                    if extracted_room_regex and not parsed_groq.get("room_number"):
                        parsed_groq["room_number"] = extracted_room_regex
                    return parsed_groq
                except Exception as e_groq_json:
                    logger.warning(f"[GeminiService Intent] Groq JSON parse error: {e_groq_json}")

        fallback_action = next(
            (act for act, kws in SERVICE_KEYWORDS.items() if any(k in lower_speech for k in kws)),
            "unknown",
        )
        if fallback_action == "unknown" and extracted_room_regex:
            fallback_action = "provide_room_number"
        return {"action": fallback_action, "room_number": extracted_room_regex, "items": user_speech}


gemini_service = GeminiService()
