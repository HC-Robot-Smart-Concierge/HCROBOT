import random
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models import ReceptionRequest
from app.schemas.operations import (
    ReceptionRequestCreate,
    ReceptionRequestUpdate,
    ReceptionRequestResponse,
    ReceptionDashboardResponse,
)
from .shared import TAG_REC, create_department_notification

router = APIRouter()

# 0. RECEPTION / FRONT DESK REQUEST DETAIL
# =====================================================================

@router.get("/dashboard/reception", response_model=ReceptionDashboardResponse, tags=TAG_REC)
async def get_reception_dashboard(db: AsyncSession = Depends(get_db)):
    """Returns the most recent guest request handled by Front Desk staff."""
    result = await db.execute(
        select(ReceptionRequest)
        .where(
            (ReceptionRequest.department_id == "DEP-RECEPTION")
            | (ReceptionRequest.ticket_code.like("REC%"))
            | (ReceptionRequest.ticket_code.like("REQ%"))
        )
        .order_by(desc(ReceptionRequest.created_at))
        .limit(1)
    )
    return {"current_request": result.scalar_one_or_none()}


@router.post("/reception/requests", response_model=ReceptionRequestResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REC)
async def create_reception_request(req_in: ReceptionRequestCreate, db: AsyncSession = Depends(get_db)):
    """Creates a new front desk reception ticket."""
    ticket_code = f"REC-{random.randint(100, 9999)}"
    new_req = ReceptionRequest(
        ticket_code=ticket_code,
        title=req_in.title,
        description=req_in.description,
        department_id="DEP-RECEPTION",
        service_type_id="ST-RECEPTION-INQUIRY",
        room_number=req_in.location,
        guest_name=req_in.guest_name,
        source=req_in.source,
        priority=req_in.priority,
        status="Pending",
    )
    db.add(new_req)
    await create_department_notification(
        db=db,
        department="Reception",
        title=f"Yêu cầu Lễ tân: {req_in.title}",
        description=f"{req_in.location} ({req_in.guest_name}): {req_in.description or 'Cần hỗ trợ lễ tân'}",
        request_id=new_req.id,
        request_type="reception",
        type="Request",
    )
    await db.commit()
    await db.refresh(new_req)
    return new_req


@router.patch(
    "/reception/requests/{request_id}",
    response_model=ReceptionRequestResponse,
    tags=TAG_REC,
)
async def update_reception_request(
    request_id: str,
    update_in: ReceptionRequestUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates status, assistance, assignment, notes, or escalation for a Front Desk request."""
    result = await db.execute(
        select(ReceptionRequest).where(
            (ReceptionRequest.id == request_id)
            | (ReceptionRequest.ticket_code == request_id)
        )
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Reception request not found")

    if update_in.status is not None:
        request.status = update_in.status
    if update_in.assigned_to is not None:
        request.assigned_staff_name = update_in.assigned_to
    if update_in.note:
        request.description = f"{request.description or ''} | Note: {update_in.note}".strip(" |")
    if update_in.escalated:
        request.priority = "HIGH"

    await db.commit()
    await db.refresh(request)
    return request

