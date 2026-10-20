import time
import logging
from typing import Optional
import httpx

from app.middlewares.correlation_id import ctx_correlation_id, ctx_request_id

logger = logging.getLogger("hcrobot.interceptor.client")


async def outgoing_request_interceptor(request: httpx.Request):
    """
    Outgoing Request Interceptor:
    Tự động inject Correlation ID và Request ID vào header của các cuộc gọi HTTP đi ra ngoài
    (ví dụ: gọi Groq API, Cloudinary, Pi 5 Remote, Ollama) để duy trì chuỗi truy vết phân tán.
    """
    corr_id = ctx_correlation_id.get()
    if corr_id:
        request.headers["X-Correlation-ID"] = corr_id

    req_id = ctx_request_id.get()
    if req_id:
        request.headers["X-Request-ID"] = req_id

    # Lưu timestamp bắt đầu vào extensions của request
    request.extensions["start_time"] = time.perf_counter()
    logger.debug(f"[OUTGOING_HTTP >>] {request.method} {request.url} [Correlation: {corr_id}]")


async def outgoing_response_interceptor(response: httpx.Response):
    """
    Outgoing Response Interceptor:
    Đo thời gian phản hồi từ dịch vụ bên ngoài và log trạng thái.
    """
    start_time = response.request.extensions.get("start_time")
    duration_ms = ((time.perf_counter() - start_time) * 1000) if start_time else 0.0

    logger.debug(
        f"[OUTGOING_HTTP <<] {response.request.method} {response.request.url} "
        f"-> {response.status_code} ({duration_ms:.2f}ms)"
    )


def create_intercepted_client(
    timeout: float = 15.0,
    headers: Optional[dict] = None,
    **kwargs
) -> httpx.AsyncClient:
    """
    Factory function tạo một HTTPX AsyncClient đã được tích hợp sẵn Outgoing Interceptors.
    """
    event_hooks = {
        "request": [outgoing_request_interceptor],
        "response": [outgoing_response_interceptor],
    }

    # Hợp nhất với hooks người dùng truyền vào (nếu có)
    if "event_hooks" in kwargs:
        custom_hooks = kwargs.pop("event_hooks")
        for k in ("request", "response"):
            if k in custom_hooks:
                event_hooks[k].extend(custom_hooks[k])

    return httpx.AsyncClient(
        timeout=timeout,
        headers=headers,
        event_hooks=event_hooks,
        **kwargs
    )
