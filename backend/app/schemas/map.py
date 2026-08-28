from typing import List, Optional
from pydantic import BaseModel, Field


class Pose2D(BaseModel):
    x: float = Field(..., description="Tọa độ X tính bằng mét")
    y: float = Field(..., description="Tọa độ Y tính bằng mét")
    yaw: float = Field(..., description="Góc quay Yaw tính bằng độ (-180 đến 180)")


class Waypoint(BaseModel):
    id: str = Field(..., description="ID duy nhất của waypoint")
    name: str = Field(..., description="Tên điểm (vd: Lễ Tân, Hồ Bơi, Phòng 101)")
    x: float
    y: float
    yaw: float = 0.0
    floor: str = "Tầng 1"


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
