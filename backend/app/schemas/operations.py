from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------
# Staff & Robot Fleet Schemas
# ---------------------------------------------------------
class StaffBase(BaseModel):
    code: str
    full_name: str
    role: str
    department: str
    location: str = "Main Hotel"
    status: str = "available"
    current_tasks_count: int = 0
    avatar_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    shift: Optional[str] = "Morning Shift (06:00 - 14:00)"
    is_fallback_agent: bool = False
    assigned_floors: Optional[str] = "Floor 1 - 5"
    notification_channels: Optional[str] = "Web Dashboard, Tablet Alert"
    is_active: bool = True

class StaffResponse(StaffBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StaffCreate(BaseModel):
    username: str
    password: str = "123456"
    full_name: str
    role: str
    department: str
    code: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = "+84 90 123 4567"
    shift: Optional[str] = "Morning Shift (06:00 - 14:00)"
    location: str = "Main Hotel"
    status: str = "available"
    avatar_url: Optional[str] = None
    is_fallback_agent: bool = False
    assigned_floors: Optional[str] = "Floor 1 - 5"
    notification_channels: Optional[str] = "Web Dashboard, Tablet Alert"


class StaffUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    shift: Optional[str] = None
    avatar_url: Optional[str] = None
    is_fallback_agent: Optional[bool] = None
    assigned_floors: Optional[str] = None
    notification_channels: Optional[str] = None



class RobotUnitBase(BaseModel):
    unit_code: str
    name: str
    model_type: str = "delivery"
    status: str = "Available"
    status_color: str = "emerald"
    location: str = "Dock 1"
    battery_level: int = 100
    current_payload: Optional[str] = None
    is_online: bool = True

class RobotUnitResponse(RobotUnitBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


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
    priority: str
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
    is_vip: bool = False
    priority: str = "normal"
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
    is_vip: bool
    status: str
    priority: str
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
    priority: str = "NORMAL"
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
    priority: str
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
    priority: str = "HIGH PRIORITY"
    is_urgent: bool = False
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
    priority: str
    is_urgent: bool
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
    priority: str = "HIGH PRIORITY"
    location: str
    description: Optional[str] = None
    source: str = "MANUAL DISPATCH"

class MaintenanceRequestResponse(BaseModel):
    id: str
    ticket_code: str
    title: str
    category: str
    priority: str
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
    delivery_fleet: List[RobotUnitResponse]
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
    department: str  # 'Reception', 'Housekeeping', 'F&B', 'Bell Services', 'Maintenance', 'Directive'
    title: str
    room_number: str = Field(..., description="Số phòng hoặc vị trí ví dụ 'Room 412', 'Lobby'")
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
    is_vip: bool = False
    category: str
    origin_robot_code: str
    sentiment: str
    wait_time_label: str
    status: str
    linked_request_id: Optional[str] = None
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


