import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db


@pytest.mark.asyncio
async def test_room_service_catalog_crud():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. GET danh sách dịch vụ phòng
        list_res = await ac.get("/api/v1/operations/room-service/services")
        assert list_res.status_code == 200
        services = list_res.json()
        assert isinstance(services, list)
        assert len(services) > 0

        # Khẳng định không có bất kỳ mục nào là "nước khoáng" hoặc ID AMENITY-06
        for item in services:
            assert "AMENITY-06" not in item.get("id", "")
            assert "nước khoáng" not in item.get("name", "").lower()
            assert "nuoc khoang" not in item.get("name", "").lower()

        # 2. Test lọc theo category
        bath_res = await ac.get("/api/v1/operations/room-service/services?category=bath")
        assert bath_res.status_code == 200
        bath_items = bath_res.json()
        assert all(it.get("category") == "bath" for it in bath_items)

        # 3. POST Tạo dịch vụ mới
        new_svc_payload = {
            "name": "Tinh dầu hoa oải hương phòng VIP",
            "category": "spa",
            "price": 50000,
            "unit": "Lọ 10ml",
            "prep_time": 10,
            "badge": "Mới",
            "description": "Tinh dầu thiên nhiên nguyên chất giúp thư giãn sâu.",
            "image_url": "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108",
            "is_available": True,
            "display_order": 99,
        }
        create_res = await ac.post("/api/v1/operations/room-service/services", json=new_svc_payload)
        assert create_res.status_code == 201
        created_item = create_res.json()
        svc_id = created_item["id"]
        assert created_item["name"] == new_svc_payload["name"]
        assert created_item["price"] == 50000
        assert created_item["is_available"] is True

        # 4. PUT Chỉnh sửa dịch vụ
        update_payload = {
            "name": "Tinh dầu hoa oải hương phòng VIP Cao Cấp",
            "price": 65000,
            "badge": "Đặc biệt",
        }
        update_res = await ac.put(f"/api/v1/operations/room-service/services/{svc_id}", json=update_payload)
        assert update_res.status_code == 200
        updated_item = update_res.json()
        assert updated_item["name"] == "Tinh dầu hoa oải hương phòng VIP Cao Cấp"
        assert updated_item["price"] == 65000
        assert updated_item["badge"] == "Đặc biệt"

        # 5. PATCH Toggle trạng thái phục vụ
        toggle_res = await ac.patch(f"/api/v1/operations/room-service/services/{svc_id}/toggle")
        assert toggle_res.status_code == 200
        assert toggle_res.json()["is_available"] is False

        toggle_res2 = await ac.patch(f"/api/v1/operations/room-service/services/{svc_id}/toggle")
        assert toggle_res2.status_code == 200
        assert toggle_res2.json()["is_available"] is True

        # 6. DELETE Xóa dịch vụ
        delete_res = await ac.delete(f"/api/v1/operations/room-service/services/{svc_id}")
        assert delete_res.status_code == 200

        # Thử toggle hoặc update lại mục đã xóa -> 404
        toggle_deleted = await ac.patch(f"/api/v1/operations/room-service/services/{svc_id}/toggle")
        assert toggle_deleted.status_code == 404

