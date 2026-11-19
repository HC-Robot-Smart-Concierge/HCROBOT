# Robot Workflow Error Handling, Low-Battery Branch and n8n-style Canvas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real-robot workflows recover from transient navigation errors per step (retry / continue / error branch), drive to the map's charger when the simulated Pi battery drops below a threshold, and are edited on a React Flow canvas.

**Architecture:** Workflows stay a flat `steps` list with `next_step_id` links. New data lives in `params.on_error`, `params.ui_position` and `execution_config.event_branches`. The backend validates/expands the plan and feeds the Pi battery % into the existing per-run control file; the ROS executor applies error policies and the low-battery branch. The frontend gets a battery slider (writes the Pi estimate) and a canvas editor whose steps⇄graph conversion lives in a pure module.

**Tech Stack:** Python 3 / FastAPI / Pydantic / SQLAlchemy async / httpx (backend), rclpy + Nav2 actions (executor), React 18 + Vite + Tailwind + vitest, `@xyflow/react` 12.

**Spec:** `docs/superpowers/specs/2026-11-18-robot-workflow-error-battery-canvas-design.md`

## Global Constraints

- `on_error`: `retry_count` int 0–5 (default 0), `retry_wait_sec` int 1–60 (default 5), `action` ∈ `STOP | CONTINUE | ERROR_BRANCH` (default `STOP`), `next_step_id` required for `ERROR_BRANCH` (a step id or `"END"`). Missing `on_error` ≡ defaults ≡ today's behavior.
- `event_branches`: at most one `{event: "LOW_BATTERY", threshold_percent: 5–90 (default 20), next_step_id, ui_position?}`. Triggers when `battery_percent < threshold_percent` and `battery_at` is ≤ 10 s old; at most once per run; then the run ends after the branch reaches `END`.
- Low-battery completion message (exact): `Dừng tuyến do pin yếu ({percent}%) — đã về trạm sạc.` with `percent` rounded to an integer.
- Charger lookup: endpoint (`RobotWaypoint`) on the run's `map_id` whose `type` lower-cased ∈ `{"charger", "dock"}`; endpoint `yaw` is radians, use as-is. None found → `ValueError("Map chưa có điểm Trạm sạc.")`.
- Safety errors (cancel, lease/control channel, backend `stop_reason`, Pi/LiDAR/health/encoder readiness, map mismatch, foreign Nav2 goal) always stop the run — never retried or branched.
- Backend reads `GET http://{PI5_IP env, default 100.99.72.51}:8000/api/v1/system/power` every 2 s with a 2 s timeout, only while a running run's plan has `event_branches`.
- Slider writes `POST /api/v1/operations/robot/pi5/system/battery/sync` with body `{percent, minutes_per_percent}` where `minutes_per_percent` is the value last read from Pi (never omit it — the Pi re-calibrates otherwise). Reads `GET /api/v1/operations/robot/pi5/system/power` every 5 s. Sends on pointer/key release only.
- Kiosk code (`useWorkflowRunner`, `utils/workflowFlow.js`) is unchanged; saving from the canvas must not change how an existing workflow runs on the kiosk or the robot.
- User wants minimal tests: test only the listed core logic; no UI snapshot tests.
- **Do not commit** (user rule): skip every "Commit" step; leave changes in the working tree for the user.
- **No file may exceed 500 lines** (user rule) — every file created or modified, tests included. Check with `wc -l` before each commit. `AdminWorkflowTab.jsx` is already 560 lines and must end ≤ 500 (Task 9).

## Review Focus

1. Re-opening and saving a legacy workflow (empty `next_step_id`, CHOICE options with empty targets, `cancel_next_step_id` absent vs `''`) must produce identical transitions — pinned in Task 7 (`legacy flow is preserved`).
2. Battery % unknown (Pi offline → `battery_percent: null`) or stale must never trigger the branch nor fail the run — pinned in Task 1 and Task 3.
3. Low battery during the retry wait of a failed step must still win (branch, not retry) — pinned in Task 3.
4. A FOLLOW_ROUTE that fails mid-route retries from the first unfinished point, not from point 0 — pinned in Task 2.
5. Deleting a node that other links point to must not leave dangling ids (kiosk would end the session silently) — pinned in Task 7.

---

## Part 1 — Core (robot executor, backend, slider)

