# Thiết kế: Trình vẽ workflow kiểu n8n (đợt 1 – chỉ giao diện)

Ngày: 2026-11-20 · Trạng thái: chờ duyệt · Kế thừa: bản thiết kế 2026-11-18 (đã duyệt, nằm trong commit `1ae7114`, bị gỡ khi revert về `82e87e5`)

## 1. Mục đích

Admin cần **vẽ được luồng có rẽ nhánh** thay vì danh sách bước + form. Nhánh quan trọng nhất:
**pin giả lập dưới 20% → bỏ dở việc đang làm → về trạm sạc gần nhất.**

Đợt 1 chỉ làm giao diện vẽ và lưu. Xe thật **chạy** nhánh pin yếu là đợt 2.

## 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu**
1. Trình sửa workflow là canvas node kiểu n8n: kéo thả node, nối dây, zoom, bản đồ thu nhỏ, node ▶ Bắt đầu / ■ Kết thúc, bảng thêm node.
2. CHOICE có một cổng ra cho mỗi lựa chọn + "Hết giờ" + "Hủy" (kiosk đã chạy được các nhánh này).
3. Workflow chế độ xe thật có tối đa một node sự kiện **"⚡ Khi pin < X%"** (mặc định 20, sửa trên node, 5–90).
4. Có node **"Về trạm sạc gần nhất"** để nối sau node pin yếu.
5. Lưu workflow giữ nguyên nhánh pin yếu và vị trí node.

**Không làm (đợt 1)**
- Không sửa bất kỳ file nào trong `robot/` (tránh ảnh hưởng LiDAR, định vị, quét map).
- Xe thật chạy nhánh pin yếu và chọn trạm sạc gần nhất (đợt 2).
- Thanh kéo pin giả lập (đợt 2, khi xe đã chạy được nhánh).
- Cài đặt lỗi từng bước (thử lại / nhánh lỗi ✗), nhánh "gặp khách", thanh trạng thái lượt chạy trên màn robot.

**Thất bại nếu (dù chạy được)**
- Workflow cũ mở ra rồi lưu lại mà chạy khác đi (kiosk hoặc xe thật).
- Bấm lưu làm mất nhánh pin yếu.
- Workflow có nhánh pin yếu chạy trên xe thật mà xe làm sai thay vì bị chặn với lý do rõ ràng.
- Có thay đổi lọt vào thư mục `robot/`.

## 3. Ràng buộc từ hệ thống hiện có

- Dữ liệu workflow là danh sách phẳng + `params.next_step_id` (rỗng = bước kế, `END` = kết thúc). Kiosk (`utils/workflowFlow.js`) và bộ thực thi xe thật (`workflow_executor.py`, đi theo `next_step_id`) dùng chung quy ước này.
- Pydantic bỏ trường lạ: `WorkflowExecutionConfig` phải khai báo `event_branches`, nếu không backend xóa nhánh khi lưu.
- `physical_plan` hiện tại từ chối MOVE không có `map_id`/tọa độ → bước "Về trạm sạc gần nhất" (chưa có tọa độ) làm lượt chạy xe thật bị từ chối, xe không chạy.
- Trạm sạc là điểm `endpoints` loại `CHARGER` (dữ liệu cũ: `dock`) trên Physical Map.
- Frontend: React 18 + Tailwind, test bằng Vitest. File mới ≤ 500 dòng.

## 4. Phương án đã cân nhắc

| Phương án | Đánh đổi | Chọn |
|---|---|---|
| **A. Lấy lại có chọn lọc từ `1ae7114`: canvas + schema backend, không lấy code robot** | Nhanh, đã theo thiết kế 18/11; phải tách cẩn thận | **Người dùng chọn** – sợ code robot của `1ae7114` làm hư LiDAR/định vị |
| B. Lấy lại cả chuỗi (giao diện + backend + bộ thực thi + thanh pin) | Xe chạy thử nhánh sớm hơn; đụng lại code robot vừa revert | |
| C. Làm canvas mới | Không lợi gì thêm, tốn công | |

Thư viện canvas: `@xyflow/react` 12.12.1 (đã chọn ở thiết kế 18/11).

## 5. Thiết kế

### 5.1 Lấy lại từ `1ae7114` (frontend)
- `workflow/canvas/WorkflowCanvas.jsx`, `WorkflowCanvasNodes.jsx`, `NodePalette.jsx`
- `utils/workflowGraph.js` (chuyển steps ⇄ nodes/edges, xếp node tự động, nối/xóa dây)
- `workflow/WorkflowBuilderModal.jsx` (bản canvas: tab Sơ đồ / Thông tin / Lịch & lặp), `WorkflowMetaPanel.jsx`, `useWorkflowEditing.js`
- Phần liên quan trong `AdminWorkflowTab.jsx` và `utils/workflowExecution.js` (`isChargerMove`)
- `package.json` / `package-lock.json`: `@xyflow/react` 12.12.1
- Test: `WorkflowBuilderSetup.test.jsx`, `workflowExecution.test.js` (phần liên quan), test cho `workflowGraph.js`

