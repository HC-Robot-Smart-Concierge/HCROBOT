from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator, FiniteFloat
from datetime import datetime


# --- WAYPOINT SCHEMAS ---
class WaypointBase(BaseModel):
    name: str = Field(..., description="Tên điểm waypoint (VD: Quầy Lễ Tân, Thang Máy A, Trạm Sạc)")
    floor: str = Field("Tầng 1", description="Tầng hiển thị")
    x: float = Field(..., description="Tọa độ X (mét)")
    y: float = Field(..., description="Tọa độ Y (mét)")
    yaw: float = Field(0.0, description="Góc quay (độ)")
    type: str = Field("standby", description="Loại điểm: dock, service, standby, room, elevator")
    description: Optional[str] = None


class WaypointCreate(WaypointBase):
    id: Optional[str] = None


class WaypointUpdate(BaseModel):
    name: Optional[str] = None
    floor: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    yaw: Optional[float] = None
    type: Optional[str] = None
    description: Optional[str] = None


class WaypointResponse(WaypointBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- WORKFLOW STEP SCHEMAS (8 Otto Steps) ---
class WorkflowStepItem(BaseModel):
    step_id: str = Field(..., description="ID định danh duy nhất của step trong workflow")
    type: str = Field(
        ...,
        description="Loại step: MOVE, GREET, COMMUNICATE, SHOW, RECOMMEND, CREATE_REQUEST, FEEDBACK (SPEAK và LISTEN hợp nhất thành COMMUNICATE)"
    )
    title: str = Field(..., description="Mô tả tiêu đề của step")
    params: Dict[str, Any] = Field(default_factory=dict, description="Các tham số chi tiết của step (silence_timeout_sec: 30, initial_prompt, ...)")


# --- WORKFLOW SCHEMAS ---
class WorkflowScheduleItem(BaseModel):
    time: str = Field(default="08:00", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    days: List[Literal[0, 1, 2, 3, 4, 5, 6]] = Field(default_factory=lambda: list(range(7)), min_length=1, max_length=7)
    timezone: Literal["Asia/Ho_Chi_Minh", "Asia/Bangkok", "UTC"] = "Asia/Ho_Chi_Minh"
    enabled: bool = True


class WorkflowRoutePoint(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    endpoint_id: Optional[str] = None
    name: str = Field(min_length=1, max_length=150)
    x: FiniteFloat
    y: FiniteFloat
    yaw: FiniteFloat = 0


class WorkflowRoute(BaseModel):
    map_id: str = Field(min_length=1, max_length=100)
    frame_id: Literal["map"] = "map"
    points: List[WorkflowRoutePoint] = Field(min_length=2, max_length=200)


class WorkflowEventBranch(BaseModel):
    event: Literal["LOW_BATTERY"]
    threshold_percent: int = Field(default=20, ge=5, le=90, strict=True)
    next_step_id: str = Field(min_length=1)
    ui_position: Optional[Dict[str, float]] = None


class WorkflowParallelConfig(BaseModel):
    """Làn Xe bắt đầu từ bước đầu tiên; Làn Màn hình và nhánh gặp khách bắt đầu từ hai bước dưới đây."""
    enabled: bool = False
    screen_step_id: Optional[str] = None
    guest_step_id: Optional[str] = None
    no_interaction_sec: int = Field(default=20, ge=5, le=120, strict=True)
    max_hold_sec: int = Field(default=600, ge=30, le=1800, strict=True)
    cooldown_sec: int = Field(default=30, ge=0, le=300, strict=True)
    screen_ui_position: Optional[Dict[str, float]] = None
    guest_ui_position: Optional[Dict[str, float]] = None


class WorkflowGuestReport(BaseModel):
    robot_id: str = "RC-001"
    state: Literal["REQUEST", "ENGAGED", "DONE"]
    idle_ms: int = Field(default=0, ge=0, le=600000)


class WorkflowExecutionConfig(BaseModel):
    execution_mode: Literal["SCREEN", "ROBOT"] = "SCREEN"
    robot_id: Literal["RC-001"] = "RC-001"
    repeat_mode: Literal["COUNT", "CONTINUOUS"] = "COUNT"
    repeat_count: int = Field(default=1, ge=1, le=1000, strict=True)
    interval_seconds: int = Field(default=0, ge=0, le=86400, strict=True)
    schedules: List[WorkflowScheduleItem] = Field(default_factory=list, max_length=20)
    route: Optional[WorkflowRoute] = None
    event_branches: List[WorkflowEventBranch] = Field(default_factory=list, max_length=1)
    parallel: Optional[WorkflowParallelConfig] = None

    @field_validator("event_branches", mode="before")
    @classmethod
    def drop_legacy_event_branches(cls, value):
        # Bỏ nhánh sự kiện cũ (VD GUEST_DETECTED); giá trị không phải list để Pydantic báo lỗi.
        if isinstance(value, list):
            return [b for b in value if isinstance(b, dict) and b.get("event") == "LOW_BATTERY"]
        return value

    @model_validator(mode="after")
    def unique_schedule_slots(self):
        slots = set()
        for schedule in self.schedules:
            if not schedule.enabled:
                continue
            for day in set(schedule.days):
                slot = (schedule.timezone, schedule.time, day)
                if slot in slots:
                    raise ValueError("Các lịch đang bật không được trùng giờ, ngày và múi giờ")
                slots.add(slot)
        return self


class WorkflowSchedulePreviewRequest(BaseModel):
    execution_config: WorkflowExecutionConfig


class WorkflowBase(BaseModel):
    name: str = Field(..., description="Tên quy trình workflow")
    description: Optional[str] = None
    trigger_type: str = Field("MANUAL", description="Cơ chế kích hoạt: AUTO_DETECT, MANUAL, SCHEDULE, GUEST_TAP")
    is_active: bool = Field(True, description="Trạng thái kích hoạt")
    execution_config: WorkflowExecutionConfig = Field(default_factory=WorkflowExecutionConfig)
    steps: List[WorkflowStepItem] = Field(default_factory=list, description="Danh sách tuần tự các bước")

class WorkflowCreate(WorkflowBase):
    id: Optional[str] = None

    @model_validator(mode="after")
    def require_schedule(self):
        if self.is_active and self.trigger_type == "SCHEDULE" and not any(s.enabled for s in self.execution_config.schedules):
            raise ValueError("Workflow theo lịch cần ít nhất một lịch đang bật")
        return self


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    is_active: Optional[bool] = None
    execution_config: Optional[WorkflowExecutionConfig] = None
    steps: Optional[List[WorkflowStepItem]] = None


class WorkflowResponse(WorkflowBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WorkflowExecuteRequest(BaseModel):
    robot_id: Optional[str] = "RC-001"
    speed_factor: Optional[float] = 1.0


class WorkflowRouteBindingRequest(BaseModel):
    route_id: str = Field(min_length=1, max_length=100)
    map_id: str = Field(min_length=1, max_length=100)
    expected_route_id: Optional[str] = None


class WorkflowExecuteResponse(BaseModel):
    status: str
    message: str
    workflow_id: str
    executed_steps: int
    logs: List[str]
    run_id: Optional[str] = None
