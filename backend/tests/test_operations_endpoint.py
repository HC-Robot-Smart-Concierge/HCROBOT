import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_all_operations_dashboards_and_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Root health check
        root_res = await ac.get("/")
        assert root_res.status_code == 200
        assert root_res.json()["status"] == "online"

        # 2. Room Service Dashboard
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

        # 6. Manager Hub Dashboard
        mgr_res = await ac.get("/api/v1/operations/dashboard/manager-hub")
        assert mgr_res.status_code == 200
        mgr_data = mgr_res.json()
        assert "kpis" in mgr_data
        assert "live_requests" in mgr_data

        # 7. Fleet & Staff
        fleet_res = await ac.get("/api/v1/operations/fleet")
        assert fleet_res.status_code == 200
        assert isinstance(fleet_res.json(), list)

        staff_res = await ac.get("/api/v1/operations/staff")
        assert staff_res.status_code == 200
        assert isinstance(staff_res.json(), list)


