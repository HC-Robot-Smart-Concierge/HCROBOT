import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.init_db import init_db


@pytest.mark.asyncio
async def test_all_operations_dashboards_and_endpoints():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Root health check
        root_res = await ac.get("/")
        assert root_res.status_code == 200
        assert root_res.json()["status"] == "online"

        # 2. Reception Dashboard
        reception_res = await ac.get("/api/v1/operations/dashboard/reception")
        assert reception_res.status_code == 200
        assert "current_request" in reception_res.json()

        # 3. Room Service Dashboard
        rs_res = await ac.get("/api/v1/operations/dashboard/room-service")
        assert rs_res.status_code == 200
        rs_data = rs_res.json()
        assert "kpis" in rs_data
        assert "orders" in rs_data
        assert "delivery_fleet" in rs_data

        # 3. Housekeeping Dashboard
        hk_res = await ac.get("/api/v1/operations/dashboard/housekeeping")
        assert hk_res.status_code == 200
        hk_data = hk_res.json()
        assert "kpis" in hk_data
        assert "requests" in hk_data

        # 4. Bell Services Dashboard
        bell_res = await ac.get("/api/v1/operations/dashboard/bell-services")
        assert bell_res.status_code == 200
        bell_data = bell_res.json()
        assert "kpis" in bell_data
        assert "requests" in bell_data

        # 5. Maintenance Dashboard
        mn_res = await ac.get("/api/v1/operations/dashboard/maintenance")
        assert mn_res.status_code == 200
        mn_data = mn_res.json()
        assert "kpis" in mn_data
        assert "requests" in mn_data

        # 6. Retired Manager Hub route stays unavailable
        mgr_res = await ac.get("/api/v1/operations/dashboard/manager-hub")
        assert mgr_res.status_code == 404

        # 7. Fleet & Staff
        fleet_res = await ac.get("/api/v1/operations/fleet")
        assert fleet_res.status_code == 200
        assert isinstance(fleet_res.json(), list)

        staff_res = await ac.get("/api/v1/operations/staff")
        assert staff_res.status_code == 200
        assert isinstance(staff_res.json(), list)

        # 8. Reception requests participate in the shared staff workflow
        unified_res = await ac.get("/api/v1/operations/all-requests")
        assert unified_res.status_code == 200
        unified_data = unified_res.json()
        assert isinstance(unified_data, list)
        assert all("department" in request for request in unified_data)

        # 9. Test Staff Soft Delete
        create_staff_res = await ac.post("/api/v1/operations/staff", json={
            "username": "test_soft_delete_staff",
            "password": "secret_password",
            "full_name": "Test Soft Delete Staff",
            "role": "Cleaner",
            "department": "Housekeeping",
        })
        assert create_staff_res.status_code == 201
        created_id = create_staff_res.json()["id"]

        del_res = await ac.delete(f"/api/v1/operations/staff/{created_id}")
        assert del_res.status_code == 200
        del_data = del_res.json()
        assert del_data["is_active"] is False
        assert del_data["status"] == "inactive"

        # Verify not returned in active staff roster
        roster_res = await ac.get("/api/v1/operations/staff")
        active_ids = [s["id"] for s in roster_res.json()]
        assert created_id not in active_ids

        # Verify returned when include_inactive=true
        all_roster_res = await ac.get("/api/v1/operations/staff?include_inactive=true")
        all_ids = [s["id"] for s in all_roster_res.json()]
        assert created_id in all_ids


