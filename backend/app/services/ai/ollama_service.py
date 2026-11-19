"""Ollama LLM orchestration service with cascading Groq -> Gemini -> Ollama -> Offline fallback."""

import asyncio
import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import ollama

from app.core.config import settings
from app.services.ai.constants import SERVICE_KEYWORDS
from app.services.ai.llm_prompt_helpers import (
    COMMON_EN_WORDS,
    COMMON_VI_WORDS,
    EN_SUBSTRING_PATTERNS,
    build_concierge_system_prompt,
    build_openai_messages,
    call_groq_chat,
    detect_bilingual_language,
    resolve_reply_language,
    resolve_request_language,
    stream_groq_chat,
)
from app.services.ai.ollama_fast_path import (
    check_fast_path_full as _fast_path_full,
    clean_vietnamese_voice_text as _clean_vi_voice_text,
    format_and_clean_reply as _format_reply,
    generate_offline_fallback as _offline_fallback,
)
from app.services.ai.prompt_guard import check_prompt_injection, get_rejection_reply

logger = logging.getLogger(__name__)

__all__ = [
    "COMMON_EN_WORDS",
    "COMMON_VI_WORDS",
    "EN_SUBSTRING_PATTERNS",
    "OllamaService",
    "ollama_service",
]


class OllamaService:
    def __init__(self):
        self.host = settings.OLLAMA_HOST
        self.model = settings.OLLAMA_MODEL
        self.embed_model = getattr(settings, "OLLAMA_EMBED_MODEL", None)
        self._client = ollama.AsyncClient(host=self.host)
        self._ollama_offline_until: float = 0.0

    async def _call_groq(self, messages: List[Dict[str, str]], json_mode: bool = False, max_tokens: int = 150) -> Optional[str]:
        return await call_groq_chat(
            messages,
            api_key=settings.GROQ_API_KEY or "",
            model=settings.GROQ_MODEL,
            json_mode=json_mode,
            max_tokens=max_tokens,
            log_prefix="[Groq API]",
        )

    async def _call_groq_stream(self, messages: List[Dict[str, str]], max_tokens: int = 150):
        async for token in stream_groq_chat(
            messages,
            api_key=settings.GROQ_API_KEY or "",
            model=settings.GROQ_MODEL,
            max_tokens=max_tokens,
            log_prefix="[Groq Stream]",
            raise_on_error=True,
        ):
            yield token

    @staticmethod
    def detect_language(text: str) -> Tuple[str, str]:
        return detect_bilingual_language(text, mode="ollama")

    def check_fast_path(self, prompt: str, language: Optional[str] = None) -> Optional[Tuple[str, str, str]]:
        match = self.check_fast_path_full(prompt, language)
        return (match[0], match[1], match[2]) if match else None

    def check_fast_path_full(
        self, prompt: str, language: Optional[str] = None
    ) -> Optional[Tuple[str, str, str, Optional[str], Optional[Dict[str, Any]]]]:
        return _fast_path_full(prompt, language, self.detect_language)

    @staticmethod
    def clean_vietnamese_voice_text(text: str) -> str:
        return _clean_vi_voice_text(text)

    @classmethod
    def format_and_clean_reply(cls, reply: str, lang_code: str) -> str:
        return _format_reply(reply, lang_code)

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

    async def _prepare_chat_context(
        self,
        prompt: str,
        rag_context: Optional[str],
        language: Optional[str],
        emotion: Optional[str],
        chat_history: Optional[List[Dict[str, str]]],
        stored_room_number: Optional[str],
        age_group: Optional[str],
        gender: Optional[str],
    ) -> Tuple[str, str, str, List[Dict[str, str]]]:
        if rag_context is None:
            try:
                from app.services.rag.chroma import query_rag_context

                rag_context = await query_rag_context(prompt)
            except Exception:
                rag_context = ""

        lang_name, lang_code = resolve_request_language(prompt, language, self.detect_language)
        system_prompt = self._build_system_prompt(
            lang_code=lang_code,
            emotion=emotion,
            stored_room_number=stored_room_number,
            rag_context=rag_context,
            age_group=age_group,
            gender=gender,
        )
        messages = build_openai_messages(system_prompt, prompt, chat_history, sanitize_user=True)
        return lang_name, lang_code, rag_context, messages

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
    ):
        """Async generator streaming tokens across Groq -> Gemini -> Ollama -> Offline fallback."""
        if check_prompt_injection(prompt):
            lang_code = "en-US" if (language and (language == "English" or "en" in str(language).lower())) else "vi-VN"
            yield get_rejection_reply(lang_code)
            return

        fast_hit = None if (rag_context and rag_context.strip()) else self.check_fast_path(prompt, language)
        if fast_hit:
            yield fast_hit[0]
            return

        _, lang_code, rag_context, messages = await self._prepare_chat_context(
            prompt, rag_context, language, emotion, chat_history, stored_room_number, age_group, gender
        )
        provider = (getattr(settings, "LLM_PROVIDER", "") or getattr(settings, "AI_PROVIDER", "") or "groq").lower()

        if provider not in ["gemini", "ollama"] and bool(settings.GROQ_API_KEY):
            has_yielded_groq = False
            try:
                logger.info(f"[AI Stream Tier 1] Đang gọi Groq Cloud Stream (model: {settings.GROQ_MODEL})...")
                async for token in self._call_groq_stream(messages, max_tokens=150):
                    has_yielded_groq = True
                    yield token
                if has_yielded_groq:
                    return
            except Exception as e_groq:
                logger.warning(f"[AI Stream Tier 1] Groq Stream không khả dụng ({e_groq}), tự động fallback sang Gemini Cloud...")
                if has_yielded_groq:
                    return

        from app.services.ai.gemini_service import gemini_service

        if provider != "ollama" and gemini_service.is_configured:
            has_yielded_gemini = False
            try:
                logger.info("[AI Stream Tier 2] Đang gọi Gemini Cloud Stream...")
                async for token in gemini_service.generate_response_stream(
                    prompt=prompt,
                    rag_context=rag_context,
                    language=language,
                    emotion=emotion,
                    chat_history=chat_history,
                    stored_room_number=stored_room_number,
                ):
                    has_yielded_gemini = True
                    yield token
                if has_yielded_gemini:
                    return
            except Exception as e_gemini:
                logger.warning(f"[AI Stream Tier 2] Gemini Stream không khả dụng ({e_gemini}), tự động fallback sang Ollama Local...")
                if has_yielded_gemini:
                    return

        if time.time() >= self._ollama_offline_until:
            try:
                logger.info(f"[AI Stream Tier 3] Đang gọi Ollama Local Stream (model: {self.model})...")
                response_stream = await asyncio.wait_for(
                    self._client.chat(
                        model=self.model,
                        messages=messages,
                        stream=True,
                        options={
                            "temperature": 0.7,
                            "top_p": 0.9,
                            "num_ctx": 1024,
                            "num_predict": 70,
                            "num_thread": 8,
                            "repeat_penalty": 1.1,
                        },
                        keep_alive="30m",
                    ),
                    timeout=1.5,
                )
                async for chunk in response_stream:
                    token = chunk.get("message", {}).get("content", "")
                    if token:
                        yield token
                return
            except Exception as e:
                self._ollama_offline_until = time.time() + 60.0
                logger.warning(f"[AI Stream Tier 3] Ollama offline ({e}), kích hoạt Smart Offline Knowledge Fallback...")
        yield self.generate_offline_fallback_response(
            prompt=prompt,
            lang_code=lang_code,
            rag_context=rag_context,
            stored_room_number=stored_room_number,
        )

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
        """Generate a synchronous reply across Groq -> Gemini -> Ollama -> Offline fallback."""
        if check_prompt_injection(prompt):
            lang_code = "en-US" if (language and (language == "English" or "en" in str(language).lower())) else "vi-VN"
            lang_name = "English" if lang_code == "en-US" else "Tiếng Việt"
            return get_rejection_reply(lang_code), lang_name, lang_code

        fast_hit = None if (rag_context and rag_context.strip()) else self.check_fast_path(prompt, language)
        if fast_hit:
            return fast_hit

        lang_name, lang_code, rag_context, messages = await self._prepare_chat_context(
            prompt, rag_context, language, emotion, chat_history, stored_room_number, age_group, gender
        )
        provider = (getattr(settings, "LLM_PROVIDER", "") or getattr(settings, "AI_PROVIDER", "") or "groq").lower()

        if provider not in ["gemini", "ollama"] and bool(settings.GROQ_API_KEY):
            try:
                logger.info(f"[AI Tier 1] Gửi Groq Cloud (model: {settings.GROQ_MODEL})...")
                groq_reply = await self._call_groq(messages, json_mode=False, max_tokens=80)
                if groq_reply and groq_reply.strip():
                    reply = self.format_and_clean_reply(groq_reply.strip(), lang_code)
                    final_lang_name, final_lang_code = resolve_reply_language(reply, lang_code, self.detect_language)
                    logger.info("[AI Tier 1] Thành công từ Groq Cloud!")
                    return reply, final_lang_name, final_lang_code
                logger.warning("[AI Tier 1] Groq Cloud phản hồi rỗng, tự động fallback sang Gemini Cloud...")
            except Exception as e_groq:
                logger.warning(f"[AI Tier 1] Groq Cloud không khả dụng ({e_groq}), tự động fallback sang Gemini Cloud...")

        from app.services.ai.gemini_service import gemini_service

        if provider != "ollama" and gemini_service.is_configured:
            try:
                logger.info("[AI Tier 2] Gửi Gemini Cloud (Fallback từ Groq)...")
                gemini_res = await gemini_service.generate_response(
                    prompt=prompt,
                    rag_context=rag_context,
                    language=language,
                    emotion=emotion,
                    chat_history=chat_history,
                    stored_room_number=stored_room_number,
                )
                if gemini_res and gemini_res[0]:
                    logger.info("[AI Tier 2] Thành công từ Gemini Cloud!")
                    return gemini_res
            except Exception as e_gemini:
                logger.warning(f"[AI Tier 2] Gemini Cloud không khả dụng ({e_gemini}), tự động fallback sang Ollama Local...")

        if time.time() >= self._ollama_offline_until:
            try:
                logger.info(f"[AI Tier 3] Gửi Ollama Local (model: {self.model})...")
                response = await asyncio.wait_for(
                    self._client.chat(
                        model=self.model,
                        messages=messages,
                        options={
                            "temperature": 0.7,
                            "top_p": 0.9,
                            "num_ctx": 1024,
                            "num_predict": 45,
                            "num_thread": 8,
                            "repeat_penalty": 1.1,
                        },
                        keep_alive="30m",
                    ),
                    timeout=1.5,
                )
                reply = self.format_and_clean_reply(response["message"]["content"].strip(), lang_code)
                final_lang_name, final_lang_code = resolve_reply_language(reply, lang_code, self.detect_language)
                logger.info("[AI Tier 3] Thành công từ Ollama Local!")
                return reply, final_lang_name, final_lang_code
            except Exception as e_ollama:
                self._ollama_offline_until = time.time() + 60.0
                logger.warning(f"[AI Tier 3] Ollama Local offline ({e_ollama}), kích hoạt Smart Offline Knowledge Fallback...")

        fallback = self.generate_offline_fallback_response(
            prompt=prompt,
            lang_code=lang_code,
            rag_context=rag_context,
            stored_room_number=stored_room_number,
        )
        return fallback, lang_name, lang_code

    def generate_offline_fallback_response(
        self,
        prompt: str,
        lang_code: str = "vi-VN",
        rag_context: Optional[str] = None,
        stored_room_number: Optional[str] = None,
    ) -> str:
        return _offline_fallback(prompt, lang_code=lang_code, rag_context=rag_context)

    async def extract_intent(self, user_speech: str) -> Dict[str, Any]:
        """Extract service action, room number, and items JSON via cascading LLM + keyword fallback."""
        lower_speech = user_speech.lower().strip()
        match_room = re.search(r"(?:phòng|room|p\.)\s*([0-9]{3,4})", lower_speech)
        extracted_room_regex = match_room.group(1) if match_room else None
        clean_items = re.sub(r"(?:phòng|room|p\.)\s*[0-9]{3,4}", "", user_speech, flags=re.IGNORECASE).strip()

        intent_prompt = (
            "Bạn là bộ định tuyến AI của khách sạn Aurora Grand.\n"
            f'Hãy phân tích yêu cầu của khách: "{user_speech}"\n'
            "Và trích xuất ra JSON duy nhất theo schema:\n"
            "{\n"
            '  "action": "housekeeping" | "maintenance" | "bellman" | "room_service" | "provide_room_number" | "unknown",\n'
            f'  "room_number": "{extracted_room_regex if extracted_room_regex else ""}",\n'
            '  "items": "mô tả đồ vật hoặc yêu cầu"\n'
            "}\n"
            "Chỉ trả về JSON thuần túy, không có giải thích, không markdown backticks."
        )
        intent_messages = [
            {"role": "system", "content": "You are an AI intent classifier. Output strictly valid JSON."},
            {"role": "user", "content": intent_prompt},
        ]
        provider = (getattr(settings, "LLM_PROVIDER", "") or getattr(settings, "AI_PROVIDER", "") or "groq").lower()

        if provider not in ["gemini", "ollama"] and bool(settings.GROQ_API_KEY):
            try:
                groq_content = await self._call_groq(intent_messages, json_mode=True, max_tokens=60)
                if groq_content:
                    parsed_json = json.loads(groq_content.strip())
                    if extracted_room_regex and not parsed_json.get("room_number"):
                        parsed_json["room_number"] = extracted_room_regex
                    logger.info(f"[Intent Router Tier 1] Groq phân tích thành công: action={parsed_json.get('action')}")
                    return parsed_json
            except Exception as e_groq:
                logger.warning(f"[Intent Router Tier 1] Groq lỗi ({e_groq}), tự động fallback sang Gemini Cloud...")

        from app.services.ai.gemini_service import gemini_service

        if provider != "ollama" and gemini_service.is_configured:
            try:
                parsed_gemini = await gemini_service.extract_intent(user_speech=user_speech)
                if parsed_gemini and parsed_gemini.get("action") not in ["unknown", None]:
                    logger.info(f"[Intent Router Tier 2] Gemini phân tích thành công: action={parsed_gemini.get('action')}")
                    return parsed_gemini
            except Exception as e_gemini:
                logger.warning(f"[Intent Router Tier 2] Gemini lỗi ({e_gemini}), tự động fallback sang Ollama Local...")

        try:
            response = await asyncio.wait_for(
                self._client.chat(
                    model=self.model,
                    messages=intent_messages,
                    format="json",
                    options={"temperature": 0.0, "num_predict": 35, "num_ctx": 512, "num_thread": 8},
                    keep_alive=-1,
                ),
                timeout=15.0,
            )
            parsed_json = json.loads(response["message"]["content"].strip())
            if extracted_room_regex and not parsed_json.get("room_number"):
                parsed_json["room_number"] = extracted_room_regex
            logger.info(f"[Intent Router Tier 3] Ollama phân tích thành công: action={parsed_json.get('action')}")
            return parsed_json
        except Exception as e_ollama:
            err_msg = repr(e_ollama) if not str(e_ollama) else str(e_ollama)
            logger.warning(f"[Intent Router Tier 3] Ollama Local offline ({err_msg}), fallback sang Heuristic Keyword...")

        fallback_action = next(
            (act for act, kws in SERVICE_KEYWORDS.items() if any(k in lower_speech for k in kws)),
            "unknown",
        )
        if fallback_action == "unknown" and extracted_room_regex:
            fallback_action = "provide_room_number"
        return {
            "action": fallback_action,
            "room_number": extracted_room_regex,
            "items": clean_items or user_speech,
        }

    async def get_embedding(self, text: str) -> List[float]:
        """Generate embedding vector via Ollama for ChromaDB."""
        try:
            response = await self._client.embeddings(model=self.embed_model or "bge-m3", prompt=text)
            return response["embedding"]
        except Exception as e:
            logger.error(f"[OllamaService Error] Lỗi tạo vector embedding: {e}")
            raise RuntimeError(f"Lỗi khi tạo embedding qua Ollama ({self.embed_model}): {e}")


ollama_service = OllamaService()
