import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, desc

from app.core.database import get_db
from app.core.security import hash_password
from app.models import (
    Staff,
    RobotUnit,
    RoomServiceOrder,
    HousekeepingRequest,
    BellRequest,
    MaintenanceRequest,
    ManagementDirective,
    InventoryStock,
    RestaurantReservation,
    RestaurantPreOrder,
    ReceptionRequest,
    HumanSupportSession,
)
from app.schemas.operations import (
    StaffResponse,
    StaffCreate,
    StaffUpdate,
    RobotUnitResponse,
    InventoryStockResponse,
    # Room Service
    RoomServiceOrderCreate,
    RoomServiceOrderStatusUpdate,
    RoomServiceOrderAssignRobot,
    RoomServiceOrderResponse,
    RoomServiceDashboardResponse,
    # Housekeeping
    HousekeepingRequestCreate,
    HousekeepingAssignRequest,
    HousekeepingRequestResponse,
    HousekeepingDashboardResponse,
    # Bell Services
    BellRequestCreate,
    BellRequestStatusUpdate,
    BellRequestResponse,
    BellServicesDashboardResponse,
    # Maintenance
    MaintenanceRequestCreate,
    MaintenanceRequestResponse,
    MaintenanceDashboardResponse,
    # Operational Directives
    DirectiveCreate,
    DirectiveResponse,
    # Restaurant
    RestaurantReservationCreate,
    RestaurantReservationResponse,
    RestaurantPreOrderCreate,
    RestaurantPreOrderResponse,
    RestaurantDashboardResponse,
    # Reception
    ReceptionRequestUpdate,
    ReceptionRequestResponse,
    ReceptionDashboardResponse,
    # Admin Operations
    UnifiedOperationTask,
    AdminTaskDispatchCreate,
    AdminTaskStatusUpdate,
    AdminOperationsSummary,
    HumanSupportSessionResponse,
)

router = APIRouter()


# =====================================================================
# 1. ROOM SERVICE / F&B DASHBOARD & ORDERS
# =====================================================================

TAG_REC = ["4. Bộ phận Lễ tân (Reception Operations)"]
TAG_FB = ["5. Bộ phận Phục vụ phòng (F&B / Room Service)"]
TAG_HK = ["6. Bộ phận Buồng phòng (Housekeeping)"]
TAG_BELL = ["7. Bộ phận Vận chuyển hành lý (Bellman Services)"]
TAG_MNT = ["8. Bộ phận Kỹ thuật & Bảo trì (Facility Maintenance)"]
TAG_OPS = ["9. Điều phối Vận hành (Operations)"]
TAG_REST = ["10. Bộ phận Nhà hàng (Restaurant - Đặt bàn & Đặt món trước)"]


# =====================================================================
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


@router.get("/dashboard/room-service", response_model=RoomServiceDashboardResponse, tags=TAG_FB)
async def get_room_service_dashboard(db: AsyncSession = Depends(get_db)):
    """Returns real-time KPIs, active orders, delivery fleet, and low stock alerts for Room Service."""
    # 1. Fetch Orders
    orders_res = await db.execute(select(RoomServiceOrder).order_by(desc(RoomServiceOrder.created_at)))
    orders = orders_res.scalars().all()

    # 2. Fetch Robots
    fleet_res = await db.execute(
        select(RobotUnit)
        .where(RobotUnit.model_type == "delivery")
        .order_by(RobotUnit.unit_code)
    )
    delivery_fleet = fleet_res.scalars().all()

    # 3. Fetch Stock
    stock_res = await db.execute(select(InventoryStock).order_by(InventoryStock.quantity))
    low_stock_alerts = stock_res.scalars().all()

    # 4. Calculate dynamic KPIs
    pending_count = sum(1 for o in orders if o.status == "Pending")
    in_prep_count = sum(1 for o in orders if o.status == "Cooking")
    delivering_count = sum(1 for o in orders if o.status in ["Delivering", "Ready"])
    completed_count = sum(1 for o in orders if o.status in ["Completed", "Delivered"])

    kpis = {
        "pendingOrders": {"value": pending_count, "delta": "+0", "status": "neutral"},
        "inPreparation": {"value": in_prep_count, "avgTime": "12m"},
        "delivering": {"value": delivering_count, "label": "In Transit"},
        "completedToday": {"value": completed_count},
    }

    return {
        "kpis": kpis,
        "orders": orders,
        "delivery_fleet": delivery_fleet,
        "low_stock_alerts": low_stock_alerts,
    }


@router.post("/room-service/orders", response_model=RoomServiceOrderResponse, status_code=status.HTTP_201_CREATED, tags=TAG_FB)
async def create_room_service_order(order_in: RoomServiceOrderCreate, db: AsyncSession = Depends(get_db)):
    """Creates a new F&B / Room Service order from guest room or tablet."""
    order_num = f"{random.randint(1043, 9999)}"
    new_order = RoomServiceOrder(
        order_number=order_num,
        room_number=order_in.room_number,
        items=[item.model_dump() for item in order_in.items],
        note=order_in.note,
        image_url=order_in.image_url,
        is_service_request=order_in.is_service_request,
        status="Pending",
        progress=0,
    )
    db.add(new_order)
    await db.commit()
    await db.refresh(new_order)
    return new_order


