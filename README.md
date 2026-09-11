# INTELLIGENT HOTEL CONCIERGE ROBOT (HC-ROBOT)

> **Hệ Thống Trợ Lý Robot Dịch Vụ Khách Sạn Thông Minh**  
> Giải pháp toàn diện kết hợp **AI Voice Conversational, RAG Knowledge Base, Real-time Socket.IO, WebRTC Call Escalation, ROS 2 Navigation & Dynamic Multi-Platform Clients**.

---

## MỤC LỤC
1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Kiến Trúc Các Phân Hệ (Subsystems)](#2-kiến-trúc-các-phân-hệ-subsystems)
   - [A. Central Backend Server (FastAPI)](#a-central-backend-server-fastapi-python)
   - [B. Frontend Web Console (ReactJS + Vite + Tailwind CSS)](#b-frontend-web-console-reactjs--vite--tailwind-css)
   - [C. Mobile Application (Flutter)](#c-mobile-application-flutter)
   - [D. Robot Edge Node (ROS 2 on Raspberry Pi 5)](#d-robot-edge-node-ros-2-on-raspberry-pi-5)
3. [Cấu Trúc Thư Mục Toàn Dự Án](#3-cấu-trúc-thư-mục-toàn-dự-án)
4. [Hướng Dẫn Cài Đặt & Khởi Chạy Từ A-Z](#4-hướng-dẫn-cài-đặt--khởi-chạy-từ-a-z)
   - [Bước 1: Yêu cầu Tiền đề (Prerequisites)](#bước-1-yêu-cầu-tiền-đề-prerequisites)
   - [Bước 2: Cài Đặt & Khởi Chạy Backend (FastAPI & DB)](#bước-2-cài-đặt--khởi-chạy-backend-fastapi--db)
   - [Bước 3: Cài Đặt & Khởi Chạy Frontend (React)](#bước-3-cài-đặt--khởi-chạy-frontend-react)
   - [Bước 4: Khởi Chạy Nhanh Trên Windows (1-Click Batch)](#bước-4-khởi-chạy-nhanh-trên-windows-1-click-batch)
   - [Bước 5: Cấu Hình & Khởi Chạy Robot Node (Raspberry Pi 5 + ROS 2)](#bước-5-cấu-hình--khởi-chạy-robot-node-raspberry-pi-5--ros-2)
   - [Bước 6: Cấu Hình & Mở Camera Stream (Pi 5 ⇄ Laptop)](#bước-6-cấu-hình--mở-camera-stream-raspberry-pi-5--laptop)
5. [Giao Tiếp Real-time, APIs & ROS 2 Topics](#5-giao-tiếp-real-time-apis--ros-2-topics)
6. [Triển Khai Production Với Docker Compose](#6-triển-khai-production-với-docker-compose)

---

## 1. TỔNG QUAN HỆ THỐNG

**HC-Robot** là hệ thống Robot trợ lý thông minh phục vụ trong môi trường khách sạn cao cấp. Hệ thống giải quyết các bài toán giao tiếp tự nhiên với khách hàng, tự động tiếp nhận yêu cầu dịch vụ (dọn phòng, gọi taxi, mượn vật dụng), hỗ trợ nhân viên quản lý theo thời gian thực và cho phép can thiệp điều khiển từ xa.

### Sơ Đồ Kiến Trúc Tổng Thể

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

## 2. KIẾN TRÚC CÁC PHÂN HỆ (SUBSYSTEMS)

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

## 3. CẤU TRÚC THƯ MỤC TOÀN DỰ ÁN

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
├── robot/                      # Robot Edge Controller & ROS 2 (Raspberry Pi 5)
│   ├── main.py                 # Điều khiển động cơ, cảm biến & auto-start camera stream
│   ├── scripts/
│   │   ├── camera_stream.py    # MJPEG HTTP Server đa luồng cho camera (OpenCV / Picamera2)
│   │   └── setup_gpio_permissions.sh # Script phân quyền GPIO trên Pi
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

## 4. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY TỪ A-Z

### Bước 1: Yêu cầu Tiền đề (Prerequisites)
- **Hệ điều hành**: Windows 10/11 (Dev Laptop) & Ubuntu 22.04/24.04 (Raspberry Pi 5).
- **Python**: Version `3.10` trở lên.
- **Node.js**: Version `18.x` hoặc `20.x`.
- **PostgreSQL**: Version `14+` chạy local hoặc Docker.
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

5. **Seed tài khoản PostgreSQL**:
   Tạo tài khoản nhân viên bằng file seed riêng (mật khẩu mặc định: `123456`):
   ```powershell
   python scripts/seed_accounts.py
   ```
   Tạo riêng tài khoản Robot Kiosk:
   ```powershell
   python scripts/seed_robot_accounts.py
   ```
   Tạo dữ liệu mẫu cho dashboard lễ tân:
   ```powershell
   python scripts/seed_reception_data.py
   ```
   Chỉ tạo các bảng còn thiếu, không tự seed tài khoản:
   ```powershell
   python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
   ```

   **Danh Sách Tài Khoản Hệ Thống Theo Bộ Phận:**
   | Tên Đăng Nhập (Username) | Mật Khẩu | Tên Bộ Phận / Chức Danh | Phân Hệ Dashboard |
   | :--- | :--- | :--- | :--- |
   | `reception` | `123456` | Nhân viên Lễ tân (Reception) | Lễ tân Hub / Executive |
   | `roomservice` | `123456` | Nhân viên Phục vụ phòng (F&B) | Room Service |
   | `housekeeping` | `123456` | Nhân viên Buồng phòng (Housekeeping) | Housekeeping |
   | `bellman` | `123456` | Nhân viên Vận chuyển hành lý (Bellman) | Bell Services |
   | `maintenance` | `123456` | Nhân viên Kỹ thuật & Bảo trì | Maintenance |
   | `manager` | `123456` | Ban Quản lý Khách sạn (Manager) | Executive Hub |
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

### Bước 5: Cấu Hình & Khởi Chạy Robot Node (Raspberry Pi 5 + ROS 2)

Hướng dẫn riêng cho Raspberry Pi 5 + ESP32 + L298N + 4 HC-SR04: [`robot/ULTRASONIC_SETUP.md`](robot/ULTRASONIC_SETUP.md).

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

# Tạo group gpio (nếu Ubuntu chưa có), cài udev rule và cấp quyền cho user
bash scripts/setup_gpio_permissions.sh
sudo reboot

colcon build --symlink-install
source install/setup.bash

# Khởi chạy AI Bridge Node
ros2 run hc_robot_client ai_bridge_node

# Khởi chạy Telemetry Node (trong terminal khác)
ros2 run hc_robot_client telemetry_node
```

---

### Bước 6: Cấu Hình & Mở Camera Stream (Raspberry Pi 5 ⇄ Laptop)

Hệ thống hỗ trợ truyền hình ảnh thời gian thực (MJPEG Video Stream) từ camera gắn trên Raspberry Pi 5 (USB Webcam hoặc CSI Camera) về màn hình Robot Kiosk (`/robot`) và trang Admin Monitor (`/admin` -> tab Camera).

#### 1. Khởi chạy Camera trên Raspberry Pi 5

##### A. Cài đặt thư viện phụ thuộc
```bash
# Đối với USB Camera/Webcam (Khuyên dùng):
pip3 install opencv-python-headless

# Hoặc nếu dùng CSI Ribbon Camera (Raspberry Pi Camera Module v3):
pip3 install picamera2
```

##### B. Cách khởi chạy Camera
- **Cách 1: Tự động mở kèm Robot Controller (`main.py` - Khuyên dùng):**
  Khi chạy bộ điều khiển động cơ và cảm biến robot, Camera Stream sẽ tự khởi chạy ở chế độ background daemon thread trên port `8554`:
  ```bash
  cd ~/HC-Robot/robot
  python3 main.py
  ```
  *(Mẹo: Thêm cờ `--no-camera` nếu chỉ muốn test động cơ/cảm biến mà không cần bật cam: `python3 main.py --no-camera`)*

- **Cách 2: Chạy độc lập kịch bản Camera Stream (`camera_stream.py`):**
  Nếu chỉ muốn stream camera riêng biệt phục vụ kiểm thử:
  ```bash
  cd ~/HC-Robot/robot
  python3 scripts/camera_stream.py --port 8554 --width 640 --height 480 --fps 30
  ```

- **Kiểm tra trạng thái luồng camera ngay trên Pi 5:**
  ```bash
  curl http://localhost:8554/health
  # Phản hồi mẫu: {"status": "ok", "backend": "opencv", "clients": 0, "fps": 30}
  ```

#### 2. Kết nối Camera từ Pi 5 về Laptop Windows

##### Cách A: Dùng SSH Tunnel (Port Forwarding - Tiện lợi nhất khi Dev)
Mở một cửa sổ PowerShell hoặc Command Prompt riêng trên Laptop Windows và chạy:
```powershell
ssh -L 8554:localhost:8554 pi@<IP_PI5> -N
```
> Thay `<IP_PI5>` bằng địa chỉ IP của Pi 5 (ví dụ: `192.168.1.50` hoặc IP Tailscale `100.x.y.z`).  
> Lệnh này sẽ ánh xạ cổng `8554` của Pi 5 về trực tiếp `localhost:8554` trên Laptop. Giữ cửa sổ terminal này mở trong suốt quá trình sử dụng.

##### Cách B: Kết nối trực tiếp qua IP Mạng LAN / Tailscale
Nếu Laptop và Pi 5 cùng lớp mạng Wi-Fi hoặc đã kết nối VPN Tailscale, bạn có thể trỏ thẳng vào IP của Pi 5 mà không cần SSH tunnel:  
`http://<IP_PI5>:8554/stream`

#### 3. Cấu hình & Xem Camera trên Laptop

##### A. Cấu hình biến môi trường Frontend (`frontend/.env`)
Tạo hoặc cập nhật file `frontend/.env` (tham khảo `frontend/.env.example`):
```env
# Nguồn camera: 'pi5' (từ Raspberry Pi 5) hoặc 'local' (webcam tích hợp trên laptop)
VITE_CAMERA_SOURCE=pi5

# Đường dẫn luồng video MJPEG từ Pi 5:
# - Nếu dùng SSH Tunnel hoặc chạy local:
VITE_PI5_CAMERA_URL=http://localhost:8554/stream

# - Nếu kết nối trực tiếp qua IP mạng LAN/Tailscale:
# VITE_PI5_CAMERA_URL=http://<IP_PI5>:8554/stream
```

##### B. Các giao diện xem Camera trên Laptop
1. **Trang Giám sát Quản trị viên (Admin Camera Portal):**
   - Đăng nhập tài khoản `admin` (mật khẩu: `123456`) tại `http://localhost:3000`.
   - Vào **Admin Portal** (`/admin`), chọn tab **"Camera"** (icon Video) trên thanh sidebar trái.
   - Các tính năng hỗ trợ:
     - 🔴 **Live Stream**: Hiển thị hình ảnh từ Pi 5 thời gian thực với độ trễ cực thấp.
     - 📸 **Snapshot & Download**: Chụp lại khung hình ngay lập tức và tải ảnh `.jpg` về máy.
     - ⛶ **Toàn màn hình (Fullscreen)**: Mở rộng khung nhìn toàn màn hình.
     - ⚙️ **Tùy chỉnh Stream URL**: Thay đổi nhanh địa chỉ luồng camera trực tiếp trên giao diện mà không cần restart frontend.
     - 💓 **Health Check Monitor**: Tự động kiểm tra endpoint `/health` mỗi 5s để báo trạng thái kết nối (ONLINE/OFFLINE).
2. **Màn hình Kiosk Robot (`/robot`):**
   - Đăng nhập tài khoản `robot_01` hoặc chuyển sang màn hình Robot Kiosk.
   - Khung Camera Preview góc trên màn hình sẽ nhận luồng video từ Pi 5 phục vụ phát hiện khuôn mặt và giao tiếp với khách hàng.
3. **Xem trực tiếp trên Trình duyệt Web:**
   - Mở trình duyệt bất kỳ gõ `http://localhost:8554` (trang dashboard test) hoặc `http://localhost:8554/stream` (luồng hình ảnh thuần).

#### 4. (Tùy chọn) Cài đặt Camera tự khởi động cùng Raspberry Pi (systemd)
Nếu muốn camera tự khởi chạy mỗi khi Pi 5 bật nguồn:
1. Tạo file service:
   ```bash
   sudo nano /etc/systemd/system/hc-camera.service
   ```
2. Thêm nội dung cấu hình:
   ```ini
   [Unit]
   Description=HC-Robot Camera MJPEG Stream Service
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/HC-Robot/robot
   ExecStart=/usr/bin/python3 /home/pi/HC-Robot/robot/scripts/camera_stream.py --port 8554
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
3. Kích hoạt và khởi chạy service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable hc-camera.service
   sudo systemctl start hc-camera.service
   ```

---

## 5. GIAO TIẾP REAL-TIME, APIS & ROS 2 TOPICS

### Endpoints RESTful API Chính (Phân loại theo Bộ phận)
- `/api/v1/auth`: 1. Đăng nhập, xác thực JWT, phân quyền RBAC theo bộ phận.
- `/api/v1/ai`: 2. Engine trí tuệ nhân tạo Ollama Local Conversational AI.
- `/api/v1/map`: 3. Định vị bản đồ 2D SLAM LiDAR & điều hướng Robot.
- `/api/v1/rag`: 4. Bộ phận Lễ tân & Reception tra cứu tri thức khách sạn (ChromaDB Vector Base).
- `/api/v1/operations/dashboard/reception` và `/reception/*`: Phiếu hỗ trợ khách và điều phối tác vụ của Reception.
- `/api/v1/operations/room-service/*`: 5. Phục vụ đồ ăn thức uống tại phòng (F&B / Room Service).
- `/api/v1/operations/housekeeping/*`: 6. Quản lý yêu cầu vệ sinh & buồng phòng (Housekeeping).
- `/api/v1/operations/bell-services/*`: 7. Quản lý yêu cầu vận chuyển hành lý (Bellman Services).
- `/api/v1/operations/maintenance/*`: 8. Tiếp nhận ticket sự cố & kỹ thuật bảo trì (Maintenance).
- `/api/v1/operations/directives`: 9. Tạo yêu cầu điều phối vận hành liên bộ phận.
- `/api/v1/operations/restaurant/*`: 10. Bộ phận Nhà hàng (Restaurant - Robot đặt bàn & đặt món trước).

### Socket.IO Events Reference
| Event Name | Direction | Payload Description |
| :--- | :--- | :--- |
| `GUEST_DETECTED` | Robot -> Server | Phát hiện khách hàng đứng trước Robot camera |
| `NEW_SERVICE_REQUEST` | Server -> Staff App | Báo chuông điện thoại nhân viên có đơn dịch vụ mới |
| `JOYSTICK_MOVE` | Mobile -> Server -> Robot | Tín hiệu góc quay & vận tốc lái Robot thủ công |
| `WEBRTC_OFFER` / `ANSWER` | Web/App <-> Robot | Luồng Signaling bắt tay kết nối Video Call HD |

### ROS 2 Topics Reference
| Topic Name | Message Type | Direction | Description |
| :--- | :--- | :--- | :--- |
| `/speech/text` | `std_msgs/msg/String` | Subscribed (Input) | Nhận văn bản đã STT trên Pi 5 |
| `/robot/speech_reply` | `std_msgs/msg/String` | Published (Output) | Phát câu trả lời từ AI LLM tới node TTS |
| `/robot/status` | `std_msgs/msg/String` | Subscribed (Input) | Truyền trạng thái pin và phần cứng về Backend Server |

---

## 6. TRIỂN KHAI PRODUCTION VỚI DOCKER COMPOSE

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

## GIẤY PHÉP & BẢN QUYỀN (LICENSE)

Dự án được phát triển phục vụ Đồ án Hệ thống Robot Trợ lý Dịch vụ Khách sạn Thông minh (HC-Robot).  
*Bản quyền © 2026 HC-Robot Team.*
