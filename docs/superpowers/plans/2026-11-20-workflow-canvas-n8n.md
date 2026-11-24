# Trình vẽ workflow kiểu n8n (đợt 1) – Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay trình sửa workflow dạng danh sách bằng canvas node kiểu n8n, vẽ và lưu được nhánh "⚡ Khi pin < X%" → "Về trạm sạc gần nhất", không đụng code robot.

**Architecture:** Lấy lại có chọn lọc phần canvas từ commit `1ae7114` (React Flow, module thuần `workflowGraph.js` chuyển steps ⇄ nodes/edges), bỏ mọi phần "gặp khách" và UI cài đặt lỗi. Dữ liệu vẫn là danh sách bước phẳng + `next_step_id`; nhánh pin nằm ở `execution_config.event_branches`. Backend chỉ thêm schema để lưu được nhánh. Frontend chặn chạy xe thật khi có nhánh pin / bước trạm sạc (đợt 2 mới chạy được).

**Tech Stack:** React 18, Tailwind 3, `@xyflow/react` 12.12.1, Vitest 1; FastAPI + Pydantic v2, pytest.

**Spec:** `docs/superpowers/specs/2026-11-20-workflow-canvas-n8n-design.md`

## Global Constraints

- Không sửa bất kỳ file nào trong `robot/`: cuối mỗi task `git diff --stat -- robot/` phải rỗng.
- **Không commit / push** (quy tắc người dùng): mỗi task kết thúc bằng việc để thay đổi trong working tree.
- File mới ≤ 500 dòng.
- `@xyflow/react` đúng phiên bản `12.12.1` (`--save-exact`).
- Ngưỡng pin: số nguyên 5–90, mặc định 20; tối đa 1 nhánh `LOW_BATTERY`.
- Bước trạm sạc: MOVE, `params.target_type = "CHARGER"`, `params.target_value = "NEAREST_CHARGER"`, **không** có `target_x`/`target_y`; tiêu đề `Về trạm sạc gần nhất`.
- Câu chặn chạy xe thật (giữ nguyên chữ):
  - `Nhánh pin yếu chưa chạy được trên xe thật (đợt 2). Gỡ nhánh để chạy.`
  - `Bước Về trạm sạc gần nhất chưa chạy được trên xe thật (đợt 2). Gỡ bước để chạy.`
- Test mới nằm trong thư mục bị gitignore (`**/__tests__/`, `**/tests/`): ghi lại để người dùng `git add -f` khi tự commit.
- Lấy file từ commit cũ bằng `git show 1ae7114:<path> > <path>` rồi sửa theo task; không cherry-pick cả commit.
- Chữ trên giao diện bằng tiếng Việt.

## Review Focus

1. Workflow lưu từ thời `1ae7114` có nhánh `GUEST_DETECTED` hoặc trường lạ (`idle_timeout_sec`…) trong `event_branches` → đọc danh sách workflow không lỗi; lưu lại thì nhánh khách bị bỏ. *(Task 1: `test_legacy_guest_branch_and_extra_keys_are_dropped`)*
2. Workflow cũ (link ngầm, chưa có `ui_position`) mở trong canvas rồi lưu → kiosk chạy y như trước. *(Task 2: `legacy flow is preserved`; Task 5: lưu qua `explicitLinks`)*
3. Xóa node "Về trạm sạc gần nhất" mà nhánh pin đang trỏ tới → node ⚡ vẫn còn, trỏ về Kết thúc, không mất nhánh âm thầm. *(Task 2: `removeStep keeps the battery branch pointing to END`)*
4. Đổi chế độ xe thật → màn hình khi đã có nhánh pin → node ⚡ vẫn hiện để xóa được; chế độ màn hình không bị chặn chạy. *(Task 3: phần SCREEN của `blocks real-robot runs…`)*
5. Bấm chạy xe thật khi có nhánh pin hoặc chỉ có bước trạm sạc → bị chặn đúng câu, không gửi lên backend. *(Task 3)*

