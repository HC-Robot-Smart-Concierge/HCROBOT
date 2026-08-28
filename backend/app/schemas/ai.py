from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    prompt: str = Field(..., description="Câu hỏi hoặc lệnh thoại từ khách hàng/robot", json_schema_extra={"example": "Tôi muốn gọi dịch vụ dọn phòng"})
    rag_context: Optional[str] = Field(None, description="Ngữ cảnh truy vấn từ ChromaDB RAG", json_schema_extra={"example": "Khách sạn cung cấp dịch vụ dọn phòng từ 8h đến 22h."})
    language: Optional[str] = Field("Tiếng Việt", description="Ngôn ngữ phản hồi yêu cầu: Tiếng Việt hoặc English", json_schema_extra={"example": "English"})
    emotion: Optional[str] = Field("neutral", description="Trạng thái cảm xúc của khách hàng", json_schema_extra={"example": "neutral"})






class ChatResponse(BaseModel):
    response: str = Field(..., description="Câu trả lời của AI Concierge phát lại cho khách hàng")
    model_used: str = Field(..., description="Model Ollama được sử dụng")
    detected_language: Optional[str] = Field("Tiếng Việt", description="Ngôn ngữ được nhận dạng tự động từ câu nói của khách")
    lang_code: Optional[str] = Field("vi-VN", description="Mã IETF language tag cho TTS (vi-VN, en-US, zh-CN, ja-JP)")



class IntentRequest(BaseModel):
    user_speech: str = Field(..., description="Văn bản nhận dạng từ giọng nói khách hàng", json_schema_extra={"example": "Phòng 302 cần lấy thêm 2 cái khăn tắm"})


class IntentResponse(BaseModel):
    action: str = Field(..., description="Tên dịch vụ: housekeeping, room_service, taxi, faq, unknown", json_schema_extra={"example": "housekeeping"})
    room_number: Optional[str] = Field(None, description="Số phòng bóc tách được", json_schema_extra={"example": "302"})
    items: Optional[str] = Field(None, description="Chi tiết các món đồ yêu cầu", json_schema_extra={"example": "2 cái khăn tắm"})
    raw_output: Dict[str, Any] = Field(..., description="Dữ liệu JSON thô bóc tách từ LLM")
