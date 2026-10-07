import json
import logging
from typing import Dict, Any, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class VideoCallManager:
    """
    Quản lý phòng gọi và WebSocket Signaling Hub cho WebRTC Video Call 2 chiều
    giữa Robot Kiosk (Guest) và Concierge Staff Dashboard (Tổng đài viên).
    """

    def __init__(self):
        # session_id -> { "guest": (websocket, guest_info), "staff": (websocket, staff_info) }
        self.rooms: Dict[str, Dict[str, Dict[str, Any]]] = {}

    async def connect(self, websocket: WebSocket, session_id: str, role: str, name: str = "User"):
        """Kết nối WebSocket của một peer vào phòng gọi."""
        await websocket.accept()
        if session_id not in self.rooms:
            self.rooms[session_id] = {}

        self.rooms[session_id][role] = {
            "ws": websocket,
            "role": role,
            "name": name,
        }
        logger.info(f"[VideoCall] Peer joined: role='{role}', name='{name}', session='{session_id}'")

        # Thông báo cho peer còn lại trong phòng (nếu đã vào trước)
        other_role = "staff" if role == "guest" else "guest"
        if other_role in self.rooms[session_id]:
            other_peer = self.rooms[session_id][other_role]
            # Báo cho người vừa vào biết người kia đã có mặt
            await websocket.send_text(json.dumps({
                "type": "peer_joined",
                "role": other_role,
                "name": other_peer["name"],
                "is_initiator": (role == "guest"), # Guest là người khởi tạo gọi
            }))
            # Báo cho người kia biết bạn mới vào
            await other_peer["ws"].send_text(json.dumps({
                "type": "peer_joined",
                "role": role,
                "name": name,
                "is_initiator": (role == "guest"),
            }))

    def disconnect(self, websocket: WebSocket, session_id: str):
        """Ngắt kết nối và dọn dẹp phòng gọi khi peer rời đi."""
        if session_id in self.rooms:
            for role, data in list(self.rooms[session_id].items()):
                if data["ws"] == websocket:
                    logger.info(f"[VideoCall] Peer disconnected: role='{role}', session='{session_id}'")
                    del self.rooms[session_id][role]
                    break

            # Nếu phòng trống -> xóa phòng
            if not self.rooms[session_id]:
                del self.rooms[session_id]
            else:
                # Báo cho peer còn lại rằng đối phương đã ngắt kết nối
                for remaining_role, data in self.rooms[session_id].items():
                    try:
                        import asyncio
                        asyncio.create_task(data["ws"].send_text(json.dumps({
                            "type": "peer_disconnected",
                            "message": "Đối phương đã ngắt kết nối cuộc gọi.",
                        })))
                    except Exception:
                        pass

    async def forward_signaling_message(self, websocket: WebSocket, session_id: str, message_data: Dict[str, Any]):
        """Chuyển tiếp gói tin signaling (offer, answer, candidate, hangup,...) tới peer đối diện."""
        if session_id not in self.rooms:
            return

        room = self.rooms[session_id]
        for role, data in room.items():
            if data["ws"] != websocket:
                try:
                    await data["ws"].send_text(json.dumps(message_data))
                except Exception as e:
                    logger.warning(f"[VideoCall] Lỗi chuyển tiếp signaling tới {role}: {e}")

    def get_room_state(self, session_id: str) -> Dict[str, Any]:
        """Lấy trạng thái hiện tại của phòng gọi."""
        if session_id not in self.rooms:
            return {"active": False, "peers": []}
        return {
            "active": True,
            "peers": [
                {"role": data["role"], "name": data["name"]}
                for data in self.rooms[session_id].values()
            ]
        }


video_call_manager = VideoCallManager()
