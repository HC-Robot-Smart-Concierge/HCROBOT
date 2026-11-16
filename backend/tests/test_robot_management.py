import uuid
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.database import AsyncSessionLocal, init_db
from app.models.job import Job
from sqlalchemy import delete


@pytest.mark.asyncio
async def test_robot_profile_job_history_and_maintenance_crud():
    await init_db()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. GET profile & fleet ensure RC-001 exists
        prof_res = await ac.get("/api/v1/operations/robot/profile?robot_id=RC-001")
        assert prof_res.status_code == 200
        orig_profile = prof_res.json()
        assert orig_profile["id"] == "RC-001"
        assert orig_profile["code"]

        fleet_res = await ac.get("/api/v1/operations/fleet")
        assert fleet_res.status_code == 200
        fleet_data = fleet_res.json()
        assert isinstance(fleet_data, list)
        assert any(r["id"] == "RC-001" for r in fleet_data)

        created_maint_ids = []
        created_job_ids = []

        try:
            # 2. PUT profile updates operating status & profile fields
            put_res = await ac.put(
                "/api/v1/operations/robot/profile?robot_id=RC-001",
                json={
                    "name": "Aurora Concierge Test Unit",
                    "firmware_version": "v2.5.0-test",
                    "status": "CHARGING",
                    "battery_level": 88,
                    "current_location": "Trạm Sạc Robot Sảnh",
                    "is_online": True,
                },
            )
            assert put_res.status_code == 200
            updated = put_res.json()
            assert updated["name"] == "Aurora Concierge Test Unit"
            assert updated["firmware_version"] == "v2.5.0-test"
            assert updated["status"] == "CHARGING"
            assert updated["battery_level"] == 88
            assert updated["current_location"] == "Trạm Sạc Robot Sảnh"

            # 3. Maintenance schedule CRUD + overdue + recurring auto-schedule
            past_due = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
            overdue_res = await ac.post(
                "/api/v1/operations/robot/maintenance",
                json={
                    "robot_id": "RC-001",
                    "title": f"Test LiDAR Inspection {uuid.uuid4().hex[:6]}",
                    "maintenance_type": "inspection",
                    "component": "lidar",
                    "priority": "High",
                    "status": "Scheduled",
                    "scheduled_date": past_due,
                    "interval_days": 30,
                    "assigned_technician": "Test Tech",
                },
            )
            assert overdue_res.status_code == 201
            overdue_item = overdue_res.json()
            created_maint_ids.append(overdue_item["id"])
            assert overdue_item["status"] == "Overdue"

            # Complete recurring item -> sets completed_date & auto-schedules next cycle
            comp_res = await ac.put(
                f"/api/v1/operations/robot/maintenance/{overdue_item['id']}",
                json={"status": "Completed", "auto_schedule_next": True},
            )
            assert comp_res.status_code == 200
            comp_item = comp_res.json()
            assert comp_item["status"] == "Completed"
            assert comp_item["completed_date"] is not None

            list_maint_res = await ac.get("/api/v1/operations/robot/maintenance?robot_id=RC-001")
            assert list_maint_res.status_code == 200
            maint_payload = list_maint_res.json()
            assert maint_payload["total"] >= 2
            next_items = [
                it for it in maint_payload["items"]
                if it["title"] == overdue_item["title"] and it["id"] != overdue_item["id"] and it["status"] == "Scheduled"
            ]
            assert len(next_items) == 1
            created_maint_ids.append(next_items[0]["id"])

            # 4. Job history creation + workflow execute persistence
            job_res = await ac.post(
                "/api/v1/operations/robot/jobs",
                json={
                    "robot_id": "RC-001",
                    "title": f"Test Navigation Job {uuid.uuid4().hex[:6]}",
                    "trigger_type": "MANUAL",
                    "status": "COMPLETED",
                    "steps": [{"type": "MOVE", "params": {"target_x": 1.0}}],
                    "events": [{"event_type": "JOB_COMPLETED", "message": "Done", "severity": "INFO"}],
                },
            )
            assert job_res.status_code == 201
            job_data = job_res.json()
            created_job_ids.append(job_data["id"])
            assert len(job_data["job_steps"]) == 1
            assert len(job_data["job_events"]) == 1

            detail_res = await ac.get(f"/api/v1/operations/robot/jobs/{job_data['id']}")
            assert detail_res.status_code == 200
            assert detail_res.json()["job_code"] == job_data["job_code"]

            # Execute workflow -> persists real Job in DB
            wf_list = await ac.get("/api/v1/workflows")
            assert wf_list.status_code == 200
            workflows = wf_list.json()
            if workflows:
                wf = workflows[0]
                exec_res = await ac.post(
                    f"/api/v1/workflows/{wf['id']}/execute",
                    json={"robot_id": "RC-001"},
                )
                assert exec_res.status_code == 200
                jobs_list_res = await ac.get("/api/v1/operations/robot/jobs?robot_id=RC-001&limit=20")
                assert jobs_list_res.status_code == 200
                wf_jobs = [j for j in jobs_list_res.json()["items"] if j["workflow_id"] == wf["id"]]
                assert len(wf_jobs) >= 1
                created_job_ids.extend(j["id"] for j in wf_jobs if j["id"] not in created_job_ids)

        finally:
            # Restore original RC-001 profile fields
            await ac.put(
                "/api/v1/operations/robot/profile?robot_id=RC-001",
                json={
                    "name": orig_profile["name"],
                    "model_type": orig_profile["model_type"],
                    "serial_number": orig_profile.get("serial_number"),
                    "firmware_version": orig_profile.get("firmware_version"),
                    "status": orig_profile["status"],
                    "battery_level": orig_profile["battery_level"],
                    "current_location": orig_profile["current_location"],
                    "is_online": orig_profile["is_online"],
                    "ip_address": orig_profile.get("ip_address"),
                    "notes": orig_profile.get("notes"),
                },
            )
            for mid in created_maint_ids:
                await ac.delete(f"/api/v1/operations/robot/maintenance/{mid}")
            if created_job_ids:
                async with AsyncSessionLocal() as s:
                    await s.execute(delete(Job).where(Job.id.in_(created_job_ids)))
                    await s.commit()

