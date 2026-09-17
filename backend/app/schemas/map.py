from typing import List, Optional
from pydantic import BaseModel, Field


class Pose2D(BaseModel):
    x: float = Field(..., description="Tọa độ X tính bằng mét")
    y: float = Field(..., description="Tọa độ Y tính bằng mét")
    yaw: float = Field(..., description="Góc quay Yaw tính bằng độ (-180 đến 180)")


class Waypoint(BaseModel):
    id: str = Field(..., description="ID duy nhất của waypoint/endpoint")
    name: str = Field(..., description="Tên điểm (vd: Quầy Lễ Tân, Trạm Sạc Fast Charger, Bàn VIP)")
    x: float
    y: float
    yaw: float = 0.0
    floor: str = "Sảnh Tầng 1"
    type: str = Field("WAYPOINT", description="Mẫu Endpoint Concierge: WAYPOINT, PARKING_SPOT, DOCKING_TARGET, SERVICE_STATION, GUEST_TABLE")
    description: Optional[str] = None


class ZoneSchema(BaseModel):
    id: str = Field(..., description="ID duy nhất của vùng chức năng")
    name: str = Field(..., description="Tên vùng (vd: Cầu Thang Bộ, Khu Giảm Tốc Sảnh)")
    type: str = Field("KEEP_OUT", description="Loại vùng: KEEP_OUT, SLOW_SPEED, SILENT_ZONE, GREETING_ZONE, SERVICE_PRIORITY")
    x: float = Field(0.0, description="Tọa độ X tâm vùng")
    y: float = Field(0.0, description="Tọa độ Y tâm vùng")
    width: float = Field(2.0, description="Chiều rộng vùng (mét)")
    height: float = Field(2.0, description="Chiều cao vùng (mét)")
    speed_limit: Optional[float] = Field(0.3, description="Tốc độ tối đa cho phép (m/s) nếu là SLOW_SPEED")
    floor: str = "Sảnh Tầng 1"
    description: Optional[str] = None


class MapMetaData(BaseModel):
    width: int = Field(200, description="Chiều rộng bản đồ theo pixel/grid cells")
    height: int = Field(200, description="Chiều cao bản đồ theo pixel/grid cells")
    resolution: float = Field(0.05, description="Độ phân giải (mét / pixel)")
    origin_x: float = Field(-5.0, description="Tọa độ gốc X trên thế giới thực (mét)")
    origin_y: float = Field(-5.0, description="Tọa độ gốc Y trên thế giới thực (mét)")


class OccupancyGridResponse(BaseModel):
    metadata: MapMetaData
    robot_pose: Pose2D
    waypoints: List[Waypoint]
    zones: List[ZoneSchema] = Field(default_factory=list, description="Danh sách các vùng chức năng")
    grid_data: List[int] = Field(..., description="Mảng 1D đại diện cho ma trận 2D (-1: chưa rõ, 0: trống, 100: vật cản)")


class NavigationRequest(BaseModel):
    target_x: float
    target_y: float
    target_yaw: Optional[float] = 0.0
    waypoint_id: Optional[str] = None


class NavigationResponse(BaseModel):
    status: str
    message: str
    target_x: float
    target_y: float

