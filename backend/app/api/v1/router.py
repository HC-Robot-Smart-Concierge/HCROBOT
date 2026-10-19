from fastapi import APIRouter
from app.api.v1.endpoints import ai, scenarios, rag, map, operations, auth, logs, workflows
from app.interceptors import RouteInterceptor
from app.schemas.response import (
    AUTH_RESPONSES,
    BUSINESS_ERROR_RESPONSES,
    NOT_FOUND_RESPONSES,
    SECURED_CRUD_RESPONSES,
)

api_router = APIRouter(route_class=RouteInterceptor)

# Swagger UI API Docs organized by Department with contextual Response Codes
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["01. Xác thực Hệ thống & JWT (Authentication)"],
)

api_router.include_router(
    ai.router,
    prefix="/ai",
    tags=["02. Trợ lý Giọng nói AI (Ollama Voice Engine)"],
    responses=BUSINESS_ERROR_RESPONSES,
)

api_router.include_router(
    scenarios.router,
    prefix="/ai/scenarios",
    tags=["02. Trợ lý Giọng nói AI (Ollama Voice Engine)"],
    responses={**BUSINESS_ERROR_RESPONSES, **NOT_FOUND_RESPONSES},
)

api_router.include_router(
    map.router,
    prefix="/map",
    tags=["03. Định vị & Bản đồ LiDAR SLAM (Robot Navigation)"],
    responses={**BUSINESS_ERROR_RESPONSES, **NOT_FOUND_RESPONSES},
)

api_router.include_router(
    workflows.router,
    prefix="/workflows",
    tags=["03. Định vị & Bản đồ LiDAR SLAM (Robot Navigation)"],
    responses={**BUSINESS_ERROR_RESPONSES, **NOT_FOUND_RESPONSES},
)

api_router.include_router(
    rag.router,
    prefix="/rag",
    tags=["04. Cơ sở Tri thức & RAG Lễ tân (Knowledge Base & RAG)"],
    responses={**BUSINESS_ERROR_RESPONSES, **NOT_FOUND_RESPONSES},
)

# Toàn bộ các bộ phận vận hành khách sạn (Lễ tân, Buồng phòng, Bếp, Robot, Admin, ...)
api_router.include_router(
    operations.router,
    prefix="/operations",
    responses=SECURED_CRUD_RESPONSES,
)

# Nhật ký & Audit Trail
api_router.include_router(
    logs.router,
    tags=["17. Nhật ký Vận hành & Audit Trail (Logging & Trace)"],
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSES},
)

