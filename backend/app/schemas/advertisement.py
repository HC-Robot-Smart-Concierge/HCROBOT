from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class AdvertisementBase(BaseModel):
    title: str = Field(..., max_length=200, description="Tiêu đề quảng cáo (Tiếng Việt)")
    title_en: Optional[str] = Field(None, max_length=200, description="Tiêu đề quảng cáo (Tiếng Anh)")
    description: Optional[str] = Field(None, description="Mô tả chi tiết (Tiếng Việt)")
    description_en: Optional[str] = Field(None, description="Mô tả chi tiết (Tiếng Anh)")
    facility_key: Optional[str] = Field(None, max_length=80, description="Mã cơ sở vật chất liên kết (vd: sky_bar, spa, rooftop_coffee)")
    target_gender: str = Field("ALL", max_length=20, description="Giới tính mục tiêu: ALL, male, female")
    target_age_group: str = Field("ALL", max_length=30, description="Nhóm tuổi mục tiêu: ALL, child, young_adult, adult, senior")
    media_type: str = Field("IMAGE", description="Loại media: IMAGE hoặc VIDEO")
    media_url: str = Field(..., max_length=500, description="URL ảnh hoặc video")
    thumbnail_url: Optional[str] = Field(None, max_length=500, description="Thumbnail URL")
    duration_seconds: int = Field(10, ge=3, le=300, description="Thời gian phát (giây)")
    priority: int = Field(1, ge=1, le=10, description="Độ ưu tiên hiển thị (1-10)")
    is_active: bool = Field(True, description="Trạng thái kích hoạt")
    auto_play: bool = Field(False, description="Tự động phát trên màn hình Robot khi rảnh")
    display_location: str = Field("ALL", description="Vị trí hiển thị: ALL, IDLE_STANDBY, WORKFLOW")


class AdvertisementCreate(AdvertisementBase):
    public_id: Optional[str] = Field(None, max_length=200, description="Cloudinary Public ID")
    storage_provider: Optional[str] = Field("cloudinary", description="cloudinary hoặc local")


class AdvertisementUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    title_en: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    description_en: Optional[str] = None
    facility_key: Optional[str] = Field(None, max_length=80)
    target_gender: Optional[str] = Field(None, max_length=20)
    target_age_group: Optional[str] = Field(None, max_length=30)
    media_type: Optional[str] = None
    media_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[int] = Field(None, ge=3, le=300)
    priority: Optional[int] = Field(None, ge=1, le=10)
    is_active: Optional[bool] = None
    auto_play: Optional[bool] = None
    display_location: Optional[str] = None


class AdvertisementResponse(AdvertisementBase):
    id: str
    public_id: Optional[str] = None
    storage_provider: str = "cloudinary"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdvertisementPushRequest(BaseModel):
    advertisement_id: Optional[str] = Field(None, description="ID quảng cáo cần phát ngay. Nếu None, phát playlist active.")
    target_screen: str = Field("STANDBY", description="STANDBY hoặc FULLSCREEN")
    duration_seconds: Optional[int] = Field(None, description="Thời gian phát ghi đè")
