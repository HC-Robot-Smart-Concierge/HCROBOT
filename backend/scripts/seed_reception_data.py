import asyncio
import os
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import AsyncSessionLocal
from app.db.init_db import init_db
from app.models import ReceptionRequest


TICKET_CODE = "REQ-8942A"


async def seed_reception_data(session: AsyncSession) -> bool:
    existing_result = await session.execute(
        select(ReceptionRequest).where(ReceptionRequest.ticket_code == TICKET_CODE)
    )
    if existing_result.scalar_one_or_none():
        return False

    session.add(
        ReceptionRequest(
            ticket_code=TICKET_CODE,
            title="Leaking Faucet in Master Bathroom",
            created_label="Created 14 mins ago",
            location="Suite 402",
            location_details={
                "floor": "West Wing",
                "category": "Premium Ocean View",
            },
            guest_name="Mr. A. Sterling",
            guest_tier="VIP",
            guest_stay_details="Check-out: Tomorrow, 11:00 AM",
            priority="High",
            status="Pending Action",
            description=(
                "Guest reported a persistent dripping sound coming from the master bathroom "
                "dual sink vanity. The left faucet is leaking approximately one drop every two "
                "seconds, causing noise disruption and minor water pooling on the marble counter. "
                "Guest requested immediate maintenance while they are out for lunch (expected "
                "return: 2:30 PM)."
            ),
            attached_media=[
                {
                    "url": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500&auto=format&fit=crop&q=80",
                    "alt": "Close-up of bathroom faucet",
                },
                {
                    "url": "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=500&auto=format&fit=crop&q=80",
                    "alt": "Guest bathroom interior",
                },
            ],
            transcript=[
                {
                    "speaker": "guest",
                    "time": "11:42 AM",
                    "message": "Aurora, the sink in the bathroom is dripping. It's driving me crazy. Can you send someone to fix it?",
                },
                {
                    "speaker": "assistant",
                    "time": "11:42 AM",
                    "message": "I apologize for the inconvenience, Mr. Sterling. I have logged a maintenance request for the dripping sink. Is it the master bathroom or the powder room?",
                },
                {
                    "speaker": "guest",
                    "time": "11:43 AM",
                    "message": "Master bathroom. The left one. We're heading out to lunch now, so they can fix it while we're gone.",
                },
                {
                    "speaker": "assistant",
                    "time": "11:43 AM",
                    "message": "Understood. I will dispatch maintenance immediately and note that the room is vacant until your return. Enjoy your lunch.",
                },
            ],
            assistance_status="Connected",
            assigned_to="Javier Morales",
            assigned_role="Maintenance Tech II",
            activity_log=[
                {
                    "title": "Video Call Ended",
                    "detail": "Staff: Elena Rossi (Duration: 03:42)",
                    "time": "11:46 AM",
                },
                {
                    "title": "Video call started",
                    "detail": "",
                    "time": "11:42 AM",
                },
                {
                    "title": "Human assistance requested",
                    "detail": "Reason: Guest requires clarification on bathroom maintenance.",
                    "time": "11:41 AM",
                },
                {
                    "title": "Task Assigned",
                    "detail": "System assigned to J. Morales",
                    "time": "11:45 AM",
                },
                {
                    "title": "Request Created",
                    "detail": "Via In-Room HCRobot",
                    "time": "11:43 AM",
                },
            ],
        )
    )
    await session.commit()
    return True


async def main():
    await init_db()
    async with AsyncSessionLocal() as session:
        created = await seed_reception_data(session)
    print("Reception request seed completed: " + ("1 created." if created else "already existed."))


if __name__ == "__main__":
    asyncio.run(main())
