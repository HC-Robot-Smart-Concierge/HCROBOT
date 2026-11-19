# Thiết kế: Đồng bộ xe thật và màn hình — tuần tra, gặp khách thì dừng trò chuyện rồi đi tiếp

Ngày: 2026-11-18 · Trạng thái: chờ duyệt · Dựa trên: `2026-11-18-robot-workflow-error-battery-canvas-design.md` (đã làm xong)

## 1. Mục đích

Hiện xe thật (backend + bộ thực thi ROS trong WSL) và màn hình robot (kiosk, trình duyệt trên điện thoại/tablet) chạy độc lập: xe đi tuyến không biết có khách; màn hình không biết xe đang đi; khi màn hình chạy kịch bản thì tín hiệu camera "khách lại gần" bị bỏ qua.

Mục tiêu: hai phần hoạt động như **một con robot** cho kịch bản demo: robot đi tuần theo tuyến, vừa đi vừa phát quảng cáo; camera thấy khách thì xe dừng, màn hình trò chuyện AI như khi đứng ở sảnh; xong thì xe đi tiếp từ điểm đang dở; pin yếu vẫn về trạm sạc.

## 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu (người dùng đã chốt)**
1. Node **"👤 Khi gặp khách"** trên canvas (chỉ chế độ xe thật, không nối dây, xong luôn quay lại tuyến). Cấu hình trên node: không tương tác **20 s** thì đi tiếp; tối đa **180 s**; sau khi đi tiếp **60 s** không chào khách mới.
2. Phần trò chuyện là **phiên AI sẵn có** của màn hình (phương án A). Xe đi tiếp khi: camera thấy khách đi khỏi, **hoặc** 20 s không tương tác, **hoặc** chạm 180 s.
3. Khi xe đang đi tuần và không có khách: màn hình mở **trình phát quảng cáo Cloudinary** sẵn có (`RobotAdPlayer`).
4. Màn hình hiện **dải trạng thái** lượt chạy: "Đang tuần tra · điểm 3/6", "Đang thử lại…", "Dừng chờ khách", "Đang về trạm sạc".
5. Pin yếu lúc đang trò chuyện: từ **10 % tới dưới ngưỡng nhánh** (mặc định 20 %) thì chờ khách xong rồi mới về sạc; **dưới 10 %** về sạc ngay.
6. Camera nhận nhầm khi xe chạy: xe dừng, 20 s không tương tác thì tự đi tiếp.
7. Admin bấm Dừng lúc đang trò chuyện: dừng hẳn lượt chạy như hiện nay.

**Không làm**
- Xe thật dẫn khách tới nơi (người dùng chọn (a)): dẫn đường vẫn chỉ hiện bản đồ/QR trên màn hình.
- Màn hình chạy các bước SPEAK/SHOW/CHOICE theo lệnh xe thật; kịch bản chào cố định trước khi trò chuyện.
- Quay xe về phía khách; nhận diện bằng camera khác ngoài camera màn hình.
- Gặp khách khi **không** có lượt chạy xe thật (màn hình vẫn hoạt động như hiện nay).

**Thất bại nếu (dù chạy được)**
- Xe tiếp tục chạy khi khách đang nói chuyện (trước khi hết 20 s im lặng/khách đi/180 s).
- Xe đứng chờ mãi khi màn hình tắt, mất mạng hoặc trình duyệt bị đóng.
- Một khách đứng trước robot bị chào lặp lại liên tục.
- Khi đi tiếp, robot chạy lại từ đầu tuyến thay vì điểm đang dở.
- Màn hình tạo yêu cầu/hiện trạng thái khi không có lượt chạy xe thật nào.

## 3. Ràng buộc từ hệ thống hiện có

