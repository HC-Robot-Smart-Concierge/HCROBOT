from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.models import Staff, BellRequest
from app.schemas.operations import (
    BellRequestCreate,
    BellRequestStatusUpdate,
    BellRequestResponse,
    BellServicesDashboardResponse,
    StaffResponse,
)
from .shared import TAG_BELL, create_department_notification

router = APIRouter()

# 3. BELL SERVICES DASHBOARD & REQUESTS
# =====================================================================

@router.get("/dashboard/bell-services", response_model=BellServicesDashboardResponse, tags=TAG_BELL)
async def get_bell_services_dashboard(db: AsyncSession = Depends(get_db)):
    """Returns bell services requests, bell staff & robot cart status."""
    res = await db.execute(select(BellRequest).order_by(desc(BellRequest.created_at)))
    requests = res.scalars().all()

    pending_count = sum(1 for r in requests if r.status in ["Pending", "Unassigned"])
    on_job_count = sum(1 for r in requests if r.status == "In Progress")
    completed_count = sum(1 for r in requests if r.status == "Completed")

    staff_res = await db.execute(select(Staff).where(Staff.department == "Bell Services"))
    bell_staff = staff_res.scalars().all()

    team_status = [
        {"id": s.id, "name": s.full_name, "role": s.role, "status": s.status, "avatar": s.avatar_url}
        for s in bell_staff
    ]
    if not team_status:
        team_status = [
            {"id": "b1", "name": "Nhân viên Vận chuyển hành lý (Bellman)", "role": "Bellman / Luggage Staff", "status": "available", "avatar": None},
        ]
    team_status.append(
        {
            "id": "bot-alpha",
            "name": "Bot Unit Alpha",
            "role": "Automated Cart",
            "status": "available",
            "isRobot": True,
        }
    )

    available_fleet_count = sum(1 for s in team_status if s.get("status") == "available")

    kpis = {
        "pending": pending_count,
        "onJob": on_job_count,
        "completed": completed_count,
        "activeFleet": available_fleet_count,
    }

    announcement = {
        "title": "Peak Hours Approaching",
        "subtitle": "Expect high volume of check-outs between 10:00 AM and 12:00 PM.",
        "imageUrl": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&auto=format&fit=crop&q=80",
    }

    return {
        "kpis": kpis,
        "requests": requests,
        "team_status": team_status,
        "announcement": announcement,
    }


@router.post("/bell-services/requests", response_model=BellRequestResponse, status_code=status.HTTP_201_CREATED, tags=TAG_BELL)
async def create_bell_request(req_in: BellRequestCreate, db: AsyncSession = Depends(get_db)):
    """Creates a new bell request (luggage assistance, room move, lost & found)."""
    ticket_code = f"BS-{random.randint(504, 9999)}"
    new_req = BellRequest(
        ticket_code=ticket_code,
        title=req_in.title,
        location=req_in.location,
        guest_name=req_in.guest_name,
        reporter=req_in.reporter,
        description=req_in.description,
        request_type=req_in.request_type,
        status="Pending",
    )
    db.add(new_req)
    await create_department_notification(
        db=db,
        department="Bell Services",
        title=f"Yêu cầu Bellman mới: {req_in.title}",
        description=f"{req_in.location}: {req_in.description or req_in.guest_name or 'Yêu cầu hỗ trợ hành lý'}",
        request_id=new_req.id,
        request_type="bell_service",
        type="Request",
    )
    await db.commit()
    await db.refresh(new_req)
    return new_req


@router.patch("/bell-services/requests/{request_id}/status", response_model=BellRequestResponse, tags=TAG_BELL)
async def update_bell_request_status(
    request_id: str,
    update_in: BellRequestStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Accepts or assigns a bell task."""
    res = await db.execute(
        select(BellRequest).where(
            (BellRequest.id == request_id) | (BellRequest.ticket_code == request_id)
        )
    )
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Bell request not found")

    req.status = update_in.status
    if update_in.assigned_to:
        req.assigned_to = update_in.assigned_to

    await db.commit()
    await db.refresh(req)
    return req


