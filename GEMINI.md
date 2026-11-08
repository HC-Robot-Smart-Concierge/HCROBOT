# HC-ROBOT — WORKSPACE RULES & CODING GUIDELINES

## NGUYÊN TẮC THƯỜNG TRỰC KHI LẬP TRÌNH

1. **Đúng phạm vi và tiêu chí hoàn thành:**
   - Làm đúng yêu cầu và tiêu chí hoàn thành. Không tự thêm tính năng, đổi UI, đổi kiến trúc hoặc refactor ngoài phạm vi cần thiết.
   - Giữ tương thích với hành vi hiện có ngoài phần được yêu cầu thay đổi.

2. **Tìm hiểu trước khi sửa (Grounded & Non-destructive):**
   - Trước khi sửa, đọc code liên quan, kiểm tra `git status` và `git diff` để hiểu thay đổi đang có.
   - Không ghi đè hoặc hoàn tác công việc của người khác.
   - Tìm nguyên nhân dựa trên code, log hoặc khả năng tái hiện. Phân biệt rõ điều đã xác nhận với giả thuyết.

3. **Tối giản & Đầy đủ (Simplicity & Correctness):**
   - Chọn thay đổi đơn giản nhất đáp ứng đầy đủ yêu cầu và các trường hợp lỗi thực tế. Không đánh đổi tính đúng đắn chỉ để giảm số dòng.
   - Tái sử dụng cơ chế và quy ước hiện có nếu phù hợp. Trước khi thêm helper, state, listener, service hoặc dependency, kiểm tra xem đã có chức năng tương đương chưa.
   - Chỉ tạo abstraction khi có nhu cầu cụ thể. Không thêm lớp trung gian hoặc cấu hình để phục vụ tình huống giả định.

4. **Xử lý lỗi trung thực (Honest Error Handling):**
   - Không thêm retry, fallback, timeout, cache hoặc cờ trạng thái chỉ để che lỗi chưa hiểu. Nếu cần, giải thích tình huống kích hoạt, giới hạn và cách kết thúc.
   - Không nuốt lỗi hoặc trả kết quả thành công giả.
   - Giữ đủ thông tin để chẩn đoán, không log dữ liệu nhạy cảm.

5. **Quyền tự quyết & Giao tiếp:**
   - Tự xử lý các lựa chọn kỹ thuật thông thường. Chỉ hỏi khi thiếu thông tin ảnh hưởng đáng kể đến kết quả hoặc cần thao tác phá hủy, triển khai hay thay đổi dữ liệu thật.
   - Trả lời bằng tiếng Việt, ngắn gọn.
   - Không tạo báo cáo hoặc tài liệu mới sau mỗi lần sửa trừ khi được yêu cầu hoặc dự án bắt buộc.

6. **Bảo toàn phạm vi phần cứng & hệ thống:**
   - Tuyệt đối không can thiệp vào thư mục `/robot`, ROS 2 packages, firmware ESP32, motor, LiDAR, cảm biến, bản đồ hoặc thuật toán điều hướng POI trừ khi có yêu cầu chuyên biệt cho phần đó.

