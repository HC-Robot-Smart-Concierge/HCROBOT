# 🖥️ FRONTEND ARCHITECTURE & DIRECTORY STRUCTURE (HC-ROBOT)

Tài liệu giải thích cấu trúc cây thư mục của dự án **Frontend** (sử dụng **ReactJS + Vite + Tailwind CSS**). Dự án này bao gồm 3 phân hệ giao diện chính:
1. **Robot Screen Display**: Màn hình cảm ứng tương tác trên thân Robot (biểu cảm Lottie Avatar, menu dịch vụ).
2. **Staff Dashboard**: Web console cho nhân viên khách sạn tiếp nhận & xử lý yêu cầu dọn phòng, gọi taxi, hỗ trợ.
3. **Admin Console**: Web quản trị hệ thống, quản lý người dùng, chỉnh sửa RAG Knowledge Base, xem báo cáo thống kê.

---

## 📁 Cây Thư Mục Chi Tiết (Directory Tree)

```text
frontend/
├── public/                     # Static assets (Favicon, manifest, fonts tĩnh)
├── src/
│   ├── assets/                 # Tài nguyên đa phương tiện
│   │   ├── icons/              # SVG & Icon dùng trong dự án
│   │   ├── images/             # Hình ảnh minh họa, logo khách sạn
│   │   └── lottie/             # Biểu cảm khuôn mặt Robot (Listening, Speaking, Thinking, Idle)
│   ├── components/             # Reusable UI Components
│   │   ├── common/             # Component dùng chung (Button, Modal, Input, Badge, Table, Loading)
│   │   ├── admin/              # Component riêng cho Admin (UserTable, RAGForm, MetricsChart)
│   │   ├── staff/              # Component riêng cho Staff (RequestCard, EscalationAlertModal)
│   │   └── robot/              # Component riêng cho Robot (FaceAvatar, VoiceWave, ServiceGrid)
│   ├── config/                 # Cấu hình hệ thống (API Base URL, Socket.IO Endpoints, App Constants)
│   ├── context/                # React Contexts (AuthContext, SocketContext, ThemeContext)
│   ├── hooks/                  # Custom React Hooks (useSocket, useAuth, useSpeechRecognition)
│   ├── layouts/                # Layout khung trang (AdminLayout, StaffLayout, RobotScreenLayout)
│   ├── pages/                  # Các trang màn hình chính (Views)
│   │   ├── admin/              # DashboardPage, KnowledgeBasePage, UsersManagementPage, ReportsPage
│   │   ├── staff/              # IncomingRequestsPage, ActiveTicketsPage, EscalationLogPage
│   │   └── robot/              # IdleFaceScreen, MainMenuScreen, ServiceRequestForm, FeedbackScreen
│   ├── routes/                 # Routing cấu hình bởi react-router-dom (AuthGuard, ProtectedRoutes)
│   ├── services/               # Tầng giao tiếp API & Socket (axiosInstance, authApi, socketService)
│   ├── styles/                 # Global CSS & Tailwind CSS custom classes
│   ├── types/                  # TypeScript Data Types / Interfaces (Nên dùng TS để chặt chẽ)
│   └── utils/                  # Hàm tiện ích (Date Formatter, Token Storage, Toast Notifier)
│   ├── App.jsx                 # Main App Component với Router Provider
│   └── main.jsx                # React App Entrypoint
├── .gitignore                  # Git ignore cho Node.js / Vite build
├── package.json                # Dependencies & Build Scripts
├── README.md                   # Tài liệu hướng dẫn cấu trúc Frontend
└── vite.config.js              # Cấu hình Vite Build & Proxy CORS
```

---

## 🛠️ Nguyên Tắc Thiết Kế Frontend

1. **Single Responsibility Component**: Mỗi Component chỉ đảm nhận 1 nhiệm vụ duy nhất (VD: `RequestCard` chỉ render card yêu cầu của khách).
2. **Centralized API & Socket Service**: Không gọi `fetch`/`axios` trực tiếp trong UI Component. Toàn bộ API calls phải thông qua thư mục `src/services/`.
3. **Responsive & Touch Friendly**: Màn hình Robot được tối ưu cho thao tác chạm (Touch Events), nút bấm to, giao diện trực quan cho mọi đối tượng khách hàng.
4. **State Management**: Sử dụng `React Query (TanStack Query)` cho server state (API caching) và `Context API / Zustand` cho client state (Socket connection, User session).