### Task 1: Pure policy helpers in the navigation logic module

The executor test fixture only compiles **classes** from `workflow_executor.py`; module-level helpers must live in `workflow_navigation_logic.py` and be injected into the fixture `env`.

**Files:**
- Modify: `robot/ros2_configs/workflow_navigation_logic.py`
- Test: `robot/tests/test_workflow_policy.py` (new)

**Interfaces:**
- Produces:
  - `step_error_policy(params: dict) -> dict` → `{'retry_count': int, 'retry_wait_sec': int, 'action': str, 'next_step_id': str|None}` with defaults filled.
  - `low_battery_branch(config: dict) -> dict|None` → the `LOW_BATTERY` entry of `config.get('event_branches') or []`, else `None`.
  - `low_battery_percent(control: dict, branch: dict|None, now: float) -> float|None` → the percent when the branch must trigger, else `None` (branch None, percent None/non-finite, `battery_at` missing or `now - battery_at > 10`, or percent ≥ threshold).
  - `readiness_issue(localization, loc_at, health, health_at, map_id, now) -> tuple[str, str]|None` → `('NAVIGATION'|'SAFETY', message)`. Localization reasons (`Không có trạng thái định vị mới.`, `localization.get('reason') or 'Robot chưa định vị hoặc đã mất định vị.'`) are `NAVIGATION`; map mismatch, health, Pi/LiDAR, encoder are `SAFETY`. `readiness_reason(...)` keeps its signature and returns `readiness_issue(...)[1]` or `None`.

- [ ] **Step 1: Write failing tests** in `robot/tests/test_workflow_policy.py`:
  - `test_default_error_policy_is_stop_without_retry`: `step_error_policy({}) == {'retry_count': 0, 'retry_wait_sec': 5, 'action': 'STOP', 'next_step_id': None}`.
  - `test_error_policy_reads_values`: `step_error_policy({'on_error': {'retry_count': 2, 'retry_wait_sec': 3, 'action': 'ERROR_BRANCH', 'next_step_id': 'x'}})` returns those values.
  - `test_low_battery_triggers_only_below_threshold_with_fresh_reading`: branch `{'event': 'LOW_BATTERY', 'threshold_percent': 20, 'next_step_id': 'c'}`; `(19.5, at=100, now=105) → 19.5`; `20 → None`; `at=90, now=105 → None`; `None → None`; `float('nan') → None`; branch `None → None`.
  - `test_readiness_issue_classifies_localization_as_navigation_and_encoder_as_safety`: stale localization → kind `'NAVIGATION'`; wrong map → `'SAFETY'`; encoder fault → `'SAFETY'`; healthy → `None`; `readiness_reason` still returns the same strings as before.
- [ ] **Step 2: Run** `cd robot && python -m pytest tests/test_workflow_policy.py -q` → FAIL (ImportError).
- [ ] **Step 3: Implement** the four functions in `workflow_navigation_logic.py` (refactor `readiness_reason` body into `readiness_issue`).
- [ ] **Step 4: Run** `python -m pytest tests/test_workflow_policy.py tests/test_workflow_executor.py -q` → all PASS.
- [ ] **Step 5: Commit** `feat(robot): workflow error-policy and low-battery helpers`.

### Task 2: Executor error classification, retry, continue and error branch

`workflow_executor.py` is 402 lines, so the new logic goes into a mixin file to keep both ≤ 500.

**Files:**
- Create: `robot/ros2_configs/workflow_flow.py` — exceptions + `class FlowPolicyMixin` (`_run_flow`, `_run_step_with_policy`). Imports only stdlib and `workflow_navigation_logic`.
- Modify: `robot/ros2_configs/workflow_executor.py` (`class Executor(FlowPolicyMixin, Node)`; reclassified raises in `check_control`, `spin_checked`, `future_result`, `move`, `follow_route`; `execute` calls `_run_flow`)
- Create: `robot/tests/conftest.py` — move the `worker` fixture, `Future` and `route_steps()` out of `test_workflow_executor.py`; fixture `env` gains `FlowPolicyMixin`, `SafetyStop`, `NavigationError`, `LowBattery` (imported from `workflow_flow`) and `step_error_policy`, `low_battery_branch`, `low_battery_percent`, `readiness_issue`; worker exposes `worker.nav_error`, `worker.safety_error`.
- Modify: `robot/tests/test_workflow_executor.py` (fixture removed, imports `route_steps` from conftest helpers)
- Create: `robot/tests/test_workflow_executor_policy.py` (new tests of Tasks 2 and 3)

