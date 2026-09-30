from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------
# Department & Organization Schemas
# ---------------------------------------------------------
class ServiceTypeResponse(BaseModel):
    id: str = Field(..., description="ID định danh duy nhất của loại dịch vụ (vd: 'ST-HOUSEKEEPING', 'ST-TAXI')", json_schema_extra={"example": "ST-TAXI"})
    code: str = Field(..., description="Mã code chuẩn của loại dịch vụ (vd: 'TAXI', 'HOUSEKEEPING', 'BELL_SERVICE', 'MAINTENANCE', 'RECEPTION', 'ROOM_SERVICE')", json_schema_extra={"example": "TAXI"})
    name: str = Field(..., description="Tên hiển thị của dịch vụ", json_schema_extra={"example": "Dịch vụ Đặt xe & Taxi"})
    department_id: str = Field(..., description="Mã ID phòng ban phụ trách", json_schema_extra={"example": "DEP-TAXI"})
    department_name: Optional[str] = Field(None, description="Tên phòng ban phụ trách", json_schema_extra={"example": "Taxi & Transportation"})
    description: Optional[str] = Field(None, description="Mô tả chi tiết nội dung và phạm vi dịch vụ", json_schema_extra={"example": "Hỗ trợ khách gọi xe di chuyển, taxi ra sân bay hoặc điểm tham quan"})
    default_priority: str = Field("NORMAL", description="Mức độ ưu tiên mặc định ('LOW', 'NORMAL', 'HIGH', 'URGENT')", json_schema_extra={"example": "NORMAL"})
    is_active: bool = Field(True, description="Trạng thái dịch vụ có đang mở phục vụ khách hay không", json_schema_extra={"example": True})
    created_at: Optional[datetime] = Field(None, description="Thời gian tạo bản ghi")
    updated_at: Optional[datetime] = Field(None, description="Thời gian cập nhật gần nhất")

    model_config = ConfigDict(from_attributes=True)


class DepartmentResponse(BaseModel):
    id: str = Field(..., description="ID định danh duy nhất của phòng ban (vd: 'DEP-HOUSEKEEPING')", json_schema_extra={"example": "DEP-HOUSEKEEPING"})
    code: str = Field(..., description="Mã code chuẩn của phòng ban (vd: 'HOUSEKEEPING', 'BELL', 'TAXI', 'MAINTENANCE', 'RECEPTION', 'FB')", json_schema_extra={"example": "HOUSEKEEPING"})
    name: str = Field(..., description="Tên phòng ban hiển thị", json_schema_extra={"example": "Housekeeping"})
    description: Optional[str] = Field(None, description="Mô tả chức năng nhiệm vụ của phòng ban", json_schema_extra={"example": "Bộ phận buồng phòng, vệ sinh và tiện ích phòng ở"})
    is_active: bool = Field(True, description="Trạng thái hoạt động của phòng ban", json_schema_extra={"example": True})
    created_at: Optional[datetime] = Field(None, description="Thời gian tạo phòng ban")
    updated_at: Optional[datetime] = Field(None, description="Thời gian cập nhật phòng ban")

    model_config = ConfigDict(from_attributes=True)