- Nguyên tắc sẵn có: trình duyệt không điều khiển xe (`workflow_runtime.py` docstring). Mọi lệnh tới xe đi qua backend → file điều khiển (`*.control.json`, backend ghi mỗi giây, executor đọc mỗi ~0,1 s).
- Executor: `FlowPolicyMixin` (`workflow_flow.py`) chạy từng bước; `_abandon_goal()` hủy goal + chờ 1 s; tuyến lỗi chạy lại từ điểm chưa đi qua (`self.index` theo `_advance_route_progress`). `check_control()` đã đọc `battery_percent/battery_at` và ném `LowBattery`.
- Nhánh sự kiện hiện có: `execution_config.event_branches` (Pydantic `WorkflowEventBranch`: `event: Literal["LOW_BATTERY"]`, `next_step_id` bắt buộc, `max_length=1`); frontend `workflowGraph.js` dùng `branchOf(wf) = event_branches[0]` và node `__battery`.
- Backend → màn hình: `notification_manager.broadcast_to_department(None, {...})` qua `/api/v1/operations/ws/notifications`; màn hình nghe bằng `useNotificationWebSocket` (`onNotificationReceived`, `onWorkflowDispatch`).
- Màn hình: `handleGuestApproached` / `handleGuestLeft` (camera, `CameraPreview`), `guestPresent`, `lastInteractionTimeRef` (cập nhật khi khách nói/chạm), tự về chờ sau 30 s im lặng, `RobotAdPlayer isOpen={isStandby && !isWorkflowRunning && !guestPresent}`, quy tắc pin `useLowBatteryGuard` (≤20 % không nhận khách mới, ≤10 % ngắt phiên).
- Quy tắc người dùng: **file mới ≤ 500 dòng**; file cũ (kể cả `RobotScreenPage.jsx` ~4100 dòng) sửa trực tiếp được; **không commit**.

## 4. Phương án

| Cách nối màn hình ↔ xe | Đánh đổi | Chọn |
|---|---|---|
| **Backend trung chuyển**: màn hình gọi REST báo khách → backend ghi `guest_hold_until` vào file điều khiển; backend phát trạng thái lượt chạy qua WebSocket sẵn có | Đúng nguyên tắc "trình duyệt không điều khiển xe"; dùng lại file điều khiển, lease, WebSocket; lượt chạy được ghi lại | **Chọn (một hướng hợp lý)** |
| Màn hình nói thẳng với ROS qua rosbridge | Trái nguyên tắc; backend không ghi nhận; điện thoại phải tới được rosbridge trên laptop | Loại |
| Executor tự hỏi backend qua HTTP | Kênh thứ hai trùng việc với file điều khiển | Loại |

| Phần trò chuyện | Chọn |
|---|---|
| **(A) Phiên AI sẵn có**, đi tiếp khi khách đi/20 s im lặng/180 s | **Người dùng chọn** |
| (B) Kịch bản cố định trên canvas · (C) Kết hợp | Không chọn |

Dẫn đường khi trò chuyện: **(a) chỉ bản đồ/QR** — người dùng chọn.

## 5. Thiết kế

### 5.1 Dữ liệu

```jsonc
"execution_config": {
  "event_branches": [
    { "event": "LOW_BATTERY", "threshold_percent": 20, "next_step_id": "go-charger" },
    { "event": "GUEST_DETECTED", "idle_timeout_sec": 20, "max_duration_sec": 180,
      "cooldown_sec": 60, "ui_position": { "x": 0, "y": 520 } }
  ]
}
```
- `WorkflowEventBranch`: `event: Literal["LOW_BATTERY","GUEST_DETECTED"]`; `next_step_id` bắt buộc cho `LOW_BATTERY`, bỏ qua cho `GUEST_DETECTED`; `idle_timeout_sec` 5–120 (mặc định 20), `max_duration_sec` 30–600 (180), `cooldown_sec` 0–600 (60). Danh sách tối đa 2, mỗi `event` tối đa một lần.

### 5.2 Màn hình → backend: báo khách

