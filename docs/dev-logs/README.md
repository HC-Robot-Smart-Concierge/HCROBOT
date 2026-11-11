# QUY CHUẨN VÀ HƯỚNG DẪN GHI CHÉP NHẬT KÝ PHÁT TRIỂN (DEVLOG GUIDE)

Thư mục này được sử dụng làm không gian lưu trữ các bản ghi nhật ký phát triển (developer logs), ghi chú thử nghiệm kỹ thuật (experimental notes), biên bản debug sự cố (debugging post-mortems) và báo cáo kiểm thử định kỳ của đội ngũ kỹ thuật dự án **HC-Robot (Intelligent Hotel Concierge Robot)**.

---

## 1. Mục Đích Của Thư Mục Devlog

1. **Lưu vết tiến trình kỹ thuật:** Ghi lại quá trình giải quyết các bài toán phức tạp (như điều chỉnh thuật toán SLAM, tối ưu hóa độ trễ âm thanh Web Audio, cấu hình mạng ROS 2 phân tán qua Tailscale).
2. **Lưu giữ quyết định thiết kế (Design Decisions):** Ghi rõ lý do chọn hoặc bỏ một giải pháp công nghệ để các thành viên khác hoặc người tiếp nhận sau này không phải thử nghiệm lại từ đầu các phương án đã thất bại.
3. **Phân tách rõ ràng với tài liệu chính thức:** Giữ cho thư mục tài liệu kiến trúc và hướng dẫn vận hành (`docs/`, `docs/guides/`, `docs/workflows/`) luôn tinh gọn, mang tính hệ thống và phản ánh chính xác trạng thái production, không bị lẫn với các ghi chú làm việc cá nhân hàng ngày.

---

## 2. Quy Chuẩn Đặt Tên File (Naming Convention)

Tất cả các file devlog mới được tạo trong thư mục này phải tuân thủ quy tắc đặt tên thống nhất:

```text
YYYY-MM-DD_<tieu-de-ky-thuat-ngan-gon>.md
```

Trong đó:
- `YYYY-MM-DD`: Ngày lập bản ghi (ví dụ: `2026-11-12`).
- `<tieu-de-ky-thuat-ngan-gon>`: Mô tả ngắn về tính năng, module hoặc sự cố kỹ thuật được xử lý. Dùng chữ thường, không dấu, phân tách bằng dấu gạch ngang (`-`).

**Ví dụ:**
- `2026-11-12_toi-uu-lidar-filter.md`
- `2026-11-15_debug-webrtc-ice-candidate-drop.md`
- `2026-11-20_kiem-thu-cam-bien-sieu-am-esp32.md`

---

## 3. Mẫu Chuẩn Cho Bản Ghi Devlog (Devlog Template)

Khi tạo một file devlog mới, hãy sao chép và điền theo cấu trúc chuẩn dưới đây:

```markdown
# [TIÊU ĐỀ BẢN GHI KỸ THUẬT]

- Ngày thực hiện: YYYY-MM-DD
- Người thực hiện: [Tên / Username]
- Phân hệ liên quan: [AI Core / ROS 2 Navigation / Frontend Kiosk / Backend Operations / Hardware]
- Nhánh Git: [Tên nhánh, ví dụ: development hoặc feature/xyz]

---

## 1. Vấn Đề Kỹ Thuật (Problem Statement)
Mô tả ngắn gọn, cụ thể hiện tượng lỗi, nút thắt hiệu năng hoặc tính năng mới cần triển khai.
Đính kèm log lỗi thực tế hoặc chỉ số đo đạc ban đầu nếu có.

## 2. Các Phương Án Đã Xem Xét (Alternative Approaches)
- Phương án A: [Mô tả ngắn] - Ưu/Nhược điểm - Lý do chọn/loại.
- Phương án B: [Mô tả ngắn] - Ưu/Nhược điểm - Lý do chọn/loại.

## 3. Chi Tiết Triển Khai (Implementation Details)
- Các file đã sửa đổi:
  - `path/to/file_1.py`: [Tóm tắt thay đổi chính]
  - `path/to/file_2.jsx`: [Tóm tắt thay đổi chính]
- Thuật toán / Logic cốt lõi: Giải thích phương pháp kỹ thuật đã áp dụng.

## 4. Kết Quả Kiểm Thử (Verification & Test Results)
- Test tự động (Pytest / Vitest): [Ví dụ: 10/10 passed]
- Đo đạc thực nghiệm: [Ví dụ: Latency giảm từ 250ms xuống 45ms, CPU giảm 30%]
- Trạng thái biên dịch: [Ví dụ: Vite production build thành công]

## 5. Lưu Ý & Công Việc Kế Tiếp (Caveats & Next Steps)
- Các trường hợp biên (edge cases) cần chú ý thêm.
- Các đầu việc tiếp theo cần phối hợp với các phân hệ khác.
```

---

## 4. Các Nguyên Tắc Bắt Buộc Khi Viết Devlog

1. **Không sử dụng emoji:** Giữ văn phong kỹ thuật nghiêm túc, tối giản, chuyên nghiệp trong toàn bộ tiêu đề, nội dung và bảng biểu.
2. **Trung thực về số liệu:** Mọi chỉ số về độ trễ (latency), tần số (Hz), tỷ lệ lỗi (%) phải xuất phát từ log thực nghiệm hoặc kết quả test tự động, không đưa ra giả định thiếu căn cứ.
3. **Giữ nguyên thuật ngữ kỹ thuật tiếng Anh:** Sử dụng thuật ngữ chuyên môn chính xác (như `Odometry`, `Barge-In`, `VAD`, `StateGraph`, `Signaling`, `TF Tree`, `Payload`).
4. **Không để lại thông tin nhạy cảm:** Tuyệt đối không commit API keys, token bí mật, mật khẩu cơ sở dữ liệu hoặc thông tin cá nhân vào nội dung devlog.
