from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    session_id: Optional[str] = Field("default_session", description="ID phiên làm việc để duy trì bộ nhớ hội thoại")
    prompt: str = Field(..., description="Câu hỏi hoặc lệnh thoại từ khách hàng/robot", json_schema_extra={"example": "Tôi muốn gọi dịch vụ dọn phòng"})
    rag_context: Optional[str] = Field(None, description="Ngữ cảnh truy vấn từ ChromaDB RAG", json_schema_extra={"example": "Khách sạn cung cấp dịch vụ dọn phòng từ 8h đến 22h."})
    language: Optional[str] = Field("Tiếng Việt", description="Ngôn ngữ phản hồi yêu cầu: Tiếng Việt hoặc English", json_schema_extra={"example": "English"})
    emotion: Optional[str] = Field("neutral", description="Trạng thái cảm xúc của khách hàng", json_schema_extra={"example": "neutral"})
    room_number: Optional[str] = Field(None, description="Số phòng khai báo nếu có")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Câu trả lời của AI Concierge phát lại cho khách hàng")
    model_used: str = Field(..., description="Model Ollama được sử dụng")
    detected_language: Optional[str] = Field("Tiếng Việt", description="Ngôn ngữ được nhận dạng tự động từ câu nói của khách")
    lang_code: Optional[str] = Field("vi-VN", description="Mã IETF language tag cho TTS (vi-VN, en-US, zh-CN, ja-JP)")
    session_id: Optional[str] = Field("default_session", description="ID phiên làm việc")
    current_room_number: Optional[str] = Field(None, description="Số phòng đang được ghi nhớ trong session")
    missing_room_number: bool = Field(False, description="True nếu đang cần hỏi thêm số phòng từ khách")


class IntentRequest(BaseModel):
    session_id: Optional[str] = Field("default_session", description="ID phiên làm việc")
    user_speech: str = Field(..., description="Văn bản nhận dạng từ giọng nói khách hàng", json_schema_extra={"example": "Phòng 302 cần lấy thêm 2 cái khăn tắm"})
    room_number: Optional[str] = Field(None, description="Số phòng nếu truyền trực tiếp")


class IntentResponse(BaseModel):
    action: str = Field(..., description="Tên dịch vụ: housekeeping, room_service, bellman, maintenance, restaurant, faq, ask_room_number, unknown")
    room_number: Optional[str] = Field(None, description="Số phòng bóc tách hoặc lấy từ bộ nhớ session")
    items: Optional[str] = Field(None, description="Chi tiết các món đồ yêu cầu")
    missing_room_number: bool = Field(False, description="True nếu yêu cầu dịch vụ nhưng chưa rõ số phòng")
    suggested_reply: Optional[str] = Field(None, description="Câu nói đề xuất Robot phát lại để hỏi số phòng")
    session_id: Optional[str] = Field("default_session", description="ID phiên làm việc")
    raw_output: Dict[str, Any] = Field(..., description="Dữ liệu JSON thô bóc tách từ LLM")


class SessionResetRequest(BaseModel):
    session_id: str = Field("default_session", description="ID phiên cần xóa bộ nhớ")


class TTSRequest(BaseModel):
    text: str = Field(..., description="Văn bản cần chuyển thành giọng nói", json_schema_extra={"example": "Xin chào quý khách, tôi có thể giúp gì?"})
    provider: Optional[str] = Field("edge", description="Provider TTS: edge, elevenlabs, openai, browser")
    voice: Optional[str] = Field(None, description="Tên giọng đọc cụ thể (VD: vi-VN-HoaiMyNeural)")
    language: Optional[str] = Field("vi-VN", description="Mã ngôn ngữ: vi-VN, en-US")


class TTSResponse(BaseModel):
    audio_base64: str = Field(..., description="Dữ liệu âm thanh MP3 mã hóa Base64")
    mime_type: str = Field("audio/mp3", description="MIME type của âm thanh")
    provider_used: str = Field("edge", description="Provider TTS đã được sử dụng thực tế (edge, elevenlabs, openai, browser)")

