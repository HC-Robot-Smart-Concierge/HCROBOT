from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatRequest(BaseModel):
    session_id: Optional[str] = Field("default_session", description="ID phiên làm việc để duy trì bộ nhớ hội thoại")
    prompt: str = Field(..., description="Câu hỏi hoặc lệnh thoại từ khách hàng/robot", json_schema_extra={"example": "Tôi muốn gọi dịch vụ dọn phòng"})
    rag_context: Optional[str] = Field(None, description="Ngữ cảnh truy vấn từ ChromaDB RAG", json_schema_extra={"example": "Khách sạn cung cấp dịch vụ dọn phòng từ 8h đến 22h."})
    language: Optional[str] = Field("auto", description="Response language: auto (VI/EN), Tiếng Việt or English", json_schema_extra={"example": "English"})
    preferred_language: Optional[str] = Field(None, description="Current conversation language for short or balanced mixed replies")
    emotion: Optional[str] = Field("neutral", description="Trạng thái cảm xúc của khách hàng", json_schema_extra={"example": "neutral"})
    room_number: Optional[str] = Field(None, description="Số phòng khai báo nếu có")
    age_group: Optional[str] = Field("adult", description="Độ tuổi ước tính của khách: child, teen, young_adult, middle_aged, senior")
    gender: Optional[str] = Field("unknown", description="Giới tính ước tính của khách: male, female, unknown")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Câu trả lời của AI Concierge phát lại cho khách hàng")
    model_used: str = Field(..., description="Model Ollama được sử dụng")
    detected_language: Optional[str] = Field(default="Tiếng Việt", description="Ngôn ngữ được nhận dạng tự động từ câu nói của khách")
    lang_code: Optional[str] = Field(default="vi-VN", description="Mã IETF language tag cho TTS (vi-VN, en-US, zh-CN, ja-JP)")
    session_id: Optional[str] = Field(default="default_session", description="ID phiên làm việc")
    current_room_number: Optional[str] = Field(default=None, description="Số phòng đang được ghi nhớ trong session")
    missing_room_number: bool = Field(default=False, description="True nếu đang cần hỏi thêm số phòng từ khách")
    trigger_video_call: Optional[bool] = Field(default=False, description="True nếu nhận diện được yêu cầu kết nối Live Call với nhân viên")
    support_session_id: Optional[str] = Field(default=None, description="Mã phiên HumanSupportSession tạo cho cuộc gọi")
    ticket_code: Optional[str] = Field(default=None, description="Mã ticket CCG được tạo cho cuộc gọi")
    ticket_created: Optional[bool] = Field(default=False, description="True nếu đã tạo ticket tự động")
    speech_audio: Optional[Dict[str, Any]] = None
    audio_base64: Optional[str] = Field(default=None, description="Âm thanh giọng đọc phát tức thì từ backend cache")
    mime_type: Optional[str] = Field(default="audio/mp3", description="MIME type của âm thanh")
    destination_key: Optional[str] = Field(default=None, description="Mã POI điều hướng bản đồ (VD: infinity_pool, restaurant, rooftop_coffee) nếu là câu hỏi chỉ đường/vị trí")
    require_room_pin: Optional[bool] = Field(default=False, description="True nếu yêu cầu khách nhập mã PIN phòng trên màn hình cảm ứng để xác thực")
    target_room_number: Optional[str] = Field(default=None, description="Số phòng mục tiêu cần nhập PIN")
    pending_service_action: Optional[str] = Field(default=None, description="Hành động dịch vụ đang chờ xác thực: room_service, housekeeping...")
    pending_service_items: Optional[str] = Field(default=None, description="Chi tiết các món đồ đang chờ xác thực")
    eye_expression: Optional[str] = Field(default=None, description="Biểu cảm cử động mắt của Robot (look_up, look_left, look_right, look_around, happy)")
    action: Optional[str] = Field(default=None, description="Tên action/intent dịch vụ được phân loại: query_order_status, room_service, ...")
    status_query_type: Optional[str] = Field(default=None, description="Loại tra cứu trạng thái: service | food")
    trigger_menu: Optional[str] = Field(default=None, description="Tên menu tự động kích hoạt trên Kiosk: food_menu | room_service")
    advertisement: Optional[Dict[str, Any]] = Field(default=None, description="Quảng cáo cơ sở vật chất kèm hình ảnh hiển thị cùng câu trả lời")
    suggested_prompts: Optional[List[str]] = Field(default_factory=list, description="Danh sách 2-3 câu hỏi gợi ý tiếp theo dạng Quick-Reply Chips")


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
    provider: Optional[str] = Field("edge", description="Legacy field; fixed Edge voices are always used")
    voice: Optional[str] = Field(None, description="Legacy field; the speaker is fixed per language")
    language: Optional[str] = Field("vi-VN", description="Language of the whole utterance: vi-VN or en-US")
    rate: Optional[str] = Field(None, pattern=r"^[+-]\d+%$", description="Speech rate; omit to use system settings")


class TTSResponse(BaseModel):
    audio_base64: str
    mime_type: str = "audio/mp3"
    provider_used: str = "edge"
    audio_url: Optional[str] = None
    error_code: Optional[str] = None
    error_detail: Optional[str] = None
    voice: Optional[str] = None
    language: Optional[str] = None
    rate: Optional[str] = None
    voice_policy: Optional[str] = None
    text: Optional[str] = None