---

### Task 1: Backend lưu được nhánh pin yếu

**Files:**
- Modify: `backend/app/schemas/workflow.py` (thêm class sau `WorkflowRoute` ~L71; thêm field vào `WorkflowExecutionConfig` L73–94)
- Test: `backend/tests/test_workflow_event_branches.py` (mới, bị gitignore)

**Interfaces:**
- Produces: `WorkflowEventBranch(event: Literal["LOW_BATTERY"], threshold_percent: int = 20 (strict, 5–90), next_step_id: str (bắt buộc, min_length=1), ui_position: Optional[Dict[str, float]] = None)`; `WorkflowExecutionConfig.event_branches: List[WorkflowEventBranch] = []`, `max_length=1`. `WorkflowCreate/Update/Response` đã dùng `WorkflowExecutionConfig` nên tự có field này.

- [ ] **Step 1: Viết test**

```python
import pytest
from pydantic import ValidationError
from app.schemas.workflow import WorkflowExecutionConfig

LOW = {'event': 'LOW_BATTERY', 'threshold_percent': 20, 'next_step_id': 'go', 'ui_position': {'x': 0, 'y': 400}}

def test_default_has_no_branches():
    assert WorkflowExecutionConfig().event_branches == []

def test_low_battery_branch_round_trips():
    cfg = WorkflowExecutionConfig.model_validate({'execution_mode': 'ROBOT', 'event_branches': [LOW]})
    assert cfg.model_dump()['event_branches'] == [LOW]

@pytest.mark.parametrize('bad', [{'threshold_percent': 4}, {'threshold_percent': 91},
                                 {'threshold_percent': '20'}, {'next_step_id': None}, {'next_step_id': ''}])
def test_invalid_low_battery_branch_is_rejected(bad):
    with pytest.raises(ValidationError):
        WorkflowExecutionConfig.model_validate({'event_branches': [{**LOW, **bad}]})

def test_only_one_low_battery_branch():
    with pytest.raises(ValidationError):
        WorkflowExecutionConfig.model_validate({'event_branches': [LOW, LOW]})

def test_legacy_guest_branch_and_extra_keys_are_dropped():
    legacy = [{'event': 'GUEST_DETECTED', 'idle_timeout_sec': 20},
              {**LOW, 'idle_timeout_sec': 20, 'cooldown_sec': 60}]
    cfg = WorkflowExecutionConfig.model_validate({'event_branches': legacy})
    assert cfg.model_dump()['event_branches'] == [LOW]
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `cd backend; python -m pytest tests/test_workflow_event_branches.py -q`
Expected: FAIL (`event_branches` không tồn tại / không bị từ chối).

- [ ] **Step 3: Cài `WorkflowEventBranch` và `event_branches`**

Pydantic mặc định bỏ trường lạ (giữ nguyên). Thêm `field_validator("event_branches", mode="before")` trên `WorkflowExecutionConfig`: nếu giá trị là list thì chỉ giữ phần tử là dict có `event == "LOW_BATTERY"` (bỏ nhánh khách cũ của `1ae7114`), giá trị khác để nguyên cho Pydantic báo lỗi.

- [ ] **Step 4: Chạy lại + không hồi quy**

Run: `cd backend; python -m pytest tests/test_workflow_event_branches.py tests/test_workflow_map_binding.py tests/test_workflow_routes.py tests/test_workflow_runtime.py tests/test_workflow_schedule.py -q`
Expected: tất cả PASS. (Không chạy `test_workflow_guest_sync.py`, `test_workflow_plan_policy.py`: file sót lại từ `1ae7114`, bị gitignore, kiểm tính năng đã gỡ.)

- [ ] **Step 5: Không commit** – để thay đổi trong working tree; `git diff --stat -- robot/` rỗng.

---

### Task 2: Module `workflowGraph.js` (steps ⇄ canvas)

**Files:**
- Create: `frontend/src/utils/workflowGraph.js` (từ `git show 1ae7114:frontend/src/utils/workflowGraph.js`)
- Test: `frontend/src/utils/__tests__/workflowGraph.test.js` (đã có trên máy, bị gitignore – sửa lại)

**Interfaces:**
- Consumes: `FLOW_END, OUTCOME, getChoiceOptions, resolveNextStepIndex` từ `frontend/src/utils/workflowFlow.js` (có sẵn).
- Produces (giữ chữ ký như `1ae7114`): hằng `START='__start'`, `END_NODE='__end'`, `BATTERY='__battery'`, `DEFAULT_BATTERY_THRESHOLD=20`; `explicitLinks(wf)`, `eventBranch(wf, event)`, `autoLayout(wf)`, `workflowToGraph(wf) → {nodes, edges}` (node types `start|end|step|battery`, edge `data.{error,battery}`), `connect(wf, {source, sourceHandle, target})`, `disconnect(wf, {source, sourceHandle})`, `removeStep(wf, stepId)`, `markSelected(nodes, selectedId)`, `clampThreshold(v)`, `setPosition(wf, nodeId, {x,y})`, `appendStep(wf, step, position?)`, `addBatteryBranch(wf, threshold=20)`, `setBatteryThreshold(wf, v)`, `removeBatteryBranch(wf)`. Mọi hàm trả workflow mới, không sửa input.

- [ ] **Step 1: Sửa test**
  - Bỏ import và 3 test khách: `guest branch coexists…`, `setGuestSettings clamps values`, `removeStep('__guest')…`.
  - Viết lại `eventBranch finds a branch by event…` không dùng khách:
    ```js
    const wf = addBatteryBranch({ steps: [], execution_config: {} }, 15);
    expect(eventBranch(wf, 'LOW_BATTERY').threshold_percent).toBe(15);
    expect(eventBranch({ execution_config: {} }, 'LOW_BATTERY')).toBeNull();
    ```
  - Trong `removeStep clears dangling links`, đổi dòng cuối và đổi tên test thành `removeStep keeps the battery branch pointing to END`:
    ```js
    expect(removed.execution_config.event_branches).toEqual([expect.objectContaining({ event: 'LOW_BATTERY', next_step_id: 'END' })]);
    ```
  - Thêm:
    ```js
    it('legacy guest branch data never becomes a node', () => {
      const wf = { steps: [step('a')], execution_config: { event_branches: [{ event: 'GUEST_DETECTED' }] } };
      expect(workflowToGraph(wf).nodes.map((n) => n.id).sort()).toEqual(['__end', '__start', 'a']);
    });
    ```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `cd frontend; npx vitest run src/utils/__tests__/workflowGraph.test.js`
Expected: FAIL (không tìm thấy `../workflowGraph`).

- [ ] **Step 3: Tạo file từ `1ae7114`, rồi sửa**
  - Xóa: `GUEST`, `GUEST_DEFAULTS`, `GUEST_LIMITS`, `addGuestBranch`, `setGuestSettings`, `removeGuestBranch`, node `guest` trong `workflowToGraph`, `positions[GUEST]` trong `autoLayout`, nhánh `GUEST` trong `setPosition` và `removeStep`; sửa comment đầu file cho khớp.
  - Giữ xử lý cổng `err` (`on_error.action === 'ERROR_BRANCH'`) để dữ liệu cũ vẫn hiện và gỡ được; không có UI tạo mới.
  - `removeStep`: nhánh pin trỏ tới bước bị xóa → đặt `next_step_id = FLOW_END` thay vì xóa nhánh.

- [ ] **Step 4: Chạy lại**

Run: `cd frontend; npx vitest run src/utils/__tests__/workflowGraph.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 5: Không commit** – để trong working tree.