**Interfaces:**
- Consumes: Task 1 helpers.
- Produces (in `workflow_flow.py`): `class SafetyStop(RuntimeError)`, `class NavigationError(RuntimeError)`, `class LowBattery(Exception)` with `.percent: float`; `class FlowPolicyMixin` expecting the host to provide `move`, `follow_route`, `wait`, `emit`, `stop_owned_goal`, `index`, `goal`, `goal_future`. Events: `STEP_RETRY` (message `"Thử lại {n}/{max}: {reason}"`), `STEP_FAILED_HANDLED` (message `"{action}: {reason}"`).
- Method `FlowPolicyMixin._run_flow(steps, ids) -> None`: runs from `self.index` until `END`/end of list, applying policies. Used by `execute()` for each round (and by Task 3 for the battery branch).

Classification: `check_control` lease/control/`stop_reason` errors → `SafetyStop` (keep messages; existing tests match on them). `spin_checked` raises `SafetyStop` or `NavigationError` from `readiness_issue`. `move`/`follow_route`: Nav2 reject, non-SUCCEEDED result, timeout (`future_result` and route deadline), stale costmap, disallowed goal cell, route points too close → `NavigationError`; "Nav2 đang có goal khác" → `SafetyStop`. `_wait_navigation_ready` stays a plain `RuntimeError` (fails before `STARTED`).

Policy algorithm inside `_run_flow`, per step (MOVE single, MOVE route segment, WAIT):
```
attempt = 0
loop:
  try: run once (route: follow_route(steps[self.index:end]) — self.index already
       points at the first unfinished point after a failure); break
  except NavigationError as exc:
       self.goal = self.goal_future = None
       if attempt < policy.retry_count: attempt += 1; emit STEP_RETRY; self.wait(policy.retry_wait_sec); continue
       if action == STOP: raise
       if action == CONTINUE:
           route and self.index + 1 < end → emit STEP_FAILED_HANDLED; self.index += 1; attempt = 0; continue loop
           else → emit STEP_FAILED_HANDLED; go to the step's normal next (next_step_id rules)
       if action == ERROR_BRANCH: self.stop_owned_goal(); emit STEP_FAILED_HANDLED;
           self.index = len(steps) if target == 'END' else ids[target]; skip STEP_COMPLETED
```
For a route, the policy is read from the step at the segment start (all expanded points carry the same `on_error`, Task 4). WAIT steps never raise `NavigationError`.

- [ ] **Step 0: Move the fixture** to `robot/tests/conftest.py`; run `cd robot && python -m pytest tests/test_workflow_executor.py -q` → all existing tests still PASS.
- [ ] **Step 1: Write failing tests** in `test_workflow_executor_policy.py` (use `worker.move = Mock(side_effect=[NavigationError('x'), None])` style; `NavigationError` from `env`, exposed as `worker.nav_error = env['NavigationError']` in the fixture, likewise `worker.safety_error`):
  - `test_move_retries_then_succeeds_and_emits_retry`: `on_error={'retry_count': 2, 'retry_wait_sec': 3}`, move fails once → `move.call_count == 2`, `wait` called with `3`, `'STEP_RETRY'` emitted, ends `COMPLETED`.
  - `test_move_exhausted_retries_with_stop_fails_run`: retry 1, always fails → raises `NavigationError`, `move.call_count == 2`, no `COMPLETED`.
  - `test_continue_skips_failed_move_to_next_step`: steps `a`(MOVE, CONTINUE), `b`(WAIT) → `b` runs, `STEP_FAILED_HANDLED` emitted, `COMPLETED`.
  - `test_error_branch_jumps_to_target_and_cancels_goal`: steps `a`(MOVE, ERROR_BRANCH→`c`, next `b`), `b`(WAIT 2), `c`(WAIT 9) → `wait` called with `9` only, `stop_owned_goal` called.
  - `test_safety_error_is_never_retried`: move raises `SafetyStop('ENCODER')` with retry 3 → raises, `move.call_count == 1`.
  - `test_route_retry_resumes_from_first_unfinished_point`: `route_steps()` with `on_error` retry 1 on all; `worker.follow_route = Mock(side_effect=fail_after_advancing)` where the first call sets `worker.index = 1` then raises `NavigationError`; second call succeeds → second call's argument is `steps[1:3]`.
  - `test_route_continue_skips_only_the_failed_point`: same, CONTINUE, first call fails at `index = 1` → second call argument `steps[2:3]`.
