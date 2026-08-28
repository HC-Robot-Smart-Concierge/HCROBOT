import logging
from fastapi import APIRouter, HTTPException, status
from app.schemas.ai import ChatRequest, ChatResponse, IntentRequest, IntentResponse
from app.services.ai.ollama_service import ollama_service
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()



import asyncio

@router.post("/chat", response_model=ChatResponse, summary="Sinh câu trả lời hội thoại cho Concierge Robot")
async def chat_with_robot(request: ChatRequest):
    """
    Endpoint nhận prompt từ Robot/User (kèm ngữ cảnh RAG nếu có) và sinh câu trả lời bằng Ollama LLM.
    """
    try:
        rag_ctx = request.rag_context
        
        # Nếu chưa truyền RAG context -> Tự động tìm kiếm tài liệu liên quan trong ChromaDB
        if not rag_ctx:
            try:
                from app.db.chroma import get_concierge_collection
                collection = get_concierge_collection("concierge_kb")
                results = await asyncio.to_thread(
                    collection.query,
                    query_texts=[request.prompt],
                    n_results=3
                )
                if results and results.get("documents") and results["documents"][0]:
                    rag_ctx = "\n---\n".join(results["documents"][0])
            except Exception as ex:
                logger.warning(f"Không thể truy vấn RAG context từ ChromaDB: {ex}")


        reply, detected_lang, lang_code = await ollama_service.generate_response(
            prompt=request.prompt,
            rag_context=rag_ctx,
            language=request.language or "auto",
            emotion=request.emotion or "neutral"
        )


        return ChatResponse(
            response=reply,
            model_used=settings.OLLAMA_MODEL,
            detected_language=detected_lang,
            lang_code=lang_code
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )



@router.post("/intent", response_model=IntentResponse, summary="Phân tích ý định & bóc tách JSON yêu cầu dịch vụ")
async def extract_service_intent(request: IntentRequest):
    """
    Endpoint nhận văn bản nhận dạng từ giọng nói (STT) và bóc tách thông tin yêu cầu dịch vụ.
    """
    try:
        intent_data = await ollama_service.extract_intent(user_speech=request.user_speech)
        
        action = intent_data.get("action", "unknown")
        room_number = intent_data.get("room_number")
        items = intent_data.get("items")

        return IntentResponse(
            action=action,
            room_number=room_number,
            items=items,
            raw_output=intent_data
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
