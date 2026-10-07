# HỆ THỐNG TÀI LIỆU KỸ THUẬT HC-ROBOT (DOCUMENTATION)

Chào mừng bạn đến với trung tâm tài liệu kỹ thuật của dự án **HC-Robot**. Tất cả tài liệu hướng dẫn chuyên sâu, kiến trúc hệ thống và quy trình triển khai được chuẩn hóa và quản lý tập trung tại đây.

---

## 📑 Danh Mục Tài Liệu

### 1. Kiến Trúc & Robot ROS 2 (Hardware & Edge)
* **[Kiến Trúc Mạng ROS 2 Phân Tán (Distributed ROS 2)](guides/distributed_ros2.md)**:
  * Hướng dẫn thiết lập mạng phân tán giữa Laptop (NUC/Workstation) và Raspberry Pi 5.
  * Cấu hình CycloneDDS, VPN Tailscale, đồng bộ ROS 2 nodes, Nav2 & SLAM Toolbox.
* **[Cấu Hình Cảm Biến Siêu Âm HC-SR04 & ESP32](guides/ultrasonic_setup.md)**:
  * Sơ đồ nối dây phần cứng giữa ESP32, L298N và 4 cảm biến siêu âm HC-SR04.
  * Giao thức truyền dữ liệu Serial nhị phân/chuỗi và cơ chế an toàn tránh va chạm thời gian thực.

### 2. Trí Tuệ Nhân Tạo & Kiểm Thử (AI & Testing)
* **[Tối Ưu Hóa AI & Audio Pipeline](guides/ai_optimization.md)**:
  * Kiến trúc xử lý đa phương tiện tốc độ cao: Fast Whisper (STT), VieNeu-TTS / EdgeTTS, Ollama LLM.
  * Tối ưu hóa độ trễ xử lý Voice Conversational và luồng RAG tri thức khách sạn.
* **[Test Harness & Đánh Giá LangGraph](guides/langgraph_harness.md)**:
  * Framework kiểm thử tự động hộp đen/hộp trắng cho LangGraph Concierge State Machine.
  * Kịch bản benchmark độ chính xác định tuyến ý định (Intent Routing) và trích xuất tham số slot.
* **[Kiến Trúc Thu Thập Đánh Giá & Vòng Đời Hội Thoại (Feedback & Session Lifecycle)](guides/robot_feedback_architecture.md)**:
  * Cơ chế nút kết thúc hội thoại, Modal đánh giá 5 sao chuẩn Kiosk 3 giây.
  * Quy trình lưu trữ hội thoại End-of-Session và cảnh báo đánh giá tệ (≤ 3 sao) tới Concierge.
* **[Cơ Chế Bảo Mật Thoát Kiosk: Secret Multi-Tap Gesture (Kiosk Exit Architecture)](guides/kiosk_security_exit.md)**:
  * Quy trình ẩn hoàn toàn nút đăng xuất khỏi khách hàng (Zero-Exposure UI).
  * Cơ chế Secret Multi-Tap (Gõ 5 lần liên tiếp trong 2 giây vào Logo hoặc góc bí mật) trên Web & App Mobile.
  * Phím tắt bảo mật (`Ctrl + Shift + L` / `Escape` x3) và lớp xác thực mật khẩu nhân viên.

### 3. Kịch Bản Tương Tác & Tự Động Hóa (Workflows)
* **[Đặc Tả 7 Core Workflows (Stepflow)](workflows/stepflow.md)**:
  * Quy chuẩn chi tiết 7 kịch bản nghiệp vụ cốt lõi: Đón tiếp (Reception), Dẫn đường (Escort), Dọn phòng (Housekeeping), Gọi taxi, Phục vụ món (Room Service), Tuần tra & Phản hồi.
  * Cấu trúc khối lệnh (Action Blocks), tham số runtime và điều kiện chuyển trạng thái.
* **[Biên Bản Bàn Giao & Triển Khai Step Workflows](workflows/workflow_handover.md)**:
  * Báo cáo tiến độ triển khai tính năng Scratch-like Builder, Simulator giả lập và tích hợp cơ sở dữ liệu.

### 4. Cơ Sở Dữ Liệu & Backend (Database & Backend)
* **[Hướng Dẫn Quản Lý Database Migration Với Alembic](guides/alembic_guide.md)**:
  * Quy trình tạo, kiểm tra và chạy database migrations với Alembic & SQLAlchemy.
  * Xử lý xung đột schema, rollback và best practices khi cập nhật model PostgreSQL.

---

> 💡 **Lưu ý:** Dữ liệu tri thức khách sạn phục vụ RAG của AI Concierge được quản lý riêng tại [backend/knowledge_vault/danh_sach_co_so_vat_chat.md](../backend/knowledge_vault/danh_sach_co_so_vat_chat.md).
