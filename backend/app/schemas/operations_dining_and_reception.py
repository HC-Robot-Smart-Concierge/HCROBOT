from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator, field_validator

# ---------------------------------------------------------
# Restaurant Table Reservation & Pre-Order Schemas
# ---------------------------------------------------------
class RestaurantReservationCreate(BaseModel):
    guest_name: str
    room_number: Optional[str] = None
    party_size: int = 2
    reservation_time: str
    table_number: Optional[str] = "Table 01"
    special_note: Optional[str] = None

class RestaurantReservationResponse(BaseModel):
    id: str
    reservation_code: str
    guest_name: str
    room_number: Optional[str]
    party_size: int
    reservation_time: str
    table_number: Optional[str]
    special_note: Optional[str]
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PreOrderItem(BaseModel):
    name: str
    quantity: int = 1
    price: float = 0.0

class RestaurantPreOrderCreate(BaseModel):
    guest_name: str
    room_number: Optional[str] = None
    reservation_code: Optional[str] = None
    items: List[PreOrderItem]
    total_price: float = 0.0
    note: Optional[str] = None

class RestaurantPreOrderResponse(BaseModel):
    id: str
    order_code: str
    reservation_code: Optional[str]
    guest_name: str
    room_number: Optional[str]
    items: List[Dict[str, Any]]
    total_price: float
    note: Optional[str]
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RestaurantDashboardResponse(BaseModel):
    kpis: Dict[str, Any]
    reservations: List[RestaurantReservationResponse]
    pre_orders: List[RestaurantPreOrderResponse]

# Aliases for Kitchen naming
KitchenReservationCreate = RestaurantReservationCreate
KitchenReservationResponse = RestaurantReservationResponse
KitchenPreOrderCreate = RestaurantPreOrderCreate
KitchenPreOrderResponse = RestaurantPreOrderResponse
KitchenDashboardResponse = RestaurantDashboardResponse


# ---------------------------------------------------------
# Food Item (Master Dish Catalog) & Menu Schemas (Diagram 2)
# ---------------------------------------------------------
class FoodItemCreate(BaseModel):
    name: str = Field(..., description="Tên món ăn hoặc thức uống")
    category: str = Field("Món chính", description="Phân loại: Khai vị, Món chính, Đồ uống, Tráng miệng, Ăn nhẹ")
    description: Optional[str] = Field(None, description="Mô tả món ăn, hương vị hoặc thành phần dị ứng")
    image_url: Optional[str] = Field(None, description="Đường dẫn ảnh món ăn")
    prep_time_minutes: int = Field(15, description="Thời gian chuẩn bị dự kiến của bếp (phút)")
    is_available: bool = Field(True, description="Bếp tổng có phục vụ món này không")


class FoodItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    is_available: Optional[bool] = None


class FoodItemResponse(BaseModel):
    id: str
    name: str
    category: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    prep_time_minutes: int
    is_available: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MenuItemCreate(BaseModel):
    menu_id: str
    food_item_id: Optional[str] = None
    price: Optional[float] = None
    display_order: int = 0
    is_available: bool = True

    # Hỗ trợ tạo nhanh món chưa có trong catalog
    name: Optional[str] = None
    currency: Optional[str] = "VND"
    image_url: Optional[str] = None
    category: Optional[str] = "Món chính"
    description: Optional[str] = None


class MenuItemResponse(BaseModel):
    id: str
    menu_id: str
    food_item_id: Optional[str] = None
    price: float
    display_order: int = 0
    is_available: bool
    name: str = ""
    currency: str = "VND"
    image_url: Optional[str] = None
    category: str = "Món chính"
    description: Optional[str] = None
    food_item: Optional[FoodItemResponse] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode='before')
    @classmethod
    def resolve_fields(cls, data: Any) -> Any:
        if hasattr(data, '__dict__'):
            fi = data.__dict__.get('food_item', None)
            name = getattr(data, 'name', None) or (getattr(fi, 'name', '') if fi else "")
            category = getattr(data, 'category', None) or (getattr(fi, 'category', 'Món chính') if fi else "Món chính")
            image_url = getattr(data, 'image_url', None) or (getattr(fi, 'image_url', None) if fi else None)
            description = getattr(data, 'description', None) or (getattr(fi, 'description', None) if fi else None)
            currency = getattr(data, 'currency', None) or (getattr(fi, 'currency', 'VND') if fi else "VND")
            return {
                "id": getattr(data, 'id', ''),
                "menu_id": getattr(data, 'menu_id', ''),
                "food_item_id": getattr(data, 'food_item_id', None),
                "price": getattr(data, 'price', 0.0),
                "display_order": getattr(data, 'display_order', 0) or 0,
                "is_available": getattr(data, 'is_available', True),
                "name": name,
                "category": category,
                "image_url": image_url,
                "description": description,
                "currency": currency,
                "food_item": fi,
                "created_at": getattr(data, 'created_at', None),
            }
        return data