@router.patch("/room-service/orders/{order_id}/status", response_model=RoomServiceOrderResponse, tags=TAG_FB)
async def update_room_service_order_status(
    order_id: str,
    status_in: RoomServiceOrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates order status (e.g. Cooking, Ready, Completed, Rejected)."""
    res = await db.execute(
        select(RoomServiceOrder).where(
            (RoomServiceOrder.id == order_id) | (RoomServiceOrder.order_number == order_id)
        )
    )
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = status_in.status
    if status_in.progress is not None:
        order.progress = status_in.progress
    if status_in.est_completion is not None:
        order.est_completion = status_in.est_completion
    if status_in.assigned_staff_name is not None:
        order.assigned_staff_name = status_in.assigned_staff_name

    await db.commit()
    await db.refresh(order)
    return order


@router.post("/room-service/orders/{order_id}/assign-robot", response_model=RoomServiceOrderResponse, tags=TAG_FB)
async def assign_robot_to_order(
    order_id: str,
    assign_in: RoomServiceOrderAssignRobot,
    db: AsyncSession = Depends(get_db),
):
    """Assigns and dispatches an autonomous HCRobot unit to deliver this order."""
    res = await db.execute(
        select(RoomServiceOrder).where(
            (RoomServiceOrder.id == order_id) | (RoomServiceOrder.order_number == order_id)
        )
    )
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    robot = None
    if assign_in.robot_id:
        robot_res = await db.execute(
            select(RobotUnit).where(
                (RobotUnit.id == assign_in.robot_id) |
                (RobotUnit.unit_code == assign_in.robot_id)
            )
        )
        robot = robot_res.scalar_one_or_none()
        if not robot:
            raise HTTPException(status_code=404, detail="Robot unit not found")

    order.assigned_robot_id = robot.id if robot else None
    order.assigned_staff_name = assign_in.robot_name or (robot.name if robot else "HCRobot Unit 01")
    order.status = "Delivering"
    await db.commit()
    await db.refresh(order)
    return order


# =====================================================================
# 2. HOUSEKEEPING DASHBOARD & REQUESTS
# =====================================================================

@router.get("/dashboard/housekeeping", response_model=HousekeepingDashboardResponse, tags=TAG_HK)
async def get_housekeeping_dashboard(db: AsyncSession = Depends(get_db)):
    """Returns housekeeping requests, floor status, available staff and KPIs."""
    req_res = await db.execute(select(HousekeepingRequest).order_by(desc(HousekeepingRequest.created_at)))
    hk_list = req_res.scalars().all()

    dir_res = await db.execute(
        select(ManagementDirective).where(
            ManagementDirective.department == "Housekeeping"
        ).order_by(desc(ManagementDirective.created_at))
    )
    dir_list = dir_res.scalars().all()

    staff_res = await db.execute(
        select(Staff).where(Staff.department == "Housekeeping", Staff.status != "off_shift")
    )
    available_staff = staff_res.scalars().all()

    unified_hk = []
    for h in hk_list:
        unified_hk.append(
            HousekeepingRequestResponse(
                id=f"REQ-{h.ticket_code}",
                ticket_code=h.ticket_code,
                source=h.source or "From HCRobot",
                time_label=h.time_label or "Recent",
                title=h.title,
                room_number=h.room_number,
                description=h.description,
                guest_name=h.guest_name or "Guest",
                status=h.status,
                assigned_staff_name=h.assigned_staff_name,
                created_at=h.created_at,
            )
        )

    for d in dir_list:
        room_num = d.location.replace("ROOM ", "").replace("Room ", "").replace("Phòng ", "").strip()
        unified_hk.append(
            HousekeepingRequestResponse(
                id=f"REQ-{d.code}",
                ticket_code=d.code,
                source="Operations Directive",
                time_label=d.reported_time_label or "Today",
                title=d.title,
                room_number=room_num or "Main Floor",
                description=d.description,
                guest_name="Operations Admin",
                status=d.status,
                assigned_staff_name=d.assigned_staff_name,
                created_at=d.created_at,
            )
        )

    pending_count = sum(1 for r in unified_hk if r.status in ["Unassigned", "Pending"])
    in_prog_count = sum(1 for r in unified_hk if r.status == "In Progress")
    completed_count = sum(1 for r in unified_hk if r.status == "Completed")
    staff_on_duty_count = len(available_staff)

    kpis = {
        "pendingRequests": pending_count,
        "inProgress": in_prog_count,
        "completedToday": completed_count,
        "staffOnDuty": staff_on_duty_count,
    }

    floor_status = {
        "activeFloor": "FLOOR 5 - ACTIVE",
        "roomsCleaned": 45,
        "totalRooms": 120,
    }

    return {
        "kpis": kpis,
        "requests": unified_hk,
        "floor_status": floor_status,
        "available_staff": available_staff,
    }


@router.post("/housekeeping/requests", response_model=HousekeepingRequestResponse, status_code=status.HTTP_201_CREATED, tags=TAG_HK)
async def create_housekeeping_request(req_in: HousekeepingRequestCreate, db: AsyncSession = Depends(get_db)):
    """Creates a new housekeeping ticket (generated by HCRobot vision or guest request)."""
    ticket_code = f"HK-{random.randint(1044, 9999)}"
    new_req = HousekeepingRequest(
        ticket_code=ticket_code,
        source=req_in.source,
        time_label="Just now",
        title=req_in.title,
        room_number=req_in.room_number,
        description=req_in.description,
        guest_name=req_in.guest_name,
        status="Unassigned",
    )
    db.add(new_req)
    await db.commit()
    await db.refresh(new_req)
    return new_req


@router.patch("/housekeeping/requests/{request_id}/assign", response_model=HousekeepingRequestResponse, tags=TAG_HK)
async def assign_housekeeping_request(
    request_id: str,
    assign_in: HousekeepingAssignRequest,
    db: AsyncSession = Depends(get_db),
):
    """Assigns staff or marks housekeeping task in progress."""
    clean_id = request_id.replace("HK-", "").strip()
    res = await db.execute(
        select(HousekeepingRequest).where(
            (HousekeepingRequest.id == request_id) |
            (HousekeepingRequest.ticket_code == request_id) |
            (HousekeepingRequest.id == clean_id) |
            (HousekeepingRequest.ticket_code == clean_id) |
            (HousekeepingRequest.id.ilike(f"%{clean_id}%")) |
            (HousekeepingRequest.ticket_code.ilike(f"%{clean_id}%"))
        )
    )
    req = res.scalar_one_or_none()
    if not req:
        # Fallback search by first HK request if matching by ID fails
        all_hk = await db.execute(select(HousekeepingRequest))
        first_hk = all_hk.scalars().first()
        if first_hk:
            req = first_hk
        else:
            raise HTTPException(status_code=404, detail="Housekeeping request not found")

    req.status = assign_in.status
    req.assigned_staff_name = assign_in.assigned_staff_name

    # Safe Foreign Key lookup: only set assigned_staff_id if valid in Staff table
    if assign_in.assigned_staff_id:
        staff_check = await db.execute(
            select(Staff).where(
                (Staff.id == assign_in.assigned_staff_id) |
                (Staff.username == assign_in.assigned_staff_id) |
                (Staff.full_name == assign_in.assigned_staff_name)
            )
        )
        found_staff = staff_check.scalar_one_or_none()
        req.assigned_staff_id = found_staff.id if found_staff else None
    else:
        req.assigned_staff_id = None

    await db.commit()
    await db.refresh(req)
    return req


# =====================================================================
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


# =====================================================================
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


# =====================================================================
# 6. ADMIN CENTRAL OPERATIONS & UNIFIED REQUESTS
# =====================================================================

async def _fetch_all_raw_requests(db: AsyncSession) -> List[Dict[str, Any]]:
    """Helper to collect and normalize tasks across all 6 operational tables."""
    orders_res = await db.execute(select(RoomServiceOrder).order_by(desc(RoomServiceOrder.created_at)))
    hk_res = await db.execute(select(HousekeepingRequest).order_by(desc(HousekeepingRequest.created_at)))
    bell_res = await db.execute(select(BellRequest).order_by(desc(BellRequest.created_at)))
    maint_res = await db.execute(select(MaintenanceRequest).order_by(desc(MaintenanceRequest.created_at)))
    reception_res = await db.execute(select(ReceptionRequest).order_by(desc(ReceptionRequest.created_at)))
    dir_res = await db.execute(select(ManagementDirective).order_by(desc(ManagementDirective.created_at)))

    unified = []

    for o in orders_res.scalars().all():
        unified.append({
            "id": f"REQ-{o.order_number}",
            "raw_id": o.id,
            "department": "F&B",
            "table_type": "room_service",
            "title": f"Order #{o.order_number}: {', '.join([i.get('name', 'Item') for i in o.items]) if o.items else 'Room Service'}",
            "location": o.room_number,
            "guestName": "Room Guest",
            "priority": "NORMAL",
            "status": o.status,
            "time": "Recent",
            "assignedTo": o.assigned_staff_name,
            "assigned_robot": o.assigned_robot_id,
            "notes": o.note,
            "source": "Guest / Robot App",
            "created_at": o.created_at,
        })

    for h in hk_res.scalars().all():
        unified.append({
            "id": f"REQ-{h.ticket_code}",
            "raw_id": h.id,
            "department": "Housekeeping",
            "table_type": "housekeeping",
            "title": h.title,
            "location": f"ROOM {h.room_number}" if not str(h.room_number).upper().startswith("ROOM") else h.room_number,
            "guestName": h.guest_name or "Guest",
            "priority": "NORMAL",
            "status": h.status,
            "time": h.time_label,
            "assignedTo": h.assigned_staff_name,
            "assigned_robot": None,
            "notes": h.description,
            "source": h.source or "HCRobot",
            "created_at": h.created_at,
        })

    for b in bell_res.scalars().all():
        unified.append({
            "id": f"REQ-{b.ticket_code}",
            "raw_id": b.id,
            "department": "Bell Services",
            "table_type": "bell",
            "title": b.title,
            "location": b.location,
            "guestName": b.guest_name or b.reporter or "Guest",
            "priority": "NORMAL",
            "status": b.status,
            "time": "Today",
            "assignedTo": b.assigned_to,
            "assigned_robot": b.assigned_robot_id,
            "notes": b.description,
            "source": "Front Desk / Robot",
            "created_at": b.created_at,
        })

    for m in maint_res.scalars().all():
        unified.append({
            "id": f"REQ-{m.ticket_code}",
            "raw_id": m.id,
            "department": "Maintenance",
            "table_type": "maintenance",
            "title": m.title,
            "location": m.location,
            "guestName": "Guest / Staff Reported",
            "priority": "NORMAL",
            "status": m.status,
            "time": m.reported_time_label,
            "assignedTo": m.assigned_to,
            "assigned_robot": None,
            "notes": m.description,
            "source": m.source or "HCRobot",
            "created_at": m.created_at,
        })

    for r in reception_res.scalars().all():
        unified.append({
            "id": r.ticket_code if str(r.ticket_code).startswith("REQ-") else f"REQ-{r.ticket_code}",
            "raw_id": r.id,
            "department": "Reception",
            "table_type": "reception",
            "title": r.title,
            "location": r.location,
            "guestName": r.guest_name or "Guest",
            "priority": "NORMAL",
            "status": r.status,
            "time": r.created_label,
            "assignedTo": r.assigned_to,
            "assigned_robot": None,
            "notes": r.description,
            "source": "Front Desk",
            "created_at": r.created_at,
        })

    for d in dir_res.scalars().all():
        unified.append({
            "id": f"REQ-{d.code}",
            "raw_id": d.id,
            "department": d.department or "Directive",
            "table_type": "directive",
            "title": d.title,
            "location": d.location,
            "guestName": "Operations Directive",
            "priority": "NORMAL",
            "status": d.status,
            "time": d.reported_time_label,
            "assignedTo": d.assigned_staff_name,
            "assigned_robot": None,
            "notes": d.description,
            "source": f"Admin ({d.created_by})",
            "created_at": d.created_at,
        })

    return unified


@router.get("/admin/tasks", response_model=List[UnifiedOperationTask], tags=TAG_OPS, summary="Admin: Danh sách tất cả các Task dịch vụ toàn khách sạn")
async def get_admin_tasks(
    department: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    Truy vấn danh sách công việc tập trung của toàn khách sạn cho Admin Operations.
    Hỗ trợ lọc theo phòng ban (department), trạng thái (status), tìm kiếm (search: phòng/khách/mã ticket).
    """
    raw_list = await _fetch_all_raw_requests(db)

    # Filter by department
    if department and department.lower() != "all":
        dep_clean = department.lower().strip()
        dept_mapping = {
            "f&b": ["f&b", "room service", "phục vụ phòng"],
            "room service": ["f&b", "room service"],
            "housekeeping": ["housekeeping", "buồng phòng"],
            "bell services": ["bell services", "bellman", "hành lý"],
            "maintenance": ["maintenance", "kỹ thuật", "bảo trì"],
            "reception": ["reception", "lễ tân"],
            "directive": ["directive", "executive", "chỉ thị"],
        }
        valid_matches = dept_mapping.get(dep_clean, [dep_clean])
        raw_list = [t for t in raw_list if any(m in t["department"].lower() for m in valid_matches)]

    # Filter by status
    if status and status.lower() != "all":
        st_clean = status.lower().strip()
        raw_list = [t for t in raw_list if st_clean in t["status"].lower()]

    # Filter by search term
    if search and search.strip():
        q = search.lower().strip()
        raw_list = [
            t for t in raw_list
            if (
                q in t["id"].lower()
                or q in t["title"].lower()
                or q in t["location"].lower()
                or q in t["guestName"].lower()
                or (t["notes"] and q in t["notes"].lower())
            )
        ]

    # Pagination
    paged = raw_list[offset : offset + limit]

    return [
        UnifiedOperationTask(
            id=item["id"],
            raw_id=item["raw_id"],
            department=item["department"],
            table_type=item["table_type"],
            title=item["title"],
            location=item["location"],
            guest_name=item["guestName"],
            priority=item["priority"],
            status=item["status"],
            time=item["time"],
            assigned_to=item.get("assignedTo"),
            assigned_robot=item.get("assigned_robot"),
            notes=item.get("notes"),
            source=item.get("source", "Robot / Staff"),
            created_at=item.get("created_at"),
        )
        for item in paged
    ]


@router.get("/admin/summary", response_model=AdminOperationsSummary, tags=TAG_OPS, summary="Admin: Thống kê số lượng ticket theo bộ phận")
async def get_admin_operations_summary(db: AsyncSession = Depends(get_db)):
    """Trả về số lượng ticket theo từng bộ phận và tổng số công việc đang xử lý."""
    raw_list = await _fetch_all_raw_requests(db)

    summary = AdminOperationsSummary(all_count=len(raw_list))

    for t in raw_list:
        dept = t["department"].lower()
        st = t["status"].lower()
        if st not in ["completed", "cancelled", "rejected"]:
            summary.total_active += 1

        if "reception" in dept:
            summary.reception_count += 1
        elif "housekeeping" in dept:
            summary.housekeeping_count += 1
        elif "f&b" in dept or "room service" in dept:
            summary.room_service_count += 1
        elif "bell" in dept:
            summary.bell_services_count += 1
        elif "maintenance" in dept:
            summary.maintenance_count += 1
        else:
            summary.directives_count += 1

    return summary


@router.post("/admin/dispatch", response_model=UnifiedOperationTask, tags=TAG_OPS, summary="Admin: Phát lệnh điều phối tạo Task mới")
async def admin_dispatch_task(
    task_in: AdminTaskDispatchCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin chủ động tạo yêu cầu dịch vụ hoặc chỉ thị điều phối.
    Dữ liệu sẽ tự động lưu vào đúng bảng CSDL của bộ phận tương ứng.
    """
    dep = task_in.department.lower().strip()
    rand_suffix = random.randint(1000, 9999)

    if "housekeeping" in dep or "buồng phòng" in dep:
        code = f"HK-{rand_suffix}"
        room = task_in.room_number.upper().replace("ROOM", "").strip()
        item = HousekeepingRequest(
            ticket_code=code,
            source="From Admin Portal",
            time_label="Just now",
            title=task_in.title,
            room_number=room,
            description=task_in.description,
            guest_name=task_in.guest_name,
            status="In Progress" if task_in.assigned_staff_name or task_in.assigned_robot_code else "Unassigned",
            assigned_staff_name=task_in.assigned_staff_name or task_in.assigned_robot_code,
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=item.id,
            department="Housekeeping",
            table_type="housekeeping",
            title=item.title,
            location=f"ROOM {item.room_number}",
            guest_name=item.guest_name or "Guest",
            priority="NORMAL",
            status=item.status,
            time="Just now",
            assigned_to=item.assigned_staff_name,
            assigned_robot=task_in.assigned_robot_code,
            notes=item.description,
            source=item.source,
            created_at=item.created_at,
        )

    elif "f&b" in dep or "room service" in dep:
        code = str(rand_suffix)
        order = RoomServiceOrder(
            order_number=code,
            room_number=task_in.room_number,
            status="Delivering" if task_in.assigned_robot_code else "Pending",
            items=[{"name": task_in.title, "qty": 1}],
            note=task_in.description,
            assigned_staff_name=task_in.assigned_staff_name,
        )
        db.add(order)
        await db.commit()
        await db.refresh(order)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=order.id,
            department="F&B",
            table_type="room_service",
            title=task_in.title,
            location=order.room_number,
            guest_name=task_in.guest_name or "Room Guest",
            priority="NORMAL",
            status=order.status,
            time="Just now",
            assigned_to=order.assigned_staff_name,
            assigned_robot=task_in.assigned_robot_code,
            notes=order.note,
            source="From Admin Portal",
            created_at=order.created_at,
        )

    elif "bell" in dep:
        code = f"BS-{random.randint(500, 999)}"
        bell = BellRequest(
            ticket_code=code,
            title=task_in.title,
            location=task_in.room_number,
            guest_name=task_in.guest_name,
            reporter="Admin Dispatch",
            description=task_in.description,
            status="In Progress" if task_in.assigned_staff_name or task_in.assigned_robot_code else "Pending",
            assigned_to=task_in.assigned_staff_name or task_in.assigned_robot_code,
        )
        db.add(bell)
        await db.commit()
        await db.refresh(bell)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=bell.id,
            department="Bell Services",
            table_type="bell",
            title=bell.title,
            location=bell.location,
            guest_name=bell.guest_name or "Guest",
            priority="NORMAL",
            status=bell.status,
            time="Just now",
            assigned_to=bell.assigned_to,
            assigned_robot=task_in.assigned_robot_code,
            notes=bell.description,
            source="From Admin Portal",
            created_at=bell.created_at,
        )

    elif "maintenance" in dep or "bảo trì" in dep:
        code = f"MN-{random.randint(400, 999)}"
        maint = MaintenanceRequest(
            ticket_code=code,
            title=task_in.title,
            reported_time_label="Just now",
            location=task_in.room_number,
            description=task_in.description,
            source="Admin Dispatch",
            status="In Progress" if task_in.assigned_staff_name else "Pending",
            assigned_to=task_in.assigned_staff_name,
        )
        db.add(maint)
        await db.commit()
        await db.refresh(maint)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=maint.id,
            department="Maintenance",
            table_type="maintenance",
            title=maint.title,
            location=maint.location,
            guest_name="Staff Reported",
            priority="NORMAL",
            status=maint.status,
            time="Just now",
            assigned_to=maint.assigned_to,
            assigned_robot=None,
            notes=maint.description,
            source="From Admin Portal",
            created_at=maint.created_at,
        )

    elif "reception" in dep or "lễ tân" in dep:
        code = f"REC-{random.randint(100, 999)}"
        rec = ReceptionRequest(
            ticket_code=code,
            title=task_in.title,
            created_label="Just now",
            location=task_in.room_number,
            guest_name=task_in.guest_name or "Hotel Guest",
            status="Pending Action",
            description=task_in.description or "",
            assigned_to=task_in.assigned_staff_name,
        )
        db.add(rec)
        await db.commit()
        await db.refresh(rec)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=rec.id,
            department="Reception",
            table_type="reception",
            title=rec.title,
            location=rec.location,
            guest_name=rec.guest_name,
            priority="NORMAL",
            status=rec.status,
            time="Just now",
            assigned_to=rec.assigned_to,
            assigned_robot=None,
            notes=rec.description,
            source="From Admin Portal",
            created_at=rec.created_at,
        )

    else:
        code = f"OP-{random.randint(100, 999)}"
        d = ManagementDirective(
            code=code,
            title=task_in.title,
            department=task_in.department,
            priority=task_in.priority,
            location=task_in.room_number,
            reported_time_label="Just now",
            description=task_in.description,
            status="In Progress" if task_in.assigned_staff_name else "Unassigned",
            assigned_staff_name=task_in.assigned_staff_name or task_in.assigned_robot_code,
            created_by="Admin Portal",
        )
        db.add(d)
        await db.commit()
        await db.refresh(d)
        return UnifiedOperationTask(
            id=f"REQ-{code}",
            raw_id=d.id,
            department=d.department,
            table_type="directive",
            title=d.title,
            location=d.location,
            guest_name="Operations Directive",
            priority=d.priority,
            status=d.status,
            time="Just now",
            assigned_to=d.assigned_staff_name,
            assigned_robot=task_in.assigned_robot_code,
            notes=d.description,
            source=f"Admin ({d.created_by})",
            created_at=d.created_at,
        )


@router.get("/admin/tasks/{ticket_id}", response_model=UnifiedOperationTask, tags=TAG_OPS, summary="Admin: Xem chi tiết 1 Task")
async def get_admin_task_detail(ticket_id: str, db: AsyncSession = Depends(get_db)):
    """Lấy chi tiết đầy đủ của một Task qua mã ticket (ví dụ: 'REQ-1042', 'HK-1042', hoặc ID CSDL)."""
    clean_id = ticket_id.replace("REQ-", "").strip()
    raw_list = await _fetch_all_raw_requests(db)

    for item in raw_list:
        if (
            item["id"] == ticket_id
            or item["id"] == f"REQ-{clean_id}"
            or item["raw_id"] == clean_id
            or clean_id in item["id"]
        ):
            return UnifiedOperationTask(
                id=item["id"],
                raw_id=item["raw_id"],
                department=item["department"],
                table_type=item["table_type"],
                title=item["title"],
                location=item["location"],
                guest_name=item["guestName"],
                priority=item["priority"],
                status=item["status"],
                time=item["time"],
                assigned_to=item.get("assignedTo"),
                assigned_robot=item.get("assigned_robot"),
                notes=item.get("notes"),
                source=item.get("source", "Robot / Staff"),
                created_at=item.get("created_at"),
            )

    raise HTTPException(status_code=404, detail=f"Task with ID {ticket_id} not found")


@router.patch("/admin/tasks/{ticket_id}", tags=TAG_OPS, summary="Admin: Cập nhật trạng thái và điều phối Task")
async def update_admin_task(
    ticket_id: str,
    update_in: AdminTaskStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật trạng thái, người phụ trách hoặc Robot cho bất kỳ Task nào trong hệ thống."""
    clean_id = ticket_id.replace("REQ-", "").strip()
    upper_id = ticket_id.upper()

    # 1. Housekeeping check if HK in ticket_id
    if "HK" in upper_id:
        res = await db.execute(
            select(HousekeepingRequest).where(
                (HousekeepingRequest.ticket_code == clean_id)
                | (HousekeepingRequest.id == clean_id)
                | (HousekeepingRequest.ticket_code == ticket_id)
                | (HousekeepingRequest.id == ticket_id)
                | (HousekeepingRequest.ticket_code.ilike(f"%{clean_id}%"))
            )
        )
        hk = res.scalar_one_or_none()
        if hk:
            hk.status = update_in.status
            if update_in.assigned_to:
                hk.assigned_staff_name = update_in.assigned_to
            if update_in.note:
                hk.description = f"{hk.description or ''} | Note: {update_in.note}"
            await db.commit()
            return {"success": True, "type": "housekeeping", "id": hk.id, "status": hk.status}

    # 2. Bell Services check if BS in ticket_id
    if "BS" in upper_id or "BELL" in upper_id:
        res = await db.execute(
            select(BellRequest).where(
                (BellRequest.ticket_code == clean_id)
                | (BellRequest.id == clean_id)
                | (BellRequest.ticket_code == ticket_id)
                | (BellRequest.id == ticket_id)
                | (BellRequest.ticket_code.ilike(f"%{clean_id}%"))
            )
        )
        bell = res.scalar_one_or_none()
        if bell:
            bell.status = update_in.status
            if update_in.assigned_to:
                bell.assigned_to = update_in.assigned_to
            await db.commit()
            return {"success": True, "type": "bell", "id": bell.id, "status": bell.status}

    # 3. Maintenance check if MN in ticket_id
    if "MN" in upper_id or "MAINT" in upper_id:
        res = await db.execute(
            select(MaintenanceRequest).where(
                (MaintenanceRequest.ticket_code == clean_id)
                | (MaintenanceRequest.id == clean_id)
                | (MaintenanceRequest.ticket_code == ticket_id)
                | (MaintenanceRequest.id == ticket_id)
                | (MaintenanceRequest.ticket_code.ilike(f"%{clean_id}%"))
            )
        )
        maint = res.scalar_one_or_none()
        if maint:
            maint.status = update_in.status
            if update_in.assigned_to:
                maint.assigned_to = update_in.assigned_to
            await db.commit()
            return {"success": True, "type": "maintenance", "id": maint.id, "status": maint.status}

    # 4. Reception check if RC in ticket_id
    if "RC" in upper_id or "REC" in upper_id:
        res = await db.execute(
            select(ReceptionRequest).where(
                (ReceptionRequest.ticket_code == clean_id)
                | (ReceptionRequest.id == clean_id)
                | (ReceptionRequest.ticket_code == ticket_id)
                | (ReceptionRequest.id == ticket_id)
                | (ReceptionRequest.ticket_code.ilike(f"%{clean_id}%"))
            )
        )
        rec = res.scalar_one_or_none()
        if rec:
            rec.status = update_in.status
            if update_in.assigned_to:
                rec.assigned_to = update_in.assigned_to
            await db.commit()
            return {"success": True, "type": "reception", "id": rec.id, "status": rec.status}

    # 5. Directive check if DIR in ticket_id
    if "DIR" in upper_id:
        res = await db.execute(
            select(ManagementDirective).where(
                (ManagementDirective.code == clean_id)
                | (ManagementDirective.id == clean_id)
                | (ManagementDirective.code == ticket_id)
                | (ManagementDirective.id == ticket_id)
                | (ManagementDirective.code.ilike(f"%{clean_id}%"))
            )
        )
        dir_item = res.scalar_one_or_none()
        if dir_item:
            dir_item.status = update_in.status
            if update_in.assigned_to:
                dir_item.assigned_staff_name = update_in.assigned_to
            await db.commit()
            return {"success": True, "type": "directive", "id": dir_item.id, "status": dir_item.status}

    # 6. Room Service (Default for orders or numeric IDs like REQ-1042)
    res = await db.execute(
        select(RoomServiceOrder).where(
            (RoomServiceOrder.order_number == clean_id)
            | (RoomServiceOrder.id == clean_id)
            | (RoomServiceOrder.order_number == ticket_id)
            | (RoomServiceOrder.id == ticket_id)
            | (RoomServiceOrder.id.ilike(f"%{clean_id}%"))
        )
    )
    order = res.scalar_one_or_none()
    if order:
        order.status = update_in.status
        if update_in.assigned_to:
            order.assigned_staff_name = update_in.assigned_to
        if update_in.note:
            order.note = update_in.note
        await db.commit()
        return {"success": True, "type": "room_service", "id": order.id, "status": order.status}

    # Fallback search across all other tables if no prefix matched
    for model, type_name, id_col, staff_col in [
        (HousekeepingRequest, "housekeeping", HousekeepingRequest.ticket_code, "assigned_staff_name"),
        (BellRequest, "bell", BellRequest.ticket_code, "assigned_to"),
        (MaintenanceRequest, "maintenance", MaintenanceRequest.ticket_code, "assigned_to"),
        (ReceptionRequest, "reception", ReceptionRequest.ticket_code, "assigned_to"),
        (ManagementDirective, "directive", ManagementDirective.code, "assigned_staff_name"),
    ]:
        res = await db.execute(
            select(model).where(
                (id_col == clean_id)
                | (model.id == clean_id)
                | (id_col == ticket_id)
                | (model.id == ticket_id)
                | (id_col.ilike(f"%{clean_id}%"))
            )
        )
        item = res.scalar_one_or_none()
        if item:
            item.status = update_in.status
            if update_in.assigned_to:
                setattr(item, staff_col, update_in.assigned_to)
            await db.commit()
            return {"success": True, "type": type_name, "id": item.id, "status": item.status}

    raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")


# Backwards compatibility endpoints
@router.get("/all-requests", tags=TAG_OPS, summary="Legacy: Lấy tất cả request")
async def get_all_unified_requests(db: AsyncSession = Depends(get_db)):
    return await _fetch_all_raw_requests(db)


@router.patch("/generic-request/{ticket_id}/status", tags=TAG_OPS, summary="Legacy: Cập nhật status request")
async def update_generic_request_status(
    ticket_id: str,
    status: str,
    assigned_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    update_data = AdminTaskStatusUpdate(status=status, assigned_to=assigned_to)
    return await update_admin_task(ticket_id=ticket_id, update_in=update_data, db=db)
# ---------------------------------------------------------
# Human Support Sessions & Multilingual Conversation Logs
# ---------------------------------------------------------

@router.get(
    "/admin/conversations",
    response_model=List[HumanSupportSessionResponse],
    tags=TAG_OPS,
    summary="Admin: Xem danh sách các phiên đàm thoại giọng nói Robot với khách",
)
async def get_admin_conversations(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Trả về danh sách các phiên hỗ trợ / hội thoại giữa Robot Concierge và khách hàng.
    Hỗ trợ chế độ chỉ xem (View-only) cho Admin giám sát.
    """
    stmt = select(HumanSupportSession).order_by(desc(HumanSupportSession.created_at))
    if status and status.lower() != "all":
        stmt = stmt.where(HumanSupportSession.status.ilike(f"%{status}%"))

    res = await db.execute(stmt)
    sessions = res.scalars().all()
    return sessions


@router.get(
    "/admin/conversations/{session_id}",
    response_model=HumanSupportSessionResponse,
    tags=TAG_OPS,
    summary="Admin: Xem chi tiết toàn bộ lịch sử đàm thoại song ngữ của 1 phiên",
)
async def get_admin_conversation_detail(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy chi tiết toàn bộ các lượt nói (turns), văn bản gốc đa ngữ,
    và bản dịch song ngữ Tiếng Việt / Tiếng Anh của phiên hỗ trợ.
    """
    res = await db.execute(
        select(HumanSupportSession).where(
            (HumanSupportSession.id == session_id)
            | (HumanSupportSession.session_code == session_id)
            | (HumanSupportSession.room_number.ilike(f"%{session_id}%"))
        )
    )
    session_item = res.scalar_one_or_none()
    if not session_item:
        raise HTTPException(status_code=404, detail=f"Conversation session {session_id} not found")
    return session_item


# =====================================================================
# 10. RESTAURANT DASHBOARD, TABLE RESERVATIONS & PRE-ORDERS
# =====================================================================


@router.get("/dashboard/restaurant", response_model=RestaurantDashboardResponse, tags=TAG_REST)
async def get_restaurant_dashboard(db: AsyncSession = Depends(get_db)):
    """Returns real-time KPIs, active table reservations, and pre-ordered dishes for the Restaurant."""
    res_db = await db.execute(select(RestaurantReservation).order_by(desc(RestaurantReservation.created_at)))
    reservations = res_db.scalars().all()

    pre_db = await db.execute(select(RestaurantPreOrder).order_by(desc(RestaurantPreOrder.created_at)))
    pre_orders = pre_db.scalars().all()

    kpis = {
        "totalReservations": len(reservations),
        "totalPreOrders": len(pre_orders),
        "seatedGuests": sum(r.party_size for r in reservations if r.status == "Seated"),
        "pendingPreOrders": sum(1 for p in pre_orders if p.status == "Pending"),
    }

    return {
        "kpis": kpis,
        "reservations": reservations,
        "pre_orders": pre_orders,
    }


@router.post("/restaurant/reservations", response_model=RestaurantReservationResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def create_restaurant_reservation(
    res_in: RestaurantReservationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new Restaurant Table Reservation (from HCRobot Kiosk or Reception)."""
    res_code = f"RES-{random.randint(1024, 9999)}"
    new_res = RestaurantReservation(
        reservation_code=res_code,
        guest_name=res_in.guest_name,
        room_number=res_in.room_number,
        party_size=res_in.party_size,
        reservation_time=res_in.reservation_time,
        table_number=res_in.table_number or f"Table {random.randint(1, 20):02d}",
        special_note=res_in.special_note,
        status="Confirmed",
    )
    db.add(new_res)
    await db.commit()
    await db.refresh(new_res)
    return new_res


@router.get("/restaurant/reservations", response_model=List[RestaurantReservationResponse], tags=TAG_REST)
async def get_restaurant_reservations(db: AsyncSession = Depends(get_db)):
    """Returns list of all table reservations."""
    res = await db.execute(select(RestaurantReservation).order_by(desc(RestaurantReservation.created_at)))
    return res.scalars().all()


@router.post("/restaurant/pre-orders", response_model=RestaurantPreOrderResponse, status_code=status.HTTP_201_CREATED, tags=TAG_REST)
async def create_restaurant_pre_order(
    order_in: RestaurantPreOrderCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new Food/Dish Pre-Order for a restaurant table from HCRobot Kiosk."""
    order_code = f"ORD-{random.randint(5012, 9999)}"
    items_data = [item.model_dump() for item in order_in.items]
    calc_total = order_in.total_price or sum(item.quantity * item.price for item in order_in.items)

    new_pre_order = RestaurantPreOrder(
        order_code=order_code,
        reservation_code=order_in.reservation_code,
        guest_name=order_in.guest_name,
        room_number=order_in.room_number,
        items=items_data,
        total_price=calc_total,
        note=order_in.note,
        status="Pending",
    )
    db.add(new_pre_order)
    await db.commit()
    await db.refresh(new_pre_order)
    return new_pre_order


@router.get("/restaurant/pre-orders", response_model=List[RestaurantPreOrderResponse], tags=TAG_REST)
async def get_restaurant_pre_orders(db: AsyncSession = Depends(get_db)):
    """Returns list of all dish pre-orders."""
    res = await db.execute(select(RestaurantPreOrder).order_by(desc(RestaurantPreOrder.created_at)))
    return res.scalars().all()


@router.patch("/restaurant/reservations/{reservation_id}/status", response_model=RestaurantReservationResponse, tags=TAG_REST)
async def update_restaurant_reservation_status(
    reservation_id: str,
    status: str,
    db: AsyncSession = Depends(get_db),
):
    """Updates reservation status (e.g. Confirmed, Seated, Completed, Cancelled)."""
    res = await db.execute(
        select(RestaurantReservation).where(
            (RestaurantReservation.id == reservation_id) |
            (RestaurantReservation.reservation_code == reservation_id)
        )
    )
    res_obj = res.scalar_one_or_none()
    if not res_obj:
        raise HTTPException(status_code=404, detail="Reservation not found")

    res_obj.status = status
    await db.commit()
    await db.refresh(res_obj)
    return res_obj


# =====================================================================
# 11. GENERAL FLEET & STAFF ENDPOINTS
# =====================================================================

@router.get("/fleet", response_model=List[RobotUnitResponse])
async def get_robot_fleet(db: AsyncSession = Depends(get_db)):
    """Returns status of all active HCRobot autonomous units."""
    res = await db.execute(select(RobotUnit).order_by(RobotUnit.unit_code))
    return res.scalars().all()


@router.get("/staff", response_model=List[StaffResponse])
async def get_staff_roster(db: AsyncSession = Depends(get_db)):
    """Returns all staff members and their active shifts."""
    res = await db.execute(select(Staff).order_by(Staff.department, Staff.full_name))
    return res.scalars().all()


@router.post("/staff", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
async def create_staff_member(staff_in: StaffCreate, db: AsyncSession = Depends(get_db)):
    """Create a new hotel staff member."""
    existing = await db.execute(select(Staff).where(Staff.username == staff_in.username.strip().lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tên đăng nhập (username) đã tồn tại trong hệ thống")

    code = staff_in.code or "".join([w[0].upper() for w in staff_in.full_name.split() if w])[:4]
    new_staff = Staff(
        username=staff_in.username.strip().lower(),
        password_hash=hash_password(staff_in.password),
        code=code,
        full_name=staff_in.full_name,
        role=staff_in.role,
        department=staff_in.department,
        location=staff_in.location,
        status=staff_in.status,
        email=staff_in.email or f"{staff_in.username}@aurora.hotel",
        phone=staff_in.phone or "+84 90 123 4567",
        shift=staff_in.shift or "Morning Shift (06:00 - 14:00)",
        is_fallback_agent=staff_in.is_fallback_agent,
        assigned_floors=staff_in.assigned_floors or "Floor 1 - 5",
        notification_channels=staff_in.notification_channels or "Web Dashboard, Tablet Alert",
        avatar_url=staff_in.avatar_url,
    )
    db.add(new_staff)
    await db.commit()
    await db.refresh(new_staff)
    return new_staff


@router.patch("/staff/{staff_id}", response_model=StaffResponse)
async def update_staff_member(staff_id: str, update_in: StaffUpdate, db: AsyncSession = Depends(get_db)):
    """Update staff details, role, status, or robot escalation configuration."""
    res = await db.execute(select(Staff).where(Staff.id == staff_id))
    staff = res.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên với ID này")

    update_dict = update_in.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(staff, field, val)

    await db.commit()
    await db.refresh(staff)
    return staff


@router.delete("/staff/{staff_id}")
async def delete_staff_member(staff_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a staff member."""
    res = await db.execute(select(Staff).where(Staff.id == staff_id))
    staff = res.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên với ID này")

    await db.delete(staff)
    await db.commit()
    return {"message": "Đã xóa nhân viên thành công", "id": staff_id}