class VoiceSettingsRequest(BaseModel):
    speech_rate: float = Field(1.0, ge=0.5, le=2.0, description="Tốc độ nói từ 0.5x đến 2.0x")
    vi_voice: Optional[str] = Field("vi-VN-HoaiMyNeural", description="Fixed female Vietnamese voice (legacy field)")
    en_voice: Optional[str] = Field("en-US-JennyNeural", description="Giọng đọc tiếng Anh")
    volume: Optional[str] = Field("+0%", description="Fixed neutral volume")


class VoiceSettingsResponse(BaseModel):
    speech_rate: float = Field(1.0, description="Tốc độ nói float (0.5 - 2.0)")
    rate_percentage: str = Field("+0%", description="Tốc độ theo định dạng % của EdgeTTS")
    vi_voice: str = Field("vi-VN-HoaiMyNeural", description="Giọng tiếng Việt đang dùng")
    en_voice: str = Field("en-US-JennyNeural", description="Giọng tiếng Anh đang dùng")
    volume: Optional[str] = Field("+0%", description="Âm lượng EdgeTTS đang dùng")


class PersonaSettingsRequest(BaseModel):
    bot_name: Optional[str] = Field(None, description="Tên định danh của Robot")
    hotel_name: Optional[str] = Field(None, description="Tên khách sạn")
    star_rating: Optional[int] = Field(None, ge=1, le=7, description="Hạng sao khách sạn (1 - 7 sao)")
    tone_style: Optional[str] = Field(None, description="Phong cách: 'luxury' | 'warm' | 'concise'")
    pronoun_bot_vi: Optional[str] = Field(None, description="Cách Robot tự xưng trong tiếng Việt")
    pronoun_guest_vi: Optional[str] = Field(None, description="Cách Robot gọi khách trong tiếng Việt")
    qr_cta_vi: Optional[str] = Field(None, description="Câu mời quét mã QR chỉ đường (tiếng Việt)")
    qr_cta_en: Optional[str] = Field(None, description="Câu mời quét mã QR chỉ đường (tiếng Anh)")
    unhappy_empathy_vi: Optional[str] = Field(None, description="Chỉ thị xoa dịu khi khách khó chịu (tiếng Việt)")
    unhappy_empathy_en: Optional[str] = Field(None, description="Chỉ thị xoa dịu khi khách khó chịu (tiếng Anh)")
    out_of_scope_vi: Optional[str] = Field(None, description="Câu từ chối khi hỏi ngoài phạm vi (tiếng Việt)")
    out_of_scope_en: Optional[str] = Field(None, description="Câu từ chối khi hỏi ngoài phạm vi (tiếng Anh)")


class PersonaSettingsResponse(BaseModel):
    bot_name: str
    hotel_name: str
    star_rating: int
    tone_style: str
    pronoun_bot_vi: str
    pronoun_guest_vi: str
    qr_cta_vi: str
    qr_cta_en: str
    unhappy_empathy_vi: str
    unhappy_empathy_en: str
    out_of_scope_vi: str
    out_of_scope_en: str


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
    created_at: Optional[datetime] = None

    @field_validator("created_at", mode="after")
    @classmethod
    def ensure_utc_created_at(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    model_config = ConfigDict(from_attributes=True)


class QuickTranslateRequest(BaseModel):
    text: str = Field(..., description="Văn bản cần dịch trong video call", json_schema_extra={"example": "Where is the swimming pool?"})
    source_lang: Optional[str] = Field("auto", description="Ngôn ngữ nguồn: 'auto', 'en', 'vi'")
    target_lang: Optional[str] = Field("vi", description="Ngôn ngữ đích: 'vi', 'en'")
    session_id: Optional[str] = Field(None, description="Mã phiên cuộc gọi video")
    sender_role: Optional[str] = Field("guest", description="Vai trò người nói: 'guest' hoặc 'staff'")
    with_audio: Optional[bool] = Field(True, description="Tự động tổng hợp âm thanh giọng đọc TTS nếu cần dịch")
    context: Optional[List[str]] = Field(None, description="2-3 câu thoại gần nhất để dịch đúng ngữ cảnh khách sạn")


class QuickTranslateResponse(BaseModel):
    original_text: str = Field(..., description="Văn bản gốc")
    translated_text: str = Field(..., description="Văn bản dịch")
    source_lang: str = Field(..., description="Ngôn ngữ nguồn đã phát hiện ('vi' hoặc 'en')")
    target_lang: str = Field(..., description="Ngôn ngữ đích ('vi' hoặc 'en')")
    needs_translation: bool = Field(..., description="True nếu đã dịch, False nếu cùng ngôn ngữ nên bypass")
    audio_base64: Optional[str] = Field(None, description="Âm thanh đọc TTS MP3 Base64 của câu dịch (nếu có)")
    tts_error_code: Optional[str] = Field(None, description="Mã lỗi TTS nếu có")
    tts_error_detail: Optional[str] = Field(None, description="Chi tiết lỗi TTS nếu có")
