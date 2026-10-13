# Hướng Dẫn Vận Hành & Cơ Chế Thoát Màn Hình Robot Chuẩn Kiosk (Secret Multi-Tap Gesture)

Tài liệu quy chuẩn kỹ thuật và cẩm nang vận hành dành riêng cho **Nhân viên Khách sạn (Hotel Staff)** và **Kỹ thuật viên (System Engineers)** về cách quản lý, thoát hoặc đăng xuất khỏi màn hình Robot Kiosk trên cả nền tảng **Web Desktop Kiosk** và **Mobile PWA App**.

---

## 1. Triết Lý Thiết Kế: Zero-Exposure Kiosk Security

Trong môi trường khách sạn và dịch vụ công cộng cao cấp, màn hình Robot Kiosk phục vụ khách hàng cần đảm bảo 2 nguyên tắc cốt lõi:
1. **Trải nghiệm khách hàng tinh gọn & an tâm (Clean Experience):** Tuyệt đối không để lộ nút "Đăng xuất", "Thoát ứng dụng" hay các phím chức năng của hệ điều hành. Khách hàng nhìn vào màn hình chỉ thấy một trợ lý Robot thông minh, liền mạch và thân thiện.
2. **Chống phá hoại & táy máy (Tamper Resistance):** Ngăn chặn khách hoặc trẻ em tự ý tắt ứng dụng, đăng xuất hệ thống hoặc can thiệp vào cài đặt kỹ thuật.

Do đó, hệ thống áp dụng cơ chế **Kiosk Secret Admin Gestures** (Cử chỉ kích hoạt ẩn) kết hợp **Mật khẩu bảo vệ 2 lớp**.

---

## 2. Hướng Dẫn Thao Tác Dành Cho Nhân Viên

### Cách 1: Cử chỉ Secret Multi-Tap (Chạm 5 lần liên tiếp) — Khuyên dùng

Đây là phương thức chuẩn công nghiệp được áp dụng đồng bộ trên cả **Web Kiosk (màn hình máy tính/robot)** và **Mobile App (PWA điện thoại)**:

| Nền tảng | Vị trí chạm bí mật (2 vị trí đồng bộ) | Thao tác kích hoạt |
| :--- | :--- | :--- |
| **Web Desktop Kiosk** | 1. Cụm chữ **HCROBOT** ở góc trên cùng bên trái<br>2. Góc dưới cùng bên phải màn hình (Vùng vô hình `64x64px`) | Gõ nhẹ nhanh **5 lần liên tiếp** trong vòng 2 giây |
| **Mobile App (PWA)** | 1. Cụm chữ **HCROBOT** ở góc trên cùng bên trái Header<br>2. Góc dưới cùng bên phải màn hình (Vùng vô hình `64x64px`) | Gõ nhẹ nhanh **5 lần liên tiếp** trong vòng 2 giây |

*Ngay khi nhận đủ 5 chạm hợp lệ, Modal bảo mật **"Mật Khẩu Đăng Xuất Robot"** sẽ lập tức xuất hiện.*

---

### Cách 2: Cử chỉ Secret Long-Press (Nhấn giữ 3 giây)

- **Thao tác:** Đặt và giữ ngón tay cố định tại góc dưới cùng bên phải màn hình trong **3 giây**.
- Hệ thống sẽ kích hoạt mở hộp thoại mật khẩu đăng xuất.

---

### Cách 3: Phím tắt bàn phím (Dành cho Kỹ thuật viên / Remote)

Dành cho trường hợp bảo trì cắm bàn phím ngoài, chuột máy tính hoặc điều khiển từ xa:
- **Tổ hợp phím nóng:** Nhấn đồng thời **`Ctrl + Shift + L`** (hoặc `Cmd + Shift + L` trên macOS).
- **Phím khẩn cấp:** Nhấn phím **`Escape` (Esc) 3 lần liên tiếp** trong vòng 1.5 giây.

---

## 3. Xác Thực Mật Khẩu Đăng Xuất (2-Factor Exit)

Sau khi kích hoạt thành công cử chỉ ẩn, giao diện sẽ yêu cầu nhập **Mật khẩu bảo vệ**:

* **Mật khẩu mặc định hệ thống:** `123456`
* **Mật khẩu quản trị viên:** `admin`, `robot123`, hoặc `aurora2026`

Nếu nhập sai mật khẩu, hệ thống sẽ báo lỗi và tiếp tục khóa an toàn tại màn hình Robot để đảm bảo tính liên tục của dịch vụ.

---

## 4. Tóm Tắt Kỹ Thuật (Architecture Checklist)

- Component Web: `frontend/src/pages/robot/RobotScreenPage.jsx` (`handleSecretAreaClick`, `handleSecretTrigger`)
- Component Mobile: `frontend/src/components/robot/MobileRobotScreen.jsx` (`handleSecretTap`)
- Bộ đếm nhịp chạm: `useRef(tapCount)` + reset timer 2000ms.
- Kiểm thử tự động: `frontend/src/pages/robot/RobotScreenLogout.test.jsx` & `frontend/src/components/robot/MobileRobotScreen.test.jsx`.
