# 🤖 INTELLIGENT HOTEL CONCIERGE ROBOT (HC-ROBOT)

> **Hệ Thống Trợ Lý Robot Dịch Vụ Khách Sạn Thông Minh**  
> Giải pháp toàn diện kết hợp **AI Voice Conversational, RAG Knowledge Base, Real-time Socket.IO, WebRTC Call Escalation, ROS 2 Navigation & Dynamic Multi-Platform Clients**.

---

## 📋 MỤC LỤC
1. [🌟 Tổng Quan Hệ Thống](#-1-tổng-quan-hệ-thống)
2. [🏛️ Kiến Trúc Các Phân Hệ (Subsystems)](#️-2-kiến-trúc-các-phân-hệ-subsystems)
   - [A. Central Backend Server (FastAPI)](#a-central-backend-server-fastapi-python)
   - [B. Frontend Web Console (ReactJS + Vite + Tailwind CSS)](#b-frontend-web-console-reactjs--vite--tailwind-css)
   - [C. Mobile Application (Flutter)](#c-mobile-application-flutter)
   - [D. Robot Edge Node (ROS 2 on Raspberry Pi 5)](#d-robot-edge-node-ros-2-on-raspberry-pi-5)
3. [📂 Cấu Trúc Thư Mục Toàn Dự Án](#-3-cấu-trúc-thư-mục-toàn-dự-án)
4. [🚀 Hướng Dẫn Cài Đặt & Khởi Chạy Từ A-Z](#-4-hướng-dẫn-cài-đặt--khởi-chạy-từ-a-z)
   - [Bước 1: Yêu cầu Tiền đề (Prerequisites)](#bước-1-yêu-cầu-tiền-đề-prerequisites)
   - [Bước 2: Cài Đặt & Khởi Chạy Backend (FastAPI & DB)](#bước-2-cài-đặt--khởi-chạy-backend-fastapi--db)
   - [Bước 3: Cài Đặt & Khởi Chạy Frontend (React)](#bước-3-cài-đặt--khởi-chạy-frontend-react)
   - [Bước 4: Khởi Chạy Nhanh Trên Windows (1-Click Batch)](#bước-4-khởi-chạy-nhanh-trên-windows-1-click-batch)
   - [Bước 5: Cài Đặt & Khởi Chạy Mobile App (Flutter)](#bước-5-cài-đặt--khởi-chạy-mobile-app-flutter)
   - [Bước 6: Cấu Hình & Khởi Chạy Robot Node (Raspberry Pi 5 + ROS 2)](#bước-6-cấu-hình--khởi-chạy-robot-node-raspberry-pi-5--ros-2)
5. [📡 Giao Tiếp Real-time, APIs & ROS 2 Topics](#-5-giao-tiếp-real-time-apis--ros-2-topics)
6. [🐳 Triển Khai Production Với Docker Compose](#-6-triển-khai-production-với-docker-compose)

---

## 🌟 1. TỔNG QUAN HỆ THỐNG

**HC-Robot** là hệ thống Robot trợ lý thông minh phục vụ trong môi trường khách sạn cao cấp. Hệ thống giải quyết các bài toán giao tiếp tự nhiên với khách hàng, tự động tiếp nhận yêu cầu dịch vụ (dọn phòng, gọi taxi, mượn vật dụng), hỗ trợ nhân viên quản lý theo thời gian thực và cho phép can thiệp điều khiển từ xa.

### 📐 Sơ Đồ Kiến Trúc Tổng Thể

```text
               +-------------------------------------------------------+
               |             FASTAPI CENTRAL BACKEND SERVER            |
               |                                                       |
               |  [REST API Router]  [Socket.IO Gateway]  [AI Core]    |
               |  [SQLAlchemy/Postgres]  [ChromaDB Vector] [WebRTC]    |
               +-------------------------------------------------------+
                                            ^
                                            |
      +-------------------+-----------------+-------------------+
      |                   |                 |                   |
 [Robot Pi 5]       [Admin Web]       [Staff Web/App]     [Guest App]
 (Voice/YOLO/ROS)   (RAG/Users/Stats) (Dọn phòng/Taxi)    (Đặt dịch vụ)
```

---

## 🏛️ 2. KIẾN TRÚC CÁC PHÂN HỆ (SUBSYSTEMS)

### A. Central Backend Server (FastAPI + Python)
- **Role**: Bộ não trung tâm của toàn bộ hệ thống.
- **Tính năng nổi bật**:
  1. **Hiệu năng Async siêu tốc**: Xây dựng trên Starlette & Pydantic, hỗ trợ `async/await` xử lý đồng thời hàng nghìn kết nối real-time.
  2. **AI Core Engine (Voice & RAG)**:
     - **STT**: Faster-Whisper chuyển đổi giọng nói nhận từ Robot thành văn bản.
     - **RAG**: Truy vấn vector tri thức khách sạn qua **ChromaDB**.
     - **LLM Orchestrator**: Gọi OpenAI GPT-4o / Gemini sinh câu trả lời tự nhiên chuẩn concierge.
     - **TTS**: EdgeTTS chuyển câu trả lời thành giọng nói phát qua loa Robot.
     - **Intent Extraction**: Sử dụng Function Calling bóc tách JSON dịch vụ tự động (VD: đặt khăn, gọi xe).
  3. **Real-time Gateway & WebRTC Signaling (Socket.IO)**:
     - Luân chuyển thông điệp thời gian thực giữa Robot, Nhân viên và Khách hàng.
     - **WebRTC Signaling**: Hỗ trợ gọi Video HD trực tiếp giữa Staff Web/App và Camera trên Robot theo mô hình P2P (Peer-to-Peer).
  4. **Database Layer**: SQLAlchemy 2.0 Async kết nối PostgreSQL & ChromaDB Vector Database.
  5. **Auto OpenAPI Docs**: Swagger UI tích hợp sẵn tại `/docs`.

### B. Frontend Web & PWA Console (ReactJS + Vite + Tailwind CSS)
- **Role**: Cung cấp giao diện web & PWA đa nền tảng (hỗ trợ màn hình Robot, Laptop Admin, Smartphone của Staff/Guest):
  1. **Robot Screen Display & PWA Face**: Màn hình cảm ứng trên thân Robot (hoặc Điện thoại PWA) với avatar biểu cảm Lottie linh hoạt (Listening, Speaking, Thinking, Idle), menu dịch vụ nhanh.
  2. **Staff Dashboard**: Web console cho nhân viên nhận thông báo và xử lý Ticket dịch vụ, phản hồi WebRTC Call khi Robot báo động.
  3. **Admin Console & Teleop**: Quản trị người dùng, quản lý tài liệu RAG Knowledge Base, xem bản đồ LiDAR 2D SLAM và bộ điều khiển di chuyển Robot từ xa (Manual Nudge Teleop).

### C. Robot Edge Node (ROS 2 on Raspberry Pi 5)
- **Role**: Nút phần cứng điều khiển nhúng trên Raspberry Pi 5 (Ubuntu 22.04/24.04 + ROS 2 Humble/Jazzy).
- **Package `hc_robot_client`**:
  - `ai_bridge_node`: Giao tiếp âm thanh/văn bản 2 chiều giữa ROS 2 Topics và FastAPI Backend.
  - `telemetry_node`: Thu thập thông số pin, vị trí tọa độ phần cứng đẩy lên Server.
  - **Mạng Tailscale Mesh VPN**: Kết nối bảo mật IP cố định dạng `100.x.y.z` giữa Pi 5 và Backend Server mà không lo bị đổi IP Wi-Fi.

---

## 📂 3. CẤU TRÚC THƯ MỤC TOÀN DỰ ÁN

```text
HC-Robot/
├── backend/                    # Server Trung Tâm FastAPI (Python)
│   ├── app/
│   │   ├── api/v1/endpoints/   # auth.py, hotel.py, requests.py, rag.py, analytics.py, ai.py
│   │   ├── core/               # config.py, security.py, database.py
│   │   ├── crud/               # crud_user.py, crud_request.py, crud_hotel.py
│   │   ├── db/                 # base.py, session.py, chroma.py
│   │   ├── models/             # ORM models (user.py, request.py, hotel.py)
│   │   ├── schemas/            # Pydantic validation schemas
│   │   └── services/
│   │       ├── ai/             # stt.py, tts.py, rag.py, llm.py, intent.py
│   │       └── socket/         # socket_manager.py, webrtc.py
│   ├── knowledge_vault/        # Dữ liệu tài liệu tri thức khách sạn (RAG)
│   ├── scripts/                # test_db_connection.py
│   ├── tests/                  # Pytest integration & unit tests
│   ├── .env.example            # File mẫu cấu hình biến môi trường Backend
│   ├── FASTAPI_ARCHITECTURE.md # (Đã gộp vào Master README này)
│   └── requirements.txt        # Danh sách thư viện Python Backend
├── frontend/                   # Web & PWA App (React + Vite + Tailwind CSS)
│   ├── public/                 # Manifest PWA, Service Worker, Favicon
│   ├── src/
│   │   ├── assets/             # Icons, images, Lottie face animations
│   │   ├── components/         # common/, admin/, staff/, robot/
│   │   ├── context/            # AuthContext, SocketContext, ThemeContext
│   │   ├── hooks/              # Custom React Hooks
│   │   ├── pages/              # admin/, staff/, robot/
│   │   ├── services/           # axiosInstance.js, socketService.js
│   │   ├── App.jsx             # Root React Router Component
│   │   └── main.jsx            # Entry point Vite (SW registered)
│   ├── package.json            # Node.js dependencies & scripts
│   ├── tailwind.config.js      # Configuration Tailwind CSS
│   └── vite.config.js          # Vite build & PWA allowedHosts settings
├── robot/                      # ROS 2 Workspace (Raspberry Pi 5)
│   └── src/
│       └── hc_robot_client/    # ROS 2 Package (nodes, launch, config)
│           ├── hc_robot_client/# Python nodes (ai_bridge_node, telemetry_node)
│           ├── config/         # settings.yaml (IP Tailscale Server)
│           └── package.xml     # ROS 2 package dependencies
├── start_all.bat               # Windows Batch Script khởi chạy nhanh Backend & Frontend
├── .gitignore                  # Git Ignore rule cho toàn dự án
└── README.md                   # Tài liệu hướng dẫn Master HCRobot System (File này)
```

---

## 🚀 4. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY TỪ A-Z

### Bước 1: Yêu cầu Tiền đề (Prerequisites)
- **Hệ điều hành**: Windows 10/11 (Dev Laptop) & Ubuntu 22.04/24.04 (Raspberry Pi 5).
- **Python**: Version `3.10` trở lên.
- **Node.js**: Version `18.x` hoặc `20.x`.
- **PostgreSQL**: Version `14+` chạy local hoặc Docker.
- **Flutter SDK**: Version `3.x+` (cho phát triển Mobile App).
- **ROS 2**: Bản Humble Desktop hoặc Jazzy Base (cho Raspberry Pi 5).

---

### Bước 2: Cài Đặt & Khởi Chạy Backend (FastAPI & DB)

1. **Di chuyển vào thư mục backend**:
   ```powershell
   cd f:\DoAn\HC-Robot\backend
   ```

2. **Tạo và kích hoạt môi trường ảo Python (Virtual Environment)**:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

3. **Cài đặt các thư viện phụ thuộc**:
   ```powershell
   pip install -r requirements.txt
   ```

4. **Cấu hình biến môi trường (`.env`)**:
   Tạo file `.env` từ `.env.example` và điền thông số CSDL PostgreSQL của bạn:
   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=hc_robot_db

   DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/hc_robot_db
   CHROMA_PERSIST_DIR=./chroma_db
   OPENAI_API_KEY=your_openai_api_key_here
   ```

5. **Seeding Tài Khoản CSDL PostgreSQL Các Bộ Phận**:
   Khởi tạo và đồng bộ bảng CSDL cùng danh sách tài khoản theo các bộ phận chức năng (Mật khẩu mặc định cho tất cả tài khoản: `123456`):
   ```powershell
   python scripts/seed_robot_accounts.py
   ```
   Hoặc khởi tạo lại CSDL từ đầu:
   ```powershell
   python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
   ```

   **📋 Danh Sách Tài Khoản Hệ Thống Theo Bộ Phận:**
   | Tên Đăng Nhập (Username) | Mật Khẩu | Tên Bộ Phận / Chức Danh | Phân Hệ Dashboard |
   | :--- | :--- | :--- | :--- |
   | `reception` | `123456` | Nhân viên Lễ tân (Reception) | Manager Hub |
   | `roomservice` | `123456` | Nhân viên Phục vụ phòng (F&B) | Room Service |
   | `housekeeping` | `123456` | Nhân viên Buồng phòng (Housekeeping) | Housekeeping |
   | `bellman` | `123456` | Nhân viên Vận chuyển hành lý (Bellman) | Bell Services |
   | `maintenance` | `123456` | Nhân viên Kỹ thuật & Bảo trì | Maintenance |
   | `manager` | `123456` | Ban Quản lý Khách sạn (Manager) | Manager Hub |
   | `admin` | `123456` | Quản trị Hệ thống (Admin) | Tất cả Dashboards |
   | `robot_01` | `123456` | Robot Kiosk Unit 01 | Màn hình Robot |
   | `robot_02` | `123456` | Robot Kiosk Unit 02 | Màn hình Robot |

6. **Khởi chạy Backend Server**:
   ```powershell
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   - **Swagger UI API Docs (Phân loại theo Bộ phận):** `http://localhost:8000/docs`

---

### Bước 3: Cài Đặt & Khởi Chạy Frontend Web & PWA (React)

1. **Di chuyển vào thư mục frontend**:
   ```powershell
   cd f:\DoAn\HC-Robot\frontend
   ```

2. **Cài đặt Node Modules**:
   ```powershell
   npm install
   ```

3. **Khởi chạy Development Server**:
   ```powershell
   npm run dev
   ```
   - Truy cập giao diện Web / PWA tại: `http://localhost:3000` (hoặc port do Vite cấp).

---

### Bước 4: Khởi Chạy Nhanh Trên Windows (1-Click Batch)

Tại thư mục gốc dự án, double click vào file `start_all.bat` hoặc chạy từ PowerShell:
```powershell
.\start_all.bat
```
Kịch bản sẽ tự động mở 2 cửa sổ Terminal riêng biệt chạy đồng thời **Backend FastAPI (Port 8000)** và **Frontend React PWA (Port 3000)**.

---

### Bước 6: Cấu Hình & Khởi Chạy Robot Node (Raspberry Pi 5 + ROS 2)

#### 1. Cấu hình mạng VPN Tailscale (Khuyên dùng)
Để Pi 5 và Laptop Backend kết nối cố định không phụ thuộc vào địa chỉ Wi-Fi local:
- **Trên Laptop Windows**: Cài Tailscale, đăng nhập và lấy IP Tailscale (Ví dụ: `100.105.12.34`).
- **Trên Pi 5 (Ubuntu)**:
  ```bash
  curl -fsSL https://tailscale.com/install.sh | sh
  sudo tailscale up
  ```
- **Đồng bộ file cấu hình `robot/src/hc_robot_client/config/settings.yaml`**:
  ```yaml
  server:
    host: "100.105.12.34" # Thay bằng IP Tailscale thực tế của Laptop
    port: 8000
  ```

#### 2. Build & Run ROS 2 Workspace
```bash
cd ~/HC-Robot/robot
pip install -r requirements.txt
colcon build --symlink-install
source install/setup.bash

# Khởi chạy AI Bridge Node
ros2 run hc_robot_client ai_bridge_node

# Khởi chạy Telemetry Node (trong terminal khác)
ros2 run hc_robot_client telemetry_node
```

---

## 📡 5. GIAO TIẾP REAL-TIME, APIS & ROS 2 TOPICS

### 🌐 Endpoints RESTful API Chính (Phân loại theo Bộ phận)
- `/api/v1/auth`: Đăng nhập, xác thực JWT, phân quyền RBAC theo bộ phận.
- `/api/v1/rag`: Lễ tân & Reception tra cứu tri thức khách sạn (ChromaDB Vector Base).
- `/api/v1/ai`: Engine trí tuệ nhân tạo Ollama Local Conversational AI.
- `/api/v1/map`: Định vị bản đồ 2D SLAM LiDAR & điều hướng Robot.
- `/api/v1/operations/restaurant/reservations`: **Bộ phận Nhà hàng - Robot / Khách đặt bàn trước**.
- `/api/v1/operations/restaurant/pre-orders`: **Bộ phận Nhà hàng - Robot / Khách đặt món ăn trước**.
- `/api/v1/operations/room-service/*`: Phục vụ đồ ăn thức uống tại phòng (F&B).
- `/api/v1/operations/housekeeping/*`: Quản lý yêu cầu vệ sinh & buồng phòng.
- `/api/v1/operations/bell-services/*`: Quản lý yêu cầu vận chuyển hành lý Bellman.
- `/api/v1/operations/maintenance/*`: Tiếp nhận ticket sự cố & kỹ thuật bảo trì.
- `/api/v1/operations/manager-hub/*`: Ban Giám đốc quản lý chỉ thị & điều hành chung.

### ⚡ Socket.IO Events Reference
| Event Name | Direction | Payload Description |
| :--- | :--- | :--- |
| `GUEST_DETECTED` | Robot -> Server | Phát hiện khách hàng đứng trước Robot camera |
| `NEW_SERVICE_REQUEST` | Server -> Staff App | Báo chuông điện thoại nhân viên có đơn dịch vụ mới |
| `JOYSTICK_MOVE` | Mobile -> Server -> Robot | Tín hiệu góc quay & vận tốc lái Robot thủ công |
| `WEBRTC_OFFER` / `ANSWER` | Web/App <-> Robot | Luồng Signaling bắt tay kết nối Video Call HD |

### 🤖 ROS 2 Topics Reference
| Topic Name | Message Type | Direction | Description |
| :--- | :--- | :--- | :--- |
| `/speech/text` | `std_msgs/msg/String` | Subscribed (Input) | Nhận văn bản đã STT trên Pi 5 |
| `/robot/speech_reply` | `std_msgs/msg/String` | Published (Output) | Phát câu trả lời từ AI LLM tới node TTS |
| `/robot/status` | `std_msgs/msg/String` | Subscribed (Input) | Truyền trạng thái pin và phần cứng về Backend Server |

---

## 🐳 6. TRIỂN KHAI PRODUCTION VỚI DOCKER COMPOSE

Dự án hỗ trợ đóng gói và triển khai 1-click bằng Docker Compose:

```bash
cd f:\DoAn\HC-Robot\backend
docker compose up -d --build
```

Lệnh trên sẽ tự động khởi tạo 3 Containers cách ly:
1. `backend-api`: FastAPI Service (Python 3.10 Container).
2. `postgres-db`: PostgreSQL Relational Database.
3. `chromadb-store`: ChromaDB Vector Database phục vụ RAG.

---

## 📝 GIẤY PHÉP & BẢN QUYỀN (LICENSE)

Dự án được phát triển phục vụ Đồ án Hệ thống Robot Trợ lý Dịch vụ Khách sạn Thông minh (HC-Robot).  
*Bản quyền © 2026 HC-Robot Team.*
