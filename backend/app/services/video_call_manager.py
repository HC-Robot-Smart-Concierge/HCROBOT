import json
import logging
import socket
from typing import Dict, Any, Optional, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


def get_lan_ip() -> str:
    """Lấy địa chỉ IPv4 LAN thực tế của máy chủ để hỗ trợ WebRTC P2P direct routing."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip


class VideoCallManager:
    """
    Quản lý phòng gọi và WebSocket Signaling Hub cho WebRTC Video Call 2 chiều
    giữa Robot Kiosk (Guest) và Concierge Staff Dashboard (Tổng đài viên).
    Hỗ trợ chuẩn hóa alias (ticket_code, request_id, support_session_id) về cùng 1 phòng.
    """

    def __init__(self):
        # session_id -> { "guest": {"ws": ws, ...}, "staff": {"ws": ws, ...} }
        self.rooms: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # alias -> canonical_session_id
        self.aliases: Dict[str, str] = {}

    def register_alias(self, canonical_id: str, *aliases: Optional[str]):
        """Đăng ký các định danh tương đương (ticket_code, req.id, session_code) về cùng phòng gọi."""
        if not canonical_id:
            return
        c_id = canonical_id.strip()
        for a in aliases:
            if a and isinstance(a, str):
                alias_clean = a.strip()
                self.aliases[alias_clean] = c_id
        logger.info(f"[VideoCall] Registered aliases for canonical room '{c_id}': {list(aliases)}")

    def resolve_session_id(self, session_id: str) -> str:
        """Chuẩn hóa session_id về canonical ID duy nhất để 2 bên luôn gặp nhau."""
        if not session_id:
            return "default-room"
        s = session_id.strip()
        # Nếu đã có alias trực tiếp
        if s in self.aliases:
            return self.aliases[s]
        return s

    async def connect(self, websocket: WebSocket, session_id: str, role: str, name: str = "User"):
        """Kết nối WebSocket của một peer vào phòng gọi đã được chuẩn hóa."""
        await websocket.accept()
        canonical_session = self.resolve_session_id(session_id)

        if canonical_session not in self.rooms:
            self.rooms[canonical_session] = {}

        self.rooms[canonical_session][role] = {
            "ws": websocket,
            "role": role,
            "name": name,
        }
        logger.info(
            f"[VideoCall] Peer joined: role='{role}', name='{name}', "
            f"input_session='{session_id}', canonical_room='{canonical_session}'"
        )

        # Gửi thông tin server LAN IP cho peer để hỗ trợ de-anonymize mDNS candidate
        try:
            await websocket.send_text(json.dumps({
                "type": "server_info",
                "lan_ip": get_lan_ip(),
            }))
        except Exception:
            pass

        # Thông báo cho peer còn lại trong phòng (nếu đã vào trước)
        other_role = "staff" if role == "guest" else "guest"
        if other_role in self.rooms[canonical_session]:
            other_peer = self.rooms[canonical_session][other_role]
            # Báo cho người vừa vào biết người kia đã có mặt
            try:
                await websocket.send_text(json.dumps({
                    "type": "peer_joined",
                    "role": other_role,
                    "name": other_peer["name"],
                    "is_initiator": (role == "guest"),
                }))
            except Exception as e:
                logger.warning(f"[VideoCall] Failed to send peer_joined to new peer: {e}")

            # Báo cho người kia biết bạn mới vào
            try:
                await other_peer["ws"].send_text(json.dumps({
                    "type": "peer_joined",
                    "role": role,
                    "name": name,
                    "is_initiator": (role == "guest"),
                }))
            except Exception as e:
                logger.warning(f"[VideoCall] Failed to send peer_joined to existing peer: {e}")

    def disconnect(self, websocket: WebSocket, session_id: str):
        """Ngắt kết nối và dọn dẹp phòng gọi khi peer rời đi."""
        canonical_session = self.resolve_session_id(session_id)
        if canonical_session in self.rooms:
            for role, data in list(self.rooms[canonical_session].items()):
                if data["ws"] == websocket:
                    logger.info(f"[VideoCall] Peer disconnected: role='{role}', canonical_room='{canonical_session}'")
                    del self.rooms[canonical_session][role]
                    break

            # Nếu phòng trống -> xóa phòng
            if not self.rooms[canonical_session]:
                del self.rooms[canonical_session]
            else:
                # Báo cho peer còn lại rằng đối phương đã ngắt kết nối
                for remaining_role, data in self.rooms[canonical_session].items():
                    try:
                        import asyncio
                        asyncio.create_task(data["ws"].send_text(json.dumps({
                            "type": "peer_disconnected",
                            "message": "Đối phương đã ngắt kết nối cuộc gọi.",
                        })))
                    except Exception:
                        pass

    async def forward_signaling_message(self, websocket: WebSocket, session_id: str, message_data: Dict[str, Any]):
        """Chuyển tiếp gói tin signaling (offer, answer, candidate, hangup, check_peer,...) tới peer đối diện."""
        canonical_session = self.resolve_session_id(session_id)
        if canonical_session not in self.rooms:
            return

        room = self.rooms[canonical_session]
        msg_type = message_data.get("type")

        # Ping / Keepalive
        if msg_type in ("check_peer", "ping"):
            try:
                await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
            return

        # Xác định role của bên gửi tin nhắn
        sender_role = None
        for r_name, r_data in room.items():
            if r_data["ws"] == websocket:
                sender_role = r_name
                break

        # De-anonymize mDNS (.local) ICE candidates CHỈ KHI người gửi là Robot Kiosk trên PC (role == 'guest')
        # Tuyệt đối không thay cho role == 'staff' (iPhone) để tránh iPhone tự xưng IP của PC
        if msg_type == "candidate" and "candidate" in message_data:
            cand_obj = message_data.get("candidate")
            if isinstance(cand_obj, dict) and "candidate" in cand_obj and sender_role == "guest":
                cand_str = cand_obj.get("candidate", "")
                if ".local" in cand_str:
                    lan_ip = get_lan_ip()
                    if lan_ip and lan_ip != "127.0.0.1":
                        import re
                        unmdns_str = re.sub(r'([a-zA-Z0-9_\-]+\.local)', lan_ip, cand_str)
                        if unmdns_str != cand_str:
                            logger.info(f"[VideoCall] Forwarding de-anonymized LAN candidate for Robot Kiosk: {lan_ip}")
                            # Forward candidate gốc trước
                            for role, data in room.items():
                                if data["ws"] != websocket:
                                    try:
                                        await data["ws"].send_text(json.dumps(message_data))
                                    except Exception as e:
                                        logger.warning(f"[VideoCall] Lỗi forward candidate gốc tới {role}: {e}")
                            # Forward thêm candidate đã de-anonymize sang IP LAN thực tế
                            alt_msg = dict(message_data)
                            alt_cand = dict(cand_obj)
                            alt_cand["candidate"] = unmdns_str
                            alt_msg["candidate"] = alt_cand
                            for role, data in room.items():
                                if data["ws"] != websocket:
                                    try:
                                        await data["ws"].send_text(json.dumps(alt_msg))
                                    except Exception as e:
                                        logger.warning(f"[VideoCall] Lỗi forward unmdns candidate tới {role}: {e}")
                            return

        for role, data in room.items():
            if data["ws"] != websocket:
                try:
                    await data["ws"].send_text(json.dumps(message_data))
                except Exception as e:
                    logger.warning(f"[VideoCall] Lỗi chuyển tiếp signaling tới {role} in '{canonical_session}': {e}")

    def get_room_state(self, session_id: str) -> Dict[str, Any]:
        """Lấy trạng thái hiện tại của phòng gọi."""
        canonical_session = self.resolve_session_id(session_id)
        if canonical_session not in self.rooms:
            return {"active": False, "canonical_room": canonical_session, "peers": []}
        return {
            "active": True,
            "canonical_room": canonical_session,
            "peers": [
                {"role": data["role"], "name": data["name"]}
                for data in self.rooms[canonical_session].values()
            ]
        }


video_call_manager = VideoCallManager()

