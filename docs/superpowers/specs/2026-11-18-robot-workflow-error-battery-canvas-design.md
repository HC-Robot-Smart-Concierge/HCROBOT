# Thiết kế: Xử lý lỗi từng bước, nhánh pin yếu cho xe thật và trình vẽ workflow kiểu n8n

Ngày: 2026-11-18 · Trạng thái: chờ duyệt

## 1. Mục đích

Robot thật (RC-001) chạy workflow tuần tra qua bộ thực thi ROS (`robot/ros2_configs/workflow_executor.py`).
Hiện tại:

- Chỉ cần một bước lỗi (Nav2 `status=5`, mất định vị thoáng qua...) là cả lượt chạy `FAILED`, robot đứng giữa đường.
- Robot thật không biết pin. Khi pin yếu, chỉ màn hình kiosk chạy workflow "Pin yếu" (MOVE ở màn hình là đồng hồ giả), xe vẫn đứng yên.
- Trình tạo workflow là danh sách bước + form, không thấy và không vẽ được nhánh.

Mục tiêu: demo được kịch bản **robot đang tuần tra → kéo thanh pin giả lập xuống dưới 20% → robot bỏ dở tuyến và tự đi về trạm sạc**, robot tự phục hồi khi lỗi điều hướng thoáng qua, và admin vẽ được các nhánh này trên canvas giống n8n.

## 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu**
1. Mỗi bước MOVE / Đi theo tuyến của xe thật có cài đặt lỗi kiểu n8n: thử lại N lần, rồi dừng / bỏ qua / đi nhánh lỗi.
2. Workflow xe thật có thể có **một nhánh sự kiện "Khi pin < X%"** (mặc định 20). Khi kích hoạt: hủy goal Nav2 đang chạy, chạy chuỗi bước của nhánh (thường là "Về trạm sạc"), xong thì kết thúc lượt chạy.
3. Thanh kéo pin giả lập ghi % vào Pi 5 (một nguồn số liệu chung cho kiosk, admin, bộ thực thi).
4. Trình vẽ workflow dạng canvas node (React Flow) thay danh sách bước, cho mọi workflow (màn hình và xe thật).

**Không làm (lần này)**
- Robot tự về sạc khi **không** có lượt chạy xe thật nào (vẫn chỉ kiosk xử lý như cũ).
- Tự chạy lại tuyến khi sạc xong ≥80%.
- Nhánh "gặp khách", bước IF tổng quát, workflow con, chạy bước màn hình (SPEAK/CHOICE) trên xe thật.
- Màn hình kiosk hiểu `on_error` / nhánh sự kiện (kiosk bỏ qua các trường mới).
- Đo pin thật.

**Thất bại nếu (dù chạy được)**
- Lỗi an toàn (encoder lệch, mất dữ liệu sức khỏe, mất lease backend, admin bấm dừng) bị "thử lại" thay vì dừng ngay.
- Kéo thanh pin làm hỏng hệ số ước tính pin thật trên Pi.
- Workflow cũ chạy khác đi sau khi mở và lưu lại trong trình vẽ mới.
- Nhánh pin yếu bắn nhiều lần trong một lượt chạy.

## 3. Ràng buộc từ hệ thống hiện có

- Bộ thực thi nhận kế hoạch (`plan`) đã phẳng hóa từ backend (`workflow_plan.physical_plan`, `workflow_routes.resolve_route_steps`) và đọc file điều khiển (`*.control.json`) mỗi ~0,1 s qua `check_control()`. Backend ghi file này mỗi giây (`WorkflowRuntime.control_loop`).
- `physical_plan` chỉ cho phép MOVE / FOLLOW_ROUTE / WAIT trên xe thật; mọi MOVE phải cùng một `map_id`.
- Dữ liệu workflow là **danh sách phẳng + `next_step_id`** (rỗng = bước kế, `END` = kết thúc). Kiosk (`utils/workflowFlow.js`, `useWorkflowRunner`) dùng chung quy ước này; CHOICE có `options[].next_step_id`, `timeout_next_step_id`, `cancel_next_step_id`.
- `WorkflowStepItem` chỉ có `step_id/type/title/params` (Pydantic bỏ trường lạ) → dữ liệu mới của bước nằm trong `params`. `WorkflowExecutionConfig` cũng bỏ trường lạ → trường mới phải khai báo.
- Pin: Pi 5 ước tính theo thời gian (`robot/scripts/pi_battery_estimator.py`). `GET /api/v1/system/power` trả `battery.{available, percent, minutes_per_percent}`; `POST /api/v1/system/battery/sync {percent, minutes_per_percent}`. **Nếu chỉ gửi `percent`, Pi tự hiệu chỉnh lại tốc độ tụt** → thanh kéo luôn gửi kèm `minutes_per_percent` hiện tại. Backend đã có proxy `/{api}/robot/pi5/{path}` (Pi `100.99.72.51:8000`).
- Trạm sạc: bảng `endpoints` có `map_id` và `type`; Physical Map tạo điểm loại `CHARGER` (dữ liệu cũ có thể là `dock`).
- Kiosk đọc cùng % pin từ Pi; ≤20% kiosk tự chạy `wf-10-low-battery` (thông báo + tạo yêu cầu nhân viên cắm sạc).