---

### Task 3: Chặn chạy xe thật khi có nhánh pin / bước trạm sạc

**Files:**
- Modify: `frontend/src/utils/workflowExecution.js` (`executionError`, ~L7–12)
- Test: `frontend/src/utils/__tests__/workflowExecution.test.js`

**Interfaces:**
- Produces: `isChargerMove(step) → boolean` (MOVE, `params.target_type === 'CHARGER'`, `target_x` null/undefined). `executionError(workflow)` ở chế độ `ROBOT`: có nhánh `LOW_BATTERY` → câu chặn nhánh pin; không có nhánh nhưng có `isChargerMove` → câu chặn bước trạm sạc; hai kiểm tra này đứng **trước** kiểm tra loại bước / `map_id`. Chế độ `SCREEN` không đổi.

- [ ] **Step 1: Viết test**

```js
it('blocks real-robot runs with a low-battery branch or a charger step (phase 2)', () => {
  const charger = { step_id: 'go', type: 'MOVE', params: { target_type: 'CHARGER', target_value: 'NEAREST_CHARGER' } };
  const branch = [{ event: 'LOW_BATTERY', threshold_percent: 20, next_step_id: 'go' }];
  const wf = (config) => ({ execution_config: config, steps: [{ step_id: 'w', type: 'WAIT', params: { duration_sec: 5 } }, charger] });
  expect(executionError(wf({ execution_mode: 'ROBOT', event_branches: branch })))
    .toBe('Nhánh pin yếu chưa chạy được trên xe thật (đợt 2). Gỡ nhánh để chạy.');
  expect(executionError(wf({ execution_mode: 'ROBOT' })))
    .toBe('Bước Về trạm sạc gần nhất chưa chạy được trên xe thật (đợt 2). Gỡ bước để chạy.');
  expect(executionError(wf({ execution_mode: 'SCREEN', event_branches: branch }))).toBe('');
});

it('isChargerMove only matches charger moves without coordinates', () => {
  expect(isChargerMove({ type: 'MOVE', params: { target_type: 'CHARGER' } })).toBe(true);
  expect(isChargerMove({ type: 'MOVE', params: { target_type: 'CHARGER', target_x: 1 } })).toBe(false);
  expect(isChargerMove({ type: 'WAIT', params: { target_type: 'CHARGER' } })).toBe(false);
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL** – `cd frontend; npx vitest run src/utils/__tests__/workflowExecution.test.js` → FAIL (`isChargerMove` chưa có).
- [ ] **Step 3: Cài `isChargerMove` và hai kiểm tra trong `executionError`.**
- [ ] **Step 4: Chạy lại** – cùng lệnh → PASS, kể cả các test cũ trong file.
- [ ] **Step 5: Không commit.**

---

### Task 4: Thư viện và các component canvas

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json` (`cd frontend; npm install --save-exact @xyflow/react@12.12.1`)
- Create: `frontend/src/pages/admin/tabs/workflow/canvas/WorkflowCanvasNodes.jsx`, `canvas/NodePalette.jsx`, `canvas/WorkflowCanvas.jsx` (từ `1ae7114`)
- Test: `frontend/src/pages/admin/tabs/workflow/__tests__/NodePalette.test.js` (mới, bị gitignore)

