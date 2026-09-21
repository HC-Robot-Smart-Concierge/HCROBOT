# BÁO CÁO TIẾN ĐỘ & TÀI LIỆU TIẾP TỤC DỰ ÁN WORKFLOW
*Ngày cập nhật: 20/09/2026 • Trạng thái: Sẵn sàng thực thi giai đoạn tiếp theo*

---

## 1. TỔNG QUAN CÔNG VIỆC ĐÃ HOÀN THÀNH

### ✅ Backend & Cơ Sở Dữ Liệu (PostgreSQL)
- **Đã nạp 100% vào CSDL:** Toàn bộ **7 Core Workflows** (theo tài liệu `Stepflow.md`) đã được nạp thành công vào bảng `robot_workflows` trên PostgreSQL.
- **Tách file chuẩn kiến trúc (< 400 dòng):**
  - `backend/app/api/v1/endpoints/workflows.py`: **147 dòng** (Router điều phối API).
  - `backend/app/api/v1/endpoints/default_workflows.py`: **381 dòng** (Dữ liệu tĩnh nạp sẵn 7 Core Workflows).

### ✅ Frontend (Admin Portal - Step Workflows)
- **Chuẩn hóa kiến trúc trực tiếp vào `AdminWorkflowTab`:**
  - Không tạo menu/folder ngoài lề, toàn bộ tính năng tập trung tại tab `Step Workflows`.
  - Giữ nguyên xuất khẩu `OTTO_STEP_TYPES` tương thích 100% với các unit test và panel khác.
- **Bộ dựng khối lệnh kiểu Scratch (`WorkflowBuilderModal` & `WorkflowStepBlock`):**
  - Bấm **"Chỉnh sửa"** hoặc **"+ Tạo kịch bản mới"** để mở giao diện khối lệnh.
  - Mỗi bước (`MOVE`, `GREET`, `SPEAK`, `SHOW`, `LISTEN`, `RECOMMEND`, `CREATE_REQUEST`, `FEEDBACK`) được thiết kế dạng khối màu Scratch kèm khớp nối.
  - **Điền tham số trực tiếp (Inline Inputs):** Sửa câu chào, chọn điểm đến, đổi màu LED, chỉnh tốc độ đọc ngay trên các ô trắng dạng viên thuốc (White Pill) của khối lệnh.
- **Trình Giả Lập Robot Tương Tác Sống Động (`WorkflowSimulatorModal`):**
  - Bấm **"▶ Chạy thử"** để chạy chu trình tuần tự (Game-like Simulator).
  - **Mặt Robot (`RobotFace`):** Tự động cử động mắt, chớp mắt, mỉm cười khi `GREET`, mở to khi `SPEAK`, đổi viền LED.
  - **Loa Laptop:** Cất tiếng phát âm thanh tiếng Việt Hoài My thật qua `useSpeechSynthesis` (EdgeTTS / Web Speech).
  - **Màn hình Kiosk:** Hiển thị thực đơn ẩm thực, bảng chọn ngôn ngữ, sóng âm lắng nghe, và **widget 5 sao tương tác click được** cho bước `FEEDBACK`.
  - **Thanh điều khiển:** Tạm dừng, Next Step, Tắt/Bật loa, Đổi tốc độ 1x/1.5x/2x.

---

## 2. KIỂM SOÁT RÀNG BUỘC KỸ THUẬT (< 400 DÒNG & 0 COMMIT)

Tất cả các file đều được module hóa sạch sẽ, code dễ hiểu và **tuyệt đối dưới 400 dòng**:

| Tập Tin | Số Dòng | Mục Đích |
| :--- | :---: | :--- |
| `backend/app/api/v1/endpoints/workflows.py` | **147** | API Endpoints: CRUD kịch bản và chạy test |
| `backend/app/api/v1/endpoints/default_workflows.py` | **381** | Định nghĩa dữ liệu gốc 7 Core Workflows |
| `frontend/src/pages/admin/tabs/AdminWorkflowTab.jsx` | **333** | Tab chính: Danh sách thẻ kịch bản & điều phối modal |
| `frontend/src/pages/admin/tabs/workflow/WorkflowStepBlock.jsx` | **316** | Khối lệnh Scratch với ô điền tham số inline |
| `frontend/src/pages/admin/tabs/workflow/WorkflowSimulatorModal.jsx` | **227** | Modal giả lập: Mặt robot, loa laptop, timeline |
| `frontend/src/pages/admin/tabs/workflow/KioskDisplayPreview.jsx` | **220** | Màn hình Kiosk: Menu, ngôn ngữ, đánh giá 5 sao |
| `frontend/src/pages/admin/tabs/workflow/WorkflowBuilderModal.jsx` | **168** | Modal chỉnh sửa kịch bản dạng khối lệnh |
| `frontend/src/pages/admin/tabs/workflow/workflowConstants.js` | **101** | Hằng số 8 bước Otto & màu sắc Scratch theme |
| `frontend/src/pages/admin/tabs/AdminRobotControlTab.jsx` | **61** | Điều hướng tab con trong Robot Control |

