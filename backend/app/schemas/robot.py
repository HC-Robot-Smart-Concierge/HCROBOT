from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RobotProfileUpdate(BaseModel):
    """Payload cập nhật hồ sơ & trạng thái vận hành của robot."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    model_type: Optional[str] = Field(None, min_length=1, max_length=50)
    serial_number: Optional[str] = Field(None, max_length=80)
    firmware_version: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, max_length=50)
    battery_level: Optional[int] = Field(None, ge=0, le=100)
    current_location: Optional[str] = Field(None, max_length=100)
    is_online: Optional[bool] = None
    ip_address: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None


class RobotProfileResponse(BaseModel):
    """Hồ sơ đầy đủ và chỉ số vận hành hiện tại của Robot."""
    id: str
    code: str
    name: str
    model_type: str
    serial_number: Optional[str] = None
    firmware_version: Optional[str] = None
    status: str
    battery_level: int
    current_location: str
    is_online: bool
    ip_address: Optional[str] = None
    last_heartbeat: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    total_jobs: int = 0
    completed_jobs: int = 0
    upcoming_maintenance: int = 0
    overdue_maintenance: int = 0
    hardware_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RobotJobStepItem(BaseModel):
    id: str
    step_index: int
    step_type: str
    params: Dict[str, Any] = Field(default_factory=dict)
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result_payload: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class RobotJobEventItem(BaseModel):
    id: int
    event_type: str
    message: str
    severity: str
    metadata_payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RobotJobCreate(BaseModel):
    """Tạo bản ghi lịch sử thực thi nhiệm vụ (Job) cho robot."""
    robot_id: str = "RC-001"
    title: str = Field(..., min_length=1, max_length=200)
    workflow_id: Optional[str] = None
    trigger_type: str = "MANUAL"
    status: str = "COMPLETED"
    current_step_index: int = 0
    total_steps: int = 0
    error_message: Optional[str] = None
    steps: List[Dict[str, Any]] = Field(default_factory=list)
    events: List[Dict[str, Any]] = Field(default_factory=list)


class RobotJobResponse(BaseModel):
    id: str
    job_code: str
    title: str
    workflow_id: Optional[str] = None
    robot_id: Optional[str] = None
    schedule_id: Optional[str] = None
    trigger_type: str
    status: str
    current_step_index: int
    total_steps: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RobotJobDetailResponse(RobotJobResponse):
    job_steps: List[RobotJobStepItem] = Field(default_factory=list)
    job_events: List[RobotJobEventItem] = Field(default_factory=list)


class RobotJobHistoryListResponse(BaseModel):
    robot_id: str
    total: int
    completed: int
    running: int
    failed: int
    items: List[RobotJobResponse]


class RobotMaintenanceScheduleCreate(BaseModel):
    robot_id: str = "RC-001"
    title: str = Field(..., min_length=1, max_length=200)
    maintenance_type: str = "preventive"
    component: str = "general"
    priority: str = "Normal"
    status: str = "Scheduled"
    scheduled_date: datetime
    interval_days: Optional[int] = Field(None, ge=1, le=3650)
    assigned_technician: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class RobotMaintenanceScheduleUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    maintenance_type: Optional[str] = None
    component: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    interval_days: Optional[int] = Field(None, ge=1, le=3650)
    assigned_technician: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    auto_schedule_next: bool = True


class RobotMaintenanceScheduleResponse(BaseModel):
    id: str
    robot_id: str
    title: str
    maintenance_type: str
    component: str
    priority: str
    status: str
    scheduled_date: datetime
    completed_date: Optional[datetime] = None
    interval_days: Optional[int] = None
    assigned_technician: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RobotMaintenanceListResponse(BaseModel):
    robot_id: str
    total: int
    scheduled: int
    in_progress: int
    completed: int
    overdue: int
    items: List[RobotMaintenanceScheduleResponse]