**Interfaces:**
- Consumes: Task 2 (`workflowGraph`), Task 3 (`isChargerMove`), `stepSetup` từ `utils/workflowStepSetup`.
- Produces: `createStep(type, overrides?) → step`; `createChargerStep() → step` (theo Global Constraints, `speed: 0.35`, `timeout_sec: 120`, `waypoint_name: 'Trạm sạc gần nhất'`); `NodePalette({ robotMode, hasBatteryBranch, onAdd, onAddBattery })`; `NODE_TYPES = { start, end, battery, step }`, `OK_COLOR`, `ERROR_COLOR`, `BATTERY_COLOR`; `WorkflowCanvas({ workflow, routes, selectedId, onSelect, onChange })` – mỗi chỉnh sửa gọi `onChange(workflowMới)`.

- [ ] **Step 1: Viết test**

```js
import { describe, expect, it } from 'vitest';
import { createChargerStep, createStep } from '../canvas/NodePalette';
import { isChargerMove } from '../../../../../utils/workflowExecution';
import { stepSetup } from '../../../../../utils/workflowStepSetup';

describe('NodePalette steps', () => {
  it('charger step is a nearest-charger MOVE without coordinates', () => {
    const s = createChargerStep();
    expect(s).toMatchObject({ type: 'MOVE', title: 'Về trạm sạc gần nhất',
      params: { target_type: 'CHARGER', target_value: 'NEAREST_CHARGER' } });
    expect(s.params.target_x).toBeUndefined();
    expect(isChargerMove(s)).toBe(true);
    expect(stepSetup(s).ready).toBe(true);
  });
  it('new steps get unique ids', () => {
    expect(createStep('WAIT').step_id).not.toBe(createStep('WAIT').step_id);
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL** – `cd frontend; npx vitest run src/pages/admin/tabs/workflow/__tests__/NodePalette.test.js` → FAIL (thiếu module).
- [ ] **Step 3: Cài thư viện, tạo 3 file từ `1ae7114`, rồi sửa**
  - `WorkflowCanvasNodes.jsx`: bỏ `GuestNode`, icon `UserRound`, khóa `guest` trong `NODE_TYPES`; dòng phụ của node trạm sạc thành `Trạm sạc gần nhất (chọn lúc chạy)`.
  - `NodePalette.jsx`: bỏ props/nút "Khi gặp khách"; `createChargerStep` theo Interfaces; nút menu ghi **Về trạm sạc gần nhất** / "Chọn trạm sạc gần xe nhất lúc chạy".
  - `WorkflowCanvas.jsx`: bỏ mọi `GUEST`/`addGuestBranch`/`hasGuestBranch`/`onAddGuest`; `freezePositions` chỉ xét `BATTERY`; `onNodeClick` chọn được node `step` và `battery`.
- [ ] **Step 4: Chạy lại** – cùng lệnh → PASS. Thêm: `git grep -nE "GUEST|Guest|UserRound" -- frontend/src/pages/admin/tabs/workflow/canvas frontend/src/utils/workflowGraph.js` → không có kết quả.
- [ ] **Step 5: Không commit.**

---

### Task 5: Cửa sổ thiết lập workflow, hook và tab Workflow

**Files:**
- Modify: `frontend/src/pages/admin/tabs/workflow/WorkflowBuilderModal.jsx` (thay bằng bản `1ae7114` rồi sửa)
- Create: `frontend/src/pages/admin/tabs/workflow/WorkflowMetaPanel.jsx`, `useWorkflowEditing.js` (lấy nguyên từ `1ae7114`)
- Modify: `frontend/src/pages/admin/tabs/AdminWorkflowTab.jsx` (áp các hunk của `git diff HEAD 1ae7114 -- frontend/src/pages/admin/tabs/AdminWorkflowTab.jsx`, **trừ** import `RobotBatterySimulator` và dòng lưới bọc `WorkflowRunsPanel`)
- Test: `frontend/src/pages/admin/tabs/workflow/__tests__/WorkflowBuilderSetup.test.jsx`

**Interfaces:**
- Consumes: Task 2–4.
- Produces: `useWorkflowEditing(setEditingWorkflow, setIsEditorOpen) → { openCreate, openEdit, openRouteWorkflow, replaceWorkflow, removeStep, changeStepParam, changeMeta }`; `WorkflowBuilderModal` props: `isOpen, workflow, workflows, onSelectWorkflow, waypoints, routes, onRouteSaved, isLoading, onClose, onSave, onWorkflowChange, onRemoveStep, onStepParamChange, onWorkflowMetaChange`. Khi lưu, `AdminWorkflowTab` gửi `explicitLinks(editingWorkflow)`.

- [ ] **Step 1: Viết test** – thay file bằng bản `1ae7114` (2 test: bố cục, trạng thái rỗng) và thêm:

```jsx
it('shows the nearest-charger note instead of the waypoint form', () => {
  const workflow = { id: 'wf', name: 'P', execution_config: { execution_mode: 'ROBOT' }, steps: [
    { step_id: 'go', type: 'MOVE', title: 'Về trạm sạc gần nhất', params: { target_type: 'CHARGER', target_value: 'NEAREST_CHARGER' } }] };
  const html = renderToStaticMarkup(<WorkflowBuilderModal isOpen workflow={workflow} />);
  expect(html).toContain('Trạm sạc gần nhất được chọn lúc chạy');
  expect(html).not.toContain('Khi gặp khách');
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL** – `cd frontend; npx vitest run src/pages/admin/tabs/workflow/__tests__/WorkflowBuilderSetup.test.jsx` → FAIL (chưa có canvas / ghi chú trạm sạc).
- [ ] **Step 3: Sửa modal sau khi lấy bản `1ae7114`**
  - Bỏ: `StepErrorSettings`, `ERROR_POLICY_TYPES`, `GuestBranchPanel`, `GUEST_FIELDS`, import `GUEST`/`removeGuestBranch`/`setGuestSettings`, biến `guestSelected`.
  - Dòng hướng dẫn đầu cửa sổ: `Kéo dây giữa các cổng để nối bước. Node ⚡ là nhánh pin yếu. Chọn node để cấu hình.`
  - `BatteryBranchPanel`: câu hướng dẫn trỏ tới node **Về trạm sạc gần nhất**; thêm dòng `Đợt này mới vẽ và lưu được nhánh; xe thật sẽ chạy nhánh này ở đợt 2.`
  - Khi node đang chọn là `isChargerMove`: hiện khung ghi `Trạm sạc gần nhất được chọn lúc chạy (điểm Trạm sạc cùng map, gần xe nhất).` và nút `Xóa node` gọi `onRemoveStep(activeIndex)`, thay cho `WorkflowStepBlock`.
- [ ] **Step 4: Tạo `WorkflowMetaPanel.jsx`, `useWorkflowEditing.js`; áp hunk vào `AdminWorkflowTab.jsx` như mục Files.**
- [ ] **Step 5: Chạy lại** – cùng lệnh → PASS. Thêm: `git grep -nE "StepErrorSettings|RobotBatterySimulator|GUEST" -- frontend/src/pages/admin/tabs` → không có kết quả.
- [ ] **Step 6: Không commit.**

---

### Task 6: Kiểm tra toàn bộ

- [ ] **Step 1:** `cd frontend; npx vitest run` → toàn bộ PASS (ghi số test).
- [ ] **Step 2:** `cd frontend; npm run build` → build thành công.
- [ ] **Step 3:** `cd backend; python -m pytest tests/test_workflow_event_branches.py tests/test_workflow_map_binding.py tests/test_workflow_routes.py tests/test_workflow_runtime.py tests/test_workflow_schedule.py -q` → PASS.
- [ ] **Step 4:** `git diff --stat -- robot/` rỗng; `git status --short` chỉ có các file trong kế hoạch.
- [ ] **Step 5: Kiểm tra trên trình duyệt** (backend + `npm run dev`): mở Admin → Workflow → sửa một workflow cũ → canvas hiện đúng luồng; chuyển chế độ xe thật, thêm "Nhánh pin yếu" và "Về trạm sạc gần nhất", nối dây, đổi ngưỡng 20 → 25, lưu, mở lại → nhánh và vị trí còn nguyên; bấm chạy xe thật → thấy câu chặn nhánh pin.
- [ ] **Step 6:** Báo người dùng danh sách file thay đổi và các test cần `git add -f`; không commit.
