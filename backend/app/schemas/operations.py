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
    is_active: bool = True

class StaffResponse(StaffBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


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

class ManagerHubDashboardResponse(BaseModel):
    department: str
    kpis: Dict[str, Any]
    live_requests: List[DirectiveResponse]
    staff_roster: List[StaffResponse]
    zone_heatmap: Dict[str, Any]