class MenuItemInMenuCreate(BaseModel):
    food_item_id: Optional[str] = None
    name: Optional[str] = None
    price: float = 0.0
    currency: str = "VND"
    image_url: Optional[str] = None
    category: str = "Món chính"
    is_available: bool = True
    description: Optional[str] = None
    display_order: int = 0


class MenuCreate(BaseModel):
    name: str
    category: str = "Food"
    description: Optional[str] = None
    is_active: bool = True
    items: Optional[List[MenuItemInMenuCreate]] = []


class MenuUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Tên thực đơn")
    category: Optional[str] = Field(None, description="Phân loại: Food, Beverage, Dessert, Combo...")
    description: Optional[str] = Field(None, description="Mô tả thực đơn")
    is_active: Optional[bool] = Field(None, description="Bật/Tắt hoạt động của thực đơn")


class MenuResponse(BaseModel):
    id: str
    name: str
    category: str
    description: Optional[str] = None
    is_active: bool
    items: List[MenuItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssignFoodToMenuRequest(BaseModel):
    food_item_id: str
    price: Optional[float] = None
    display_order: int = 0
    is_available: bool = True


class MenuItemUpdate(BaseModel):
    price: Optional[float] = Field(None, description="Đơn giá áp dụng riêng tại thực đơn này (VND)")
    display_order: Optional[int] = Field(None, description="Thứ tự hiển thị trong thực đơn")
    is_available: Optional[bool] = Field(None, description="Có đang phục vụ tại thực đơn này không")


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
    room_number: Optional[str] = Field(None, description="Số phòng của khách yêu cầu", json_schema_extra={"example": "301"})
    guest_name: str = Field("Hotel Guest", description="Tên khách hàng yêu cầu xe", json_schema_extra={"example": "Mr. David Miller"})
    pickup_location: str = Field("Main Lobby", description="Điểm đón khách (vd: 'Main Lobby', 'Cổng trước', 'Room 502')", json_schema_extra={"example": "Main Lobby & Front Entrance"})
    destination: str = Field(..., description="Điểm đến (vd: 'Sân bay Quốc tế Đà Nẵng', 'Bà Nà Hills')", json_schema_extra={"example": "Sân bay Quốc tế Đà Nẵng (DAD)"})
    pickup_time: Optional[str] = Field("Immediate", description="Thời gian đón (vd: 'Immediate', '14:30 Today')", json_schema_extra={"example": "Immediate (Càng sớm càng tốt)"})
    party_size: int = Field(2, description="Số lượng hành khách", json_schema_extra={"example": 2})
    vehicle_type: str = Field("4-Seater Sedan", description="Loại phương tiện mong muốn: '4-Seater Sedan', '7-Seater SUV', 'Luxury Van'", json_schema_extra={"example": "4-Seater Sedan"})
    description: Optional[str] = Field(None, description="Ghi chú thêm về hành lý hoặc yêu cầu đặc biệt", json_schema_extra={"example": "Có 2 vali lớn, cần cốp xe rộng"})


class TaxiRequestStatusUpdate(BaseModel):
    status: str = Field(..., description="Trạng thái chuyến xe: 'Pending', 'Driver Assigned', 'On The Way', 'Completed', 'Cancelled'", json_schema_extra={"example": "Driver Assigned"})
    assigned_driver: Optional[str] = Field(None, description="Tên tài xế phụ trách", json_schema_extra={"example": "Nguyễn Văn Hùng"})
    license_plate: Optional[str] = Field(None, description="Biển số xe taxi", json_schema_extra={"example": "43A-888.99"})
    note: Optional[str] = Field(None, description="Ghi chú cập nhật", json_schema_extra={"example": "Xe đã đến sảnh chính đón khách"})


class TaxiRequestResponse(BaseModel):
    id: str = Field(..., description="Mã ID duy nhất của yêu cầu")
    ticket_code: str = Field(..., description="Mã vé / Mã chuyến xe (vd: 'TX-102')")
    guest_name: str = Field(..., description="Tên khách hàng")
    pickup_location: str = Field(..., description="Điểm đón khách")
    room_number: Optional[str] = Field(None, description="Số phòng của khách yêu cầu")
    destination: str = Field(..., description="Điểm đến")
    pickup_time: str = Field(..., description="Thời gian đón")
    party_size: int = Field(..., description="Số lượng khách")
    vehicle_type: str = Field(..., description="Loại xe")
    status: str = Field(..., description="Trạng thái chuyến xe")
    assigned_driver: Optional[str] = Field(None, description="Tài xế phân công")
    license_plate: Optional[str] = Field(None, description="Biển số xe")
    notes: Optional[str] = Field(None, description="Ghi chú chuyến đi")
    created_at: datetime = Field(..., description="Thời gian tạo yêu cầu")

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
