from typing import List, Optional
import math
from pydantic import BaseModel, Field, model_validator
from app.services.zone_geometry import polygon_geometry


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
    type: str = Field("WAYPOINT", description="Mẫu Endpoint Concierge: WAYPOINT, CHARGER, PARK")
    description: Optional[str] = None
    map_id: Optional[str] = Field(None, description="Tên map SLAM chứa điểm này (vd: layout2)")


class ZoneVertex(BaseModel):
    x: float = Field(..., allow_inf_nan=False)
    y: float = Field(..., allow_inf_nan=False)


class ZoneSchema(BaseModel):
    id: str = Field(..., description="ID duy nhất của vùng chức năng")
    name: str = Field(..., description="Tên vùng (vd: Cầu Thang Bộ, Khu Giảm Tốc Sảnh, Cửa Thông Sảnh)")
    type: str = Field("KEEP_OUT", description="Loại vùng: KEEP_OUT (Khu vực cấm vào), SPEED_ZONE / SLOW_SPEED (Giới hạn tốc độ), NO_STOP (Khu vực cấm dừng), SILENT_ZONE, GREETING_ZONE, SERVICE_PRIORITY")
    x: float = Field(0.0, description="Tọa độ X tâm vùng")
    y: float = Field(0.0, description="Tọa độ Y tâm vùng")
    width: float = Field(2.0, description="Chiều rộng vùng (mét)")
    height: float = Field(2.0, description="Chiều cao vùng (mét)")
    yaw: float = Field(0.0, allow_inf_nan=False, description="Góc xoay vùng, độ ngược chiều kim đồng hồ trong khung map")
    vertices: Optional[List[ZoneVertex]] = Field(None, min_length=3, max_length=64,
        description="Ordered polygon vertices in absolute map metres; null keeps the rotated rectangle.")
    speed_limit: Optional[float] = Field(0.2, description="Tốc độ tối đa cho phép (m/s) nếu là SPEED_ZONE / SLOW_SPEED")
    floor: str = "Sảnh Tầng 1"
    description: Optional[str] = None
    map_id: Optional[str] = Field(None, description="Tên map SLAM chứa vùng này (vd: layout2)")

    @model_validator(mode='after')
    def validate_speed_zone(self):
        if self.vertices is not None:
            geometry = polygon_geometry(self.vertices)
            for key in ('x', 'y', 'width', 'height', 'yaw'):
                setattr(self, key, geometry[key])
        if not all(math.isfinite(v) for v in (self.x, self.y, self.width, self.height)) or self.width <= 0 or self.height <= 0:
            raise ValueError('Vùng phải có tọa độ hữu hạn và kích thước dương.')
        self.yaw = (self.yaw + 180) % 360 - 180
        if self.type.upper() in ('SPEED_ZONE', 'SLOW_SPEED'):
            if self.speed_limit is None or not math.isfinite(self.speed_limit) or not 0.01 <= self.speed_limit <= 1.0:
                raise ValueError('Giới hạn tốc độ phải từ 0.01 đến 1.00 m/s.')
            if not all(math.isfinite(v) for v in (self.x, self.y, self.width, self.height)) or self.width <= 0 or self.height <= 0:
                raise ValueError('Vùng tốc độ phải có tọa độ hữu hạn và kích thước dương.')
        return self


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


