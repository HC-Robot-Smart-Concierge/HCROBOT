# Robot ↔ Screen Sync (patrol, stop for guests, resume) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a real-robot run patrols, the kiosk plays ads and shows run status; when its camera sees a guest the vehicle stops for the kiosk's AI conversation and resumes from the unfinished point afterwards.

**Architecture:** The kiosk reports guest engagement to a new backend endpoint; the backend writes a renewable `guest_hold_until` into the per-run control file (like the battery reading); the executor raises `GuestHold`, abandons its goal, waits, then re-runs the same step from `self.index`. The backend also broadcasts `ROBOT_RUN_STATUS` over the existing notification WebSocket.

**Tech Stack:** FastAPI/Pydantic, ROS 2 executor (pure-python mixin), React 18 + vitest, @xyflow/react 12.

**Spec:** `docs/superpowers/specs/2026-11-18-robot-screen-sync-design.md`

## Global Constraints

- **No commits.** Skip every commit step. **New files ≤ 500 lines**; existing files may be edited in place.
- Guest branch: `{event: "GUEST_DETECTED", idle_timeout_sec: 5–120 (20), max_duration_sec: 30–600 (180), cooldown_sec: 0–600 (60), ui_position?}`, no `next_step_id`; at most one per event; `event_branches` max 2; `LOW_BATTERY` still requires `next_step_id`.
- Control-file fields: `guest_hold_until` (epoch s | null), `guest_since` (epoch s | null).
- Endpoint: `POST /api/v1/workflows/runs/guest` body `{robot_id: "RC-001", state: "ENGAGED"|"DONE", idle_ms: 0–600000}` → `{accepted: bool, run_id: str|null}`. ENGAGED: `hold_until = now − idle_ms/1000 + idle_timeout_sec`; DONE: clear.
- Executor events: `GUEST_HOLD` (message `Dừng chờ khách`), `GUEST_RESUME` (message one of `Khách đã đi`, `Hết {idle} s không tương tác`, `Hết thời gian tối đa {max} s`).
- Low battery while holding: percent ≥ 10 deferred until the hold ends; < 10 triggers the branch at once. No guest hold while the battery branch runs or during cooldown.
- WS payload: `{"type": "ROBOT_RUN_STATUS", robot_id, run_id, workflow_name, status, phase, step_title, step_index, total_steps, guest_mode, guest_idle_timeout_sec}`; `phase` ∈ `MOVING|RETRYING|GUEST_HOLD|CHARGING|DONE`; sent on phase change and every 10 s while running. Kiosk drops a status not refreshed for 25 s; pings ENGAGED every 3 s.
- Kiosk labels: MOVING `Đang tuần tra · bước {i}/{n}`, RETRYING `Đang thử lại…`, GUEST_HOLD `Dừng chờ khách`, CHARGING `Đang về trạm sạc`.

## Review Focus

1. After the guest leaves (DONE) the kiosk must not immediately re-hold the robot because the last interaction is still recent — pinned in Task 5 (`no ping after the guest left`).
2. Kiosk closed mid-conversation → robot resumes after `idle_timeout_sec` — pinned in Task 2 (`hold expires when no renewal arrives`).
3. A guest seen during the retry wait or the inter-round interval must hold, not fail the run — pinned in Task 2.
4. ENGAGED with no running guest-enabled run must be ignored, not an error — pinned in Task 3.
5. Cancel / lease loss during a hold must still stop the run — pinned in Task 2.

---

### Task 1: Schema and plan validation for the guest branch
**Files:** Modify `backend/app/schemas/workflow.py`, `backend/app/services/workflow_plan.py`; Test `backend/tests/test_workflow_plan_policy.py`.
**Interfaces — Produces:** `WorkflowEventBranch` fields above (+ `model_validator`: LOW_BATTERY needs `next_step_id`); `WorkflowExecutionConfig.event_branches` max 2, unique `event`. `physical_plan` checks `next_step_id` only when not None.
- [ ] Tests (RED): `test_guest_branch_defaults_and_limits` (defaults 20/180/60; idle 4, max 601, cooldown -1 rejected); `test_two_guest_branches_rejected`; `test_low_battery_without_target_rejected`; `test_plan_accepts_battery_and_guest_branches` (plan config keeps both).
- [ ] Implement; run `cd backend && python -m pytest tests -q` → all pass.

