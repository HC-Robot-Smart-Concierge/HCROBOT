import uuid
import contextvars
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

# Context variables phục vụ truy xuất Correlation ID / Request ID ở bất kỳ đâu trong luồng async
ctx_correlation_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("ctx_correlation_id", default=None)
ctx_request_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("ctx_request_id", default=None)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware quản lý Request ID và Correlation ID.
    - Nhận X-Request-ID và X-Correlation-ID từ client nếu có, hoặc tự động tạo mới UUID.
    - Lưu vào request.state để các router/endpoint có thể truy cập trực tiếp.
    - Lưu vào contextvars để các Service (như LoggerService, AuditLog) tự động bắt được trace ID mà không cần truyền object request qua nhiều tầng.
    - Đính kèm X-Request-ID và X-Correlation-ID vào response headers gửi về cho client.
    """

    HEADER_REQUEST_ID = "X-Request-ID"
    HEADER_CORRELATION_ID = "X-Correlation-ID"

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        req_id = request.headers.get(self.HEADER_REQUEST_ID) or f"req-{uuid.uuid4().hex[:12]}"
        corr_id = request.headers.get(self.HEADER_CORRELATION_ID) or req_id

        # Gán vào request state
        request.state.request_id = req_id
        request.state.correlation_id = corr_id

        # Thiết lập contextvars cho luồng xử lý async hiện tại
        token_req = ctx_request_id.set(req_id)
        token_corr = ctx_correlation_id.set(corr_id)

        try:
            response = await call_next(request)
            response.headers[self.HEADER_REQUEST_ID] = req_id
            response.headers[self.HEADER_CORRELATION_ID] = corr_id
            return response
        finally:
            ctx_request_id.reset(token_req)
            ctx_correlation_id.reset(token_corr)
