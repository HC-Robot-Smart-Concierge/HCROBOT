from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.middlewares.correlation_id import (
    CorrelationIdMiddleware,
    ctx_correlation_id,
    ctx_request_id,
)
from app.middlewares.logging_middleware import RequestLoggingMiddleware
from app.middlewares.error_handler import GlobalExceptionMiddleware
from app.middlewares.security import SecurityHeadersMiddleware


def register_middlewares(app: FastAPI) -> None:
    """
    Đăng ký toàn bộ middleware cho ứng dụng FastAPI theo mô hình Onion (củ hành) của Starlette.
    
    Thứ tự đăng ký:
    1. SecurityHeadersMiddleware (Trong cùng, ngay trước router)
    2. RequestLoggingMiddleware (Ghi log và đo process time)
    3. GlobalExceptionMiddleware (Bắt unhandled 500 exceptions thành JSON)
    4. CorrelationIdMiddleware (Sinh/gán X-Request-ID, X-Correlation-ID và ContextVars)
    5. CORSMiddleware (Ngoài cùng để xử lý OPTIONS preflight và headers)
    """
    # 1. Security Headers
    app.add_middleware(SecurityHeadersMiddleware)

    # 2. Access Logging & Process Time
    app.add_middleware(RequestLoggingMiddleware)

    # 3. Global Exception Handler
    app.add_middleware(GlobalExceptionMiddleware)

    # 4. Correlation ID & Tracing Context
    app.add_middleware(CorrelationIdMiddleware)

    # 5. CORS (Cho phép Pi 5, Web Admin & Mobile App trong mạng Local kết nối)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[
            "X-Request-ID",
            "X-Correlation-ID",
            "X-Process-Time",
        ],
    )


__all__ = [
    "register_middlewares",
    "CorrelationIdMiddleware",
    "RequestLoggingMiddleware",
    "GlobalExceptionMiddleware",
    "SecurityHeadersMiddleware",
    "ctx_correlation_id",
    "ctx_request_id",
]
