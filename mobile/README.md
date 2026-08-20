# 📱 MOBILE APP ARCHITECTURE & DIRECTORY STRUCTURE (HC-ROBOT)

Tài liệu giải thích cấu trúc cây thư mục của ứng dụng **Mobile** (sử dụng **Flutter**). Ứng dụng mobile đóng vai trò đa năng cho 3 nhóm đối tượng:
1. **Khách hàng (Guest)**: Xem thông tin phòng, gửi yêu cầu dịch vụ (dọn phòng, gọi taxi, thêm khăn), theo dõi trạng thái xử lý và đánh giá 5 sao.
2. **Nhân viên (Staff)**: Nhận thông báo đẩy (Push Notification / Socket.IO) khi có request mới từ Robot hoặc Khách, tiếp nhận và đổi trạng thái xử lý.
3. **Điều khiển từ xa (Manual Controller)**: Cho phép kỹ thuật viên / nhân viên điều khiển Robot di chuyển thủ công bằng Joystick khi gặp sự cố vật cản phức tạp.

---

## 📁 Cây Thư Mục Chi Tiết (Directory Tree)

```text
mobile/
├── android/                    # Native Android configurations & Gradle build
├── ios/                        # Native iOS configurations & Xcode build
├── lib/                        # Mã nguồn chính của ứng dụng Flutter
│   ├── core/                   # Cấu hình cốt lõi & Tiện ích chung
│   │   ├── constants/          # App Colors, Typography, API Routes, Asset Paths
│   │   ├── network/            # HTTP Client (Dio Custom Client), Socket.IO Listener
│   │   ├── theme/              # Light Theme & Dark Theme
│   │   └── utils/              # Validators, Date Formatters, Custom Dialogs
│   ├── data/                   # Data Layer (Models, Providers, Repositories)
│   │   ├── models/             # GuestRequestModel, UserModel, RobotTelemetryModel
│   │   ├── providers/          # Flutter Secure Storage (Lưu JWT Token), SharedPreferences
│   │   └── repositories/       # AuthRepository, RequestRepository, RobotControlRepository
│   ├── logic/                  # State Management Layer (Dùng BLoC / Provider / Cubit)
│   │   ├── auth/               # AuthCubit / AuthBloc (Login, Logout, Role Check)
│   │   ├── request/            # RequestCubit (Load, Create, Update status request)
│   │   └── controller/         # RobotJoystickCubit (Phát tín hiệu điều khiển di chuyển)
│   ├── presentation/           # UI Layer (Screens & Reusable Widgets)
│   │   ├── screens/            # Màn hình chính
│   │   │   ├── auth/           # LoginScreen, SplashScreen
│   │   │   ├── guest/          # GuestHomeScreen, CreateRequestScreen, TrackStatusScreen, RatingScreen
│   │   │   ├── staff/          # StaffDashboardScreen, RequestDetailScreen, EscalationChatScreen
│   │   │   └── controller/     # RemoteJoystickControllerScreen (Màn hình tay cầm điều khiển Robot)
│   │   └── widgets/            # Reusable UI Widgets (CustomButton, RequestStatusBadge, JoystickPad)
│   └── main.dart               # Entry point của ứng dụng Flutter
├── .gitignore                  # Git ignore cho Flutter & Dart build
├── pubspec.yaml                # Khai báo Packages dependencies (dio, socket_io_client, flutter_bloc...)
└── README.md                   # Tài liệu hướng dẫn cấu trúc Mobile
```

---

## 🛠️ Nguyên Tắc Thiết Kế Mobile Flutter

1. **Clean Architecture + BLoC/Cubit Pattern**: Tách biệt hoàn toàn phần UI (`presentation`), Xử lý trạng thái (`logic`) và Truy xuất dữ liệu (`data`).
2. **Real-time Socket.IO Connection**: Khi Staff mở ứng dụng, Socket.IO duy trì kết nối để lắng nghe sự kiện có Yêu cầu dịch vụ mới tức thì.
3. **Manual Joystick Control (Chế độ Điều khiển Thủ công)**: Sử dụng gói `flutter_joystick` gửi tín hiệu góc quay và vận tốc (`vx`, `w`) trực tiếp về Robot qua Socket.IO với độ trễ siêu thấp (< 100ms).