class DepartmentDetailResponse(DepartmentResponse):
    service_types: List[ServiceTypeResponse] = Field(default_factory=list, description="Danh sách các loại dịch vụ trực thuộc phòng ban")
    staff_count: int = Field(0, description="Tổng số nhân viên đang trực thuộc phòng ban", json_schema_extra={"example": 3})

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Staff & Robot Fleet Schemas
# ---------------------------------------------------------
class StaffBase(BaseModel):
    code: str = Field(..., description="Mã viết tắt / huy hiệu nhân viên (vd: 'MS', 'JD')", json_schema_extra={"example": "MS"})
    full_name: str = Field(..., description="Họ và tên đầy đủ của nhân viên", json_schema_extra={"example": "Maria Santos"})
    role: str = Field(..., description="Chức danh / Vai trò chuyên môn", json_schema_extra={"example": "Housekeeping Lead"})
    department: str = Field(..., description="Tên phòng ban hiển thị", json_schema_extra={"example": "Housekeeping"})
    department_id: Optional[str] = Field(None, description="Mã phòng ban chuẩn (vd: 'DEP-HOUSEKEEPING')", json_schema_extra={"example": "DEP-HOUSEKEEPING"})
    location: str = Field("Main Hotel", description="Khu vực làm việc chính", json_schema_extra={"example": "Floor 3 & 4"})
    status: str = Field("available", description="Trạng thái trực: 'available' (sẵn sàng), 'busy' (đang bận), 'off_shift' (hết ca)", json_schema_extra={"example": "available"})
    current_tasks_count: int = Field(0, description="Số lượng công việc đang xử lý đồng thời", json_schema_extra={"example": 1})
    avatar_url: Optional[str] = Field(None, description="URL ảnh đại diện nhân viên", json_schema_extra={"example": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2"})
    email: Optional[str] = Field(None, description="Địa chỉ email liên hệ", json_schema_extra={"example": "housekeeping@aurora.hotel"})
    phone: Optional[str] = Field(None, description="Số điện thoại di động", json_schema_extra={"example": "+84 90 123 4567"})
    shift: Optional[str] = Field("Morning Shift (06:00 - 14:00)", description="Ca làm việc phân công", json_schema_extra={"example": "Morning Shift (06:00 - 14:00)"})
    is_fallback_agent: bool = Field(False, description="Cờ kích hoạt làm nhân viên tiếp nhận cuộc gọi khẩn / chuyển tiếp từ Robot", json_schema_extra={"example": True})
    assigned_floors: Optional[str] = Field("Floor 1 - 5", description="Phạm vi tầng phục vụ phụ trách", json_schema_extra={"example": "Floor 1 - 5"})
    notification_channels: Optional[str] = Field("Web Dashboard, Tablet Alert", description="Các kênh nhận thông báo công việc", json_schema_extra={"example": "Web Dashboard, Tablet Alert"})
    is_active: bool = Field(True, description="Trạng thái tài khoản (True = Đang hoạt động, False = Đã khóa/xóa mềm)", json_schema_extra={"example": True})


class StaffResponse(StaffBase):
    id: str = Field(..., description="ID định danh duy nhất của tài khoản (vd: 'STF-f9ab1b15')", json_schema_extra={"example": "STF-f9ab1b15"})
    username: Optional[str] = Field(None, description="Tên đăng nhập hệ thống", json_schema_extra={"example": "housekeeping"})
    department_name: Optional[str] = Field(None, description="Tên phòng ban chính thức từ bảng Department", json_schema_extra={"example": "Housekeeping"})
    created_at: datetime = Field(..., description="Thời gian tạo tài khoản")
    updated_at: datetime = Field(..., description="Thời gian cập nhật thông tin gần nhất")

    model_config = ConfigDict(from_attributes=True)


class StaffCreate(BaseModel):
    username: str = Field(..., description="Tên đăng nhập hệ thống (duy nhất, viết thường không dấu)", json_schema_extra={"example": "alex_turner"})
    password: str = Field("123456", description="Mật khẩu khởi tạo tài khoản", json_schema_extra={"example": "123456"})
    full_name: str = Field(..., description="Họ và tên đầy đủ của nhân viên", json_schema_extra={"example": "Alex Turner"})
    role: str = Field(..., description="Chức danh / Vai trò chuyên môn", json_schema_extra={"example": "Maintenance Technician"})
    department: Optional[str] = Field(None, description="Tên phòng ban (Nếu để trống hệ thống sẽ tự suy từ department_id)", json_schema_extra={"example": "Maintenance"})
    department_id: Optional[str] = Field(None, description="Mã phòng ban chuẩn (vd: 'DEP-MAINTENANCE'). Nếu để trống hệ thống sẽ tự tìm theo department", json_schema_extra={"example": "DEP-MAINTENANCE"})
    code: Optional[str] = Field(None, description="Mã viết tắt / huy hiệu nhân viên (vd: 'AT'). Nếu để trống hệ thống tự sinh ngẫu nhiên", json_schema_extra={"example": "AT"})
    email: Optional[str] = Field(None, description="Địa chỉ email nhân viên", json_schema_extra={"example": "alex.turner@aurora.hotel"})
    phone: Optional[str] = Field("+84 90 123 4567", description="Số điện thoại di động", json_schema_extra={"example": "+84 90 123 4567"})
    shift: Optional[str] = Field("Morning Shift (06:00 - 14:00)", description="Ca làm việc", json_schema_extra={"example": "Morning Shift (06:00 - 14:00)"})
    location: str = Field("Main Hotel", description="Khu vực phụ trách", json_schema_extra={"example": "Basement & Engineering Rooms"})
    status: str = Field("available", description="Trạng thái trực ban đầu ('available', 'busy', 'off_shift')", json_schema_extra={"example": "available"})
    avatar_url: Optional[str] = Field(None, description="URL ảnh đại diện", json_schema_extra={"example": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d"})
    is_fallback_agent: bool = Field(False, description="Tiếp nhận hỗ trợ khi Robot yêu cầu can thiệp người thật", json_schema_extra={"example": False})
    assigned_floors: Optional[str] = Field("Floor 1 - 5", description="Phạm vi tầng phân công", json_schema_extra={"example": "All Floors"})
    notification_channels: Optional[str] = Field("Web Dashboard, Tablet Alert", description="Kênh nhận thông báo", json_schema_extra={"example": "Web Dashboard, Tablet Alert"})


class StaffUpdate(BaseModel):
    full_name: Optional[str] = Field(None, description="Họ và tên nhân viên cập nhật", json_schema_extra={"example": "Alex Turner Updated"})
    role: Optional[str] = Field(None, description="Vai trò / Chức danh mới", json_schema_extra={"example": "Lead Engineer"})
    department: Optional[str] = Field(None, description="Tên phòng ban mới", json_schema_extra={"example": "Maintenance & Engineering"})
    department_id: Optional[str] = Field(None, description="Mã ID phòng ban chuẩn mới (vd: 'DEP-MAINTENANCE')", json_schema_extra={"example": "DEP-MAINTENANCE"})
    status: Optional[str] = Field(None, description="Trạng thái làm việc ('available', 'busy', 'off_shift', 'inactive')", json_schema_extra={"example": "available"})
    location: Optional[str] = Field(None, description="Vị trí làm việc mới", json_schema_extra={"example": "Floor 1 - 3"})
    email: Optional[str] = Field(None, description="Địa chỉ email mới", json_schema_extra={"example": "alex.lead@aurora.hotel"})
    phone: Optional[str] = Field(None, description="Số điện thoại mới", json_schema_extra={"example": "+84 90 987 6543"})
    shift: Optional[str] = Field(None, description="Ca trực mới", json_schema_extra={"example": "Afternoon Shift (14:00 - 22:00)"})
    avatar_url: Optional[str] = Field(None, description="URL ảnh đại diện mới")
    is_fallback_agent: Optional[bool] = Field(None, description="Cấu hình tiếp nhận escalation từ Robot")
    assigned_floors: Optional[str] = Field(None, description="Tầng phân công mới", json_schema_extra={"example": "Floor 1 - 7"})
    notification_channels: Optional[str] = Field(None, description="Kênh thông báo mới", json_schema_extra={"example": "Web Dashboard, SMS Alert"})






# ---------------------------------------------------------
# Reception / Front Desk Schemas
# ---------------------------------------------------------
class ReceptionRequestUpdate(BaseModel):
    status: Optional[str] = None
    assistance_status: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_role: Optional[str] = None
    note: Optional[str] = None
    escalated: Optional[bool] = None


class ReceptionRequestResponse(BaseModel):
    id: str
    ticket_code: str
    title: str
    created_label: str
    location: str
    location_details: Dict[str, Any]
    guest_name: str
    guest_tier: str
    guest_stay_details: str
    status: str
    description: str
    attached_media: List[Dict[str, Any]]
    transcript: List[Dict[str, Any]]
    assistance_status: str
    assigned_to: Optional[str]
    assigned_role: Optional[str]
    notes: List[Dict[str, Any]]
    activity_log: List[Dict[str, Any]]
    escalated: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReceptionDashboardResponse(BaseModel):
    current_request: Optional[ReceptionRequestResponse] = None


# ---------------------------------------------------------
# Room Service / F&B Schemas
# ---------------------------------------------------------
class OrderItem(BaseModel):
    name: str
    qty: Any # string or number, e.g. 2 or "Set of 4"

class RoomServiceOrderCreate(BaseModel):
    room_number: str
    items: List[OrderItem]
    note: Optional[str] = None
    image_url: Optional[str] = None
    is_service_request: bool = False

class RoomServiceOrderStatusUpdate(BaseModel):
    status: str # 'Pending', 'Cooking', 'Ready', 'Delivering', 'Completed', 'Rejected'
    progress: Optional[int] = None
    est_completion: Optional[str] = None
    assigned_staff_name: Optional[str] = None

class RoomServiceOrderAssignRobot(BaseModel):
    robot_id: Optional[str] = None
    robot_name: Optional[str] = None

class RoomServiceOrderResponse(BaseModel):
    id: str
    order_number: str
    room_number: str
    status: str
    items: List[Dict[str, Any]]
    note: Optional[str]
    image_url: Optional[str]
    is_service_request: bool
    progress: int
    est_completion: Optional[str]
    assigned_robot_id: Optional[str]
    assigned_staff_name: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Housekeeping Schemas
# ---------------------------------------------------------
class HousekeepingRequestCreate(BaseModel):
    source: str = "From HCRobot"
    title: str
    room_number: str
    description: Optional[str] = None
    guest_name: Optional[str] = None

class HousekeepingAssignRequest(BaseModel):
    status: str = "In Progress"
    assigned_staff_name: str
    assigned_staff_id: Optional[str] = None

class HousekeepingRequestResponse(BaseModel):
    id: str
    ticket_code: str
    source: str
    time_label: str
    title: str
    room_number: str
    description: Optional[str]
    guest_name: Optional[str]
    status: str
    assigned_staff_name: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Bell Services Schemas
# ---------------------------------------------------------
class BellRequestCreate(BaseModel):
    title: str
    location: str
    guest_name: Optional[str] = None
    reporter: Optional[str] = None
    description: Optional[str] = None
    request_type: str = "luggage"

class BellRequestStatusUpdate(BaseModel):
    status: str # 'Pending', 'In Progress', 'Completed'
    assigned_to: Optional[str] = None

class BellRequestResponse(BaseModel):
    id: str
    ticket_code: str
    title: str
    location: str
    guest_name: Optional[str]
    reporter: Optional[str]
    description: Optional[str]
    request_type: str
    status: str
    assigned_to: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Maintenance Schemas
# ---------------------------------------------------------
class MaintenanceRequestCreate(BaseModel):
    title: str
    category: str = "general"
    location: str
    description: Optional[str] = None
    source: str = "MANUAL DISPATCH"

class MaintenanceRequestResponse(BaseModel):
    id: str
    ticket_code: str
    title: str
    category: str
    reported_time_label: str
    location: str
    description: Optional[str]
    source: str
    status: str
    assigned_to: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Management Directive Schemas
# ---------------------------------------------------------
class DirectiveCreate(BaseModel):
    title: str
    department: str = "Housekeeping"
    priority: str = "URGENT"
    location: str = "Main Entrance"
    description: Optional[str] = None
    type: str = "directive"

class DirectiveResponse(BaseModel):
    id: str
    code: str
    title: str
    department: str
    priority: str
    location: str
    reported_time_label: str
    description: Optional[str]
    status: str
    assigned_staff_name: Optional[str]
    assigned_eta: Optional[str]
    assigned_staff_avatar: Optional[str]
    type: str
    created_by: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Inventory Stock Schemas
# ---------------------------------------------------------
class InventoryStockResponse(BaseModel):
    id: str
    name: str
    category: str
    count_label: str
    quantity: int
    level: str

    model_config = ConfigDict(from_attributes=True)



# ---------------------------------------------------------
# Full Department Dashboard Responses (Matching UI perfectly)
# ---------------------------------------------------------
class RoomServiceDashboardResponse(BaseModel):
    kpis: Dict[str, Any]
    orders: List[RoomServiceOrderResponse]
    delivery_fleet: List[Dict[str, Any]] = []
    low_stock_alerts: List[InventoryStockResponse]

class HousekeepingDashboardResponse(BaseModel):
    kpis: Dict[str, Any]
    requests: List[HousekeepingRequestResponse]
    floor_status: Dict[str, Any]
    available_staff: List[StaffResponse]

class BellServicesDashboardResponse(BaseModel):
    kpis: Dict[str, Any]
    requests: List[BellRequestResponse]
    team_status: List[Dict[str, Any]]
    announcement: Dict[str, Any]

class MaintenanceDashboardResponse(BaseModel):
    kpis: Dict[str, Any]
    requests: List[MaintenanceRequestResponse]
    staff_availability: List[Dict[str, Any]]
    facility_map: Dict[str, Any]


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


# ---------------------------------------------------------
# Admin Central Operations Schemas
# ---------------------------------------------------------
class UnifiedOperationTask(BaseModel):
    id: str
    raw_id: str
    department: str
    table_type: str
    title: str
    location: str
    guest_name: str
    priority: str
    status: str
    time: str
    assigned_to: Optional[str] = None
    assigned_robot: Optional[str] = None
    notes: Optional[str] = None
    source: str = "Robot / Staff"
    created_at: Optional[datetime] = None


class AdminTaskDispatchCreate(BaseModel):
    department: str  # 'Reception', 'Housekeeping', 'F&B', 'Bell Services', 'Maintenance', 'Taxi', 'Directive'
    title: str
    room_number: Optional[str] = Field(None, description="Số phòng hoặc vị trí ví dụ 'Room 412', 'Lobby', hoặc None")
    guest_name: Optional[str] = "Hotel Guest"
    priority: str = Field("NORMAL", description="'HIGH PRIORITY', 'NORMAL', 'LOW'")
    description: Optional[str] = None
    assigned_staff_name: Optional[str] = None
    assigned_robot_code: Optional[str] = None


class AdminTaskStatusUpdate(BaseModel):
    status: str = Field(..., description="'Pending', 'In Progress', 'Completed', 'Cancelled'")
    assigned_to: Optional[str] = None
    assigned_robot: Optional[str] = None
    note: Optional[str] = None


class AdminOperationsSummary(BaseModel):
    total_active: int = 0
    all_count: int = 0
    reception_count: int = 0
    housekeeping_count: int = 0
    room_service_count: int = 0
    bell_services_count: int = 0
    maintenance_count: int = 0
    taxi_count: int = 0
    directives_count: int = 0


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


