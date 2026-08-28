from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class RAGDocumentItem(BaseModel):
    id: str = Field(..., description="ID duy nhất của tài liệu", json_schema_extra={"example": "kb_pool_001"})
    document: str = Field(..., description="Nội dung tri thức bằng tiếng Việt", json_schema_extra={"example": "Hồ bơi tầng 5 mở cửa từ 6h đến 22h"})
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="Phân loại hoặc thẻ phụ", json_schema_extra={"example": {"category": "facilities"}})


class RAGDocumentListResponse(BaseModel):
    total: int
    documents: List[RAGDocumentItem]


class RAGActionResponse(BaseModel):
    message: str
    id: str
