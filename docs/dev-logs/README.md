# NHẬT KÝ PHÁT TRIỂN & BIÊN BẢN KỸ THUẬT (DEV LOGS & AUDIT ARCHIVE)

Thư mục này lưu trữ tập trung toàn bộ **nhật ký kỹ thuật (developer logs)**, **báo cáo rà soát định kỳ (technical audits)**, và **biên bản bàn giao theo từng mốc thời gian (handover & progress reports)** trong suốt quá trình nghiên cứu, phát triển và thử nghiệm hệ thống **HC-Robot (Intelligent Hotel Concierge Robot)**.

> **Lưu ý:** 
> - Các tài liệu hướng dẫn vận hành, đặc tả kiến trúc và quy chuẩn hệ thống chính thức đang hoạt động được quản lý tại:
>   - [[../01-File-Map|Bản Đồ Kiểm Kê Mã Nguồn (01-File-Map.md)]]
>   - [[../02-Architecture|Tổng Quan Kiến Trúc Hệ Thống (02-Architecture.md)]]
>   - [[../guides/hardware_architecture|Đặc Tả Phần Cứng & ROS 2 Edge]]
>   - [[../workflows/stepflow|Đặc Tả 8 Action Blocks & Kịch Bản Stepflows]]
> - Thư mục `dev-logs/` phục vụ mục đích tra cứu lịch sử quyết định kỹ thuật, đối chiếu quá trình tối ưu và truy vết log phát triển qua các phiên bản.

---

## 📅 Danh Mục Nhật Ký & Báo Cáo Theo Mốc Thời Gian

| Thời Gian | Tên Tài Liệu | Nội Dung Trọng Tâm | Phân Hệ Liên Quan |
| :--- | :--- | :--- | :--- |
| **24/10/2026** | [[slam-navigation-audit-2026-10-24|Báo Cáo Audit SLAM Navigation]] | Đánh giá độ trôi Odometry, tần số quét LiDAR A1M8, cấu hình SLAM Toolbox online async và TF tree `map -> odom -> base_link`. | ROS 2 Edge, SLAM, Hardware |
| **29/10/2026** | [[project-status-2026-10-29|Báo Cáo Tiến Độ Dự Án (29/10)]] | Tổng hợp tình trạng vận hành 3 tầng: Pi 5 sensor hub, WSL2 ROS 2 Core, Web Admin; đối chiếu thông số encoder 330 CPR và cảm biến siêu âm. | Architecture, Pi 5, ESP32 |
| **06/11/2026** | [[daily-summary-2026-11-06|Tổng Kết Công Việc (06/11)]] | Tối ưu hóa các điểm đích điều hướng (Move Targets), cơ chế phân nhánh rẽ nhánh CHOICE trong kịch bản và chu trình cảnh báo bảo vệ pin 20%/10%. | Workflow Engine, Battery Policy |
| **Tháng 11/2026** | [[ai-voice-harness-optimization-log|Nhật Ký Tối Ưu AI Voice Pipeline]] | Ghi chép quá trình chuyển dịch từ sequential blocking sang LangGraph StateGraph, tích hợp Groq LLM cascade và Audio Caching RAM/Disk. | AI Core, Voice VAD, EdgeTTS |
| **Lưu trữ** | [[workflow-handover-archive|Biên Bản Bàn Giao Kịch Bản Cũ]] | Tài liệu ghi nhận các kịch bản stepflow ban đầu trước khi chuẩn hóa sang chuẩn 8 Action Blocks và 5 kịch bản SOP Review 2. | Workflow Archive |

---

## 🔍 Hướng Dẫn Tra Cứu Cho Developer

1. **Khi gặp vấn đề về điều hướng, SLAM hoặc lệch tọa độ:** Đọc [[slam-navigation-audit-2026-10-24|slam-navigation-audit-2026-10-24.md]] để xem các bài test thực tế về ma sát bánh, drift odometry và giải pháp khắc phục bằng dynamic TF.
2. **Khi tối ưu độ trễ âm thanh và hội thoại giọng nói:** Đọc [[ai-voice-harness-optimization-log|ai-voice-harness-optimization-log.md]] kết hợp [[../ROBOT_CONVERSATION_FLOW_REPORT|ROBOT_CONVERSATION_FLOW_REPORT.md]] để nắm rõ các cạm bẫy đã được giải quyết (lỗi ngắt lời sớm, lỗi double-speech, lỗi voice Safari).
3. **Khi cần đối chiếu lại logic kịch bản ban đầu:** Đọc [[workflow-handover-archive|workflow-handover-archive.md]] và [[daily-summary-2026-11-06|daily-summary-2026-11-06.md]].