### Task 2: Executor guest hold
**Files:** Modify `robot/ros2_configs/workflow_navigation_logic.py` (helpers), `robot/ros2_configs/workflow_flow.py` (`GuestHold`, hold loop, policy integration), `robot/ros2_configs/workflow_executor.py` (`check_control`, `__init__`, `_wall`, `execute` interval); Modify `robot/tests/conftest.py` (env + defaults); Create `robot/tests/test_workflow_guest_hold.py`.
**Interfaces — Produces:**
- `guest_branch(config) -> dict|None`; `guest_hold_active(control, branch, now, cooldown_until) -> bool` (branch set, `now >= cooldown_until`, numeric `guest_hold_until > now`).
- `class GuestHold(Exception)` in `workflow_flow.py`; executor attrs `guest_branch`, `guest_holding=False`, `guest_cooldown_until=0.0`, `in_battery_branch=False`, `last_control={}`; `Executor._wall() -> time.time()`.
- `check_control` stores `self.last_control`; when armed, not holding, not in battery branch and `guest_hold_active` → `guest_holding=True`, raise `GuestHold`. Battery: when `guest_holding` and percent ≥ 10 → skip (not triggered).
- `FlowPolicyMixin._hold_for_guest() -> None`: emit `GUEST_HOLD`; loop `spin_checked` (ignore `NavigationError`) until `guest_hold_until` not numeric (`Khách đã đi`), `_wall() >= hold_until` (idle), or `max_duration_sec` elapsed by `_monotonic` (max); then `guest_holding=False`, `guest_cooldown_until=_wall()+cooldown_sec`, emit `GUEST_RESUME` with the reason.
- `_run_step_with_policy`: outer `try/except GuestHold` around each loop iteration → `_abandon_goal()`, `_hold_for_guest()`, retry the same step from `self.index` without counting an attempt. `_run_battery_branch` sets `in_battery_branch=True` first. `execute`: GuestHold during the inter-round wait → hold, then continue to the next round.
- [ ] Tests (RED), using a fake `spin_checked` that advances the clock and calls `check_control`, writing control files with `guest_hold_until`:
  `test_guest_hold_cancels_goal_and_resumes_same_route_point` (route fails? no: guest arrives at point 1 → second follow_route call gets `steps[1:3]`, events contain GUEST_HOLD then GUEST_RESUME, run COMPLETED);
  `test_hold_expires_when_no_renewal_arrives` (hold_until = now+2, never renewed → resume reason idle, ≥2 s held);
  `test_done_resumes_immediately` (control rewritten with `guest_hold_until: null` → reason `Khách đã đi`);
  `test_max_duration_caps_the_hold` (hold_until far future, max 30 → resumes after 30 s);
  `test_cooldown_blocks_a_new_hold`;
  `test_guest_during_retry_wait_holds_and_keeps_attempts`;
  `test_cancel_during_hold_stops_run` (cancel true → RunCancelled);
  `test_low_battery_waits_for_guest_unless_critical` (15 % during hold → branch after resume; 8 % → branch immediately);
  `test_no_guest_hold_while_charging`.
- [ ] Implement; `cd robot && python -m pytest tests -q` → all pass; `wc -l` new files ≤ 500.

### Task 3: Backend guest endpoint, control fields and run status broadcast
**Files:** Modify `backend/app/services/workflow_runtime.py`, `backend/app/api/v1/endpoints/workflows.py`; Create `backend/app/services/workflow_run_status.py` (pure: `run_phase(status, last_event_type) -> str`, `status_payload(run, item) -> dict`); Create `backend/tests/test_workflow_guest_sync.py`.
**Interfaces — Produces:** `WorkflowRuntime.report_guest(robot_id: str, state: str, idle_ms: int) -> dict`; `launch()` stores `robot_id`, `guest_branch` in the item; `refresh_control` writes `guest_hold_until`, `guest_since` from `item['guest']`; `report_guest` refreshes the control file immediately. `async def publish_status(self, payload)` (calls `notification_manager.broadcast_to_department(None, payload)`); `monitor()` publishes on phase change / every 10 s (item keys `phase`, `status_sent_at`, `step_title`) and once with `DONE` when the run finishes. Endpoint schema `GuestReport` in `workflows.py`.
- [ ] Tests (RED): `test_guest_report_ignored_without_guest_run`; `test_engaged_sets_hold_from_idle_ms_and_done_clears`; `test_control_file_carries_guest_hold`; `test_run_phase_maps_events`; `test_monitor_publishes_status_on_phase_change` (publish_status AsyncMock); `test_guest_endpoint_returns_accepted_flag` (FastAPI TestClient pattern from `test_workflow_runtime.py`).
- [ ] Implement; `cd backend && python -m pytest tests -q` → all pass.

