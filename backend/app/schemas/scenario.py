from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, Field


class DialogueScenarioBase(BaseModel):
    title: str = Field(..., max_length=150, description="Ten kich ban hoac cau hoi thuong gap")
    category: str = Field("faq", max_length=50, description="Danh muc: faq, greeting, facility, service, chitchat")
    match_keywords: List[str] = Field(default_factory=list, description="Danh sach tu khoa kich hoat kich ban")
    match_type: str = Field("keyword", max_length=20, description="Cach thuc khop: keyword, exact, regex")
    response_vi: str = Field(..., description="Noi dung phan hoi tieng Viet")
    response_en: Optional[str] = Field(None, description="Noi dung phan hoi tieng Anh")
    action_type: str = Field("none", max_length=50, description="Hanh dong: none, trigger_video_call, show_map, open_menu")
    action_payload: Optional[Any] = Field(None, description="Du lieu phu cho hanh dong (vi du: destination_key)")
    is_fast_path: bool = Field(True, description="True neu tra loi tuc thi <1ms ma khong goi LLM")
    is_active: bool = Field(True, description="Trang thai kich hoat")
    priority: int = Field(0, description="Do uu tien doi soat (so cang lon cang uu tien truoc)")


class DialogueScenarioCreate(DialogueScenarioBase):
    pass


class DialogueScenarioUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=150)
    category: Optional[str] = Field(None, max_length=50)
    match_keywords: Optional[List[str]] = None
    match_type: Optional[str] = Field(None, max_length=20)
    response_vi: Optional[str] = None
    response_en: Optional[str] = None
    action_type: Optional[str] = Field(None, max_length=50)
    action_payload: Optional[Any] = None
    is_fast_path: Optional[bool] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


class DialogueScenarioResponse(DialogueScenarioBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DialogueScenarioListResponse(BaseModel):
    total: int
    items: List[DialogueScenarioResponse]
