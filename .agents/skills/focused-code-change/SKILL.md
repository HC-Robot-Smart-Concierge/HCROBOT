---
name: focused-code-change
description: Hướng dẫn sửa lỗi, thêm tính năng và refactor có giới hạn trong codebase hiện có; ưu tiên xác minh nguyên nhân, tái sử dụng cơ chế sẵn có và kiểm tra hồi quy.
---

# Quy Trình Sửa Đổi Code Có Trọng Tâm (focused-code-change)

Skill này cung cấp quy trình 5 bước để sửa lỗi, thêm tính năng hoặc refactor có kiểm soát trong codebase dự án, đảm bảo đúng phạm vi, có căn cứ kỹ thuật và không để lại code dư thừa.

---

## A. Xác định kết quả cần đạt
- Tóm tắt ngắn hành vi mong muốn và điều kiện hoàn thành cụ thể trước khi sửa.
- Với việc nhỏ: đi thẳng vào xử lý; chỉ lập kế hoạch khi có nhiều bước phụ thuộc lẫn nhau.

---

## B. Điều tra có giới hạn
- Đọc hướng dẫn dự án (`GEMINI.md`, tài liệu liên quan), tìm đúng entry point và lần theo luồng dữ liệu liên quan.
- Mở rộng phạm vi đọc chỉ khi có bằng chứng cần thiết; tránh quét toàn bộ repository không có mục tiêu.
- Với lỗi chưa rõ nguyên nhân: bổ sung quan sát (logging có chủ đích) hoặc kiểm thử có mục tiêu trước khi thay đổi hành vi code.

---

## C. Thực hiện
- Sửa tại nơi chịu trách nhiệm trực tiếp cho hành vi đó.
- Nếu thay thế cơ chế cũ: xử lý dứt điểm phần cũ bị thay thế trong phạm vi liên quan, tránh để hai cơ chế cùng hoạt động song song.
- Với tác vụ bất đồng bộ: kiểm tra chặt chẽ vòng đời (lifecycle), cleanup, hủy tác vụ (cancellation) và xử lý kết quả trả về muộn (late resolution).
- Với retry hoặc fallback: xác định một nơi điều phối duy nhất, điều kiện chuyển nhánh rõ ràng và giới hạn số lần thử; tránh thực thi trùng lặp các tác vụ có side-effect.

---

## D. Kiểm tra
- Chạy các kiểm tra phù hợp với thay đổi và công cụ sẵn có của dự án (pytest cho backend, vitest / vite build cho frontend).
- Với bug fix: ưu tiên tái hiện lỗi trước khi sửa và kiểm tra lại sau khi sửa nếu môi trường cho phép.
- Kiểm tra hành vi chính, các trường hợp lỗi liên quan và nguy cơ hồi quy sát với phần vừa sửa.
- Tuyệt đối không sửa test chỉ để che lỗi. Không tuyên bố đã kiểm thử nếu chưa chạy lệnh thực tế.
- Đọc lại `git diff` để loại bỏ thay đổi không liên quan, debug log, import hoặc code thừa do chính lần sửa này tạo ra.

---

## E. Điều kiện dừng và báo cáo
- Khi yêu cầu đã đạt và các kiểm tra phù hợp đã qua: dừng ngay, không tiếp tục “tối ưu” hoặc sửa lan man ngoài phạm vi.
- Nếu một cách sửa thất bại: xem lại giả thuyết ban đầu và loại bỏ thử nghiệm không còn cần thiết trước khi thử cách khác.
- Báo cáo ngắn gọn: đã thay đổi gì, kiểm tra nào đã chạy và phần nào chưa xác minh được (ví dụ phần cứng thực tế).
- Nếu phát hiện lỗi ngoài phạm vi: ghi nhận riêng trong phản hồi, không tự ý sửa lan sang.