- [ ] **Step 2: Run** `cd robot && python -m pytest tests/test_workflow_executor.py -q` → new tests FAIL.
- [ ] **Step 3: Implement** the exception classes, reclassification and `_run_flow`; `execute()` keeps its round loop and calls `_run_flow` per round.
- [ ] **Step 4: Run** `python -m pytest tests -q -k "workflow"` → all PASS (old tests included).
- [ ] **Step 5: Commit** `feat(robot): per-step retry/continue/error-branch for real-robot workflows`.

### Task 3: Executor low-battery branch

**Files:**
- Modify: `robot/ros2_configs/workflow_executor.py` (`__init__`: `self.battery_branch = low_battery_branch(plan['config'])`, `self.battery_triggered = False`; `check_control`; `execute`)
- Modify: `robot/ros2_configs/workflow_flow.py` (put the `LowBattery` handling of `execute` in a mixin method `_run_battery_branch(steps, ids, percent)` if `workflow_executor.py` would pass 500 lines)
- Modify: `robot/tests/conftest.py` (fixture sets `worker.battery_branch = None`, `worker.battery_triggered = False`)
- Test: `robot/tests/test_workflow_executor_policy.py`

**Interfaces:**
- Consumes: Task 1 `low_battery_branch`, `low_battery_percent`; Task 2 `LowBattery`, `_run_flow`.
- Produces: events `EVENT_TRIGGERED` (message `"Pin {p}% < {threshold}%"`) and final `COMPLETED` with the exact low-battery message (Global Constraints). Control-file fields read: `battery_percent`, `battery_at`.

`check_control`: after cancel/lease checks, if `not self.battery_triggered` and `low_battery_percent(control, self.battery_branch, time.time())` is not `None` → set `self.battery_triggered = True`, raise `LowBattery(percent)`. `execute`: wrap the round loop; on `LowBattery`: `stop_owned_goal()`, `self.goal = self.goal_future = None`, emit `EVENT_TRIGGERED`, set `self.index` from the branch target (`END` → emit COMPLETED immediately), `_run_flow(steps, ids)`, emit `COMPLETED` with the message, return (no further rounds). `LowBattery` raised inside `self.wait()` during a retry wait propagates (it is not a `NavigationError`).

- [ ] **Step 1: Write failing tests:**
  - `test_low_battery_mid_route_cancels_goal_runs_branch_and_ends_run`: plan `config` has `event_branches=[{'event': 'LOW_BATTERY', 'threshold_percent': 20, 'next_step_id': 'charger'}]`, `repeat_count: 3`; steps `patrol`(MOVE, next `END`), `charger`(MOVE, next `END`). `worker.move` side effect: on the first `patrol` call write control `{'cancel': False, 'expires_at': 200, 'battery_percent': 15, 'battery_at': worker.clock.value}` and call `worker.check_control()`. Assert: `stop_owned_goal` called, `move` called next with `charger` params, final emit `('COMPLETED', 'Dừng tuyến do pin yếu (15%) — đã về trạm sạc.')`, `patrol` never runs a second round.
  - `test_low_battery_triggers_once`: after triggering, a later `check_control()` with the same low reading does not raise.
  - `test_unknown_battery_never_triggers`: control with `battery_percent: None` → `check_control()` does not raise.
  - `test_low_battery_during_retry_wait_wins_over_retry`: patrol move fails with `NavigationError` (retry 2, wait 5); the fake `wait` writes the low reading and calls `check_control()` → branch runs, move not retried.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `python -m pytest tests -q -k workflow` → PASS.
- [ ] **Step 5: Commit** `feat(robot): low-battery event branch drives to charger and ends the run`.

### Task 4: Backend schema, plan validation, charger resolution, route `on_error` copy

