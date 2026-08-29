import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import engine, Base
from app.models import (
    Staff,
    RobotUnit,
    RoomServiceOrder,
    HousekeepingRequest,
    BellRequest,
    MaintenanceRequest,
    ManagementDirective,
    InventoryStock,
)

logger = logging.getLogger(__name__)


async def init_db(session: AsyncSession = None):
    """
    Creates all database tables defined in SQLAlchemy ORM and seeds default 5-star hotel data
    if tables are currently empty.
    """
    # 1. Create tables
    async with engine.begin() as conn:
        logger.info("🛠️ Creating all database tables if not exist (Code-First Migration)...")
        await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables verified/created successfully.")

    # 2. Seed initial data if needed
    if session:
        await seed_initial_data(session)


async def seed_initial_data(session: AsyncSession):
    """Populates initial operational data corresponding to Aurora Grand Hotel & HCRobot dashboards."""
    try:
        # Check if staff table has data
        staff_check = await session.execute(select(Staff).limit(1))
        if staff_check.scalar_one_or_none() is not None:
            logger.info("ℹ️ Database already contains seed data. Skipping initial population.")
            return

        logger.info("🌱 Seeding initial 5-star hotel operational data for Aurora OS...")

        # 1. Seed Staff with Authentication Credentials (Default password: '123456')
        from app.core.security import hash_password
        default_pwd_hash = hash_password("123456")

        staff_members = [
            Staff(
                username="roomservice",
                password_hash=default_pwd_hash,
                code="ER",
                full_name="Elena Rossi",
                role="Shift Leader / F&B Lead",
                department="F&B",
                default_dashboard="room_service",
                location="Main Hotel",
                status="available",
                current_tasks_count=0,
                avatar_url=None,
            ),
            Staff(
                username="manager",
                password_hash=default_pwd_hash,
                code="MV",
                full_name="Marcus Vane",
                role="General Manager",
                department="Executive",
                default_dashboard="manager_hub",
                location="Executive Office",
                status="available",
                current_tasks_count=0,
                avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
            ),
            Staff(
                username="housekeeping",
                password_hash=default_pwd_hash,
                code="MS",
                full_name="Maria Santos",
                role="Housekeeping Lead",
                department="Housekeeping",
                default_dashboard="housekeeping",
                location="Floor 3",
                status="available",
                current_tasks_count=0,
                avatar_url="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
            ),
            Staff(
                username="maintenance",
                password_hash=default_pwd_hash,
                code="JD",
                full_name="James Doe",
                role="HVAC Tech & Maintenance",
                department="Maintenance",
                default_dashboard="maintenance",
                location="Floor 5",
                status="busy",
                current_tasks_count=1,
                avatar_url="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80",
            ),
            Staff(
                username="bellman",
                password_hash=default_pwd_hash,
                code="MT",
                full_name="Marcus T.",
                role="Bell Captain",
                department="Bell Services",
                default_dashboard="bell_services",
                location="Lobby",
                status="available",
                current_tasks_count=0,
                avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
            ),
            Staff(
                username="admin",
                password_hash=default_pwd_hash,
                code="ADM",
                full_name="System Administrator",
                role="Operations Admin",
                department="Executive",
                default_dashboard="manager_hub",
                location="Command Center",
                status="available",
                current_tasks_count=0,
                avatar_url=None,
            ),
            Staff(
                username="sarah_j",
                password_hash=default_pwd_hash,
                code="SJ",
                full_name="Sarah J.",
                role="Attendant",
                department="Bell Services",
                default_dashboard="bell_services",
                location="Lobby",
                status="busy",
                current_tasks_count=1,
                avatar_url="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
            ),
        ]
        session.add_all(staff_members)

        # 2. Seed Robot Units
        robot_units = [
            RobotUnit(
                unit_code="U1",
                name="Unit 01",
                model_type="delivery",
                status="Available",
                status_color="emerald",
                location="F&B Dock",
                battery_level=96,
            ),
            RobotUnit(
                unit_code="U2",
                name="Unit 02",
                model_type="delivery",
                status="Delivering",
                status_color="sky",
                location="En route Fl 4",
                battery_level=74,
            ),
            RobotUnit(
                unit_code="U3",
                name="Unit 03",
                model_type="delivery",
                status="Charging",
                status_color="amber",
                location="84%",
                battery_level=84,
            ),
            RobotUnit(
                unit_code="ALPHA",
                name="Bot Unit Alpha",
                model_type="automated_cart",
                status="Available",
                status_color="emerald",
                location="Lobby",
                battery_level=92,
            ),
        ]
        session.add_all(robot_units)

        # 3. Seed Room Service Orders
        orders = [
            RoomServiceOrder(
                order_number="1042",
                room_number="ROOM 412",
                is_vip=True,
                status="Pending",
                priority="high",
                items=[
                    {"name": "Club Sandwich & Truffle Fries", "qty": 2},
                    {"name": "Artisan Cola (Ice)", "qty": 2},
                ],
                note="Note: No mayo on one sandwich, please.",
                image_url="https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80",
                progress=0,
            ),
            RoomServiceOrder(
                order_number="1041",
                room_number="ROOM 208",
                is_vip=False,
                status="Cooking",
                priority="normal",
                items=[
                    {"name": "Grand Breakfast Set for Two", "qty": 1},
                ],
                est_completion="4 mins",
                progress=60,
                image_url="https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=500&auto=format&fit=crop&q=80",
            ),
            RoomServiceOrder(
                order_number="1040",
                room_number="ROOM 512",
                is_vip=False,
                status="Pending",
                priority="normal",
                items=[
                    {"name": "Extra Tableware & Wine Glasses", "qty": "Set of 4"},
                ],
                note="Service Request - No food prep required",
                is_service_request=True,
                progress=0,
            ),
        ]
        session.add_all(orders)

        # 4. Seed Housekeeping Requests
        hk_requests = [
            HousekeepingRequest(
                ticket_code="HK-1042",
                source="From HCRobot",
                priority="HIGH PRIORITY",
                time_label="10:15 AM",
                title="Spill cleanup required",
                room_number="502",
                description="Wine spill on carpet. Guest requested immediate attention.",
                guest_name="Mr. John Smith",
                status="Unassigned",
            ),
            HousekeepingRequest(
                ticket_code="HK-1043",
                source="From HCRobot",
                priority="NORMAL",
                time_label="10:22 AM",
                title="Extra Towels",
                room_number="314",
                description="Guest requested 4 extra bath towels.",
                guest_name="Mrs. Alena Croft",
                status="Unassigned",
            ),
        ]
        session.add_all(hk_requests)

        # 5. Seed Bell Requests
        bell_requests = [
            BellRequest(
                ticket_code="BS-501",
                title="Luggage Pickup (Urgent)",
                priority="HIGH PRIORITY",
                is_urgent=True,
                location="Suite 402",
                guest_name="Mr. Aris Thorne",
                description="Guest is departing early for an international flight. Requires immediate assistance with 4 large suitcases and 2 garment bags. VIP status.",
                status="Pending",
                request_type="luggage",
            ),
            BellRequest(
                ticket_code="BS-502",
                title="Room Move Assistance",
                priority="Pending",
                is_urgent=False,
                location="Room 215 to 510",
                guest_name="Mrs. Elena Rostova",
                description="Guest requested an upgrade. Need to move luggage from current room to the new suite. Coordinate with housekeeping for final check of Room 215.",
                status="Pending",
                request_type="room_move",
            ),
            BellRequest(
                ticket_code="BS-503",
                title="Lost & Found Retrieval",
                priority="In Progress",
                is_urgent=False,
                location="Lobby Lounge",
                reporter="Staff (J. Doe)",
                description="A leather briefcase was left near the grand piano. Retrieve, log into system, and secure in the main Lost & Found locker.",
                status="In Progress",
                request_type="lost_found",
            ),
        ]
        session.add_all(bell_requests)

        # 6. Seed Maintenance Requests
        maintenance_requests = [
            MaintenanceRequest(
                ticket_code="MN-401",
                title="Plumbing Leak",
                category="plumbing",
                priority="HIGH PRIORITY",
                reported_time_label="10 mins ago",
                location="Room 412",
                description="Guest reported water pooling near bathroom sink.",
                source="RECEIVED FROM HCROBOT",
                status="Pending",
            ),
            MaintenanceRequest(
                ticket_code="MN-402",
                title="Air Conditioner Issue",
                category="hvac",
                priority="In Progress",
                reported_time_label="45 mins ago",
                location="Room 305",
                description="Unit making loud rattling noise when fan is on high.",
                source="RECEIVED FROM HCROBOT",
                status="In Progress",
                assigned_to="James D.",
            ),
            MaintenanceRequest(
                ticket_code="MN-403",
                title="Light Bulb Replacement",
                category="electrical",
                priority="Completed",
                reported_time_label="2 hrs ago",
                location="Corridor 2B",
                description="Fading overhead light near elevator bay.",
                source="RECEIVED FROM HCROBOT",
                status="Completed",
            ),
        ]
        session.add_all(maintenance_requests)

        # 7. Seed Management Directives
        directives = [
            ManagementDirective(
                code="M-101",
                title="Spill in Lobby",
                department="Housekeeping",
                priority="URGENT",
                location="Main Entrance",
                reported_time_label="Reported 2m ago",
                status="Unassigned",
                type="spill",
            ),
            ManagementDirective(
                code="M-102",
                title="Room Make-up",
                department="Housekeeping",
                priority="PENDING",
                location="Suite 402",
                reported_time_label="Guest Requested",
                status="Unassigned",
                type="room_service",
            ),
            ManagementDirective(
                code="M-103",
                title="Extra Towels",
                department="Housekeeping",
                priority="IN PROGRESS",
                location="Room 214",
                reported_time_label="Scheduled",
                status="In Progress",
                assigned_staff_name="Maria S.",
                assigned_eta="5m",
                assigned_staff_avatar="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
                type="towels",
            ),
        ]
        session.add_all(directives)

        # 8. Seed Inventory Stocks
        stocks = [
            InventoryStock(name="Artisan Cola", category="beverage", count_label="6 left", quantity=6, level="danger"),
            InventoryStock(name="Sparkling Water (L)", category="beverage", count_label="2 left", quantity=2, level="danger"),
            InventoryStock(name="Truffle Oil", category="condiment", count_label="1 btl", quantity=1, level="warning"),
        ]
        session.add_all(stocks)

        await session.commit()
        logger.info("🎉 Initial 5-star hotel operational data seeded successfully!")

    except Exception as e:
        await session.rollback()
        logger.error(f"❌ Error seeding initial hotel data: {e}")
        raise e
