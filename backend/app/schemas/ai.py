from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


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
    trigger_video_call: Optional[bool] = Field(False, description="True nếu nhận diện được yêu cầu kết nối Live Call với nhân viên")
    support_session_id: Optional[str] = Field(None, description="Mã phiên HumanSupportSession tạo cho cuộc gọi")
    ticket_code: Optional[str] = Field(None, description="Mã ticket CCG được tạo cho cuộc gọi")
    audio_base64: Optional[str] = Field(None, description="Âm thanh giọng đọc phát tức thì từ backend cache")
    destination_key: Optional[str] = Field(None, description="Mã POI điều hướng bản đồ (VD: infinity_pool, restaurant, rooftop_coffee) nếu là câu hỏi chỉ đường/vị trí")
    require_room_pin: Optional[bool] = Field(False, description="True nếu yêu cầu khách nhập mã PIN phòng trên màn hình cảm ứng để xác thực")
    target_room_number: Optional[str] = Field(None, description="Số phòng mục tiêu cần nhập PIN")
    pending_service_action: Optional[str] = Field(None, description="Hành động dịch vụ đang chờ xác thực: room_service, housekeeping...")
    pending_service_items: Optional[str] = Field(None, description="Chi tiết các món đồ đang chờ xác thực")


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
    rate: Optional[str] = Field("+0%", description="Tốc độ nói (VD: +0%, -10%, +10%)")


class TTSResponse(BaseModel):
    audio_base64: str = Field(..., description="Dữ liệu âm thanh MP3 mã hóa Base64")
    mime_type: str = Field("audio/mp3", description="MIME type của âm thanh")
    provider_used: str = Field("edge", description="Provider TTS đã được sử dụng thực tế (edge, elevenlabs, openai, browser)")


class VoiceSettingsRequest(BaseModel):
    speech_rate: float = Field(1.0, ge=0.5, le=2.0, description="Tốc độ nói từ 0.5x đến 2.0x")
    vi_voice: Optional[str] = Field("vi-VN-HoaiMyNeural", description="Giọng đọc tiếng Việt (VD: vi-VN-HoaiMyNeural, vi-VN-NamMinhNeural)")
    en_voice: Optional[str] = Field("en-US-JennyNeural", description="Giọng đọc tiếng Anh")


class VoiceSettingsResponse(BaseModel):
    speech_rate: float = Field(1.0, description="Tốc độ nói float (0.5 - 2.0)")
    rate_percentage: str = Field("+0%", description="Tốc độ theo định dạng % của EdgeTTS")
    vi_voice: str = Field("vi-VN-HoaiMyNeural", description="Giọng tiếng Việt đang dùng")
    en_voice: str = Field("en-US-JennyNeural", description="Giọng tiếng Anh đang dùng")


class FeedbackCreate(BaseModel):
    chat_session_id: Optional[str] = None
    rating: int = Field(5, ge=1, le=5, description="Số sao đánh giá từ 1 đến 5")
    category: str = Field("Service", description="Danh mục: Service, Robot, Cleanliness, F&B")
    comment: Optional[str] = None
    guest_name: Optional[str] = None
    room_number: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: str
    chat_session_id: Optional[str] = None
    rating: int
    category: str
    comment: Optional[str] = None
    guest_name: Optional[str] = None
    room_number: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

