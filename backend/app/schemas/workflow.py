from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
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
        description="Loại step: MOVE, GREET, SPEAK, SHOW, LISTEN, RECOMMEND, CREATE_REQUEST, FEEDBACK"
    )
    title: str = Field(..., description="Mô tả tiêu đề của step")
    params: Dict[str, Any] = Field(default_factory=dict, description="Các tham số chi tiết của step")


# --- WORKFLOW SCHEMAS ---
class WorkflowBase(BaseModel):
    name: str = Field(..., description="Tên quy trình workflow")
    description: Optional[str] = None
    trigger_type: str = Field("MANUAL", description="Cơ chế kích hoạt: AUTO_DETECT, MANUAL, SCHEDULE, GUEST_TAP")
    is_active: bool = Field(True, description="Trạng thái kích hoạt")
    steps: List[WorkflowStepItem] = Field(default_factory=list, description="Danh sách tuần tự các bước")


class WorkflowCreate(WorkflowBase):
    id: Optional[str] = None


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    is_active: Optional[bool] = None
    steps: Optional[List[WorkflowStepItem]] = None


class WorkflowResponse(WorkflowBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WorkflowExecuteRequest(BaseModel):
    robot_id: Optional[str] = "RC-001"
    speed_factor: Optional[float] = 1.0


class WorkflowExecuteResponse(BaseModel):
    status: str
    message: str
    workflow_id: str
    executed_steps: int
    logs: List[str]
