import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI, APIRouter
from app.interceptors import (
    RouteInterceptor,
    audit_action,
    measure_performance,
    create_intercepted_client,
)
from app.middlewares import register_middlewares
from app.middlewares.correlation_id import ctx_correlation_id


@pytest.mark.asyncio
async def test_route_interceptor_headers():
    """Kiểm tra RouteInterceptor can thiệp vào router và đính kèm thông tin endpoint."""
    test_app = FastAPI()
    register_middlewares(test_app)

    router = APIRouter(route_class=RouteInterceptor)

    @router.get("/custom-route")
    async def sample_endpoint():
        return {"hello": "world"}

    test_app.include_router(router)

    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as client:
        response = await client.get("/custom-route")
        assert response.status_code == 200
        assert "x-handler-time" in response.headers
        assert response.headers["x-handler-time"].endswith("ms")
        assert response.headers["x-endpoint"] == "sample_endpoint"


@pytest.mark.asyncio
async def test_audit_action_interceptor():
    """Kiểm tra @audit_action AOP Interceptor tự động bắt action và ghi audit."""
    test_app = FastAPI()
    register_middlewares(test_app)

    @test_app.post("/test-audit/{robot_id}")
    @audit_action(action="ROBOT_TEST_ACTION", resource_type="ROBOT", resource_id_arg="robot_id", default_actor_id="test_actor")
    async def test_endpoint(robot_id: str):
        return {"status": "ok", "robot": robot_id}

    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as client:
        response = await client.post("/test-audit/RC-999")
        assert response.status_code == 200
        assert response.json()["robot"] == "RC-999"


@pytest.mark.asyncio
async def test_measure_performance_interceptor():
    """Kiểm tra @measure_performance Interceptor đo đạc thời gian chạy của hàm."""
    executed = False

    @measure_performance(action_name="test_heavy_task", slow_threshold_ms=50.0)
    async def sample_task():
        nonlocal executed
        executed = True
        return 42

    result = await sample_task()
    assert result == 42
    assert executed is True


@pytest.mark.asyncio
async def test_outgoing_client_interceptor():
    """Kiểm tra Outgoing HTTP Client Interceptor tự động gắn Correlation ID vào header ra ngoài."""
    token = ctx_correlation_id.set("SR-EXTERNAL-TRACE-12345")
    try:
        # Giả lập external service với ASGITransport
        external_mock_app = FastAPI()
        captured_headers = {}

        @external_mock_app.get("/api/external")
        async def mock_external():
            return {"status": "ok"}

        # Tạo intercepted client
        client = create_intercepted_client(
            transport=ASGITransport(app=external_mock_app),
            base_url="http://mock-service",
        )

        async with client:
            res = await client.get("/api/external")
            assert res.status_code == 200
            # Header X-Correlation-ID đã được tự động inject bởi outgoing_request_interceptor
            assert res.request.headers.get("x-correlation-id") == "SR-EXTERNAL-TRACE-12345"
    finally:
        ctx_correlation_id.reset(token)
