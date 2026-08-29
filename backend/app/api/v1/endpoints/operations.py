import random
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, desc

from app.core.database import get_db
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
)
from app.schemas.operations import (
    StaffResponse,
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
)

router = APIRouter()


# =====================================================================
# 1. ROOM SERVICE / F&B DASHBOARD & ORDERS
# =====================================================================

TAG_FB = ["5. Bộ phận Phục vụ phòng (F&B / Room Service)"]
TAG_HK = ["6. Bộ phận Buồng phòng (Housekeeping)"]
TAG_BELL = ["7. Bộ phận Vận chuyển hành lý (Bellman Services)"]
TAG_MNT = ["8. Bộ phận Kỹ thuật & Bảo trì (Facility Maintenance)"]
TAG_OPS = ["9. Điều phối Vận hành (Operations)"]
TAG_REST = ["10. Bộ phận Nhà hàng (Restaurant - Đặt bàn & Đặt món trước)"]


@router.get("/dashboard/room-service", response_model=RoomServiceDashboardResponse, tags=TAG_FB)
async def get_room_service_dashboard(db: AsyncSession = Depends(get_db)):
    """Returns real-time KPIs, active orders, delivery fleet, and low stock alerts for Room Service."""
    # 1. Fetch Orders
    orders_res = await db.execute(select(RoomServiceOrder).order_by(desc(RoomServiceOrder.created_at)))
    orders = orders_res.scalars().all()

    # 2. Fetch Robots
    fleet_res = await db.execute(select(RobotUnit).order_by(RobotUnit.unit_code))
    delivery_fleet = fleet_res.scalars().all()

    # 3. Fetch Stock
    stock_res = await db.execute(select(InventoryStock).order_by(InventoryStock.quantity))
    low_stock_alerts = stock_res.scalars().all()

    # 4. Calculate dynamic KPIs
    pending_count = sum(1 for o in orders if o.status == "Pending")
    in_prep_count = sum(1 for o in orders if o.status == "Cooking")
    completed_count = sum(1 for o in orders if o.status in ["Completed", "Ready", "Delivered"])
    vip_count = sum(1 for o in orders if o.is_vip and o.status != "Completed")

    kpis = {
        "pendingOrders": {"value": pending_count, "delta": "+0", "status": "neutral"},
        "inPreparation": {"value": in_prep_count, "avgTime": "12m"},
        "completedToday": {"value": completed_count},
        "highPriority": {"count": vip_count, "label": "VIP Guests"},
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
        is_vip=order_in.is_vip,
        priority=order_in.priority,
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

    order.assigned_robot_id = assign_in.robot_id
    order.assigned_staff_name = assign_in.robot_name or "HCRobot Unit 01"
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
                priority=h.priority or "NORMAL",
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
                priority=d.priority or "NORMAL",
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
    high_prio_count = sum(1 for r in unified_hk if "HIGH" in (r.priority or "").upper() and r.status != "Completed")

    kpis = {
        "pendingRequests": pending_count,
        "inProgress": in_prog_count,
        "completedToday": completed_count,
        "highPriority": high_prio_count,
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
        priority=req_in.priority,
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
    urgent_count = sum(1 for r in requests if r.is_urgent or "HIGH" in (r.priority or "").upper())

    kpis = {
        "pending": pending_count,
        "onJob": on_job_count,
        "completed": completed_count,
        "urgent": urgent_count,
    }

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
        priority=req_in.priority,
        is_urgent=req_in.is_urgent,
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
    high_count = sum(1 for r in requests if "HIGH" in (r.priority or "").upper() and r.status != "Completed")

    kpis = {
        "highPriority": {"count": high_count, "delta": "+0", "status": "good"},
        "pendingRequests": pending_count,
        "inProgress": in_prog_count,
        "completedToday": {"count": completed_count, "delta": "+0", "status": "good"},
    }

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
        priority=req_in.priority,
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
# 6. UNIFIED REQUESTS & GENERIC UPDATE
# =====================================================================

@router.get("/all-requests", tags=TAG_OPS)
async def get_all_unified_requests(db: AsyncSession = Depends(get_db)):
    """Returns consolidated requests across all hotel departments."""
    orders_res = await db.execute(select(RoomServiceOrder).order_by(desc(RoomServiceOrder.created_at)))
    hk_res = await db.execute(select(HousekeepingRequest).order_by(desc(HousekeepingRequest.created_at)))
    bell_res = await db.execute(select(BellRequest).order_by(desc(BellRequest.created_at)))
    maint_res = await db.execute(select(MaintenanceRequest).order_by(desc(MaintenanceRequest.created_at)))
    dir_res = await db.execute(select(ManagementDirective).order_by(desc(ManagementDirective.created_at)))

    unified = []

    for o in orders_res.scalars().all():
        unified.append({
            "id": f"REQ-{o.order_number}",
            "raw_id": o.id,
            "department": "F&B",
            "title": f"Order #{o.order_number}: {', '.join([i.get('name', 'Item') for i in o.items]) if o.items else 'Room Service'}",
            "location": o.room_number,
            "guestName": "VIP Guest" if o.is_vip else "Room Guest",
            "priority": "HIGH PRIORITY" if o.priority == "high" or o.is_vip else "NORMAL",
            "status": o.status,
            "time": "Recent",
            "assignedTo": o.assigned_staff_name,
            "notes": o.note,
            "table_type": "room_service",
        })

    for h in hk_res.scalars().all():
        unified.append({
            "id": f"REQ-{h.ticket_code}",
            "raw_id": h.id,
            "department": "Housekeeping",
            "title": h.title,
            "location": f"ROOM {h.room_number}",
            "guestName": h.guest_name or "Guest",
            "priority": h.priority,
            "status": h.status,
            "time": h.time_label,
            "assignedTo": h.assigned_staff_name,
            "notes": h.description,
            "table_type": "housekeeping",
        })

    for b in bell_res.scalars().all():
        unified.append({
            "id": f"REQ-{b.ticket_code}",
            "raw_id": b.id,
            "department": "Bell Services",
            "title": b.title,
            "location": b.location,
            "guestName": b.guest_name or b.reporter or "Guest",
            "priority": b.priority,
            "status": b.status,
            "time": "Today",
            "assignedTo": b.assigned_to,
            "notes": b.description,
            "table_type": "bell",
        })

    for m in maint_res.scalars().all():
        unified.append({
            "id": f"REQ-{m.ticket_code}",
            "raw_id": m.id,
            "department": "Maintenance",
            "title": m.title,
            "location": m.location,
            "guestName": "Guest / Staff Reported",
            "priority": m.priority,
            "status": m.status,
            "time": m.reported_time_label,
            "assignedTo": m.assigned_to,
            "notes": m.description,
            "table_type": "maintenance",
        })

    for d in dir_res.scalars().all():
        unified.append({
            "id": f"REQ-{d.code}",
            "raw_id": d.id,
            "department": d.department,
            "title": d.title,
            "location": d.location,
            "guestName": "Operations Directive",
            "priority": d.priority,
            "status": d.status,
            "time": d.reported_time_label,
            "assignedTo": d.assigned_staff_name,
            "notes": d.description,
            "table_type": "directive",
        })

    return unified


@router.patch("/generic-request/{ticket_id}/status", tags=TAG_OPS)
async def update_generic_request_status(
    ticket_id: str,
    status: str,
    assigned_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Universal status updater across all operational tables in DB."""
    clean_id = ticket_id.replace("REQ-", "").strip()

    # 1. Check Room Service
    res = await db.execute(
        select(RoomServiceOrder).where(
            (RoomServiceOrder.order_number == clean_id) |
            (RoomServiceOrder.id == clean_id) |
            (RoomServiceOrder.order_number == ticket_id) |
            (RoomServiceOrder.id == ticket_id) |
            (RoomServiceOrder.id.ilike(f"%{clean_id}%"))
        )
    )
    order = res.scalar_one_or_none()
    if order:
        order.status = status
        if assigned_to:
            order.assigned_staff_name = assigned_to
        await db.commit()
        return {"success": True, "type": "room_service", "id": order.id, "status": order.status}

    # 2. Check Housekeeping
    res = await db.execute(
        select(HousekeepingRequest).where(
            (HousekeepingRequest.ticket_code == clean_id) |
            (HousekeepingRequest.id == clean_id) |
            (HousekeepingRequest.ticket_code == ticket_id) |
            (HousekeepingRequest.id == ticket_id) |
            (HousekeepingRequest.id.ilike(f"%{clean_id}%")) |
            (HousekeepingRequest.ticket_code.ilike(f"%{clean_id}%"))
        )
    )
    hk = res.scalar_one_or_none()
    if hk:
        hk.status = status
        if assigned_to:
            hk.assigned_staff_name = assigned_to
        await db.commit()
        return {"success": True, "type": "housekeeping", "id": hk.id, "status": hk.status}

    # 3. Check Bell
    res = await db.execute(
        select(BellRequest).where(
            (BellRequest.ticket_code == clean_id) |
            (BellRequest.id == clean_id) |
            (BellRequest.ticket_code == ticket_id) |
            (BellRequest.id == ticket_id) |
            (BellRequest.id.ilike(f"%{clean_id}%"))
        )
    )
    bell = res.scalar_one_or_none()
    if bell:
        bell.status = status
        if assigned_to:
            bell.assigned_to = assigned_to
        await db.commit()
        return {"success": True, "type": "bell", "id": bell.id, "status": bell.status}

    # 4. Check Maintenance
    res = await db.execute(
        select(MaintenanceRequest).where(
            (MaintenanceRequest.ticket_code == clean_id) |
            (MaintenanceRequest.id == clean_id) |
            (MaintenanceRequest.ticket_code == ticket_id) |
            (MaintenanceRequest.id == ticket_id) |
            (MaintenanceRequest.id.ilike(f"%{clean_id}%"))
        )
    )
    maint = res.scalar_one_or_none()
    if maint:
        maint.status = status
        if assigned_to:
            maint.assigned_to = assigned_to
        await db.commit()
        return {"success": True, "type": "maintenance", "id": maint.id, "status": maint.status}

    # 5. Check Directive
    res = await db.execute(
        select(ManagementDirective).where(
            (ManagementDirective.code == clean_id) |
            (ManagementDirective.id == clean_id) |
            (ManagementDirective.code == ticket_id) |
            (ManagementDirective.id == ticket_id) |
            (ManagementDirective.id.ilike(f"%{clean_id}%"))
        )
    )
    dir_item = res.scalar_one_or_none()
    if dir_item:
        dir_item.status = status
        if assigned_to:
            dir_item.assigned_staff_name = assigned_to
        await db.commit()
        return {"success": True, "type": "directive", "id": dir_item.id, "status": dir_item.status}

    return {"success": True, "message": f"Updated ticket {ticket_id} status to {status}"}


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