**Files:**
- Modify: `backend/app/schemas/workflow.py` (`WorkflowEventBranch`, `WorkflowExecutionConfig.event_branches`)
- Modify: `backend/app/services/workflow_routes.py` (copy `on_error` into every expanded MOVE)
- Modify: `backend/app/services/workflow_plan.py`
- Test: `backend/tests/test_workflow_routes.py`, `backend/tests/test_workflow_runtime.py`

**Interfaces:**
- Produces: `class WorkflowEventBranch(BaseModel)`: `event: Literal["LOW_BATTERY"]`, `threshold_percent: int = Field(20, ge=5, le=90, strict=True)`, `next_step_id: str = Field(min_length=1)`, `ui_position: Optional[Dict[str, float]] = None`. `WorkflowExecutionConfig.event_branches: List[WorkflowEventBranch] = Field(default_factory=list, max_length=1)`. `physical_plan` output unchanged in shape; `plan['config']['event_branches']` present via `model_dump()`.

`physical_plan` additions (after `resolve_route_steps`): validate each MOVE's `on_error` against Global Constraints (`ValueError("Cài đặt khi lỗi của bước {title} không hợp lệ.")`); `ERROR_BRANCH` target and each event branch target must be in ids or `END` (`ValueError("Nhánh trỏ tới bước không tồn tại.")`); MOVE with `params.target_type == "CHARGER"` and no `target_x` is filled after the map is known (map = the single `map_id` of the other MOVEs) from `MapRepository(repo.db).list_waypoints(map_id)` → sets `map_id, frame_id='map', target_x, target_y, target_yaw, waypoint_name`. A plan whose only MOVEs are charger MOVEs → `ValueError("Một lượt chạy xe thật cần các điểm đến trên cùng một map.")` (existing message). Only call the repository when a charger MOVE exists (existing tests pass `SimpleNamespace()`).

- [ ] **Step 1: Write failing tests:**
  - routes: `test_route_on_error_is_copied_to_every_expanded_point` — FOLLOW_ROUTE with `on_error={'retry_count': 1, 'action': 'CONTINUE'}`, 3-point route, repeat 2 → all 6 MOVEs carry an equal `on_error` dict.
  - runtime: `test_charger_step_resolved_from_map_endpoint` — workflow with MOVE `a` (map `room`) + MOVE `go` `{'target_type': 'CHARGER'}`; repo stub whose `db` makes `MapRepository.list_waypoints` return `[NS(type='CHARGER', x=3.0, y=4.0, yaw=1.57, name='Trạm sạc', map_id='room')]` (monkeypatch `MapRepository.list_waypoints`) → step `go` has `target_x == 3.0`, `target_yaw == 1.57`, `map_id == 'room'`.
  - runtime: `test_missing_charger_rejected` → `ValueError` match `Trạm sạc`.
  - runtime: parametrize `test_bad_error_policy_rejected` over `{'retry_count': 6}`, `{'retry_wait_sec': 0}`, `{'action': 'X'}`, `{'action': 'ERROR_BRANCH'}` (no target), `{'action': 'ERROR_BRANCH', 'next_step_id': 'missing'}`.
  - runtime: `test_event_branch_validated` — threshold 4 rejected by schema; target `missing` rejected by `physical_plan`; two branches rejected by schema.
- [ ] **Step 2: Run** `cd backend && python -m pytest tests/test_workflow_routes.py tests/test_workflow_runtime.py -q` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same command → PASS.
- [ ] **Step 5: Commit** `feat(backend): validate workflow error policies, low-battery branch and charger target`.

### Task 5: Backend battery feed into the control file and completion note

**Files:**
- Modify: `backend/app/services/workflow_runtime.py`
- Test: `backend/tests/test_workflow_runtime.py`

**Interfaces:**
- Consumes: plan `config.event_branches` (Task 4).
- Produces: `WorkflowRuntime.battery = {'percent': float|None, 'at': float|None}`; `async def read_pi_battery(self) -> float|None` (httpx GET per Global Constraints; returns `battery.percent` when `battery.available`, else `None`; any exception → `None`); `async def battery_loop(self)` (every 2 s; only when some `self.running` item has `needs_battery=True`; on a reading sets `self.battery = {'percent': p, 'at': time.time()}`; on `None` keeps the old value). `launch()` stores `needs_battery=bool(run.payload['config'].get('event_branches'))` in the item. `refresh_control` adds `'battery_percent': self.battery['percent'], 'battery_at': self.battery['at']`. `start()`/`close()` manage the third task. `monitor()`: when the terminal event is `COMPLETED` and has a message, store it in `run.error` via `finish(run_id, 'COMPLETED', message)`.