`POST /api/v1/workflows/runs/guest` body `{ "robot_id": "RC-001", "state": "ENGAGED" | "DONE", "idle_ms": <ms từ tương tác gần nhất> }` → `{ "accepted": bool, "run_id": str|null }`.
- Backend chỉ nhận khi có lượt chạy **RUNNING** của robot đó mà plan có nhánh `GUEST_DETECTED`; ngược lại `accepted: false` (không lỗi).
- `ENGAGED`: `guest_hold_until = now − idle_ms/1000 + idle_timeout_sec`; ghi `guest_since` nếu đang trống.
- `DONE`: xóa giữ (`guest_hold_until = None`).
- Lưu trong item `WorkflowRuntime.running[run_id]['guest']`; `refresh_control` thêm `guest_hold_until`, `guest_since` (epoch giây) vào file điều khiển. Mất màn hình → không còn `ENGAGED` → giữ tự hết sau `idle_timeout_sec`.

Màn hình (hook mới `useRobotRunSync`):
- Chỉ gửi khi đang có lượt chạy xe thật có nhánh gặp khách (biết qua trạng thái ở 5.4).
- Khách lại gần (`handleGuestApproached`) → `ENGAGED` ngay; sau đó mỗi 3 s gửi `ENGAGED` kèm `idle_ms` từ `lastInteractionTimeRef` khi `guestPresent` hoặc tương tác trong 20 s qua.
- `handleGuestLeft` → `DONE` ngay.
- Màn hình vẫn trò chuyện với khách như hiện nay trong mọi trường hợp (kể cả lúc cooldown); pin yếu vẫn chặn phiên mới như hiện nay. Cooldown chỉ do executor áp dụng: trong cooldown xe **không dừng** dù nhận `ENGAGED`; hết cooldown mà khách vẫn tương tác thì xe dừng.

### 5.3 Bộ thực thi

- `check_control()`: nếu có nhánh `GUEST_DETECTED`, đã armed, không trong cooldown, chưa đang giữ, và `now < guest_hold_until` → ném `GuestHold`.
- `GuestHold` có thể ném ra ở bất kỳ `check_control` nào: khi gửi goal, trong lúc chờ thử lại (`_retry_wait`) hay chờ lệnh hủy lắng (`_settle_after_cancel`). Đặt cờ `guest_holding` trước khi ném để không ném lại trong lúc giữ.
- `_run_step_with_policy` bắt `GuestHold` ở cấp cả vòng lặp (không tính là lần thử, giữ nguyên số lần thử đã dùng): `_abandon_goal()`, emit `GUEST_HOLD`, gọi `_hold_for_guest()`, rồi chạy lại **đúng bước đó từ điểm đang dở** (với tuyến: `self.index` hiện tại).
- `_hold_for_guest()`: spin + `check_control` (vẫn dừng ngay khi hủy/mất lease/lỗi an toàn) cho tới khi `now ≥ guest_hold_until` hoặc hết `max_duration_sec` kể từ `guest_since`; emit `GUEST_RESUME` (kèm lý do: khách đi/hết im lặng/hết 180 s); đặt `guest_cooldown_until = now + cooldown_sec`.
- Pin trong lúc giữ (`guest_holding`): bỏ qua nhánh pin khi `percent ≥ 10`; khi `< 10` ném `LowBattery` ngay. Sau khi giữ kết thúc, kiểm tra pin bình thường (nhánh pin chạy trước khi đi tiếp tuyến).
- Bước WAIT gặp khách: giữ rồi chạy lại phần còn lại của WAIT (đơn giản: chạy lại WAIT đủ thời gian).
- Đang chạy nhánh pin (về sạc): không giữ cho khách.

### 5.4 Backend → màn hình: trạng thái lượt chạy

- Trong `monitor()`, sau khi đọc sự kiện mới: nếu trạng thái hiển thị đổi thì `broadcast_to_department(None, {"type": "ROBOT_RUN_STATUS", "robot_id", "run_id", "workflow_name", "status", "phase", "step_title", "step_index", "total_steps", "guest_mode", "guest_cooldown_until"})`.
- `phase` ∈ `MOVING | RETRYING | GUEST_HOLD | CHARGING | DONE` suy ra từ sự kiện cuối (`STEP_STARTED` → MOVING, `STEP_RETRY` → RETRYING, `GUEST_HOLD` → GUEST_HOLD, `EVENT_TRIGGERED` → CHARGING, trạng thái kết thúc → DONE).
- Gửi lại trạng thái hiện tại mỗi 10 s khi đang chạy (màn hình mới mở vẫn nhận được).

