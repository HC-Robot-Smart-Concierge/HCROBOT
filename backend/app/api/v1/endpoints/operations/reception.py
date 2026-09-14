from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models import ReceptionRequest
from app.schemas.operations import (
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
        select(ReceptionRequest).order_by(desc(ReceptionRequest.created_at)).limit(1)
    )
    return {"current_request": result.scalar_one_or_none()}


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

    timestamp = datetime.now().strftime("%I:%M %p").lstrip("0")
    new_activity = list(request.activity_log or [])

    if update_in.status is not None and update_in.status != request.status:
        request.status = update_in.status
        new_activity.insert(
            0,
            {
                "title": f"Status changed to {update_in.status}",
                "detail": "Updated by Front Desk staff",
                "time": timestamp,
            },
        )
    if update_in.assistance_status is not None:
        request.assistance_status = update_in.assistance_status
        new_activity.insert(
            0,
            {
                "title": f"Live assistance {update_in.assistance_status.lower()}",
                "detail": "Front Desk video assistance session",
                "time": timestamp,
            },
        )
    if update_in.assigned_to is not None:
        request.assigned_to = update_in.assigned_to
        request.assigned_role = update_in.assigned_role or request.assigned_role
        new_activity.insert(
            0,
            {
                "title": "Task Assigned",
                "detail": f"System assigned to {update_in.assigned_to}",
                "time": timestamp,
            },
        )
    if update_in.note:
        request.notes = [
            {"message": update_in.note, "time": timestamp},
            *(request.notes or []),
        ]
        new_activity.insert(
            0,
            {"title": "Note Added", "detail": update_in.note, "time": timestamp},
        )
    if update_in.escalated is not None:
        request.escalated = update_in.escalated
        if update_in.escalated:
            new_activity.insert(
                0,
                {
                    "title": "Request Escalated",
                    "detail": "Priority escalation sent to Operations",
                    "time": timestamp,
                },
            )

    request.activity_log = new_activity
    await db.commit()
    await db.refresh(request)
    return request