- [ ] **Step 1: Write failing tests:**
  - `test_control_file_carries_latest_battery_reading` — set `runtime.battery = {'percent': 15.0, 'at': 123.0}`, `refresh_control(supervised_item(runtime))` → file JSON has `battery_percent == 15.0`, `battery_at == 123.0`.
  - `test_battery_loop_polls_only_for_runs_with_event_branches` — monkeypatch `read_pi_battery` (AsyncMock → 42.0) and `asyncio.sleep` to stop after one iteration; with no `needs_battery` item → not awaited; with one → `runtime.battery['percent'] == 42.0`.
  - `test_failed_battery_read_keeps_previous_value` — `read_pi_battery` → `None` keeps `{'percent': 30.0, 'at': 1.0}`.
  - `test_completed_with_message_keeps_low_battery_note` — extend the existing events test pattern: worker events end with `{'type': 'COMPLETED', 'message': 'Dừng tuyến do pin yếu (15%) — đã về trạm sạc.'}` → run `status == 'COMPLETED'` and `error` equals that message.
- [ ] **Step 2: Run** `python -m pytest tests/test_workflow_runtime.py -q` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(backend): feed simulated Pi battery to workflow runs`.

### Task 6: Battery simulator slider and run-log labels

**Files:**
- Create: `frontend/src/services/robotBatteryApi.js`
- Create: `frontend/src/components/robot/RobotBatterySimulator.jsx`
- Modify: `frontend/src/pages/admin/tabs/PhysicalMapWorkflowRunControls.jsx` (render slider under the start button)
- Modify: `frontend/src/pages/admin/tabs/AdminWorkflowTab.jsx` (render slider next to `WorkflowRunsPanel`)
- Modify: `frontend/src/pages/admin/tabs/workflow/WorkflowRunsPanel.jsx` (event labels)
- Test: `frontend/src/services/__tests__/robotBatteryApi.test.js`

**Interfaces:**
- Produces: `fetchPiBattery(signal?) -> Promise<{available: boolean, percent: number|null, minutes_per_percent: number|null}>`; `syncPiBattery(percent: number, minutesPerPercent: number) -> Promise<battery>` (throws `Error(message)` when `status !== 'SUCCESS'`); `<RobotBatterySimulator threshold={20} />`.
- UI: label `Pin giả lập (ghi vào Pi 5)`, current `%`, range 0–100 step 1, a marker at `threshold`, disabled with text `Pi 5 chưa kết nối` when unavailable. Commit on `onPointerUp`/`onKeyUp` only.
- Run-log labels: `STEP_RETRY` → `Thử lại`, `STEP_FAILED_HANDLED` → `Bỏ qua lỗi`, `EVENT_TRIGGERED` → `Pin yếu`; a COMPLETED run with `error` shows it in amber, not rose.

- [ ] **Step 1: Write failing tests** (mock `global.fetch`): `syncPiBattery(15, 5)` POSTs to `/api/v1/operations/robot/pi5/system/battery/sync` with body `{"percent":15,"minutes_per_percent":5}`; `fetchPiBattery()` maps `{battery: {available: true, percent: 63.2, minutes_per_percent: 5}}`; offline payload `{battery: null}` → `{available: false, percent: null, minutes_per_percent: null}`.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/services/__tests__/robotBatteryApi.test.js` → FAIL.
- [ ] **Step 3: Implement** API, component, mounts, labels.
- [ ] **Step 4: Run** the test → PASS; `npx vite build` → succeeds.
- [ ] **Step 5: Commit** `feat(frontend): simulated Pi battery slider and run-log labels`.

## Part 2 — n8n-style canvas

### Task 7: Pure steps ⇄ graph module

**Files:**
- Create: `frontend/src/utils/workflowGraph.js`
- Test: `frontend/src/utils/__tests__/workflowGraph.test.js`
- Modify: `frontend/package.json` (add `@xyflow/react` 12.x — exact latest 12 version published ≥ 2 weeks ago; install with `npm install @xyflow/react@<version>`)