### 5.5 Màn hình

- `useRobotRunSync` (file mới): nghe `ROBOT_RUN_STATUS`, giữ `run` hiện tại (hết hạn nếu 25 s không nhận), gửi báo khách (5.2).
- `RobotRunStatusBar.jsx` (file mới): dải trạng thái nhỏ phía trên màn hình khi có `run` đang chạy.
- Quảng cáo: khi `run.phase === 'MOVING' | 'RETRYING'` và không có khách → mở `RobotAdPlayer` (thêm điều kiện vào `isOpen`, không đổi hành vi khi không có lượt chạy).
- `RobotScreenPage.jsx` (file cũ): chỉ thêm việc gọi hook, gắn status bar, nối `handleGuestApproached/handleGuestLeft` và điều kiện quảng cáo.

### 5.6 Canvas

- `workflowGraph.js`: nhánh theo `event` (`branchOf(wf, event)`), node `__guest` (không cổng ra). Palette (chế độ xe thật): "👤 Khi gặp khách" khi chưa có. Panel phải: 3 ô số (20/180/60) và nút xóa. Node hiển thị tóm tắt "Dừng trò chuyện · 20 s im lặng · tối đa 180 s".
- Lưu workflow: backend kiểm tra giới hạn ở 5.1.

## 6. Kiểm thử (tối thiểu, phần lõi)

- Executor: giữ khi có khách → hủy goal, không gửi goal mới khi đang giữ, đi tiếp từ đúng điểm tuyến; hết im lặng/hết 180 s → đi tiếp; cooldown chặn giữ mới; hủy/lỗi an toàn khi đang giữ → dừng; pin ≥10 % chờ, <10 % về sạc ngay; khi giữ ở bước WAIT.
- Backend: endpoint nhận/không nhận (không có lượt chạy, không có nhánh); `ENGAGED` tính `guest_hold_until`; `DONE` xóa; trường vào file điều khiển; schema nhánh (giới hạn, trùng event, LOW_BATTERY cần next_step_id); `ROBOT_RUN_STATUS` phát khi đổi phase.
- Frontend: `workflowGraph` với node khách (thêm/xóa/không cạnh); hàm thuần trong `useRobotRunSync` (khi nào gửi ENGAGED/DONE, hết hạn run).
- Chạy thử trên xe (bước tay): tuyến 2 vòng, đứng trước camera giữa tuyến → xe dừng, nói chuyện, đi khỏi → xe đi tiếp từ điểm dở; im lặng 20 s → đi tiếp; kéo pin 15 % khi đang nói → chờ xong mới về sạc; 8 % → về ngay.

## 7. Quyết định của Claude (người dùng có thể sửa)

1. Giữ xe bằng **"hạn giữ"** (`guest_hold_until`) mà màn hình gia hạn mỗi 3 s — màn hình chết thì xe tự đi tiếp sau 20 s, không đứng chờ mãi.
2. Khách lại gần lúc đang **cooldown** 60 s: màn hình vẫn trò chuyện bình thường nhưng **xe không dừng**.
3. Bước WAIT bị khách làm gián đoạn được chạy lại đủ thời gian.
4. Trạng thái được phát lại mỗi 10 s; màn hình bỏ trạng thái nếu 25 s không nhận.
5. Endpoint báo khách không cần đăng nhập (giống các endpoint workflow hiện tại), chỉ tác động lên lượt chạy đang RUNNING có nhánh khách.
6. Đang về trạm sạc thì không dừng cho khách.

## 8. Để lại cho người làm

Kiểu dáng status bar/node, thông điệp tiếng Việt chi tiết, tên hàm nội bộ.
