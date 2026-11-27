from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


# ---------------------------------------------------------
# Admin Central Operations Schemas
# ---------------------------------------------------------
class AdminOperationsSummary(BaseModel):
    total_active: int = 0
    all_count: int = 0
    reception_count: int = 0
    concierge_count: int = 0
    housekeeping_count: int = 0
    room_service_count: int = 0
    bell_services_count: int = 0
    maintenance_count: int = 0
    taxi_count: int = 0
    directives_count: int = 0


class AdminTaskDispatchCreate(BaseModel):
    department: str = Field("Housekeeping", description="Tên bộ phận tiếp nhận (Housekeeping, F&B, Reception, Bell Services, Maintenance, Taxi, Concierge)")
    title: str = Field(..., description="Tiêu đề yêu cầu điều phối")
    room_number: str = Field(..., description="Số phòng hoặc vị trí tiếp nhận")
    guest_name: Optional[str] = Field("Hotel Guest", description="Tên khách hàng")
    description: Optional[str] = Field("", description="Chi tiết nội dung chỉ đạo / yêu cầu")
    assigned_staff_name: Optional[str] = Field(None, description="Tên nhân viên phụ trách ban đầu")
    assigned_robot_code: Optional[str] = Field(None, description="Mã Robot điều động")



# ---------------------------------------------------------
# Human Support & Multilingual Conversations Schemas
# ---------------------------------------------------------
class SupportMessageSchema(BaseModel):
    id: str
    speaker: str  # 'guest' | 'robot' | 'staff' | 'system'
    speaker_name: str
    raw_transcript: str
    languages_detected: List[str] = ["en"]
    translations: Dict[str, str] = Field(default_factory=dict)
    sentiment: Optional[str] = None
    confidence: Optional[float] = None
    timestamp: str


class HumanSupportSessionResponse(BaseModel):
    id: str
    session_code: str
    room_number: str
    guest_name: str
    category: str
    origin_robot_code: str
    sentiment: str
    wait_time_label: str
    status: str
    linked_request_id: Optional[str] = None
    recording_url: Optional[str] = None
    recording_public_id: Optional[str] = None
    recording_duration: Optional[int] = None
    recording_status: Optional[str] = "ready"
    thumbnail_url: Optional[str] = None
    call_started_at: Optional[datetime] = None
    call_ended_at: Optional[datetime] = None
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Notification Schemas
# ---------------------------------------------------------
class NotificationCreate(BaseModel):
    department: str = Field(..., description="'F&B', 'Housekeeping', 'Bell Services', 'Maintenance', 'Reception', 'All'")
    title: str
    description: str
    request_id: Optional[str] = None
    request_type: Optional[str] = None
    type: str = "Request"


class NotificationResponse(BaseModel):
    id: str
    department: str
    title: str
    description: str
    request_id: Optional[str] = None
    request_type: Optional[str] = None
    type: str
    is_read: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Taxi & Transportation Schemas
# ---------------------------------------------------------
class TaxiRequestCreate(BaseModel):
    booking_mode: Literal["assistance", "trip"] = "trip"
    room_number: Optional[str] = Field(None, max_length=50)
    guest_name: str = Field("Hotel Guest", max_length=100)
    # Assistance requests contain only details supplied by the guest.
    pickup_location: Optional[str] = None
    destination: Optional[str] = None
    pickup_time: Optional[str] = None
    party_size: Optional[int] = Field(None, ge=1, le=100)
    vehicle_type: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=4000)

    @model_validator(mode="after")
    def validate_booking(self):
        self.room_number = (self.room_number or "").strip() or None
        if self.booking_mode == "assistance" and not self.room_number:
            raise ValueError("A room number is required for taxi assistance")
        if self.booking_mode == "trip" and not (self.destination or "").strip():
            raise ValueError("A destination is required for a trip booking")
        return self


class TaxiRequestStatusUpdate(BaseModel):
    status: str = Field(..., description="Trạng thái chuyến xe: 'Pending', 'Driver Assigned', 'On The Way', 'Completed', 'Cancelled'", json_schema_extra={"example": "Driver Assigned"})
    assigned_driver: Optional[str] = Field(None, description="Tên tài xế phụ trách", json_schema_extra={"example": "Nguyễn Văn Hùng"})
    license_plate: Optional[str] = Field(None, description="Biển số xe taxi", json_schema_extra={"example": "43A-888.99"})
    note: Optional[str] = Field(None, description="Ghi chú cập nhật", json_schema_extra={"example": "Xe đã đến sảnh chính đón khách"})


class TaxiRequestResponse(BaseModel):
    id: str
    ticket_code: str
    booking_mode: Literal["assistance", "trip"] = "trip"
    guest_name: str
    guest_phone: Optional[str] = None
    room_phone: Optional[str] = None
    room_number: Optional[str] = None
    pickup_location: Optional[str] = None
    destination: Optional[str] = None
    pickup_time: Optional[str] = None
    party_size: Optional[int] = None
    vehicle_type: Optional[str] = None
    status: str
    assigned_driver: Optional[str] = None
    license_plate: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaxiDashboardResponse(BaseModel):
    kpis: Dict[str, Any] = Field(..., description="Các chỉ số KPI hoạt động vận chuyển")
    requests: List[TaxiRequestResponse] = Field(default_factory=list, description="Danh sách các cuốc xe đang điều phối")
    fleet_status: List[Dict[str, Any]] = Field(default_factory=list, description="Trạng thái đội xe đối tác và xe khách sạn")
    announcement: Dict[str, Any] = Field(default_factory=dict, description="Thông báo tình trạng giao thông / điều phối")