**Bỏ khi lấy lại:** mọi phần "gặp khách" (`GUEST`, `addGuestBranch`…), `StepErrorSettings` và cổng lỗi ✗, `RobotBatterySimulator`, `RobotRunStatusBar`, `useRobotRunSync`/`robotRunSync`, `robotRunApi`/`robotBatteryApi`.

### 5.2 Backend
- `schemas/workflow.py`: thêm `WorkflowEventBranch` (chỉ `LOW_BATTERY`: `threshold_percent` 5–90 mặc định 20, `next_step_id` bắt buộc, `ui_position`) và `execution_config.event_branches` (tối đa 1).
- Không sửa `workflow_plan.py` / `workflow_runtime.py` ngoài mức cần để lưu được.

### 5.3 Node "Về trạm sạc gần nhất"
- Lưu dưới dạng bước MOVE với `params.target_type = "CHARGER"`, **không** có tọa độ, tiêu đề "Về trạm sạc gần nhất".
- Ý nghĩa (để đợt 2 cài): lúc nhánh kích hoạt, chọn điểm `CHARGER`/`dock` cùng map gần vị trí xe nhất (khoảng cách đường thẳng).
- Panel cấu hình của node chỉ hiện ghi chú "Trạm sạc gần nhất được chọn lúc chạy", không có ô chọn waypoint.

### 5.4 Chạy xe thật trong đợt 1
- Workflow chế độ xe thật có nhánh pin yếu → nút chạy bị chặn ở frontend (`executionError`) với lý do: "Nhánh pin yếu chưa chạy được trên xe thật (đợt 2). Gỡ nhánh để chạy."
- Workflow không có nhánh pin yếu chạy như hiện tại.

### 5.5 Giao diện (giữ như thiết kế 18/11, bỏ phần lỗi)
```
┌─ Thiết lập workflow ─────────────────────────────────────────────────┐
│ [Sơ đồ] [Thông tin] [Lịch & lặp]                     Lưu · Đóng       │
├──────────┬──────────────────────────────────────────┬─────────────────┤
│ + Thêm   │  ▶ Bắt đầu ──► [Đi theo tuyến ↻2] ──► ■ Kết thúc │ Cấu hình node │
│ node     │                                          │ (form hiện có)  │
│          │  ⚡ Khi pin < 20% ──► [Về trạm sạc gần nhất] │                 │
│          │                              [minimap]   │                 │
└──────────┴──────────────────────────────────────────┴─────────────────┘
```
- Mọi bước được ghi `next_step_id` tường minh khi lưu, nên bước chỉ thuộc nhánh pin không bao giờ bị chạy "rơi" từ bước đứng trước.
- Workflow cũ chưa có `ui_position` được tự xếp trái → phải; kéo node thì lưu vị trí.
- Node có vấn đề (`stepSetup`, hoặc loại bước xe thật chưa hỗ trợ) có viền vàng + lý do.

## 6. Kiểm thử
- `frontend/src/utils/__tests__/workflowGraph.test.js` (ngày 18/11) **vẫn còn trên máy** vì `**/__tests__/` bị gitignore; dùng lại, bỏ các ca "gặp khách". Khi commit cần `git add -f`.
- `workflowGraph.js`: chuyển đổi hai chiều không đổi hành vi workflow cũ; nối/xóa dây; xóa node gỡ mọi tham chiếu; nhánh pin yếu tối đa 1.
- Backend: lưu rồi đọc lại giữ `event_branches`; từ chối ngưỡng ngoài 5–90 và nhánh pin không có bước đích.
- `executionError` chặn chạy xe thật khi có nhánh pin yếu.
- Kiểm tra bằng mắt trên trình duyệt: mở workflow cũ, vẽ nhánh pin, lưu, mở lại.
- `git diff --stat -- robot/` phải rỗng.

## 7. Quyết định của Claude (người dùng có thể sửa)
1. Không đưa cài đặt lỗi từng bước / cổng ✗ vào đợt 1 (xe chưa chạy được, người dùng chưa yêu cầu).
2. Không đưa thanh pin giả lập vào đợt 1; làm cùng đợt 2.
3. "Gần nhất" = khoảng cách đường thẳng từ vị trí xe lúc pin tụt, trong các trạm sạc cùng map.
4. Đợt 1 chặn chạy xe thật khi workflow có nhánh pin yếu, thay vì bỏ qua nhánh.
5. Node pin yếu chỉ có ở chế độ xe thật (kiosk đã tự xử lý pin ≤ 20% bằng workflow riêng).

## 8. Để lại cho người làm
Cách tách code từ `1ae7114`, tên test, kiểu dáng node, câu chữ tiếng Việt chi tiết.
