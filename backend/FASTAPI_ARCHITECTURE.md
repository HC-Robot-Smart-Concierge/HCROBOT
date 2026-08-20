# ⚡ FASTAPI BACKEND ARCHITECTURE - INTELLIGENT HOTEL CONCIERGE ROBOT (HC-ROBOT)

Tài liệu này giải thích chi tiết cách **FastAPI (Python)** được áp dụng để làm **Central Backend Server (Server Trung Tâm Tập Trung)** cho toàn bộ hệ thống Robot Trợ lý Dịch vụ Khách sạn Thông minh (HCRobot).

---

## 🎯 1. Tại Sao Lựa Chọn FastAPI Cho Hệ Thống HCRobot?

1. **Hiệu năng Async Siêu Tốc (Asynchronous Performance)**: 
   FastAPI xây dựng trên nền tảng **Starlette** và **Pydantic**, hỗ trợ native `async/await`. Tốc độ xử lý của FastAPI tương đương với Node.js và Go, cực kỳ thích hợp cho các ứng dụng I/O intensive (gọi API AI, streaming audio, giao tiếp Socket.IO real-time).
2. **Tích hợp Hệ Sinh Thái AI/Python Hoàn Hảo**:
   Toàn bộ các mô hình AI của dự án như **Faster-Whisper (STT)**, **Ultralytics YOLO11 (Computer Vision)**, **ChromaDB / FAISS (Vector DB cho RAG)**, **OpenAI / Gemini SDK** đều là thư viện Python native. FastAPI cho phép gọi trực tiếp các mô hình AI này mà không cần qua tầng trung gian inter-process communication phức tạp.
3. **Tự Động Sinh Tài Liệu API (Auto Swagger/OpenAPI Docs)**:
   FastAPI tự động tạo trang Swagger UI tại `/docs` và ReDoc tại `/redoc`. Giúp đội ngũ Frontend (ReactJS) và Mobile (Flutter) xem và test API cực kỳ nhanh chóng.
4. **Xác Thực Dữ Liệu Chặt Chẽ (Strict Data Validation with Pydantic)**:
   Mọi dữ liệu JSON đầu vào/đầu ra đều được validate tự động bởi Pydantic schemas, loại bỏ 99% lỗi sai định dạng dữ liệu (Data Type Error).

---

## 🏛️ 2. Vai Trò Của FastAPI Trong Hệ Thống HCRobot

FastAPI đóng vai trò là **Bộ Não Trung Tâm (Central Brain)** kết nối 4 thành phần Client:

```text
               +-------------------------------------------------------+
               |             FASTAPI CENTRAL BACKEND SERVER            |
               |                                                       |
               |  [REST API Router]  [Socket.IO Gateway]  [AI Service] |
               +-------------------------------------------------------+
                                           ^
                                           |
     +-------------------+-----------------+-------------------+
     |                   |                 |                   |
[Robot Pi 5]       [Admin Web]       [Staff Web/App]     [Guest App]
(Voice/YOLO/ROS)   (RAG/Users/Stats) (Dọn phòng/Taxi)    (Đặt dịch vụ)
```

---

## 🔬 3. Chi Tiết Các Module FastAPI Áp Dụng Vào Hệ Thống

### A. Tầng Real-Time Gateway (Socket.IO over FastAPI)
- **Công nghệ**: `python-socketio` tích hợp vào FastAPI ASGI App.
- **Nhiệm vụ**:
  - **Robot ↔ Server**: Robot gửi event khi nhận diện được khách (`GUEST_DETECTED`), gửi vị trí tọa độ telemetry, gửi trạng thái pin.
  - **Server ↔ Staff Web/App**: Khi Robot trích xuất được yêu cầu dọn phòng/gọi taxi từ giọng nói khách hàng, Server lập tức bắn event Socket.IO `NEW_SERVICE_REQUEST` tới Staff App làm điện thoại nhân viên rung và kêu chuông tức thì.
  - **App Remote Controller ↔ Robot**: Nhận lệnh joystick từ app Flutter và chuyển tiếp xuống Robot điều khiển động cơ với độ trễ < 50ms.

