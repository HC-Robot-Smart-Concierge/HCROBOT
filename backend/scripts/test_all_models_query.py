import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import AsyncSessionLocal
from app.models import (
    Staff, Department, ServiceType, SupportRequest, RoomServiceOrder, 
    OrderItem, Robot, Job, JobStep, JobEvent, ManagementDirective, 
    HumanSupportSession, ChatSession, ChatMessage, LogEvent, AuditLog, 
    Notification, Hotel, Floor, Room, Amenity, Event, Map, Zone, 
    Endpoint, EndpointGroup, EndpointGroupMember, Menu, MenuItem, 
    FoodItem, Feedback, Schedule, RobotWorkflow, DialogueScenario
)
from sqlalchemy import select

async def test_models():
    print("Testing select query on each model against live database...")
    async with AsyncSessionLocal() as session:
        models = [
            Staff, Department, ServiceType, SupportRequest, RoomServiceOrder, 
            OrderItem, Robot, Job, JobStep, JobEvent, ManagementDirective, 
            HumanSupportSession, ChatSession, ChatMessage, LogEvent, AuditLog, 
            Notification, Hotel, Floor, Room, Amenity, Event, Map, Zone, 
            Endpoint, EndpointGroup, EndpointGroupMember, Menu, MenuItem, 
            FoodItem, Feedback, Schedule, RobotWorkflow, DialogueScenario
        ]
        all_ok = True
        for m in models:
            try:
                res = await session.execute(select(m).limit(1))
                row = res.scalar()
                sample_id = getattr(row, "id", None) if row else "Empty table"
                print(f"  [OK] Model {m.__name__:<22} -> Sample ID: {sample_id}")
            except Exception as e:
                print(f"  [FAIL] Model {m.__name__:<22} -> Error: {e}")
                all_ok = False
        
        if all_ok:
            print("\nALL 34 SQLALCHEMY MODELS QUERY 100% CLEANLY!")
        else:
            print("\nSOME MODELS FAILED!")

if __name__ == '__main__':
    asyncio.run(test_models())
