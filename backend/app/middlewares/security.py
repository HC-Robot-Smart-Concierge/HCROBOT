from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware gắn các Security Headers chuẩn để bảo vệ backend:
    - X-Content-Type-Options: Ngăn trình duyệt MIME-sniffing.
    - X-Frame-Options: Chống tấn công Clickjacking.
    - X-XSS-Protection: Bật bộ lọc chống Cross-Site Scripting.
    - Referrer-Policy: Bảo vệ thông tin URL nội bộ khi chuyển hướng.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
