from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator, field_validator

from .operations_concierge import StaffResponse

# ---------------------------------------------------------
# Room Service / F&B Schemas
# ---------------------------------------------------------
class OrderItem(BaseModel):
    name: str
    qty: Any # string or number, e.g. 2 or "Set of 4"
    menu_item_id: Optional[str] = None
    food_item_id: Optional[str] = None
    notes: Optional[str] = None

class OrderItemResponse(BaseModel):
    id: Optional[int] = None
    order_id: Optional[str] = None
    menu_item_id: Optional[str] = None
    food_item_id: Optional[str] = None
    item_name: str
    quantity: int = 1
    unit_price: float = 0.0
    subtotal: float = 0.0
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class RoomServiceCatalogItemBase(BaseModel):
    name: str = Field(..., description="Tên dịch vụ/tiện ích")
    category: str = Field(default="bath", description="Phân loại: bath, spa, bedding, housekeeping, laundry")
    price: float = Field(default=0.0, description="Giá dịch vụ (0 = Miễn phí)")
    unit: Optional[str] = Field(None, description="Đơn vị tính")
    prep_time: int = Field(default=10, description="Thời gian chuẩn bị (phút)")
    badge: Optional[str] = Field(None, description="Huy hiệu hiển thị")
    description: Optional[str] = Field(None, description="Mô tả chi tiết")
    image_url: Optional[str] = Field(None, description="Link hình ảnh minh họa")
    is_available: bool = Field(default=True, description="Đang phục vụ")
    display_order: int = Field(default=0, description="Thứ tự hiển thị")


class RoomServiceCatalogItemCreate(RoomServiceCatalogItemBase):
    id: Optional[str] = None


class RoomServiceCatalogItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    unit: Optional[str] = None
    prep_time: Optional[int] = None
    badge: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_available: Optional[bool] = None
    display_order: Optional[int] = None


class RoomServiceCatalogItemResponse(RoomServiceCatalogItemBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RoomServiceOrderCreate(BaseModel):
    room_number: str
    items: List[OrderItem]
    note: Optional[str] = None
    image_url: Optional[str] = None
    is_service_request: bool = False
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    room_phone: Optional[str] = None
    is_merged: Optional[bool] = False

class RoomServiceOrderStatusUpdate(BaseModel):
    status: str # 'Pending', 'Cooking', 'Ready', 'Delivering', 'Completed', 'Rejected'
    progress: Optional[int] = None
    est_completion: Optional[str] = None
    assigned_staff_name: Optional[str] = None


class RoomServiceOrderResponse(BaseModel):
    id: str
    order_number: str
    room_id: Optional[str] = None
    room_number: str
    account_id: Optional[str] = None
    status: str
    items: List[Dict[str, Any]]
    note: Optional[str]
    image_url: Optional[str]
    is_service_request: bool
    progress: int
    est_completion: Optional[str]
    assigned_robot_id: Optional[str]
    assigned_staff_name: Optional[str]
    total_amount: Optional[float] = 0.0
    created_at: datetime
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    room_phone: Optional[str] = None
    is_merged: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)


class RoomOrderedItemSummary(BaseModel):
    item_name: str = Field(..., description="Tên món ăn / đồ uống đã đặt")
    total_quantity: int = Field(1, description="Tổng số lượng đã đặt của món này")
    unit_price: Optional[float] = Field(0.0, description="Đơn giá tham khảo (VNĐ)")
    total_price: Optional[float] = Field(0.0, description="Tổng tiền tính cho món này (VNĐ)")
    last_ordered_at: Optional[datetime] = Field(None, description="Thời điểm đặt gần nhất")


class RoomOrdersHistoryResponse(BaseModel):
    room_number: str = Field(..., description="Số phòng tra cứu (vd: '402', 'ROOM 201')")
    total_orders: int = Field(0, description="Tổng số đơn hàng Room Service của phòng")
    total_amount: float = Field(0.0, description="Tổng số tiền các đơn của phòng (VNĐ)")
    ordered_items_summary: List[RoomOrderedItemSummary] = Field(default_factory=list, description="Danh sách tổng hợp các món ăn phòng đó đã đặt")
    orders: List[RoomServiceOrderResponse] = Field(default_factory=list, description="Danh sách chi tiết từng đơn hàng của phòng")


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
    status: Optional[str] = "In Progress"
    assigned_staff_name: Optional[str] = None
    assigned_staff: Optional[str] = None
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
    # Robot kiosk: a key from bell_request_service.BELL_SERVICES, or "auto" to classify the
    # guest's words. Either enables duplicate protection; staff quick requests omit it.
    service_key: Optional[str] = Field(None, max_length=50)
    source: Optional[str] = Field(None, max_length=100)

class BellRequestStatusUpdate(BaseModel):
    status: Optional[str] = None # 'Pending', 'In Progress', 'Completed'
    assigned_to: Optional[str] = None
    assigned_staff: Optional[str] = None

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
    bell_service: Optional[str] = None
    duplicate: bool = False

    model_config = ConfigDict(from_attributes=True)


class BellRoomStatusResponse(BaseModel):
    room_number: str
    pending_count: int
    in_progress_count: int
    completed_count: int
    requests: List[BellRequestResponse]


# ---------------------------------------------------------
# Maintenance Schemas
# ---------------------------------------------------------
class MaintenanceRequestCreate(BaseModel):
    title: str
    catalog_item_id: Optional[str] = Field(None, max_length=50)
    category: str = "general"
    location: str
    description: Optional[str] = None
    source: str = "MANUAL DISPATCH"

class MaintenanceRequestStatusUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_technician: Optional[str] = None

class MaintenanceRequestPriorityUpdate(BaseModel):
    priority: Literal["Normal", "Urgent"]

class MaintenanceRequestResponse(BaseModel):
    id: str
    duplicate: bool = False
    merged: bool = False
    priority: str = "Normal"
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


class MaintenanceCatalogItemCreate(BaseModel):
    name_vi: str = Field(..., description="Tên sự cố tiếng Việt", min_length=2, max_length=150)
    name_en: str = Field(..., description="Tên sự cố tiếng Anh", min_length=2, max_length=150)
    category: str = Field("hvac", description="Phân loại: hvac, plumbing, electrical, door_lock, media_network, appliance, other")
    priority: str = Field("NORMAL", description="Mức độ ưu tiên: LOW, NORMAL, HIGH, URGENT")
    description_vi: Optional[str] = None
    description_en: Optional[str] = None
    estimated_fix_time: int = Field(15, description="Thời gian xử lý ước tính (phút)")
    is_active: bool = True
    display_order: int = 0


class MaintenanceCatalogItemUpdate(BaseModel):
    name_vi: Optional[str] = None
    name_en: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    description_vi: Optional[str] = None
    description_en: Optional[str] = None
    estimated_fix_time: Optional[int] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class MaintenanceCatalogItemResponse(BaseModel):
    id: str
    name_vi: str
    name_en: str
    category: str
    priority: str
    description_vi: Optional[str] = None
    description_en: Optional[str] = None
    estimated_fix_time: int
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoomMaintenanceRequestItem(BaseModel):
    id: str
    ticket_code: str
    title: str
    category: str
    status: str
    priority: str
    assigned_to: Optional[str] = None
    created_at: datetime
    est_completion: Optional[str] = None
    description: Optional[str] = None


class RoomMaintenanceStatusResponse(BaseModel):
    room_number: str
    total_requests: int
    pending_count: int
    in_progress_count: int
    completed_count: int
    requests: List[RoomMaintenanceRequestItem]


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


