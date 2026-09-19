import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.models import Staff, MaintenanceRequest, ManagementDirective, InventoryStock
from app.schemas.operations import (
    MaintenanceRequestCreate,
    MaintenanceRequestResponse,
    MaintenanceDashboardResponse,
    DirectiveCreate,
    DirectiveResponse,
    InventoryStockResponse,
)
from .shared import TAG_MNT, TAG_OPS, create_department_notification

router = APIRouter()

# 4. MAINTENANCE DASHBOARD & REQUESTS
# =====================================================================

@router.get("/dashboard/maintenance", response_model=MaintenanceDashboardResponse, tags=TAG_MNT)
async def get_maintenance_dashboard(db: AsyncSession = Depends(get_db)):
    """Returns active facility maintenance requests, technician availability, and map."""
    res = await db.execute(select(MaintenanceRequest).order_by(desc(MaintenanceRequest.created_at)))
    requests = res.scalars().all()

    pending_count = sum(1 for r in requests if r.status in ["Pending", "Unassigned"])
    in_prog_count = sum(1 for r in requests if r.status == "In Progress")
    completed_count = sum(1 for r in requests if r.status == "Completed")

    staff_res = await db.execute(select(Staff).where(Staff.department == "Maintenance"))
    maint_staff = staff_res.scalars().all()

    staff_availability = [
        {
            "id": s.id,
            "name": s.full_name,
            "role": s.role,
            "status": "Available" if s.status == "available" else "Busy",
            "statusClass": "text-emerald-600" if s.status == "available" else "text-amber-600",
        }
        for s in maint_staff
    ]
    if not staff_availability:
        staff_availability = [
            {"id": "MNT", "name": "Nhân viên Kỹ thuật & Bảo trì", "role": "Maintenance Technician", "status": "Available", "statusClass": "text-emerald-600"}
        ]

    active_techs_count = sum(1 for s in staff_availability if s.get("status") == "Available")

    kpis = {
        "availableTechs": {"count": active_techs_count, "delta": "+0", "status": "good"},
        "pendingRequests": pending_count,
        "inProgress": in_prog_count,
        "completedToday": {"count": completed_count, "delta": "+0", "status": "good"},
    }

    facility_map = {
        "zone": "Zone Status",
        "description": "View active requests and technician locations on the floor plan.",
        "thumbnail": "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&auto=format&fit=crop&q=80",
    }

    return {
        "kpis": kpis,
        "requests": requests,
        "staff_availability": staff_availability,
        "facility_map": facility_map,
    }


@router.post("/maintenance/requests", response_model=MaintenanceRequestResponse, status_code=status.HTTP_201_CREATED, tags=TAG_MNT)
async def create_maintenance_request(req_in: MaintenanceRequestCreate, db: AsyncSession = Depends(get_db)):
    """Creates a new maintenance issue work order."""
    ticket_code = f"MN-{random.randint(404, 9999)}"
    new_req = MaintenanceRequest(
        ticket_code=ticket_code,
        title=req_in.title,
        category=req_in.category,
        reported_time_label="Just now",
        location=req_in.location,
        description=req_in.description,
        source=req_in.source,
        status="Pending",
    )
    db.add(new_req)
    await create_department_notification(
        db=db,
        department="Maintenance",
        title=f"Yêu cầu Kỹ thuật mới: {req_in.title}",
        description=f"{req_in.location}: {req_in.description or 'Cần bảo trì kỹ thuật'}",
        request_id=new_req.id,
        request_type="maintenance",
        type="Request",
    )
    await db.commit()
    await db.refresh(new_req)
    return new_req


# =====================================================================
# 5. OPERATIONAL DIRECTIVES
# =====================================================================

@router.post("/directives", response_model=DirectiveResponse, status_code=status.HTTP_201_CREATED, tags=TAG_OPS)
async def create_operational_directive(dir_in: DirectiveCreate, db: AsyncSession = Depends(get_db)):
    """Creates a cross-department operational request."""
    code = f"OP-{random.randint(104, 999)}"
    new_dir = ManagementDirective(
        code=code,
        title=dir_in.title,
        department=dir_in.department,
        priority=dir_in.priority,
        location=dir_in.location,
        reported_time_label="Directive Just Issued",
        description=dir_in.description,
        status="Unassigned",
        type=dir_in.type,
        created_by="System Administrator",
    )
    db.add(new_dir)
    await db.commit()
    await db.refresh(new_dir)
    return new_dir


@router.patch("/maintenance/requests/{request_id}/status", response_model=MaintenanceRequestResponse, tags=TAG_MNT)
async def update_maintenance_request_status(
    request_id: str,
    status: str,
    assigned_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Updates maintenance request status (e.g. In Progress, Completed)."""
    res = await db.execute(
        select(MaintenanceRequest).where(
            (MaintenanceRequest.id == request_id) | (MaintenanceRequest.ticket_code == request_id)
        )
    )
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Maintenance ticket not found")

    req.status = status
    if assigned_to:
        req.assigned_to = assigned_to
    await db.commit()
    await db.refresh(req)
    return req


@router.patch("/stock/{stock_id}/restock", response_model=InventoryStockResponse, tags=TAG_OPS)
async def restock_inventory(
    stock_id: str,
    add_quantity: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Restocks inventory item in database."""
    res = await db.execute(
        select(InventoryStock).where(
            (InventoryStock.id == stock_id) | (InventoryStock.name.ilike(f"%{stock_id}%"))
        )
    )
    stock = res.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    stock.quantity += add_quantity
    stock.count_label = f"{stock.quantity} in stock"
    stock.level = "normal" if stock.quantity > 5 else "warning"
    await db.commit()
    await db.refresh(stock)
    return stock


