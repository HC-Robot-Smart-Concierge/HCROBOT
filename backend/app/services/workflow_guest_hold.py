"""Shared state of a parallel run: vehicle phase, guest reports and the robot-screen status."""

TERMINAL_EVENTS = {"COMPLETED", "FAILED", "CANCELLED"}
MOVING_EVENTS = {"STARTED", "STEP_STARTED", "STEP_COMPLETED", "ROUND_COMPLETED", "GUEST_RESUME"}


def new_guest_state():
    return {"hold_until": None, "done": False, "request_seq": 0}


def run_phase(previous, event_type):
    """Phase after one executor event. Only GUEST_RESUME or a terminal event ends a hold."""
    if event_type in TERMINAL_EVENTS:
        return "DONE"
    if previous == "DONE":
        return previous
    if event_type == "GUEST_HOLD":
        return "GUEST_HOLD"
    if previous == "GUEST_HOLD" and event_type != "GUEST_RESUME":
        return previous
    return "MOVING" if event_type in MOVING_EVENTS else (previous or "MOVING")


def apply_guest_report(guest, phase, state, idle_ms, no_interaction_sec, now):
    """Update the guest state in place. Returns False for a report that no longer applies."""
    if state == "REQUEST":
        if phase == "MOVING":
            guest["request_seq"] += 1
            guest["done"] = False
        elif phase != "GUEST_HOLD" or guest["done"]:
            return False
        guest["hold_until"] = now + no_interaction_sec
        return True
    if phase != "GUEST_HOLD" or guest["done"]:
        return False
    if state == "DONE":
        guest.update(hold_until=None, done=True)
    else:
        guest["hold_until"] = now - idle_ms / 1000 + no_interaction_sec
    return True


def clear_guest_hold(guest):
    """The executor resumed: late reports must not affect the next hold (request_seq is kept)."""
    guest.update(hold_until=None, done=False)


def guest_control_fields(guest):
    return {"guest_hold_until": guest["hold_until"], "guest_done": guest["done"],
            "guest_request_seq": guest["request_seq"]}


def status_payload(run, item):
    parallel = item["parallel"]
    lanes = item.get("lanes") or {}
    return {
        "type": "ROBOT_RUN_STATUS", "robot_id": run.robot_id, "run_id": run.id,
        "workflow_id": run.workflow_id, "workflow_name": run.name, "status": run.status,
        "phase": item.get("phase") or "MOVING", "step_title": item.get("step_title"),
        "step_index": run.current_step_index, "total_steps": run.total_steps,
        "parallel": True, "no_interaction_sec": parallel.get("no_interaction_sec", 20),
        "screen_steps": lanes.get("screen") or [], "guest_steps": lanes.get("guest") or [],
    }