# ---------------------------------------------------------
# Room PIN / NFC Verification & Check-in Schemas
# ---------------------------------------------------------
class RoomPinVerifyRequest(BaseModel):
    room_number: str = Field(..., description="Số phòng cần xác thực (vd: '302', '402')")
    pin: Optional[str] = Field(None, description="Mã PIN 4 số, 4 số cuối CCCD/Hộ chiếu, hoặc mã thẻ NFC")
    tag_code: Optional[str] = Field(None, alias="tagCode", description="Mã NDEF Tag Code hoặc UID thẻ phòng quẹt tại Robot Kiosk")
    nfc_card_uid: Optional[str] = Field(None, description="Mã UID thẻ NFC phòng quẹt tại Robot Kiosk (legacy)")
    action: Optional[str] = Field(None, description="Hành động dịch vụ: 'room_service', 'housekeeping', 'bellman', 'maintenance'")
    items: Optional[str] = Field(None, description="Chi tiết món đồ hoặc yêu cầu dịch vụ")
    note: Optional[str] = Field(None, description="Ghi chú thêm nếu có")
    skip_ticket_creation: Optional[bool] = Field(False, description="Nếu True, chỉ xác thực PIN/NFC mà không tạo SupportRequest tự động")
    create_ticket: Optional[bool] = Field(True, description="Nếu False, chỉ xác thực PIN/NFC mà không tạo SupportRequest tự động")
    session_id: Optional[str] = Field(None, description="Session ID hiện tại của Kiosk để ghi nhớ xác thực trong phiên")

    model_config = ConfigDict(populate_by_name=True)


class RoomNfcVerifyRequest(BaseModel):
    tag_code: Optional[str] = Field(None, alias="tagCode", description="Mã NDEF Tag Code hoặc UID thẻ phòng (vd: '401', 'ROOM-401', '1D:28:9A:56:21:10:80')")
    nfc_card_uid: Optional[str] = Field(None, description="Mã UID thẻ NFC phòng (legacy)")
    room_number: Optional[str] = Field(None, description="Số phòng (tùy chọn)")
    action: Optional[str] = Field(None, description="Hành động dịch vụ: 'room_service', 'housekeeping', 'bellman', 'maintenance'")
    items: Optional[str] = Field(None, description="Chi tiết món đồ hoặc yêu cầu dịch vụ")
    note: Optional[str] = Field(None, description="Ghi chú thêm nếu có")
    skip_ticket_creation: Optional[bool] = Field(False, description="Nếu True, chỉ xác thực PIN/NFC mà không tạo SupportRequest tự động")
    create_ticket: Optional[bool] = Field(True, description="Nếu False, chỉ xác thực PIN/NFC mà không tạo SupportRequest tự động")
    session_id: Optional[str] = Field(None, description="Session ID hiện tại của Kiosk để ghi nhớ xác thực trong phiên")

    model_config = ConfigDict(populate_by_name=True)


class RoomPinVerifyResponse(BaseModel):
    verified: bool = Field(..., description="True nếu mã PIN/CCCD/NFC chính xác")
    duplicate: bool = False
    merged: bool = False
    success: bool = Field(True, description="True nếu xác thực thành công")
    room_number: str = Field(..., description="Số phòng")
    guest_name: Optional[str] = Field(None, description="Tên khách đang ở")
    ticket_code: Optional[str] = Field(None, description="Mã ticket được tạo tự động sau khi xác thực thành công")
    verification_type: Optional[str] = Field("PIN", description="Hình thức xác thực: 'PIN', 'CCCD', hoặc 'NFC'")
    tag_code: Optional[str] = Field(None, alias="tagCode", description="Mã TagCode của phòng")
    message: str = Field(..., description="Thông báo kết quả")

    model_config = ConfigDict(populate_by_name=True)


class RoomCheckInRequest(BaseModel):
    guest_name: str = Field(..., description="Tên khách hàng check-in")
    guest_phone: Optional[str] = Field(None, alias="guestPhone", description="Số điện thoại di động của khách lưu trú")
    room_phone: Optional[str] = Field(None, alias="roomPhone", description="Số máy nhánh nội bộ phòng (ví dụ: Ext 301 hoặc 028...)")
    identity_number: Optional[str] = Field(None, description="Số CCCD / CMND / Hộ chiếu (chỉ gồm chữ số 0-9)")
    pin_code: Optional[str] = Field(None, description="Mã PIN 4 số (nếu không truyền sẽ tự sinh hoặc lấy 4 số cuối CCCD)")
    tag_code: Optional[str] = Field(None, alias="tagCode", description="Mã thẻ phòng NFC / TagCode cấp cho khách lưu trú")
    nfc_card_uid: Optional[str] = Field(None, description="Mã thẻ phòng NFC (legacy)")
    status: Optional[str] = Field("OCCUPIED", description="Trạng thái phòng sau check-in")

    @field_validator("identity_number")
    @classmethod
    def validate_identity_number(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            if clean:
                if not clean.isdigit():
                    raise ValueError("Số CCCD / Hộ chiếu chỉ được chứa các chữ số (0-9).")
                if len(clean) < 4:
                    raise ValueError("Số CCCD / Hộ chiếu phải có ít nhất 4 chữ số để tạo mã PIN phòng.")
            return clean or None
        return v

    model_config = ConfigDict(populate_by_name=True)


class RoomInfoResponse(BaseModel):
    id: str
    room_number: str
    room_type: str
    status: str
    current_guest_name: Optional[str] = None
    current_guest_phone: Optional[str] = None
    guest_phone: Optional[str] = None
    room_phone: Optional[str] = None
    is_merged: Optional[bool] = False
    pin_code: Optional[str] = None
    identity_number: Optional[str] = None
    tag_code: Optional[str] = None
    nfc_card_uid: Optional[str] = None
    qr_code: Optional[str] = None
    floor: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