**Interfaces:**
- Consumes: `resolveNextStepIndex`, `getChoiceOptions`, `FLOW_END`, `OUTCOME` from `utils/workflowFlow.js`.
- Produces:
  - Node ids: `'__start'`, `'__end'`, `'__battery'`, and each `step_id`. Handle ids (source): `'ok'`, `'err'`, `'opt:<optionId>'`, `'timeout'`, `'cancel'`; battery node source `'ok'`.
  - `workflowToGraph(workflow) -> {nodes, edges}`: node `{id, type: 'start'|'end'|'battery'|'step', position, data: {step?, index?, threshold?}}`. Every outgoing link is computed with `resolveNextStepIndex` (DONE / CHOSEN optionId / TIMEOUT / CANCEL) so implicit links become explicit edges; `-1` → `'__end'`. `err` edge only when `on_error.action === 'ERROR_BRANCH'`. Battery node + edge only when `execution_config.event_branches[0]` exists. Positions from `params.ui_position` / branch `ui_position`, else `autoLayout`.
  - `autoLayout(steps) -> Record<id, {x, y}>`: column = BFS depth from start over all edges (spacing 260 px), row = order within column (spacing 140 px); start at (0, 0); battery node in row below the deepest row.
  - `connect(workflow, {source, sourceHandle, target}) -> workflow`: writes the link field for the handle (`next_step_id` / option `next_step_id` / `timeout_next_step_id` / `cancel_next_step_id` / `on_error.next_step_id` / `event_branches[0].next_step_id`); `target '__end'` → `'END'`; source `'__start'` → move target step to index 0 after `explicitLinks`.
  - `disconnect(workflow, {source, sourceHandle}) -> workflow`: link → `'END'`; for `err` → `on_error.action = 'STOP'`, `next_step_id` removed.
  - `removeStep(workflow, stepId) -> workflow`: removes the step, every link pointing to it becomes `'END'`, an event branch pointing to it is removed.
  - `explicitLinks(workflow) -> workflow`: rewrites every link to its resolved explicit target (no empty links remain) — called by `connect` before reordering and by save.
  - `setPosition(workflow, nodeId, {x, y}) -> workflow`: writes `params.ui_position` or branch `ui_position`.
- [ ] **Step 1: Write failing tests:**
  - `legacy flow is preserved`: a 4-step workflow with implicit links, a CHOICE with one empty option target, `cancel_next_step_id` absent and another CHOICE with `cancel_next_step_id: ''` → for every step index and every outcome, `resolveNextStepIndex(explicitLinks(wf).steps, i, o)` maps to the same `step_id` (or end) as on the original.
  - `connect start reorders without changing links`: connecting `'__start'` to the 3rd step puts it first and all other steps keep the same resolved targets.
  - `error handle connect and disconnect`: connect `err` sets `on_error.action = 'ERROR_BRANCH'` + target; disconnect resets to `STOP`.
  - `battery branch connect`: connecting `'__battery'` → `'charger'` sets `event_branches[0].next_step_id`.
  - `removeStep clears dangling links`: links to the removed step become `'END'`; battery branch targeting it is removed.
  - `graph has one edge per resolved link`: `workflowToGraph` of a 2-step workflow → edges `__start→a`, `a→b (ok)`, `b→__end (ok)`.
- [ ] **Step 2: Run** `npx vitest run src/utils/__tests__/workflowGraph.test.js` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(frontend): workflow steps-to-graph conversion for canvas editor`.

### Task 8: Canvas component

**Files:**
- Create: `frontend/src/pages/admin/tabs/workflow/canvas/WorkflowCanvas.jsx`
- Create: `frontend/src/pages/admin/tabs/workflow/canvas/WorkflowCanvasNodes.jsx` (`StartNode`, `EndNode`, `StepNode`, `BatteryNode`)
- Create: `frontend/src/pages/admin/tabs/workflow/canvas/NodePalette.jsx`

**Interfaces:**
- Consumes: Task 7 functions; `OTTO_STEP_TYPES`, step colors/icons from `workflowConstants.js`; `stepSetup` from `utils/workflowStepSetup.js`.
- Produces: `<WorkflowCanvas workflow routes selectedId onSelect(id|null) onChange(nextWorkflow) onAddStep(type) />`. `onChange` receives the whole updated workflow (the modal owns state). Imports `@xyflow/react/dist/style.css`.
- Visuals: React Flow with `Background`, `Controls`, `MiniMap`; edges `smoothstep`; `ok`/option handles green (`#16a34a`), `err` red (`#dc2626`), battery node amber with `⚡ Khi pin < {threshold}%` and an inline number input (5–90); step node shows icon, title, type label, `↻ {retry_count}` badge when retries > 0, amber border + `title` tooltip when `stepSetup(...).ready === false` or (ROBOT mode and type ∉ MOVE/FOLLOW_ROUTE/WAIT). Palette: `+ Thêm node` button opening the step type list (from `OTTO_STEP_TYPES`), plus `⚡ Nhánh pin yếu` (only in ROBOT mode, hidden when one exists). Delete key / node menu deletes via `removeStep`; start/end nodes are not deletable.
- [ ] **Step 1: Implement** the three files.
- [ ] **Step 2: Verify** `npx vite build` succeeds.
- [ ] **Step 3: Commit** `feat(frontend): React Flow workflow canvas`.