> **Ràng buộc Git:** `0 commit`, `0 push` — Toàn bộ mã nguồn được giữ nguyên ở local workspace.

---

## 3. DANH SÁCH WORKFLOW HIỆN CÓ TRONG CSDL POSTGRESQL

```text
1. [wf-01-welcome]       Workflow 1: Đón tiếp và Chào mừng khách chủ động (5 steps)
   MOVE -> GREET -> SHOW -> LISTEN -> SHOW
2. [wf-02-recommend]     Workflow 2: Gợi ý và Tư vấn dịch vụ thông minh (5 steps)
   SHOW -> LISTEN -> RECOMMEND -> SHOW -> SPEAK
3. [wf-03-room-service]  Workflow 3: Đặt dịch vụ buồng phòng / Gọi xe (5 steps)
   SHOW -> LISTEN -> CREATE_REQUEST -> SPEAK -> SHOW
4. [wf-04-call-staff]    Workflow 4: Nhờ nhân viên hỗ trợ khẩn cấp (Call Staff) (3 steps)
   SPEAK -> CREATE_REQUEST -> SHOW
5. [wf-05-feedback]      Workflow 5: Đánh giá và Kết thúc phiên (4 steps)
   SHOW -> FEEDBACK -> SPEAK -> MOVE
6. [wf-06-idle-promo]    Workflow 6: Chế độ rảnh và Chiếu quảng cáo (2 steps)
   MOVE -> SHOW
7. [wf-07-guide-tour]    Workflow 7: Chỉ đường và Dẫn khách đến tiện ích (5 steps)
   SHOW -> SPEAK -> MOVE -> SPEAK -> MOVE
```

---

## 4. KẾ HOẠCH CÔNG VIỆC CHO NGÀY MAI (ACTION ITEMS)

Khi quay lại vào ngày mai, bạn và Agent có thể chọn tiếp tục các mục sau:

1. **Kiểm thử chi tiết 4 workflow còn lại trên Simulator:**
   - Chạy thử `wf-03-room-service`: Kiểm tra xem form yêu cầu buồng phòng và thông báo ticket dispatch hoạt động thế nào.
   - Chạy thử `wf-04-call-staff`: Kiểm tra cảnh báo khẩn cấp gọi nhân viên trực sảnh.
   - Chạy thử `wf-06-idle-promo`: Kiểm tra chế độ rảnh chiếu poster khuyến mại.
   - Chạy thử `wf-07-guide-tour`: Kiểm tra kịch bản dẫn khách đến nhà hàng và quay về quầy sạc.
2. **Tích hợp bản đồ 2D mini cho bước `MOVE` (Nếu muốn):**
   - Khi bước `MOVE` kích hoạt, hiển thị một sơ đồ sảnh 2D thu nhỏ có chấm icon robot di chuyển mượt mà giữa các Waypoint (`Quầy Lễ Tân` $\rightarrow$ `Bàn VIP` $\rightarrow$ `Thang máy`).
3. **Kết nối Dispatching sang Raspberry Pi 5 (Khi có phần cứng):**
   - Đấu nối endpoint `/execute` gửi lệnh JSON tuần tự qua WebSocket / MQTT / ROS2 sang Pi5 khi robot thật sẵn sàng.

---

## 5. HƯỚNG DẪN KHỞI ĐỘNG NHANH CHO NGÀY MAI

```bash
# 1. Khởi động Backend (FastAPI + PostgreSQL)
cd "d:\FPT MATERIALS\9th Semeter (Final)\HCROBOT\backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 2. Khởi động Frontend (Vite React)
cd "d:\FPT MATERIALS\9th Semeter (Final)\HCROBOT\frontend"
npm run dev

# 3. Mở trình duyệt:
# Truy cập: http://localhost:5173/admin
# Vào mục "Robot Control" -> chọn tab "Quản Lý Step Workflows" để trải nghiệm!
```
