import socket
import json
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .shared import TAG_OPS

router = APIRouter()


class RobotMoveCommand(BaseModel):
    command: str
    target_ip: Optional[str] = "100.73.245.66"
    port: Optional[int] = 9999


@router.post("/robot/control", tags=[TAG_OPS], summary="Điều khiển di chuyển HCRobot (UDP Remote)")
async def control_robot_movement(cmd: RobotMoveCommand):
    """Gửi lệnh di chuyển qua UDP tới Raspberry Pi 5 tích hợp fail-safe siêu âm."""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.5)
        motion_map = {
            "forward": "w", "w": "w", "up": "w", "arrowup": "w",
            "backward": "s", "s": "s", "down": "s", "arrowdown": "s",
            "left": "a", "a": "a", "arrowleft": "a",
            "right": "d", "d": "d", "arrowright": "d",
            "stop": "stop", "x": "stop", "space": "stop", "": "stop"
        }
        cmd_str = motion_map.get(cmd.command.lower().strip(), "stop")
        target_host = cmd.target_ip or "100.73.245.66"
        target_port = cmd.port or 9999
        sock.sendto(cmd_str.encode('utf-8'), (target_host, target_port))
        sock.close()
        return {"status": "ok", "command_sent": cmd_str, "target": f"{target_host}:{target_port}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể gửi lệnh di chuyển tới Pi 5: {e}")


