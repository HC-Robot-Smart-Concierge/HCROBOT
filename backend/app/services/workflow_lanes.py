"""Split a parallel workflow into the vehicle lane, the screen lane and the guest branch.

Links follow the same rules as frontend/src/utils/workflowFlow.js. Each lane is returned
with explicit links, because taking a subset of the flat list changes what "next" means.
"""
from copy import deepcopy

END = "END"
ROBOT_TYPES = {"MOVE", "FOLLOW_ROUTE", "WAIT"}
SCREEN_TYPES = {"SHOW", "SPEAK", "WAIT"}
GUEST_TYPES = {"GREET", "SPEAK", "COMMUNICATE", "LISTEN", "CHOICE", "SHOW",
               "RECOMMEND", "CREATE_REQUEST", "FEEDBACK", "WAIT"}
LANE_NAMES = {"robot": "Làn Xe", "screen": "Làn Màn hình", "guest": "Nhánh gặp khách"}
LANE_TYPES = {"robot": ROBOT_TYPES, "screen": SCREEN_TYPES, "guest": GUEST_TYPES}


def _resolve(steps, index, target):
    if target in (None, ""):
        return steps[index + 1]["step_id"] if index + 1 < len(steps) else END
    return target


def _choice_options(step):
    options = (step.get("params") or {}).get("options")
    if not isinstance(options, list):
        return []
    return [o for o in options if isinstance(o, dict) and (o.get("id") or o.get("label"))]


def _explicit(steps, index):
    """A copy of one step whose outgoing links no longer depend on list order."""
    step = deepcopy(steps[index])
    params = step.setdefault("params", {})
    if step.get("type") != "CHOICE":
        params["next_step_id"] = _resolve(steps, index, params.get("next_step_id"))
        return step
    for option in _choice_options(step):
        option["next_step_id"] = _resolve(steps, index, option.get("next_step_id"))
    cancel = params.get("cancel_next_step_id")
    params["cancel_next_step_id"] = _resolve(steps, index, END if cancel is None else cancel)
    timeout = params.get("timeout_next_step_id")
    params["timeout_next_step_id"] = (params["cancel_next_step_id"] if timeout is None
                                      else _resolve(steps, index, timeout))
    return step


def _targets(step):
    params = step.get("params") or {}
    if step.get("type") != "CHOICE":
        return [params.get("next_step_id")]
    return [*(o.get("next_step_id") for o in _choice_options(step)),
            params.get("timeout_next_step_id"), params.get("cancel_next_step_id")]


def _reach(steps, entry):
    """Explicit copies of every step reachable from entry, entry first."""
    index_of = {step.get("step_id"): i for i, step in enumerate(steps)}
    if entry not in index_of:
        raise ValueError("Bước bắt đầu của làn song song không tồn tại.")
    queue, seen, lane = [entry], {entry}, []
    while queue:
        step = _explicit(steps, index_of[queue.pop(0)])
        lane.append(step)
        for target in _targets(step):
            if target == END:
                continue
            if target not in index_of:
                raise ValueError("Bước tiếp theo không tồn tại.")
            if target not in seen:
                seen.add(target)
                queue.append(target)
    return lane


def split_lanes(steps, parallel, strict=True):
    """strict=False is for saving a draft: missing entries and unwired steps are allowed."""
    if not steps:
        return {"robot": [], "screen": [], "guest": []}
    if strict and not parallel.screen_step_id:
        raise ValueError("Làn Màn hình chưa có bước nào. Nối node Làn Màn hình tới bước phát quảng cáo.")
    if strict and not parallel.guest_step_id:
        raise ValueError("Nhánh gặp khách chưa có bước nào. Nối node Khi gặp khách tới bước nói chuyện.")
    lanes = {
        "robot": _reach(steps, steps[0].get("step_id")),
        "screen": _reach(steps, parallel.screen_step_id) if parallel.screen_step_id else [],
        "guest": _reach(steps, parallel.guest_step_id) if parallel.guest_step_id else [],
    }
    owner = {}
    for name, lane in lanes.items():
        for step in lane:
            if step["step_id"] in owner:
                raise ValueError(f"Bước \"{step.get('title')}\" đang nằm trong cả "
                                 f"{LANE_NAMES[owner[step['step_id']]]} và {LANE_NAMES[name]}.")
            owner[step["step_id"]] = name
            if step.get("type") not in LANE_TYPES[name]:
                raise ValueError(f"{LANE_NAMES[name]} không chạy được bước {step.get('type')}.")
    if strict:
        unwired = [s.get("title") or s.get("step_id") for s in steps if s.get("step_id") not in owner]
        if unwired:
            raise ValueError(f"Bước chưa nối vào làn nào: {', '.join(unwired)}.")
        if not any(s.get("type") == "FOLLOW_ROUTE" for s in lanes["robot"]):
            raise ValueError("Làn Xe cần ít nhất một bước Đi theo tuyến.")
    return lanes
