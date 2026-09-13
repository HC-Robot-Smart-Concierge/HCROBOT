import asyncio
import logging
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket

logger = logging.getLogger("hcrobot.notification_manager")


class NotificationConnectionManager:
    """
    Quản lý kết nối WebSocket cho Trung tâm Thông báo Nghiệp vụ & Điều phối Phòng ban.
    Hỗ trợ lọc theo phòng ban (department) và broadcast real-time với độ trễ < 30ms.
    """

    def __init__(self):
        # Lưu kết nối theo department: {"Housekeeping": {ws1, ws2}, "All": {ws3}}
        self.department_connections: Dict[str, Set[WebSocket]] = {}
        self.all_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, department: str = "All"):
        """Chấp nhận kết nối và ghi nhận vào nhóm phòng ban tương ứng."""
        await websocket.accept()
        dept_key = department.strip() if department else "All"

        if dept_key not in self.department_connections:
            self.department_connections[dept_key] = set()

        self.department_connections[dept_key].add(websocket)
        self.all_connections.add(websocket)

        logger.info(
            f"🔌 [NotificationWS] Client connected. Dept: '{dept_key}'. Total active: {len(self.all_connections)}"
        )

        # Gửi thông điệp chào mừng kết nối thành công
        try:
            await websocket.send_json({
                "type": "CONNECTION_ESTABLISHED",
                "message": f"Connected to Realtime Notification Hub ({dept_key})",
                "department": dept_key,
            })
        except Exception as e:
            logger.warning(f"[NotificationWS] Error sending welcome msg: {e}")

    def disconnect(self, websocket: WebSocket, department: str = "All"):
        """Hủy kết nối và dọn dẹp bộ nhớ."""
        dept_key = department.strip() if department else "All"

        if dept_key in self.department_connections and websocket in self.department_connections[dept_key]:
            self.department_connections[dept_key].remove(websocket)
            if not self.department_connections[dept_key]:
                del self.department_connections[dept_key]

        if websocket in self.all_connections:
            self.all_connections.remove(websocket)

        logger.info(
            f"🔌 [NotificationWS] Client disconnected. Dept: '{dept_key}'. Total remaining: {len(self.all_connections)}"
        )

    async def broadcast_notification(
        self,
        notification_data: Dict[str, Any],
        department: Optional[str] = None
    ):
        """
        Phát sóng thông báo mới tới:
        1. Nhân viên thuộc phòng ban được chỉ định (`department`).
        2. Nhân viên Lễ tân (`Reception`), Quản trị (`admin`) hoặc người theo dõi toàn bộ (`All`).
        """
        payload = {
            "type": "NEW_NOTIFICATION",
            "data": notification_data,
        }
        await self.broadcast_to_department(department, payload)

    async def broadcast_to_department(
        self,
        target_department: Optional[str],
        payload: Dict[str, Any]
    ):
        """Phát sóng payload JSON tới các client phù hợp."""
        target_sockets: Set[WebSocket] = set()

        # 1. Các client kết nối dạng 'All' hoặc 'admin' luôn nhận được tất cả thông báo
        for super_dept in ["All", "all", "admin", "Admin"]:
            if super_dept in self.department_connections:
                target_sockets.update(self.department_connections[super_dept])

        # 2. Bộ phận Lễ tân (Reception) là trung tâm điều phối, nhận bản sao mọi thông báo
        for rec_dept in ["Reception", "reception"]:
            if rec_dept in self.department_connections:
                target_sockets.update(self.department_connections[rec_dept])

        # 3. Bộ phận đích cụ thể
        if target_department:
            for dept_key, ws_set in self.department_connections.items():
                if dept_key.lower() == target_department.lower():
                    target_sockets.update(ws_set)

        if not target_sockets:
            logger.debug(f"[NotificationWS] No active subscribers for department '{target_department}'")
            return

        dead_sockets = []
        send_coros = []
        target_list = list(target_sockets)

        for ws in target_list:
            send_coros.append(self._safe_send(ws, payload))

        results = await asyncio.gather(*send_coros, return_exceptions=True)

        for ws, res in zip(target_list, results):
            if isinstance(res, Exception):
                dead_sockets.append(ws)

        # Dọn dẹp các socket đã ngắt kết nối âm thầm
        for dead in dead_sockets:
            self._remove_dead_socket(dead)

    async def _safe_send(self, ws: WebSocket, payload: Dict[str, Any]):
        """Gửi dữ liệu qua WebSocket an toàn."""
        await ws.send_json(payload)

    def _remove_dead_socket(self, ws: WebSocket):
        """Xóa socket chết khỏi mọi nhóm."""
        if ws in self.all_connections:
            self.all_connections.remove(ws)
        for dept_key in list(self.department_connections.keys()):
            if ws in self.department_connections[dept_key]:
                self.department_connections[dept_key].remove(ws)
                if not self.department_connections[dept_key]:
                    del self.department_connections[dept_key]


# Singleton instance toàn hệ thống
notification_manager = NotificationConnectionManager()