### Task 9: Builder modal integration and error settings panel

**Files:**
- Create: `frontend/src/pages/admin/tabs/workflow/StepErrorSettings.jsx`
- Modify: `frontend/src/pages/admin/tabs/workflow/WorkflowBuilderModal.jsx` (tabs `Sơ đồ | Thông tin | Lịch & lặp`; canvas center; right panel = `WorkflowStepBlock` for the selected node + `StepErrorSettings`; battery node selected → threshold field; drop `WorkflowStepNavigator`)
- Create: `frontend/src/pages/admin/tabs/workflow/useWorkflowEditing.js` — move `handleAddStep`, `handleRemoveStep`, `handleMoveStep`, `handleStepParamChange`, `handleWorkflowMetaChange` (and their helpers) out of `AdminWorkflowTab.jsx` unchanged in behavior; hook signature `useWorkflowEditing(editingWorkflow, setEditingWorkflow) -> {addStep, removeStep, moveStep, changeStepParam, changeMeta, replaceWorkflow}`.
- Modify: `frontend/src/pages/admin/tabs/AdminWorkflowTab.jsx` (use the hook; pass `onWorkflowChange` = `replaceWorkflow`; run `explicitLinks` in the save handler before the API call). **Must end ≤ 500 lines** (now 560).

**Interfaces:**
- Consumes: Task 7 `explicitLinks`, Task 8 `WorkflowCanvas`.
- Produces: `<StepErrorSettings step allSteps onChange(onError) />`: fields `Thử lại` (0–5), `Chờ giữa mỗi lần (giây)` (1–60), `Sau đó` select (`Dừng lượt chạy` / `Bỏ qua, đi tiếp` / `Đi nhánh lỗi (cổng đỏ)`); when `Đi nhánh lỗi`, a target select of steps + `Kết thúc`. Shown only for MOVE/FOLLOW_ROUTE when `execution_config.execution_mode === 'ROBOT'`.
- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify** `wc -l` of every touched file ≤ 500, `npx vitest run` (whole suite) and `npx vite build` pass; open the admin Workflow tab with `npm run dev`, open an existing workflow → canvas shows it, add a WAIT node, connect it, add a battery branch to a CHARGER MOVE, save, reopen → same graph.
- [ ] **Step 3: Commit** `feat(frontend): canvas-based workflow builder with error settings`.

## Part 3 — On the robot

### Task 10: Real-robot verification

- [ ] **Step 1:** Restart the backend; confirm Nav2 + localization on the map that has a `CHARGER` endpoint (Physical Map).
- [ ] **Step 2:** Build workflow: Start → FOLLOW_ROUTE (2 laps, `on_error` retry 2 / wait 5 / CONTINUE) → END; battery branch `< 20%` → MOVE `target_type: CHARGER` → END. Set battery slider to 80%, start.
- [ ] **Step 3:** Block the robot's path until Nav2 aborts → run log shows `Thử lại` and the robot resumes from the same point.
- [ ] **Step 4:** Drag the slider to 15% mid-route → within ~3 s the robot stops the route and drives to the charger; the run ends `Hoàn thành` with `Dừng tuyến do pin yếu (15%) — đã về trạm sạc.`
- [ ] **Step 5:** Report results; no commit unless fixes were needed.
