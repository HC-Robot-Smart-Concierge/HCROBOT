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
    speed: Optional[int] = None


@router.post("/robot/control", tags=[TAG_OPS], summary="Điều khiển di chuyển HCRobot (UDP Remote)")
async def control_robot_movement(cmd: RobotMoveCommand):
    """Gửi lệnh di chuyển qua UDP tới Raspberry Pi 5 tích hợp fail-safe siêu âm và PWM speed."""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.5)
        target_host = cmd.target_ip or "100.73.245.66"
        target_port = cmd.port or 9999

        raw_cmd = cmd.command.lower().strip()

        # Nếu truyền kèm tham số speed:
        if cmd.speed is not None:
            spd_val = max(20, min(100, int(cmd.speed)))
            sock.sendto(f"speed:{spd_val}".encode("utf-8"), (target_host, target_port))

        if raw_cmd.startswith("speed:") or raw_cmd.startswith("speed_"):
            sock.sendto(raw_cmd.encode("utf-8"), (target_host, target_port))
            sock.close()
            return {"status": "ok", "speed_set": raw_cmd, "target": f"{target_host}:{target_port}"}

        motion_map = {
            "forward": "w", "w": "w", "up": "w", "arrowup": "w",
            "backward": "s", "s": "s", "down": "s", "arrowdown": "s",
            "left": "a", "a": "a", "arrowleft": "a",
            "right": "d", "d": "d", "arrowright": "d",
            "forward_left": "wa", "wa": "wa", "aw": "wa", "up_left": "wa",
            "forward_right": "wd", "wd": "wd", "dw": "wd", "up_right": "wd",
            "backward_left": "sa", "sa": "sa", "as": "sa", "down_left": "sa",
            "backward_right": "sd", "sd": "sd", "ds": "sd", "down_right": "sd",
            "stop": "stop", "x": "stop", "space": "stop", "": "stop"
        }
        cmd_str = motion_map.get(raw_cmd, "stop")
        sock.sendto(cmd_str.encode('utf-8'), (target_host, target_port))
        sock.close()
        return {
            "status": "ok",
            "command_sent": cmd_str,
            "speed": cmd.speed,
            "target": f"{target_host}:{target_port}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể gửi lệnh di chuyển tới Pi 5: {e}")


