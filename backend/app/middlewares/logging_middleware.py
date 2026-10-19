import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("hcrobot.access")

# Các đường dẫn tĩnh hoặc tài liệu API không cần log chi tiết để tránh làm loãng file log vận hành
SILENT_PATHS = {"/docs", "/redoc", "/openapi.json", "/favicon.ico"}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware ghi nhận thời gian thực thi (Process Time) và HTTP Access Log.
    - Đo chính xác thời gian xử lý của từng API request (ms).
    - Đính kèm header 'X-Process-Time' vào phản hồi.
    - Ghi log thống kê ngắn gọn: Method, Path, Status Code, Duration và Client IP.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.perf_counter()

        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000
            response.headers["X-Process-Time"] = f"{duration_ms:.2f}ms"

            if path not in SILENT_PATHS:
                status_code = response.status_code
                log_msg = f"[HTTP] {request.method} {path} -> {status_code} ({duration_ms:.2f}ms) | Client: {client_ip}"
                if status_code >= 500:
                    logger.error(log_msg)
                elif status_code >= 400:
                    logger.warning(log_msg)
                else:
                    logger.info(log_msg)

            return response
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"[HTTP] {request.method} {path} -> FAILED ({duration_ms:.2f}ms) | Client: {client_ip} | Error: {exc}"
            )
            raise exc