## 4. Phương án đã cân nhắc

| Phương án canvas | Đánh đổi | Chọn |
|---|---|---|
| **A. React Flow (`@xyflow/react` 12, hỗ trợ React 18)** | Có sẵn kéo thả, nối dây, zoom, minimap; +~150 KB | **Người dùng chọn A** |
| B. Tự vẽ SVG | Không thêm thư viện, nhưng tự viết nối dây/hit-test, tốn nhiều công, kém mượt | |
| C. Giữ form, thêm sơ đồ chỉ xem | Rẻ nhất, không vẽ nhánh được – trái ý người dùng | |

| Nguồn pin giả lập | Đánh đổi | Chọn |
|---|---|---|
| **A. Thanh kéo mới ghi % vào Pi** | Một nguồn số liệu cho mọi nơi; sau khi kéo Pi vẫn tự tụt dần | **Người dùng chọn A** |
| B. Dùng lại thanh kéo Studio | Studio (giả lập) sẽ tác động robot thật | |
| C. Lưu % ở backend | Kiosk không biết pin yếu | |

| Cách mô hình nhánh trong dữ liệu | Đánh đổi | Chọn |
|---|---|---|
| **Giữ danh sách phẳng + `next_step_id`, thêm `params.on_error`, `params.ui_position`, `execution_config.event_branches`** | Kiosk và workflow cũ không phải chuyển đổi | **Chọn (quyết định của Claude)** |
| Đổi sang đồ thị nodes/edges | Sạch hơn nhưng phải chuyển đổi dữ liệu và viết lại runner kiosk | |

Thứ tự làm (người dùng đồng ý): **Phần 1 lõi xe thật → Phần 2 canvas → Phần 3 nối và chạy thử trên xe.**

## 5. Thiết kế

### 5.1 Mô hình dữ liệu

Bước (trong `params`):
```jsonc
"on_error": {
  "retry_count": 0,          // 0–5
  "retry_wait_sec": 5,       // 1–60
  "action": "STOP",          // STOP | CONTINUE | ERROR_BRANCH
  "next_step_id": null       // bắt buộc khi ERROR_BRANCH: step_id hoặc "END"
},
"ui_position": { "x": 240, "y": 120 }   // chỉ để vẽ
```
Thiếu `on_error` = `{retry_count: 0, action: "STOP"}` = hành vi hiện tại.

Workflow:
```jsonc
"execution_config": {
  ...,
  "event_branches": [
    { "event": "LOW_BATTERY", "threshold_percent": 20, "next_step_id": "step-go-charger",
      "ui_position": { "x": 0, "y": 400 } }
  ]
}
```
Tối đa 1 nhánh `LOW_BATTERY`; ngưỡng 5–90.

Bước "Về trạm sạc": MOVE với `params.target_type = "CHARGER"` và **không** có tọa độ. `physical_plan` tra điểm `endpoints` cùng `map_id` của lượt chạy có `type` ∈ {`CHARGER`, `dock`} và điền `target_x/y/yaw`; không có điểm nào → từ chối khi bấm chạy: "Map chưa có điểm Trạm sạc".

Quy ước khi lưu từ canvas: **mọi bước được ghi `next_step_id` tường minh** (bước nối tiếp hoặc `END` khi không có dây ra), nên các bước chỉ thuộc nhánh lỗi/nhánh pin không bao giờ bị "rơi" vào từ bước đứng trước trong danh sách. Bước nối từ node "Bắt đầu" được xếp lên đầu danh sách.

### 5.2 Backend

