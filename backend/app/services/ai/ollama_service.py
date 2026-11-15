import asyncio
import logging
import re
from typing import Dict, List, Optional, Tuple

import ollama

from app.core.config import settings
from app.services.ai.ollama_groq_and_intent_mixin import OllamaGroqAndIntentMixin
from app.services.ai.ollama_prompt_fastpath_mixin import OllamaPromptFastpathMixin
from app.services.ai.prompt_guard import (
    check_prompt_injection,
    format_safe_user_prompt,
    get_rejection_reply,
)

logger = logging.getLogger(__name__)


class OllamaService(OllamaPromptFastpathMixin, OllamaGroqAndIntentMixin):
    def __init__(self):
        self.host = settings.OLLAMA_HOST
        self.model = settings.OLLAMA_MODEL
        self.embed_model = getattr(settings, "OLLAMA_EMBED_MODEL", None)
        self._client = ollama.AsyncClient(host=self.host)

    async def generate_response_stream(
        self,
        prompt: str,
        rag_context: Optional[str] = None,
        language: Optional[str] = None,
        emotion: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        stored_room_number: Optional[str] = None,
    ):
        """
        Async Generator sinh token theo thời gian thực từ Qwen/Groq/Gemini/Ollama (stream=True).
        Cơ chế Cascading 3 Tầng: Groq Cloud -> Google Gemini Cloud -> Ollama Local -> Offline Factsheet.
        """
        # 0.0. Kiem tra an toan bao mat: Chan Prompt Injection tuc thi (< 0.05ms)
        if check_prompt_injection(prompt):
            lang_code = "en-US" if (language and (language == "English" or "en" in str(language).lower())) else "vi-VN"
            yield get_rejection_reply(lang_code)
            return

        # 0. Kiểm tra Mega Fast-Path tức thì (< 1ms), bỏ qua nếu caller truyền sẵn rag_context từ Knowledge Base
        fast_hit = None if (rag_context and rag_context.strip()) else self.check_fast_path(prompt, language)
        if fast_hit:
            reply, _, _ = fast_hit
            yield reply
            return

        # Tự động truy vấn tri thức RAG từ ChromaDB nếu chưa có sẵn
        if not rag_context:
            try:
                from app.services.rag.chroma import query_rag_context
                rag_context = await query_rag_context(prompt)
            except Exception:
                rag_context = ""

        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if (language.lower().startswith("en") or "english" in language.lower()) else "vi-VN"

        system_prompt = self._build_system_prompt(
            lang_code=lang_code,
            emotion=emotion,
            stored_room_number=stored_room_number,
            rag_context=rag_context,
        )

        messages = [{"role": "system", "content": system_prompt}]
        if chat_history:
            for turn in chat_history:
                if turn.get("role") in ["user", "assistant"] and turn.get("content"):
                    messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": format_safe_user_prompt(prompt)})

        provider = (getattr(settings, "LLM_PROVIDER", "") or getattr(settings, "AI_PROVIDER", "") or "groq").lower()

        # =========================================================================
        # 1. TIER 1 (Ưu tiên 1): Groq Cloud Streaming siêu tốc (< 200ms TTFT)
        # =========================================================================
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

        # =========================================================================
        # 2. TIER 2 (Ưu tiên 2): Google Gemini Cloud Streaming (Fallback từ Groq)
        # =========================================================================
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

        # =========================================================================
        # 3. TIER 3 (Ưu tiên 3): Ollama Local Streaming (Hoạt động 100% Offline)
        # =========================================================================
        try:
            logger.info(f"[AI Stream Tier 3] Đang gọi Ollama Local Stream (model: {self.model})...")
            response_stream = await self._client.chat(
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
                keep_alive="30m"
            )

            async for chunk in response_stream:
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield token
            return
        except Exception as e:
            logger.warning(f"[AI Stream Tier 3] Ollama offline ({e}), kích hoạt Smart Offline Knowledge Fallback...")
            fallback = self.generate_offline_fallback_response(
                prompt=prompt,
                lang_code=lang_code,
                rag_context=rag_context,
                stored_room_number=stored_room_number,
            )
            yield fallback

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
        Sinh câu trả lời thoại cho Concierge Robot dựa trên câu hỏi của khách và lịch sử phiên.
        Cơ chế Cascading 3 Tầng: Groq Cloud -> Google Gemini Cloud -> Ollama Local -> Offline Factsheet.
        """
        # 0.0. Kiem tra an toan bao mat: Chan Prompt Injection tuc thi (< 0.05ms)
        if check_prompt_injection(prompt):
            lang_code = "en-US" if (language and (language == "English" or "en" in str(language).lower())) else "vi-VN"
            lang_name = "English" if lang_code == "en-US" else "Tiếng Việt"
            return get_rejection_reply(lang_code), lang_name, lang_code

        # 0. Kiểm tra Fast-Path trước (< 1ms), bỏ qua nếu caller truyền sẵn rag_context từ Knowledge Base
        fast_hit = None if (rag_context and rag_context.strip()) else self.check_fast_path(prompt, language)
        if fast_hit:
            return fast_hit

        # Tự động truy vấn tri thức RAG từ ChromaDB nếu chưa có sẵn
        if not rag_context:
            try:
                from app.services.rag.chroma import query_rag_context
                rag_context = await query_rag_context(prompt)
            except Exception:
                rag_context = ""

        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if (language.lower().startswith("en") or "english" in language.lower()) else "vi-VN"

        system_prompt = self._build_system_prompt(
            lang_code=lang_code,
            emotion=emotion,
            stored_room_number=stored_room_number,
            rag_context=rag_context,
        )

        messages = [{"role": "system", "content": system_prompt}]
        if chat_history:
            for turn in chat_history:
                if turn.get("role") in ["user", "assistant"] and turn.get("content"):
                    messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": format_safe_user_prompt(prompt)})

        provider = (getattr(settings, "LLM_PROVIDER", "") or getattr(settings, "AI_PROVIDER", "") or "groq").lower()

        # =========================================================================
        # 1. TIER 1 (Ưu tiên 1): Groq Cloud (< 300ms)
        # =========================================================================
        if provider not in ["gemini", "ollama"] and bool(settings.GROQ_API_KEY):
            try:
                logger.info(f"[AI Tier 1] Gửi Groq Cloud (model: {settings.GROQ_MODEL})...")
                groq_reply = await self._call_groq(messages, json_mode=False, max_tokens=80)
                if groq_reply and groq_reply.strip():
                    reply = self.format_and_clean_reply(groq_reply.strip(), lang_code)
                    if lang_code == "en-US" and not re.search(r"[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", reply, re.IGNORECASE):
                        final_lang_name, final_lang_code = "English", "en-US"
                    else:
                        final_lang_name, final_lang_code = self.detect_language(reply)
                    logger.info("[AI Tier 1] Thành công từ Groq Cloud!")
                    return reply, final_lang_name, final_lang_code
                else:
                    logger.warning("[AI Tier 1] Groq Cloud phản hồi rỗng, tự động fallback sang Gemini Cloud...")
            except Exception as e_groq:
                logger.warning(f"[AI Tier 1] Groq Cloud không khả dụng ({e_groq}), tự động fallback sang Gemini Cloud...")

        # =========================================================================
        # 2. TIER 2 (Ưu tiên 2): Google Gemini Cloud (Fallback từ Groq)
        # =========================================================================
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

        # =========================================================================
        # 3. TIER 3 (Ưu tiên 3): Ollama Local (Hoạt động 100% Offline)
        # =========================================================================
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
                    keep_alive="30m"
                ),
                timeout=4.0
            )

            raw_reply = response["message"]["content"].strip()
            reply = self.format_and_clean_reply(raw_reply, lang_code)

            if lang_code == "en-US" and not re.search(r"[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", reply, re.IGNORECASE):
                final_lang_name, final_lang_code = "English", "en-US"
            else:
                final_lang_name, final_lang_code = self.detect_language(reply)
            logger.info("[AI Tier 3] Thành công từ Ollama Local!")
            return reply, final_lang_name, final_lang_code
        except Exception as e_ollama:
            logger.warning(f"[AI Tier 3] Ollama Local offline ({e_ollama}), kích hoạt Smart Offline Knowledge Fallback...")

        # =========================================================================
        # 4. TIER 4: Smart Offline Knowledge Fallback khi toàn bộ AI models gián đoạn
        # =========================================================================
        fallback = self.generate_offline_fallback_response(
            prompt=prompt,
            lang_code=lang_code,
            rag_context=rag_context,
            stored_room_number=stored_room_number,
        )
        return fallback, lang_name, lang_code


# Singleton Instance
ollama_service = OllamaService()