### B. Tầng Xử Lý Voice AI & RAG Pipeline (AI Engine)
FastAPI quản lý luồng đàm thoại 2 chiều cho Robot:
1. **STT Service (`app/services/ai/stt.py`)**: Nhận file âm thanh WAV từ Robot -> Chạy **Faster-Whisper** trả về văn bản câu hỏi.
2. **RAG Service (`app/services/ai/rag.py`)**: Nhận câu hỏi -> Truy vấn **ChromaDB Vector Store** lấy thông tin ngữ cảnh khách sạn (FAQ, nhà hàng, ưu đãi).
3. **LLM Orchestrator (`app/services/ai/llm.py`)**: Kết hợp System Prompt Concierge + Ngữ cảnh RAG -> Gọi **GPT-4o / Gemini API** sinh câu trả lời tự nhiên.
4. **Intent & Function Calling (`app/services/ai/intent.py`)**: Sử dụng Function Calling để tự động bóc tách JSON yêu cầu dịch vụ (VD: `{ "action": "housekeeping", "room": "302", "item": "towel" }`).
5. **TTS Service (`app/services/ai/tts.py`)**: Chuyển câu trả lời văn bản thành giọng nói bằng **EdgeTTS / GPT-4o mini TTS** phát lại cho Robot.

### C. Tầng RESTful API & Phân Quyền (Authentication & RBAC)
- **JWT (JSON Web Token)**: Cấp token xác thực cho Admin, Staff, Guest và Device Robot.
- **API Routers (`app/api/v1/`)**:
  - `/api/v1/auth`: Đăng nhập, đăng ký, refresh token.
  - `/api/v1/hotel`: Quản lý thông tin khách sạn, phòng nghỉ, ưu đãi.
  - `/api/v1/requests`: Tạo, cập nhật trạng thái yêu cầu dịch vụ.
  - `/api/v1/rag`: Admin thêm/sửa/xóa tài liệu tri thức RAG.
  - `/api/v1/analytics`: Thống kê số lượng tương tác, đánh giá 5 sao.

### D. Tầng Cơ Sở Dữ Liệu (Database Layer)
- **Relational DB (MySQL / PostgreSQL)**: Sử dụng **SQLAlchemy 2.0 (Async)** + **Alembic** để quản lý DB Migration. Lưu trữ Người dùng, Đơn dịch vụ, Nhật ký cuộc gọi.
- **Vector DB (ChromaDB / FAISS)**: Lưu trữ các đoạn văn bản nhúng (Embeddings) dữ liệu tri thức khách sạn phục vụ RAG.

---

## 📂 4. Cấu Trúc Thư Mục Chuẩn Của Backend FastAPI

```text
backend/
├── app/
│   ├── api/                    # Tầng Routers (Endpoints)
│   │   └── v1/
│   │       ├── endpoints/      # auth.py, hotel.py, requests.py, rag.py, analytics.py
│   │       └── router.py       # Gom tất cả routers v1
│   ├── core/                   # Cấu hình hệ thống
│   │   ├── config.py           # BaseSettings đọc biến môi trường (.env)
│   │   ├── security.py         # Mã hóa Password (Bcrypt) & Tạo/Verify JWT Token
│   │   └── database.py         # Kết nối Async SQLAlchemy Session Engine
│   ├── crud/                   # Create, Read, Update, Delete DB Operations
│   │   ├── crud_user.py
│   │   ├── crud_request.py
│   │   └── crud_hotel.py
│   ├── db/                     # Database migrations & base class
│   │   ├── base.py
│   │   └── session.py
│   ├── models/                 # SQLAlchemy ORM Models
│   │   ├── user.py             # User, Role (Admin, Staff, Guest)
│   │   ├── request.py          # ServiceRequest, RequestStatus
│   │   └── hotel.py            # HotelInfo, Facility, Promotion
│   ├── schemas/                # Pydantic Schemas (Input/Output Data Validation)
│   │   ├── user.py
│   │   ├── request.py
│   │   └── ai.py
│   ├── services/               # Tầng xử lý Logic nghiệp vụ & AI
│   │   ├── ai/                 # Faster-Whisper, RAG ChromaDB, LLM, TTS
│   │   └── socket/             # Socket.IO Event Handlers & Connection Manager
│   └── main.py                 # FastAPI Application Entrypoint & Middleware Setup
├── Alembic/                    # Database Migration Scripts
├── Dockerfile                  # Dockerfile đóng gói ứng dụng Backend
├── docker-compose.yml          # Triển khai FastAPI + MySQL + ChromaDB 1-click
├── requirements.txt            # Danh sách thư viện Python dependencies
└── FASTAPI_ARCHITECTURE.md     # Tài liệu kiến trúc FastAPI
```

---

## 🐳 5. Đóng Gói Và Triển Khai (Docker Compose 1-Click)

Dự án FastAPI được thiết kế để triển khai cực kỳ đơn giản trên **Laptop Server (giai đoạn Dev)** hoặc **VPS Ubuntu (giai đoạn Production)** chỉ với 1 lệnh duy nhất:

```bash
docker compose up -d --build
```

Nó sẽ tự động kích hoạt 3 container:
1. `backend-api`: Container FastAPI ứng dụng.
2. `mysql-db`: Container Database lưu trữ dữ liệu.
3. `chromadb-store`: Container Vector DB cho AI RAG.
