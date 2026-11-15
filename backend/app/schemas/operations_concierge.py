from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator, field_validator


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


class DepartmentCreate(BaseModel):
    name: str = Field(..., description="Tên phòng ban hiển thị", json_schema_extra={"example": "Security & Loss Prevention"})
    code: Optional[str] = Field(None, description="Mã code chuẩn của phòng ban (vd: 'SECURITY')", json_schema_extra={"example": "SECURITY"})
    description: Optional[str] = Field(None, description="Mô tả chức năng nhiệm vụ của phòng ban", json_schema_extra={"example": "Bộ phận kiểm soát an ninh và an toàn"})
    is_active: bool = Field(True, description="Trạng thái hoạt động", json_schema_extra={"example": True})


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Tên phòng ban cập nhật")
    code: Optional[str] = Field(None, description="Mã code cập nhật")
    description: Optional[str] = Field(None, description="Mô tả cập nhật")
    is_active: Optional[bool] = Field(None, description="Trạng thái hoạt động")


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
    avatar_url: Optional[str] = Field(None, description="URL ảnh đại diện nhân viên", json_schema_extra={"example": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2"})
    email: Optional[str] = Field(None, description="Địa chỉ email liên hệ", json_schema_extra={"example": "housekeeping@aurora.hotel"})
    phone: Optional[str] = Field(None, description="Số điện thoại di động", json_schema_extra={"example": "+84 90 123 4567"})
    is_fallback_agent: bool = Field(False, description="Cờ kích hoạt làm nhân viên tiếp nhận cuộc gọi khẩn / chuyển tiếp từ Robot", json_schema_extra={"example": True})
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
    location: str = Field("Main Hotel", description="Khu vực phụ trách", json_schema_extra={"example": "Basement & Engineering Rooms"})
    status: str = Field("available", description="Trạng thái trực ban đầu ('available', 'busy', 'off_shift')", json_schema_extra={"example": "available"})
    avatar_url: Optional[str] = Field(None, description="URL ảnh đại diện", json_schema_extra={"example": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d"})
    is_fallback_agent: bool = Field(False, description="Tiếp nhận hỗ trợ khi Robot yêu cầu can thiệp người thật", json_schema_extra={"example": False})


class StaffUpdate(BaseModel):
    full_name: Optional[str] = Field(None, description="Họ và tên nhân viên cập nhật", json_schema_extra={"example": "Alex Turner Updated"})
    role: Optional[str] = Field(None, description="Vai trò / Chức danh mới", json_schema_extra={"example": "Lead Engineer"})
    department: Optional[str] = Field(None, description="Tên phòng ban mới", json_schema_extra={"example": "Maintenance & Engineering"})
    department_id: Optional[str] = Field(None, description="Mã ID phòng ban chuẩn mới (vd: 'DEP-MAINTENANCE')", json_schema_extra={"example": "DEP-MAINTENANCE"})
    status: Optional[str] = Field(None, description="Trạng thái làm việc ('available', 'busy', 'off_shift', 'inactive')", json_schema_extra={"example": "available"})
    location: Optional[str] = Field(None, description="Vị trí làm việc mới", json_schema_extra={"example": "Floor 1 - 3"})
    email: Optional[str] = Field(None, description="Địa chỉ email mới", json_schema_extra={"example": "alex.lead@aurora.hotel"})
    phone: Optional[str] = Field(None, description="Số điện thoại mới", json_schema_extra={"example": "+84 90 987 6543"})
    avatar_url: Optional[str] = Field(None, description="URL ảnh đại diện mới")
    is_fallback_agent: Optional[bool] = Field(None, description="Cấu hình tiếp nhận escalation từ Robot")






# ---------------------------------------------------------
# Reception / Front Desk Schemas (Lễ tân & Đặt phòng)
# ---------------------------------------------------------
class ReceptionRequestCreate(BaseModel):
    title: str = Field("Yêu cầu Lễ tân", description="Tiêu đề yêu cầu lễ tân (vd: 'Hỗ trợ đặt phòng Suite', 'Thủ tục gia hạn lưu trú')", json_schema_extra={"example": "Hỗ trợ đặt phòng Executive Suite"})
    room_number: Optional[str] = Field("Lobby Desk", description="Số phòng hoặc vị trí tiếp nhận", json_schema_extra={"example": "Lobby Desk"})
    location: Optional[str] = Field(None, description="Vị trí thay thế cho room_number nếu dùng legacy client", json_schema_extra={"example": "Lobby"})
    guest_name: Optional[str] = Field("Hotel Guest", description="Tên khách hàng", json_schema_extra={"example": "Nguyễn Văn An"})
    description: Optional[str] = Field(None, description="Chi tiết yêu cầu lễ tân / đặt phòng", json_schema_extra={"example": "Khách muốn đặt thêm 1 phòng hướng biển 2 đêm từ ngày mai"})
    source: Optional[str] = Field("Front Desk", description="Nguồn phát sinh yêu cầu", json_schema_extra={"example": "Front Desk"})


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
    description: Optional[str] = ""
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
    recent_requests: List[ReceptionRequestResponse] = []


# ---------------------------------------------------------
# Concierge & Live Support Schemas (Trợ lý Concierge & Live Call)
# ---------------------------------------------------------
class ConciergeLiveRequestCreate(BaseModel):
    title: str = Field("Cuộc gọi video hỗ trợ trực tiếp từ Robot", description="Tiêu đề cuộc gọi trợ giúp Concierge", json_schema_extra={"example": "Yêu cầu video call hỗ trợ khách từ Robot Kiosk Sảnh"})
    room_number: Optional[str] = Field("Main Lobby Kiosk", description="Vị trí robot / phòng khách", json_schema_extra={"example": "Main Lobby Kiosk"})
    guest_name: Optional[str] = Field("Hotel Guest", description="Tên khách hàng", json_schema_extra={"example": "Mr. A. Sterling"})
    description: Optional[str] = Field(None, description="Lý do can thiệp hoặc câu hỏi chưa giải đáp được", json_schema_extra={"example": "Khách cần hướng dẫn chi tiết quy trình thuê xe riêng sang trọng"})
    assistance_status: Optional[str] = Field("Connected", description="Trạng thái kết nối video: 'Connected', 'Pending', 'Ended'", json_schema_extra={"example": "Connected"})
    transcript: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Đoạn hội thoại đã diễn ra giữa Robot và khách")
    category: Optional[str] = Field(None, description="Phân loại yêu cầu hỗ trợ")
    notify: bool = Field(True, description="Có gửi thông báo notification đến Concierge hay không")


class ConciergeLiveRequestUpdate(BaseModel):
    status: Optional[str] = None
    assistance_status: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_staff_name: Optional[str] = None
    assigned_role: Optional[str] = None
    note: Optional[str] = None
    escalated: Optional[bool] = None


class ConciergeLiveRequestResponse(BaseModel):
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
    description: Optional[str] = ""
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


class ConciergeDashboardResponse(BaseModel):
    current_request: Optional[ConciergeLiveRequestResponse] = None
    active_sessions_count: int = 0
    active_emotion_alerts_count: int = 0


class ConciergeEmotionAlertCreate(BaseModel):
    title: str = Field("Cảnh báo AI: Khách có biểu cảm khó chịu", description="Tiêu đề cảnh báo khách có biểu cảm khó chịu")
    location: str = Field("Main Lobby Kiosk", description="Vị trí phát hiện khách (Kiosk Sảnh hoặc số phòng)")
    guest_name: Optional[str] = Field(None, description="Tên khách hàng hoặc định danh")
    reporter: Optional[str] = Field("HCRobot Emotion AI", description="Nguồn ghi nhận cảnh báo")
    description: Optional[str] = Field(None, description="Mô tả biểu cảm và tình huống cần Concierge hỗ trợ")
    emotion_type: Optional[str] = Field(None, description="Loại biểu cảm (VD: Khó chịu / Unhappy)")


class ConciergeEmotionAlertUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_staff: Optional[str] = None


class ConciergeEmotionAlertResponse(BaseModel):
    id: str
    ticket_code: str
    title: str
    location: str
    guest_name: Optional[str] = None
    reporter: Optional[str] = None
    description: Optional[str] = None
    request_type: str = "emotion_alert"
    status: str
    assigned_to: Optional[str] = None
    created_at: datetime
    duplicate: bool = False

    model_config = ConfigDict(from_attributes=True)


