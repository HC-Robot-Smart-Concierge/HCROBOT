import logging
import traceback
from datetime import datetime, timezone
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = logging.getLogger("hcrobot.exception")


class GlobalExceptionMiddleware(BaseHTTPMiddleware):
    """
    Middleware xử lý ngoại lệ toàn cục (Global Exception Handler).
    - Bắt mọi ngoại lệ unhandled chưa được try-catch ở tầng router/service.
    - Ngăn chặn server trả về phản hồi 500 HTML mặc định làm lỗi parse JSON trên Robot và Web Admin.
    - Chuẩn hóa payload trả về dạng JSON đồng nhất kèm theo correlation_id để phục vụ tra cứu log trong Audit Trail.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            return await call_next(request)
        except Exception as exc:
            corr_id = getattr(request.state, "correlation_id", "N/A")
            req_id = getattr(request.state, "request_id", "N/A")

            logger.error(
                f"[UNHANDLED EXCEPTION] {request.method} {request.url.path} "
                f"[Correlation: {corr_id}] [Request: {req_id}]: {exc}\n"
                f"{traceback.format_exc()}"
            )

            headers = {
                "X-Request-ID": req_id,
                "X-Correlation-ID": corr_id,
            }

            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "error_code": "INTERNAL_SERVER_ERROR",
                    "message": "Đã xảy ra lỗi máy chủ nội bộ. Vui lòng liên hệ ban quản trị hệ thống.",
                    "correlation_id": corr_id,
                    "request_id": req_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
                headers=headers,
            )
