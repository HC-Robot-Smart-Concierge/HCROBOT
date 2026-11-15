"""Groq cloud client, offline RAG fallback, intent extraction, and embedding helpers for OllamaService."""

import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.services.ai.scenario_service import scenario_service

logger = logging.getLogger(__name__)


class OllamaGroqAndIntentMixin:
    """Groq cloud fallback, offline fallback response, intent extraction, and embeddings."""

    async def _call_groq(self, messages: List[Dict[str, str]], json_mode: bool = False, max_tokens: int = 150) -> Optional[str]:
        """
        Gọi Groq Cloud API qua HTTP POST (OpenAI format).
        Ưu tiên hàng đầu (Tier 1), phản hồi siêu tốc (< 500ms).
        """
        if not settings.GROQ_API_KEY:
            return None
        import httpx
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.0.1",
        }
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
                    logger.warning("[Groq 429 Rate Limit] Token bucket full, waiting 0.8s for fast auto-recovery...")
                    await asyncio.sleep(0.8)
                    res_retry = await client.post(url, headers=headers, json=payload)
                    if res_retry.status_code == 200:
                        return res_retry.json()["choices"][0]["message"]["content"]
                    else:
                        logger.warning(f"[Groq Retry Failed] status={res_retry.status_code}")
                        return None
                else:
                    logger.warning(f"[Groq API Warning] status={res.status_code}: {res.text[:120]}")
                    return None
        except Exception as e:
            logger.warning(f"[Groq API Error]: {str(e)}")
            return None

    async def _call_groq_stream(self, messages: List[Dict[str, str]], max_tokens: int = 150):
        """Streaming token từ Groq Cloud API theo chuẩn Server-Sent Events (SSE)."""
        if not settings.GROQ_API_KEY:
            return
        import httpx
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "User-Agent": "curl/8.0.1",
        }
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
                        logger.warning(f"[Groq Stream Warning] status={response.status_code}: {err_text[:120].decode('utf-8', errors='ignore')}")
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
            logger.warning(f"[Groq Stream Error]: {str(e)}")
            raise

    def generate_offline_fallback_response(
        self,
        prompt: str,
        lang_code: str = "vi-VN",
        rag_context: Optional[str] = None,
        stored_room_number: Optional[str] = None,
    ) -> str:
        """
        Tự động phản hồi thông minh từ factsheet khách sạn Aurora khi Ollama local chưa khởi động.
        Đảm bảo zero-crash, zero-downtime cho bất kỳ ai clone dự án về mà chưa cài Ollama.
        """
        is_en = lang_code == "en-US"

        if rag_context and len(rag_context.strip()) > 20:
            clean_ctx = re.sub(r'[*#_`]', '', rag_context).strip()
            sentences = [s.strip() for s in clean_ctx.split('.') if len(s.strip()) > 15]
            if sentences:
                return f"Dạ theo thông tin khách sạn: {sentences[0]} ạ." if not is_en else f"According to hotel info: {sentences[0]}."

        fast_hit = scenario_service.match_fast_path(prompt, lang_code)
        if fast_hit:
            return fast_hit[0]

        try:
            from app.services.rag.chroma import get_concierge_collection
            col = get_concierge_collection("concierge_kb")
            res = col.query(query_texts=[prompt], n_results=1)
            if res and res.get("documents") and len(res["documents"]) > 0:
                docs = res["documents"][0]
                if docs and len(docs[0].strip()) > 15:
                    clean_ctx = re.sub(r'[*#_`]', '', docs[0].strip()).strip()
                    sentences = [s.strip() for s in clean_ctx.split('.') if len(s.strip()) > 15]
                    if sentences:
                        return f"Dạ theo thông tin khách sạn: {sentences[0]} ạ." if not is_en else f"According to hotel info: {sentences[0]}."
        except Exception as e_rag:
            logger.debug(f"[Offline RAG Query Error]: {e_rag}")

        return (
            "I have noted your request. Please contact the Front Desk at Level 1 or dial 0 from your room phone for immediate assistance!"
            if is_en else
            "Dạ Rora xin ghi nhận câu hỏi của quý khách. Quý khách vui lòng liên hệ Quầy Lễ tân sảnh tầng 1 hoặc gọi phím 0 từ điện thoại phòng để được hỗ trợ chu đáo nhất nhé ạ!"
        )

    async def extract_intent(self, user_speech: str) -> Dict[str, Any]:
        """
        Phân tích câu nói của khách để bóc tách ý định (action), số phòng (room_number), và yêu cầu/món đồ (items).
        Cascading Fallback: Groq Cloud -> Gemini Cloud -> Ollama Local -> Heuristic Keywords.
        """
        lower_speech = user_speech.lower().strip()
        extracted_room_regex = None
        match_room = re.search(r'(?:phòng|room|p\.)\s*([0-9]{3,4})', lower_speech)
        if match_room:
            extracted_room_regex = match_room.group(1)

        clean_items = re.sub(r'(?:phòng|room|p\.)\s*[0-9]{3,4}', '', user_speech, flags=re.IGNORECASE).strip()

        from app.services.ai.constants import SERVICE_KEYWORDS

        intent_prompt = f"""Bạn là bộ định tuyến AI của khách sạn Aurora Grand.
Hãy phân tích yêu cầu của khách: "{user_speech}"
Và trích xuất ra JSON duy nhất theo schema:
{{
  "action": "housekeeping" | "maintenance" | "bellman" | "room_service" | "provide_room_number" | "unknown",
  "room_number": "{extracted_room_regex if extracted_room_regex else ''}",
  "items": "mô tả đồ vật hoặc yêu cầu"
}}
Chỉ trả về JSON thuần túy, không có giải thích, không markdown backticks."""

        intent_messages = [
            {"role": "system", "content": "You are an AI intent classifier. Output strictly valid JSON."},
            {"role": "user", "content": intent_prompt}
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
                    options={
                        "temperature": 0.0,
                        "num_predict": 35,
                        "num_ctx": 512,
                        "num_thread": 8,
                    },
                    keep_alive=-1
                ),
                timeout=15.0
            )
            content = response["message"]["content"].strip()
            parsed_json = json.loads(content)

            if extracted_room_regex and not parsed_json.get("room_number"):
                parsed_json["room_number"] = extracted_room_regex

            logger.info(f"[Intent Router Tier 3] Ollama phân tích thành công: action={parsed_json.get('action')}")
            return parsed_json
        except Exception as e_ollama:
            err_msg = repr(e_ollama) if not str(e_ollama) else str(e_ollama)
            logger.warning(f"[Intent Router Tier 3] Ollama Local offline ({err_msg}), fallback sang Heuristic Keyword...")

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
            "items": clean_items or user_speech,
        }

    async def get_embedding(self, text: str) -> List[float]:
        """Tạo Vector Embedding từ đoạn văn bản để lưu/tìm kiếm trong ChromaDB Vector Store."""
        try:
            response = await self._client.embeddings(
                model=self.embed_model or 'bge-m3',
                prompt=text
            )
            return response["embedding"]
        except Exception as e:
            logger.error(f"[OllamaService Error] Lỗi tạo vector embedding: {str(e)}")
            raise RuntimeError(f"Lỗi khi tạo embedding qua Ollama ({self.embed_model}): {str(e)}")
