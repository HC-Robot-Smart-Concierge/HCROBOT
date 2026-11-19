"""What the robot screen is told about a real-robot run (ROBOT_RUN_STATUS over /ws/notifications)."""

TERMINAL_EVENTS = {"COMPLETED", "FAILED", "CANCELLED"}
PHASE_BY_EVENT = {
    "STARTED": "MOVING", "STEP_STARTED": "MOVING", "STEP_COMPLETED": "MOVING",
    "ROUND_COMPLETED": "MOVING", "STEP_FAILED_HANDLED": "MOVING", "GUEST_RESUME": "MOVING",
    "STEP_RETRY": "RETRYING", "GUEST_HOLD": "GUEST_HOLD", "EVENT_TRIGGERED": "CHARGING",
}


def run_phase(previous, event_type):
    """Phase after one executor event. Once the low-battery branch starts, the run stays CHARGING."""
    if event_type in TERMINAL_EVENTS:
        return "DONE"
    if previous in ("CHARGING", "DONE"):
        return previous
    return PHASE_BY_EVENT.get(event_type, previous or "MOVING")


def guest_branch_of(config):
    return next((b for b in (config or {}).get("event_branches") or [] if b.get("event") == "GUEST_DETECTED"), None)


def status_payload(run, item):
    guest = item.get("guest_branch")
    return {
        "type": "ROBOT_RUN_STATUS", "robot_id": run.robot_id, "run_id": run.id,
        "workflow_name": run.name, "status": run.status, "phase": item.get("phase") or "MOVING",
        "step_title": item.get("step_title"), "step_index": run.current_step_index,
        "total_steps": run.total_steps, "guest_mode": bool(guest),
        "guest_idle_timeout_sec": (guest or {}).get("idle_timeout_sec", 20),
    }
