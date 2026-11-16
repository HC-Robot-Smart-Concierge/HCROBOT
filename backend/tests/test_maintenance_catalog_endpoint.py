import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db


@pytest.mark.asyncio
async def test_maintenance_catalog_crud_and_status():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Get Catalog (should auto-seed if empty)
        cat_res = await ac.get("/api/v1/operations/maintenance/catalog")
        assert cat_res.status_code == 200
        items = cat_res.json()
        assert isinstance(items, list)
        assert len(items) > 0
        first_item = items[0]
        assert "name_vi" in first_item
        assert "name_en" in first_item
        assert "category" in first_item
        assert "priority" in first_item

        # 2. Filter Catalog by Category
        hvac_res = await ac.get("/api/v1/operations/maintenance/catalog?category=hvac")
        assert hvac_res.status_code == 200
        for it in hvac_res.json():
            assert it["category"] == "hvac"

        # 3. Create New Maintenance Catalog Item
        new_payload = {
            "name_vi": "Sự cố kiểm thử tự động",
            "name_en": "Automated Test Issue",
            "category": "other",
            "priority": "HIGH",
            "description_vi": "Mô tả kiểm thử",
            "description_en": "Test description",
            "estimated_fix_time": 25,
            "is_active": True,
            "display_order": 99,
        }
        create_res = await ac.post("/api/v1/operations/maintenance/catalog", json=new_payload)
        assert create_res.status_code == 201
        created_data = create_res.json()
        item_id = created_data["id"]
        assert created_data["name_vi"] == new_payload["name_vi"]
        assert created_data["name_en"] == new_payload["name_en"]

        # 4. Toggle Item Active State
        toggle_res = await ac.patch(f"/api/v1/operations/maintenance/catalog/{item_id}/toggle")
        assert toggle_res.status_code == 200
        assert toggle_res.json()["is_active"] is False

        # 5. Update Item
        update_res = await ac.put(
            f"/api/v1/operations/maintenance/catalog/{item_id}",
            json={"priority": "URGENT", "estimated_fix_time": 30},
        )
        assert update_res.status_code == 200
        assert update_res.json()["priority"] == "URGENT"
        assert update_res.json()["estimated_fix_time"] == 30

        # 6. Delete Item
        del_res = await ac.delete(f"/api/v1/operations/maintenance/catalog/{item_id}")
        assert del_res.status_code == 200
        assert del_res.json()["id"] == item_id

        # 7. Check Room Maintenance Status Endpoint
        status_res = await ac.get("/api/v1/operations/maintenance/rooms/402/status")
        assert status_res.status_code == 200
        status_data = status_res.json()
        assert status_data["room_number"] == "402"
        assert "total_requests" in status_data
        assert "pending_count" in status_data
        assert "in_progress_count" in status_data
        assert "completed_count" in status_data
        assert isinstance(status_data["requests"], list)

