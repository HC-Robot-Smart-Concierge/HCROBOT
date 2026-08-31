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


class RAGStatsResponse(BaseModel):
    total_documents: int
    total_sources: int
    rag_health_percent: float = 98.2
    categories: Dict[str, int] = Field(default_factory=dict)
    last_synced: str = "Just now"


class RAGSourceFileItem(BaseModel):
    filename: str
    file_type: str
    file_size_kb: float
    chunks_count: int
    last_modified: str
    status: str = "Synced"
    content: Optional[str] = None


class RAGSourceFilesResponse(BaseModel):
    total: int
    sources: List[RAGSourceFileItem]


class RAGFileUploadResponse(BaseModel):
    message: str
    filename: str
    chunks_created: int
    image_url: Optional[str] = None

