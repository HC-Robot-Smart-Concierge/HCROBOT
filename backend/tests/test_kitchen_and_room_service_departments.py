import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete
from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.support_request import SupportRequest
from app.models.room_service import RoomServiceOrder


@pytest.mark.asyncio
async def test_food_order_assigned_to_kitchen_department():
    """Đảm bảo đơn gọi món ẩm thực (is_service_request=False) được định tuyến vào Bếp (Kitchen / DEP-KITCHEN)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        order_payload = {
            "room_number": "302",
            "items": [{"name": "Phở bò đặc biệt", "qty": 1, "price": 85000}],
            "total_amount": 85000,
            "is_service_request": False,
            "special_instructions": "Không hành tây",
        }
        res = await ac.post("/api/v1/operations/room-service/orders", json=order_payload)
        assert res.status_code in [200, 201]
        data = res.json()
        order_id = data["id"]

        # 1. Kiểm tra trực tiếp trong DB (SupportRequest)
        async with AsyncSessionLocal() as db:
            sr = await db.get(SupportRequest, order_id)
            assert sr is not None
            assert sr.department_id == "DEP-KITCHEN"

        # 2. Kiểm tra API GET /tasks
        tasks_res = await ac.get("/api/v1/operations/tasks")
        assert tasks_res.status_code == 200
        tasks = tasks_res.json()
        target_task = next((t for t in tasks if t.get("raw_id") == order_id), None)
        assert target_task is not None
        assert target_task.get("department") == "Kitchen"
        assert target_task.get("table_type") == "room_service"
        assert target_task.get("is_service_request") is False


@pytest.mark.asyncio
async def test_service_order_assigned_to_room_service_department():
    """Đảm bảo đơn dịch vụ phòng (is_service_request=True) được định tuyến vào Room Service (DEP-ROOMSERVICE)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        service_payload = {
            "room_number": "302",
            "items": [{"name": "Thêm 2 khăn tắm", "qty": 2, "price": 0}],
            "total_amount": 0,
            "is_service_request": True,
            "note": "Yêu cầu thêm khăn tắm và đồ dùng vệ sinh",
        }
        res = await ac.post("/api/v1/operations/room-service/orders", json=service_payload)
        assert res.status_code in [200, 201]
        data = res.json()
        order_id = data["id"]

        # 1. Kiểm tra trực tiếp trong DB (SupportRequest)
        async with AsyncSessionLocal() as db:
            sr = await db.get(SupportRequest, order_id)
            assert sr is not None
            assert sr.department_id == "DEP-ROOMSERVICE"

        # 2. Kiểm tra API GET /tasks
        tasks_res = await ac.get("/api/v1/operations/tasks")
        assert tasks_res.status_code == 200
        tasks = tasks_res.json()
        target_task = next((t for t in tasks if t.get("raw_id") == order_id), None)
        assert target_task is not None
        assert target_task.get("department") == "Room Service"
        assert target_task.get("table_type") == "room_service"
        assert target_task.get("is_service_request") is True



@pytest.mark.asyncio
async def test_dashboard_room_service_and_kitchen_isolation():
    """Đảm bảo /dashboard/room-service lọc cô lập hoàn toàn giữa Room Service và Kitchen."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Gọi với is_service_request=true (Room Service Portal)
        rs_res = await ac.get("/api/v1/operations/dashboard/room-service?is_service_request=true")
        assert rs_res.status_code == 200
        rs_data = rs_res.json()
        assert "orders" in rs_data
        for o in rs_data["orders"]:
            assert o.get("is_service_request") is True, "Room Service dashboard tuyệt đối không được chứa món ăn của Bếp"

        # 2. Gọi với is_service_request=false (Kitchen Dashboard)
        k_res = await ac.get("/api/v1/operations/dashboard/room-service?is_service_request=false")
        assert k_res.status_code == 200
        k_data = k_res.json()
        assert "orders" in k_data
        for o in k_data["orders"]:
            assert o.get("is_service_request") is False, "Kitchen dashboard tuyệt đối không được chứa yêu cầu dịch vụ phòng"