### Task 4: Canvas guest node
**Files:** Modify `frontend/src/utils/workflowGraph.js` (event-aware `branchOf(wf, event)`, `GUEST='__guest'`, `addGuestBranch`, `setGuestSettings(wf, patch)` with clamps, `removeGuestBranch`; graph node `type:'guest'`; `setPosition`/`removeStep` support), `canvas/WorkflowCanvasNodes.jsx` (GuestNode, no handles), `canvas/NodePalette.jsx` (item when ROBOT and absent), `canvas/WorkflowCanvas.jsx` (select guest node), `workflow/WorkflowBuilderModal.jsx` (GuestBranchPanel: 3 number inputs committed on blur + delete); Test `frontend/src/utils/__tests__/workflowGraph.test.js`.
- [ ] Tests (RED): `guest branch coexists with battery branch` (add both; battery connect still works; guest node present, no edges from it); `setGuestSettings clamps values` (4→5 idle, 1000→600 max, -3→0 cooldown, '' → default); `removeStep('__guest') removes only the guest branch`.
- [ ] Implement; `cd frontend && npx vitest run` → all pass; `npx vite build` ok.

### Task 5: Kiosk sync (status bar, ads while patrolling, guest reports)
**Files:** Create `frontend/src/utils/robotRunSync.js` (pure), `frontend/src/services/robotRunApi.js` (`reportGuest(state, idleMs, robotId='RC-001')`), `frontend/src/hooks/useRobotRunSync.js`, `frontend/src/components/robot/RobotRunStatusBar.jsx`; Modify `frontend/src/hooks/useNotificationWebSocket.js` (`onRobotRunStatus` for `ROBOT_RUN_STATUS`), `frontend/src/pages/robot/RobotScreenPage.jsx` (wire); Test `frontend/src/utils/__tests__/robotRunSync.test.js`.
**Interfaces — Produces:** `RUN_STALE_MS=25000`, `GUEST_PING_MS=3000`; `freshRun(run, now)`; `guestModeActive(run, now)` (fresh, `status==='RUNNING'`, `guest_mode`, phase not CHARGING/DONE); `shouldPing({ run, engaged, guestPresent, lastInteractionAt, now })` (guest mode, engaged, and guest present or interaction within `guest_idle_timeout_sec`); `phaseLabel(run)`; `patrolAdsActive(run, guestPresent, now)` (MOVING|RETRYING, no guest). Hook `useRobotRunSync({ guestPresent, lastInteractionRef }) -> { run, handleRunStatus, onGuestApproached, onGuestLeft, patrolAds }` (`onGuestApproached` sets engaged + sends ENGAGED; `onGuestLeft` clears engaged + sends DONE; interval pings; engaged cleared when idle passes the timeout).
- [ ] Tests (RED): `stale status is dropped after 25 s`; `no ping after the guest left`; `ping while present or recently interacting`; `no ping when idle beyond the timeout`; `phase labels`; `patrol ads only while moving without a guest`.
- [ ] Implement; wire `RobotScreenPage` (approach/touch/left handlers call the hook; `RobotAdPlayer isOpen={(isStandby || patrolAds) && !isWorkflowRunning && !guestPresent}`; render status bar); `npx vitest run` + `npx vite build` pass.

### Task 6: Verification
- [ ] All suites green; `wc -l` of new files ≤ 500; executor imports OK in WSL (`run_workflow.sh --check`).
- [ ] Final whole-change review by a fresh reviewer; fix Critical/Important with RED→GREEN tests.
- [ ] Manual robot check list for the user (spec §6).