- `schemas/workflow.py`: thêm `WorkflowEventBranch` và `execution_config.event_branches`.
- `workflow_plan.physical_plan`: kiểm tra `on_error` (khoảng giá trị; `ERROR_BRANCH` phải trỏ tới bước tồn tại hoặc `END`), `event_branches[].next_step_id` tồn tại; điền tọa độ trạm sạc; vẫn chỉ cho MOVE/FOLLOW_ROUTE/WAIT.
- `workflow_routes.resolve_route_steps`: chép `on_error` của bước FOLLOW_ROUTE vào **mọi** MOVE được mở ra (cùng `source_route_step_id`); `next_step_id` của nhánh lỗi giữ nguyên ID gốc. ID bước đầu tiên của tuyến vẫn là `step_id` gốc nên mọi dây trỏ vào FOLLOW_ROUTE vẫn đúng.
- `workflow_runtime`: khi có lượt chạy đang chạy **và** plan có `event_branches`, một tác vụ nền đọc `GET /system/power` trên Pi mỗi 2 s (httpx, timeout 2 s, không chặn event loop) và đưa vào file điều khiển: `battery_percent`, `battery_at` (epoch). Pi lỗi → giữ giá trị cũ kèm `battery_at` cũ.
- Sự kiện mới đọc từ executor: `STEP_RETRY`, `STEP_FAILED_HANDLED`, `EVENT_TRIGGERED` → lưu vào `run.events` như các sự kiện khác. Lượt chạy kết thúc qua nhánh pin yếu: status `COMPLETED`, `error` = "Dừng tuyến do pin yếu (15%) — đã về trạm sạc." (để bảng lượt chạy hiển thị lý do).

### 5.3 Bộ thực thi (`workflow_executor.py`)

**Phân loại lỗi**
- *Lỗi an toàn – luôn dừng lượt chạy, không theo `on_error`*: `RunCancelled`, lease/kênh điều khiển, `stop_reason` từ backend, lỗi sức khỏe từ `readiness_reason` (mất dữ liệu sức khỏe, Pi/LiDAR không sẵn sàng, encoder lỗi/cũ), sai map.
- *Lỗi điều hướng – theo `on_error` của bước*: Nav2 từ chối / không `SUCCEEDED`, hết thời gian, điểm đến không hợp lệ trên costmap, costmap cũ, chưa có / mất định vị (`Không có trạng thái định vị mới`, `Robot chưa định vị...`, `Chưa có vị trí robot trên map`).
- Cài đặt bằng hai lớp ngoại lệ (`SafetyStop`, `NavigationError`); chỗ đang `raise RuntimeError` trong `move`, `follow_route`, `future_result`, `reason()` được đổi sang lớp phù hợp.

**Thử lại**
- MOVE: chờ `retry_wait_sec` (vẫn `spin_checked`, vẫn kiểm tra pin/lease) rồi gửi lại goal. Emit `STEP_RETRY` kèm lần thử và lý do.
- Tuyến: thử lại **từ điểm đầu tiên chưa đi qua** (dựa trên tiến độ `_advance_route_progress` hiện có), không đi lại từ đầu tuyến.
- Hết lần thử: `STOP` → lượt chạy `FAILED` như nay. `CONTINUE` → MOVE: sang bước kế (theo `next_step_id`); tuyến: bỏ điểm lỗi, đi tiếp các điểm còn lại của tuyến (nếu điểm lỗi là điểm cuối thì sang bước kế). `ERROR_BRANCH` → `stop_owned_goal()`, emit `STEP_FAILED_HANDLED`, nhảy tới `on_error.next_step_id`.
- Khi nhánh lỗi chạy tới `END`, vòng hiện tại kết thúc bình thường và vòng lặp workflow (repeat) tiếp tục như cũ.

**Nhánh pin yếu**
- Trong `check_control()`: nếu plan có nhánh `LOW_BATTERY`, chưa kích hoạt trong lượt này, `battery_percent` biết được, `battery_at` mới (≤10 s) và `battery_percent < threshold_percent` → `raise LowBattery(percent)`.
- Bắt ở `execute()`: `stop_owned_goal()`, emit `EVENT_TRIGGERED` (kèm %), đánh dấu đã kích hoạt (không bắn lại), đặt `index` = bước đầu của nhánh, chạy chuỗi bước nhánh tới `END`, rồi **kết thúc lượt chạy** (bỏ các vòng repeat còn lại), emit `COMPLETED` với thông điệp pin yếu.
- Trong khi chạy nhánh pin: lỗi điều hướng vẫn theo `on_error` của các bước trong nhánh; lỗi an toàn vẫn dừng.
- Pin không đọc được (Pi offline) → không kích hoạt, không làm hỏng lượt chạy.

### 5.4 Thanh kéo pin giả lập

- Component `RobotBatterySimulator` đặt trong `PhysicalMapWorkflowRunControls` (nơi bấm chạy xe thật) và cạnh `WorkflowRunsPanel` ở tab Workflow.
- Hiển thị % hiện tại từ Pi (đọc qua proxy backend mỗi 5 s); kéo thả, **gửi khi nhả chuột**: `POST /robot/pi5/system/battery/sync` với `{percent, minutes_per_percent: <giá trị hiện tại từ Pi>}`.
- Nhãn rõ "Pin giả lập (ghi vào Pi 5)" và vạch ngưỡng 20%.
- Kiosk giữ nguyên hành vi: khi ≤20% vẫn tự thông báo và tạo yêu cầu nhân viên cắm sạc (xe thật không tạo thêm yêu cầu → không trùng).

