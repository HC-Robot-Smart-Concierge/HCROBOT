import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.models.support import HumanSupportSession


SAMPLE_SUPPORT_SESSIONS = [
    {
        "session_code": "SES-302",
        "room_number": "Room 302",
        "guest_name": "Alexander Chen",
        "category": "Luggage Assist",
        "origin_robot_code": "RC-001 (Main Lobby)",
        "sentiment": "Impatient",
        "wait_time_label": "08m 10s",
        "status": "Active",
        "linked_request_id": "REQ-1042",
        "messages": [
            {
                "id": "msg-302-1",
                "speaker": "guest",
                "speaker_name": "Alexander Chen",
                "raw_transcript": "Can you help me with my luggage? I'm at the elevator bank.",
                "languages_detected": ["en"],
                "translations": {
                    "vi": "Bạn có thể giúp tôi chuyển hành lý không? Tôi đang ở cụm thang máy.",
                    "en": "Can you help me with my luggage? I'm at the elevator bank."
                },
                "sentiment": "Impatient",
                "confidence": 0.96,
                "timestamp": "10:42 AM"
            },
            {
                "id": "msg-302-2",
                "speaker": "robot",
                "speaker_name": "RC-001 (Automated)",
                "raw_transcript": "I can certainly help! I'm calling for a staff member to assist you now.",
                "languages_detected": ["en"],
                "translations": {
                    "vi": "Tôi chắc chắn có thể giúp! Tôi đang gọi một nhân viên đến hỗ trợ bạn ngay bây giờ.",
                    "en": "I can certainly help! I'm calling for a staff member to assist you now."
                },
                "sentiment": "Helpful",
                "confidence": 0.99,
                "timestamp": "10:42 AM"
            },
            {
                "id": "msg-302-3",
                "speaker": "system",
                "speaker_name": "System",
                "raw_transcript": "Staff member (You) joined the conversation",
                "languages_detected": ["en"],
                "translations": {
                    "vi": "Nhân viên hỗ trợ đã tham gia phiên đàm thoại",
                    "en": "Staff member (You) joined the conversation"
                },
                "sentiment": "Neutral",
                "confidence": 1.0,
                "timestamp": "10:43 AM"
            },
            {
                "id": "msg-302-4",
                "speaker": "staff",
                "speaker_name": "Elena Rossi (Staff)",
                "raw_transcript": "Hello Mr. Chen, I'm on my way to the 3rd floor elevators with a luggage cart.",
                "languages_detected": ["en"],
                "translations": {
                    "vi": "Chào ông Chen, tôi đang trên đường lên thang máy tầng 3 cùng xe đẩy hành lý.",
                    "en": "Hello Mr. Chen, I'm on my way to the 3rd floor elevators with a luggage cart."
                },
                "sentiment": "Courteous",
                "confidence": 0.99,
                "timestamp": "10:50 AM"
            }
        ]
    },
    {
        "session_code": "SES-402",
        "room_number": "Room 402",
        "guest_name": "Elena Rossi",
        "category": "Maintenance",
        "origin_robot_code": "RC-001 (Floor 4)",
        "sentiment": "Neutral",
        "wait_time_label": "02m 14s",
        "status": "Active",
        "linked_request_id": "REQ-MN-401",
        "messages": [
            {
                "id": "msg-402-1",
                "speaker": "guest",
                "speaker_name": "Elena Rossi",
                "raw_transcript": "Bonjour! The air conditioner trong phòng 402 is not working per favore.",
                "languages_detected": ["fr", "en", "vi", "it"],
                "translations": {
                    "vi": "Xin chào! Máy điều hòa trong phòng 402 không hoạt động, làm ơn kiểm tra giúp.",
                    "en": "Hello! The air conditioner in room 402 is not working please."
                },
                "sentiment": "Neutral",
                "confidence": 0.92,
                "timestamp": "10:52 AM"
            },
            {
                "id": "msg-402-2",
                "speaker": "robot",
                "speaker_name": "RC-001 (Automated)",
                "raw_transcript": "Đã ghi nhận sự cố điều hòa phòng 402. Tôi đã tạo phiếu kỹ thuật gửi bộ phận bảo trì đến kiểm tra ngay!",
                "languages_detected": ["vi"],
                "translations": {
                    "vi": "Đã ghi nhận sự cố điều hòa phòng 402. Tôi đã tạo phiếu kỹ thuật gửi bộ phận bảo trì đến kiểm tra ngay!",
                    "en": "Air conditioner issue for Room 402 recorded. I have dispatched a technician to check it right away!"
                },
                "sentiment": "Positive",
                "confidence": 0.98,
                "timestamp": "10:53 AM"
            }
        ]
    },
    {
        "session_code": "SES-105",
        "room_number": "Room 105",
        "guest_name": "Mark Thompson",
        "category": "Housekeeping",
        "origin_robot_code": "RC-001 (Main Lobby)",
        "sentiment": "Positive",
        "wait_time_label": "05m 45s",
        "status": "Active",
        "linked_request_id": "REQ-HK-1042",
        "messages": [
            {
                "id": "msg-105-1",
                "speaker": "guest",
                "speaker_name": "Mark Thompson",
                "raw_transcript": "Could you send extra towels to room 105 please?",
                "languages_detected": ["en"],
                "translations": {
                    "vi": "Bạn có thể mang thêm khăn tắm lên phòng 105 giúp tôi được không?",
                    "en": "Could you send extra towels to room 105 please?"
                },
                "sentiment": "Positive",
                "confidence": 0.97,
                "timestamp": "10:35 AM"
            },
            {
                "id": "msg-105-2",
                "speaker": "robot",
                "speaker_name": "RC-001 (Automated)",
                "raw_transcript": "Vâng, yêu cầu khăn tắm của phòng 105 đã được tiếp nhận. Nhân viên buồng phòng sẽ mang lên trong 10 phút.",
                "languages_detected": ["vi"],
                "translations": {
                    "vi": "Vâng, yêu cầu khăn tắm của phòng 105 đã được tiếp nhận. Nhân viên buồng phòng sẽ mang lên trong 10 phút.",
                    "en": "Yes, towel request for Room 105 has been received. Housekeeping will deliver them in 10 minutes."
                },
                "sentiment": "Helpful",
                "confidence": 0.99,
                "timestamp": "10:35 AM"
            }
        ]
    }
]


async def seed_support_data():
    print("[*] Checking and creating human_support_sessions table if missing...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        for s_data in SAMPLE_SUPPORT_SESSIONS:
            res = await session.execute(
                select(HumanSupportSession).where(HumanSupportSession.session_code == s_data["session_code"])
            )
            existing = res.scalar_one_or_none()
            if not existing:
                item = HumanSupportSession(
                    session_code=s_data["session_code"],
                    room_number=s_data["room_number"],
                    guest_name=s_data["guest_name"],
                    category=s_data["category"],
                    origin_robot_code=s_data["origin_robot_code"],
                    sentiment=s_data["sentiment"],
                    wait_time_label=s_data["wait_time_label"],
                    status=s_data["status"],
                    linked_request_id=s_data["linked_request_id"],
                    messages=s_data["messages"]
                )
                session.add(item)
        await session.commit()
        print("[SUCCESS] Human support sessions seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed_support_data())
