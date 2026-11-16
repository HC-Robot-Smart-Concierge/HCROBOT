import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI
from app.main import app
from app.services.logger_service import log_event, ctx_correlation_id, ctx_request_id


@pytest.mark.asyncio
async def test_middleware_request_id_and_process_time():
    """Kiểm tra CorrelationIdMiddleware và RequestLoggingMiddleware gắn header."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        
        # Headers phải tồn tại
        assert "x-request-id" in response.headers
        assert "x-correlation-id" in response.headers
        assert "x-process-time" in response.headers
        assert response.headers["x-process-time"].endswith("ms")


@pytest.mark.asyncio
async def test_middleware_preserves_client_correlation_id():
    """Kiểm tra khi client gửi sẵn X-Correlation-ID và X-Request-ID thì hệ thống giữ nguyên."""
    custom_req_id = "test-req-12345"
    custom_corr_id = "SR-20261019-9999"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/health",
            headers={
                "X-Request-ID": custom_req_id,
                "X-Correlation-ID": custom_corr_id,
            },
        )
        assert response.status_code == 200
        assert response.headers["x-request-id"] == custom_req_id
        assert response.headers["x-correlation-id"] == custom_corr_id


@pytest.mark.asyncio
async def test_middleware_security_headers():
    """Kiểm tra SecurityHeadersMiddleware thêm các header an toàn."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers["x-xss-protection"] == "1; mode=block"
        assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"


@pytest.mark.asyncio
async def test_global_exception_middleware():
    """Kiểm tra GlobalExceptionMiddleware bắt ngoại lệ 500 và trả về JSON chuẩn."""
    # Tạo một router tạm có endpoint cố tình gây lỗi
    test_app = FastAPI()
    from app.middlewares import register_middlewares
    register_middlewares(test_app)

    @test_app.get("/trigger-error")
    async def trigger_error():
        raise RuntimeError("Cố ý gây lỗi thử nghiệm middleware")

    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as client:
        response = await client.get("/trigger-error", headers={"X-Correlation-ID": "test-corr-error"})
        assert response.status_code == 500
        data = response.json()
        assert data["status"] == "error"
        assert data["error_code"] == "INTERNAL_SERVER_ERROR"
        assert "correlation_id" in data
        assert data["correlation_id"] == "test-corr-error"
        assert response.headers["x-correlation-id"] == "test-corr-error"


@pytest.mark.asyncio
async def test_contextvars_propagation_to_logger_service():
    """Kiểm tra contextvars tự động truyền correlation_id vào logger_service mà không cần truyền tay."""
    test_app = FastAPI()
    from app.middlewares import register_middlewares
    register_middlewares(test_app)

    captured_corr_id = None
    captured_req_id = None

    @test_app.get("/test-context")
    async def test_context_endpoint():
        nonlocal captured_corr_id, captured_req_id
        # log_event không truyền correlation_id hay request_id
        entry = log_event(message="Test contextvars log")
        captured_corr_id = entry.correlation_id
        captured_req_id = entry.request_id
        return {"status": "ok"}

    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as client:
        res = await client.get("/test-context", headers={"X-Correlation-ID": "SR-AUTO-CONTEXT-99"})
        assert res.status_code == 200
        assert captured_corr_id == "SR-AUTO-CONTEXT-99"
        assert captured_req_id is not None