### 5.5 Trình vẽ workflow (React Flow)

```
┌─ Thiết lập workflow ─────────────────────────────────────────────────┐
│ [Sơ đồ] [Thông tin] [Lịch & lặp]                     Lưu · Đóng       │
├──────────┬──────────────────────────────────────────┬─────────────────┤
│ + Thêm   │  ▶ Bắt đầu ──► [Đi theo tuyến ↻2] ─✓─► [Chờ] ──► ■ Kết thúc │ Cấu hình node   │
│ node     │                       │✗                 │ (form hiện có)  │
│ (bảng    │                       ▼                  │                 │
│ chọn)    │                 [Về trạm sạc]            │ ── Khi lỗi ──   │
│          │                                          │ Thử lại: [2]    │
│          │  ⚡ Khi pin < 20% ──► [Về trạm sạc]       │ Chờ: [5] giây   │
│          │                                          │ Sau đó: [Nhánh▾]│
│          │                         [minimap]        │                 │
└──────────┴──────────────────────────────────────────┴─────────────────┘
```

- Node cố định "▶ Bắt đầu" và "■ Kết thúc"; node bước dùng màu/icon theo `workflowConstants`.
- Cổng ra: mọi bước có cổng ✓ (xanh). Có thêm cổng ✗ (đỏ) khi `on_error.action = ERROR_BRANCH`. CHOICE có một cổng mỗi lựa chọn + "Hết giờ" + "Hủy".
- Node sự kiện "⚡ Khi pin < X%" chỉ có trong chế độ xe thật, tối đa 1, ngưỡng sửa trực tiếp trên node.
- Nối dây = ghi `next_step_id` / `options[i].next_step_id` / `on_error.next_step_id` / `event_branches[0].next_step_id`. Xóa dây = về `END` (hoặc hành động lỗi về `STOP` với cổng đỏ). Xóa node = xóa bước và mọi tham chiếu tới nó.
- Bấm node mở panel phải: dùng lại `WorkflowStepBlock` + mục "Khi lỗi" (chỉ MOVE/FOLLOW_ROUTE ở chế độ xe thật).
- Node có vấn đề (từ `stepSetup`, hoặc loại bước xe thật không hỗ trợ) có viền vàng + tooltip lý do.
- Workflow cũ chưa có `ui_position`: tự xếp trái→phải theo thứ tự và độ sâu nhánh; kéo node thì lưu `ui_position`.
- Logic chuyển đổi steps ⇄ nodes/edges nằm trong một module thuần (`utils/workflowGraph.js`) để test được.
- Tab "Thông tin" và "Lịch & lặp" là các panel hiện có (metadata, `WorkflowExecutionSettings`).

## 6. Kiểm thử

Người dùng không cần nhiều test; chỉ test phần lõi dễ sai:
- Backend: `physical_plan` kiểm tra `on_error`/`event_branches`, điền tọa độ trạm sạc, `resolve_route_steps` chép `on_error`.
- Executor (`robot/tests/test_workflow_executor.py`, có sẵn): thử lại MOVE, thử lại tuyến từ điểm dở, CONTINUE, ERROR_BRANCH, lỗi an toàn không thử lại, pin yếu kích hoạt đúng một lần và kết thúc lượt chạy.
- Frontend: `workflowGraph.js` chuyển đổi hai chiều không làm đổi hành vi workflow cũ.
- Chạy thử trên xe: tuyến 2 vòng, kéo pin 15% giữa chừng → robot về điểm Trạm sạc; chặn đường cho Nav2 lỗi → thấy `STEP_RETRY`.

## 7. Quyết định của Claude (người dùng có thể sửa)

1. Mặc định `on_error` = thử lại 0 lần, Dừng (giữ hành vi cũ).
2. Lỗi định vị thuộc nhóm "điều hướng" (được thử lại); lỗi encoder/sức khỏe/lease/hủy luôn dừng.
3. Lượt chạy kết thúc qua nhánh pin yếu có status `COMPLETED` kèm lý do, không thêm status mới.
4. Nhánh lỗi chạy tới `END` thì vòng lặp workflow vẫn tiếp tục; nhánh pin yếu thì kết thúc hẳn lượt chạy.
5. Ngưỡng pin cấu hình trên node, mặc định 20%.
6. Backend không tạo yêu cầu "cắm sạc" (kiosk đã tạo).
7. Thanh kéo gửi khi nhả chuột, luôn kèm `minutes_per_percent` hiện tại.

## 8. Để lại cho người làm

Tên component/file cụ thể, cách xếp node tự động, kiểu dáng node, thông điệp tiếng Việt chi tiết.
