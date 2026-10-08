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
   - [Bước 4: Hướng Dẫn Khởi Chạy Toàn Bộ Hệ Thống (Mở Từng Cái & 1-Click Batch)](#bước-4-hướng-dẫn-khởi-chạy-toàn-bộ-hệ-thống-mở-từng-cái--1-click-batch)
   - [Bước 5: Cấu Hình & Khởi Chạy Robot Node (Raspberry Pi 5 + ROS 2)](#bước-5-cấu-hình--khởi-chạy-robot-node-raspberry-pi-5--ros-2)
   - [Bước 6: Cấu Hình & Mở Camera Stream (Pi 5 <-> Laptop)](#bước-6-cấu-hình--mở-camera-stream-pi-5--laptop)
   - [Bước 7: Quy Trình Tạo Map SLAM & Điều Hướng Nav2 (Pi 5 <-> Laptop WSL2 <-> Web Admin)](#bước-7-quy-trình-tạo-map-slam--điều-hướng-nav2-pi-5--laptop-wsl2--web-admin)
   - [Bước 8: Khởi Chạy Giả Lập 3D & Tự Hành Né Vật Cản (Gazebo Sim + RViz2 LiDAR)](#bước-8-khởi-chạy-giả-lập-3d--tự-hành-né-vật-cản-gazebo-sim--rviz2-lidar)
5. [Giao Tiếp Real-time, APIs & ROS 2 Topics](#5-giao-tiếp-real-time-apis--ros-2-topics)
6. [Triển Khai Production Với Docker Compose](#6-triển-khai-production-với-docker-compose)
7. [Tài Liệu Kỹ Thuật Chuyên Sâu (Documentation Index)](#7-tài-liệu-kỹ-thuật-chuyên-sâu-documentation-index)

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
     - **Bảo mật Kiosk chuyên nghiệp (Zero-Exposure UI)**: Ẩn hoàn toàn nút đăng xuất khỏi tầm mắt khách hàng. Nhân viên & Kỹ thuật viên thoát ứng dụng bằng cử chỉ **Secret Multi-Tap** (Gõ 5 lần liên tiếp trong 2 giây vào Logo hoặc góc màn hình trên cả Web Kiosk và App PWA) hoặc phím tắt `Ctrl + Shift + L`, kết hợp nhập mật khẩu bảo vệ 2 lớp.
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
├── robot/                      # Robot Edge Controller & ROS 2 (Raspberry Pi 5 + Laptop WSL2)
│   ├── main.py                 # Điều khiển động cơ, an toàn vật cản & LiDAR/Camera services
│   ├── description/            # Mô hình 3D URDF & xacro (robot.urdf, lidar.xacro...)
│   ├── maps/                   # Thư mục lưu bản đồ SLAM Occupancy Grid (.yaml + .pgm)
│   ├── ros2_configs/           # Cấu hình SLAM Toolbox, Bridge, RViz2
│   │   ├── start_wsl_slam.sh   # 1-Click khởi chạy toàn bộ SLAM Stack trên WSL2
│   │   ├── lidar_ws_to_ros2.py # Bridge WebSocket Pi 5 -> ROS 2 (/scan, /odom, /robot_path)
│   │   ├── slam_toolbox_params.yaml # Cấu hình thuật toán SLAM Toolbox Online Async
│   │   └── nav2/lidar_view.rviz# Giao diện RViz2 trực quan hóa 3D Robot, LiDAR & Map
│   ├── scripts/
│   │   ├── teleop_keyboard.py  # Điều khiển bàn phím WASD terminal (đồng bộ RViz2 & Pi 5)
│   │   ├── save_map.sh         # Script trích xuất và lưu bản đồ SLAM thành phẩm
│   │   ├── lidar_service.py    # Dịch vụ RPLiDAR SLAM & WebSocket trên Pi 5
│   │   └── camera_stream.py    # MJPEG HTTP Server đa luồng cho camera
│   └── src/
│       └── hc_robot_client/    # ROS 2 Package (nodes, launch, config)
├── docs/                       # Hệ thống tài liệu kỹ thuật chuẩn hóa (guides/, workflows/)
│   ├── guides/                 # Hướng dẫn ROS 2 phân tán, AI pipeline, Alembic, Ultrasonic
│   ├── workflows/              # Đặc tả kịch bản tương tác (Stepflow) & biên bản bàn giao
│   └── README.md               # Trung tâm chỉ mục tài liệu (Docs Index)
├── start_all.bat               # Windows Batch Script khởi chạy nhanh Backend & Frontend
├── stop_all.bat                # Windows Batch Script dừng an toàn toàn bộ tiến trình
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

### Bước 4: Hướng Dẫn Khởi Chạy Toàn Bộ Hệ Thống (Mở Từng Cái & 1-Click Batch)

Toàn bộ hệ thống HC-Robot bao gồm 4 tiến trình chính kết nối với nhau qua mạng an toàn **Tailscale Mesh VPN**. Tùy thuộc vào nhu cầu phát triển hoặc vận hành, bạn có thể lựa chọn 1 trong 2 cách sau:

---

#### CÁCH 1: MỞ THỦ CÔNG TỪNG CÁI (DÀNH CHO LẬP TRÌNH & DEBUG TỪNG PHÂN HỆ)

Mở 4 cửa sổ Terminal riêng biệt theo đúng thứ tự sau:

##### Terminal 1 (Laptop - Backend FastAPI Server)
Mở PowerShell trên Windows và chạy:
```powershell
cd f:\DoAn\HC-Robot\backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- **Nhiệm vụ:** Bộ não trung tâm AI RAG, Database PostgreSQL, WebSocket Voice & RESTful API.
- **Kiểm tra:** Mở trình duyệt vào `http://localhost:8000/docs`.

##### Terminal 2 (Laptop - Frontend React Web Admin)
Mở cửa sổ PowerShell thứ 2 trên Windows và chạy:
```powershell
cd f:\DoAn\HC-Robot\frontend
npm run dev
```
- **Nhiệm vụ:** Giao diện Quản trị viên (`/admin`), Màn hình mặt Robot Kiosk (`/robot`) và Canvas hiển thị LiDAR 2D.
- **Kiểm tra:** Mở trình duyệt vào `http://localhost:3000`.

##### Terminal 3 (Laptop - WSL2 Ubuntu-24.04 ROS 2 SLAM Stack)
Mở cửa sổ PowerShell thứ 3 trên Windows để vào môi trường Linux WSL2:
```powershell
wsl -d Ubuntu-24.04
```
Sau khi vào shell `kha@...:~$`, khởi chạy SLAM Toolbox và Rosbridge:
```bash
bash /mnt/f/DoAn/HC-Robot/robot/ros2_configs/start_wsl_slam.sh
```
- **Nhiệm vụ:**
  - Khởi động `rosbridge_server` mở cổng WebSocket `9090` truyền dữ liệu lên Web Admin.
  - Chạy cầu nối `lidar_ws_to_ros2.py` tự động hút tia quét từ Pi 5 về Laptop qua Tailscale.
  - Chạy `slam_toolbox` tính toán ma trận lưới Occupancy Grid và xuất topic `/map`.

##### Terminal 4 (SSH từ Laptop vào Raspberry Pi 5 - Khởi chạy Phần Cứng Robot)
Mở cửa sổ PowerShell thứ 4 trên Windows và **SSH trực tiếp vào Raspberry Pi 5** qua địa chỉ IP Tailscale (Ví dụ: `100.99.72.51`):
```powershell
ssh pi@100.99.72.51
```
*(Nhập mật khẩu SSH của Pi 5)*.

Sau khi đã đăng nhập thành công vào Pi 5 (`pi@raspberrypi:~$`), chạy bộ điều khiển All-in-One:
```bash
cd ~/HC-Robot/robot
sudo python3 main.py
```
> **Giải thích cơ chế:** Lệnh `sudo python3 main.py` đã tự động gộp và chạy ngầm toàn bộ 4 thành phần phần cứng quan trọng:
> 1. **Động cơ bánh xe (L298N):** Nhận lệnh lái bàn phím WASD hoặc nhận lệnh điều khiển từ xa qua UDP port `9999`.
> 2. **Camera Stream HD:** Tự động mở luồng video MJPEG tại port `8554` cho Web Admin giám sát.
> 3. **Cảm biến siêu âm (ESP32):** Tự động đo khoảng cách 4 góc và khóa an toàn nếu sắp đụng tường.
> 4. **Cảm biến LiDAR (RPLiDAR A1M8):** Tự quay mô tơ 360° và stream dữ liệu tia quét qua WebSocket port `8000` để Terminal 3 (WSL2) nhận và vẽ bản đồ.

---

#### CÁCH 2: KHỞI CHẠY 1-CLICK TỰ ĐỘNG HÓA (CẮT GIẢM TỐI ĐA THAO TÁC)

Nếu không muốn mở nhiều cửa sổ terminal thủ công:

1. **Trên Laptop (1-Click bật cả Backend, Frontend và WSL2 SLAM):**
   - Tại thư mục gốc `f:\DoAn\HC-Robot`, nhấp đúp chuột vào file:
     ```text
     start_all.bat
     ```
   - Kịch bản sẽ tự động mở đồng thời Backend (:8000), Frontend (:3000), WSL2 SLAM (:9090) và tự mở luôn trang Web Admin trên trình duyệt!
   - Khi muốn dừng tất cả: Nhấp đúp chuột vào file `stop_all.bat`.

2. **Trên Raspberry Pi 5:**
   - **Tùy chọn A (Chạy thủ công nhanh - 1 lệnh duy nhất):**
     SSH vào Pi 5: `ssh pi@100.99.72.51` và gõ `sudo python3 ~/HC-Robot/robot/main.py`.
   - **Tùy chọn B (Tự động chạy ngầm khi cắm điện - 0 Cần SSH):**
     SSH vào Pi 5 chạy đúng 1 lần duy nhất lệnh cài đặt dịch vụ systemd:
     ```bash
     bash ~/HC-Robot/robot/setup_autostart_service.sh
     ```
     Từ nay về sau, mỗi khi cắm nguồn Pi 5, robot sẽ tự khởi động ngầm Động cơ + Camera + LiDAR mà bạn không cần phải SSH hay mở bất kỳ terminal nào trên Pi 5 nữa!

---

#### CÁCH 3: KHỞI CHẠY GIẢ LẬP 3D & DEMO TỰ HÀNH NÉ VẬT CẢN (1-CLICK BATCH)
Nếu muốn chạy thử nghiệm toàn bộ hệ thống Robot tự hành trong thế giới ảo 3D mà không cần kết nối Raspberry Pi 5 vật lý:
- Nhấp đúp chuột vào file:
  ```text
  demo_tu_hanh.bat
  ```
- Hệ thống sẽ tự động khởi động đồng thời **Gazebo Sim 8**, **ROS 2 Parameter Bridge**, **RViz2 (Chùm tia Laser LiDAR 360°)** và node điều hướng tự hành **Artificial Potential Field (APF)** tuần tra né vật cản.
- Xem chi tiết tại [Bước 8: Khởi Chạy Giả Lập 3D](#bước-8-khởi-chạy-giả-lập-3d--tự-hành-né-vật-cản-gazebo-sim--rviz2-lidar).

---

### Bước 5: Cấu Hình & Khởi Chạy Robot Node (Raspberry Pi 5 + ROS 2)

Hướng dẫn riêng cho Raspberry Pi 5 + ESP32 + L298N + 4 HC-SR04: [`docs/guides/ultrasonic_setup.md`](docs/guides/ultrasonic_setup.md).

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

#### 3. Tối ưu bộ nhớ RAM cho Pi 5 (Tắt GUI Desktop)
Để giải phóng khoảng 700MB - 1GB RAM trên Ubuntu Desktop giúp các tiến trình ROS 2 và SLAM hoạt động ổn định:
- **Lệnh tắt GUI Desktop khi khởi động (chuyển sang CLI mode):**
  ```bash
  sudo systemctl set-default multi-user.target
  sudo reboot
  ```
- **Lệnh bật lại GUI Desktop (khi cần cắm màn hình rời để dùng):**
  ```bash
  sudo systemctl set-default graphical.target
  sudo reboot
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
     - **Live Stream**: Hiển thị hình ảnh từ Pi 5 thời gian thực với độ trễ cực thấp.
     - **Snapshot & Download**: Chụp lại khung hình ngay lập tức và tải ảnh `.jpg` về máy.
     - **Toàn màn hình (Fullscreen)**: Mở rộng khung nhìn toàn màn hình.
     - **Tùy chỉnh Stream URL**: Thay đổi nhanh địa chỉ luồng camera trực tiếp trên giao diện mà không cần restart frontend.
     - **Health Check Monitor**: Tự động kiểm tra endpoint `/health` mỗi 5s để báo trạng thái kết nối (ONLINE/OFFLINE).
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

### Bước 7: Quy Trình Tạo Map SLAM & Điều Hướng Nav2 (Pi 5 <-> Laptop WSL2 <-> Web Admin)

Hệ thống áp dụng mô hình **Distributed Robotics Computing** kết hợp mạng an toàn **Tailscale Mesh VPN**:
- **Raspberry Pi 5 (Edge Sensor Node):** Thu thập dữ liệu thô từ LiDAR (RPLiDAR A1M8/A2) qua USB/Serial, stream tia quét sang Laptop. CPU Pi 5 chỉ chiếm < 5%, tiết kiệm pin tối đa.
- **Laptop WSL2 (Compute & SLAM Master):** Nhận stream tia quét, chạy **SLAM Toolbox** dựng bản đồ lưới 2D Occupancy Grid (`/map`), chạy **Nav2** tự hành và mở **Rosbridge WebSocket** (Port `9090`).
- **Web Admin Console (React UI):** Kết nối WebSocket (`ws://<IP_TAILSCALE>:9090` hoặc backend API), hiển thị bản đồ trực tiếp trên thẻ HTML5 Canvas (`LidarCanvas.jsx`) và hỗ trợ click ghim Waypoint/Goal điều hướng.

```mermaid
flowchart LR
    subgraph Pi5 ["Raspberry Pi 5 (Edge Sensor)"]
        Lidar["RPLiDAR Hardware"] -->|Serial / USB| LidarDriver["LiDAR Node"]
        LidarDriver --> StreamOut["LiDAR Stream (Tailscale IP: 100.99.72.51)"]
    end

    subgraph WSL2 ["Laptop WSL 2 (SLAM & Nav2 Master)"]
        StreamIn["Bridge Node / Scan Topic"] --> SLAM["SLAM Toolbox (Online Async)"]
        SLAM -->|Topic /map| Rosbridge["Rosbridge Server (:9090)"]
        Rosbridge -.-> Nav2["Nav2 Stack (Planner & Controller)"]
        Nav2 -->|Topic /cmd_vel| MotorPi["Động cơ Robot"]
    end

    subgraph Web ["Web Admin Console (React + Vite)"]
        Roslib["WebSocket Client"] --> Canvas["HTML5 Canvas (LidarCanvas)"]
        Canvas --> GoalPose["Click Goal / Waypoints"]
    end

    StreamOut ==>|WireGuard Encrypted Tunnel| StreamIn
    Rosbridge ==>|WebSocket JSON| Roslib
    GoalPose -.->|Topic /goal_pose| Rosbridge
```

#### Chu Trình Vận Hành Cốt Lõi:
```text
[1. Khởi động SLAM Stack] -> [2. Mở RViz2 Giám sát 3D] -> [3. Lái Robot bằng WASD Teleop] -> [4. Lưu Bản đồ thành phẩm]
```

---

#### 1. Khởi động SLAM Stack (Laptop WSL2)
- **Trên Raspberry Pi 5:** Khởi động robot và LiDAR server:
  ```bash
  cd ~/HC-Robot/robot
  sudo python3 main.py
  ```
- **Trên Laptop WSL2:** Khởi chạy toàn bộ stack SLAM chỉ với 1 lệnh:
  ```bash
  bash /mnt/f/DoAn/HC-Robot/robot/ros2_configs/start_wsl_slam.sh
  ```
  *Script sẽ tự động dọn tiến trình cũ và khởi chạy đồng thời:*
  1. `robot_state_publisher`: Đọc URDF 3D của HC-Robot và phát khung tọa độ TF (`base_link`, `laser_frame`...).
  2. `rosbridge_websocket`: Mở cổng WebSocket `ws://127.0.0.1:9090` phục vụ Web Admin.
  3. `lidar_ws_to_ros2.py`: Nhận tia quét từ Pi 5 qua Tailscale, chuẩn hóa chiều quay CCW (chuẩn ROS REP-103), phát `/scan`, `/odom` (30Hz) và `/robot_path`.
  4. `slam_toolbox` (Online Async): Dựng bản đồ Occupancy Grid thời gian thực trên topic `/map`.

---

#### 2. Mở giao diện trực quan 3D RViz2
Trên một terminal WSL2 khác, mở RViz2 với cấu hình chuyên dụng:
```bash
source /opt/ros/jazzy/setup.bash
rviz2 -d /mnt/f/DoAn/HC-Robot/robot/ros2_configs/nav2/lidar_view.rviz
```
*Các thành phần hiển thị trên RViz2:*
- **RobotModel:** Mô hình 3D xe HC-Robot đầy đủ khung gầm cam, bánh xe và cảm biến.
- **Realtime SLAM Map:** Bản đồ lưới Occupancy Grid sắc nét (`Alpha: 0.85`), vùng trắng là không gian trống đã đi qua, viền đen là tường/vật cản kiên cố.
- **LaserScan (Hit Points):** Các điểm va chạm LiDAR màu xanh ngọc (cyan) tức thời.
- **Robot Trajectory:** Đường nét đứt màu vàng hiển thị toàn bộ quỹ đạo xe đã di chuyển.

---

#### 3. Lái Robot quét phòng (Terminal WASD Teleop)
Mở terminal WSL2 thứ ba và chạy công cụ điều khiển bàn phím:
```bash
python3 /mnt/f/DoAn/HC-Robot/robot/scripts/teleop_keyboard.py
```
- **Bàn phím điều khiển:**
  - `W`: Tiến thẳng | `S`: Lùi lại
  - `A`: Xoay trái  | `D`: Xoay phải
  - `Q` / `E`: Rẽ trái / Rẽ phải vừa tiến
  - `SPACE` hoặc `X`: Phanh dừng khẩn cấp
  - `+` / `-`: Tăng / Giảm vận tốc tuyến tính ($v_x$)
  - `]` / `[`: Tăng / Giảm vận tốc góc ($\omega_z$)
- **Đồng bộ kép:** Lệnh phím vừa bắn `/cmd_vel` cho Odometry Dead-Reckoning trên RViz2, vừa bắn UDP (Port `9999`) trực tiếp tới Pi 5 để quay motor bánh xe thật.
- **Quy tắc di chuyển:** Lái xe tốc độ vừa phải ($0.20 - 0.25\text{ m/s}$) men theo các bức tường. Bản đồ sẽ tự động mở rộng theo thời gian thực và ghim các vật cản mới xuất hiện vào bản đồ.

---

#### 4. Lưu Bản đồ thành phẩm (Save Map)
Khi robot đã quét kín không gian phòng và các đường biên đã khép góc hoàn chỉnh (Loop Closure):
```bash
/mnt/f/DoAn/HC-Robot/robot/scripts/save_map.sh phong_lam_viec
```
- Lệnh trên sẽ tự động xuất cặp file vào thư mục `robot/maps/`:
  - `phong_lam_viec.yaml`: Chứa tọa độ gốc `origin`, độ phân giải `resolution: 0.05` (5cm/ô lưới).
  - `phong_lam_viec.pgm`: Ảnh nhị phân mặt bằng sàn để đưa lên Web Admin hoặc làm dữ liệu định vị cho Nav2.

---

#### 5. Mẹo xóa bản đồ quét lại từ đầu (Reset / Fresh Start)
Khi muốn xóa sạch bản đồ cũ để quét một căn phòng mới:
1. Nhấn `Ctrl + C` tại terminal đang chạy `start_wsl_slam.sh`.
2. Trên cửa sổ RViz2, nhấn nút **Reset** ở góc dưới cùng bên phải (hoặc phím tắt `Alt + R`).
3. Khởi chạy lại: `bash /mnt/f/DoAn/HC-Robot/robot/ros2_configs/start_wsl_slam.sh`.

---

#### 6. TẮT SLAM, BẬT NAV2 (Navigation Phase)
Sau khi đã có bản đồ hoàn chỉnh, chuyển sang chế độ tự hành thương mại:
1. **Tắt SLAM:** Nhấn `Ctrl + C` tại terminal `start_wsl_slam.sh`.
2. **Khởi chạy Nav2:**
   ```bash
   ros2 launch nav2_bringup bringup_launch.py \
     use_sim_time:=False \
     map:=/mnt/f/DoAn/HC-Robot/robot/maps/phong_lam_viec.yaml
   ```
3. **Tự hành:** AMCL sẽ định vị vị trí robot trên bản đồ tĩnh, Costmap phát hiện người đi lại và né vật cản, đồng thời nhận mục tiêu từ Web Admin qua topic `/goal_pose`.

---

#### 7. Cải tiến Kỹ thuật Đột phá trong SLAM Stack
| Điểm cải tiến | Giải pháp kỹ thuật | Tác dụng |
| :--- | :--- | :--- |
| **Chuẩn hóa góc CCW (REP-103)** | `ros_angle = (360 - angle) % 360` trong [lidar_ws_to_ros2.py](robot/ros2_configs/lidar_ws_to_ros2.py) | Triệt tiêu lỗi lật gương trái-phải của RPLiDAR A1M8, giúp Scan Matcher bám tường chuẩn xác khi quay xe. |
| **Đồng bộ hóa Timestamp TF** | Dùng chung timestamp giữa TF `odom -> base_link` và topic `/scan` | Triệt tiêu 100% lỗi rớt tia LiDAR (*dropping message: earlier than transform cache*). |
| **Tối ưu Scan Matcher Ceres** | `angle_variance_penalty: 0.30`, `distance_variance_penalty: 0.25` trong [slam_toolbox_params.yaml](robot/ros2_configs/slam_toolbox_params.yaml) | Cho phép Scan Matcher linh hoạt tự nắn chỉnh sai số góc trôi bánh xe, bản đồ liên tục lưu vật cản mới khi xe đi vào vùng lạ. |
| **Tăng tầm liên kết Pose-Graph** | `link_scan_maximum_distance: 4.0m`, `scan_buffer_size: 30` | Bản đồ không bị đứt đoạn hay tạo vệt sọc khi xe đổi hướng hoặc đi qua khoảng trống lớn. |
| **Trực quan hóa RViz2 & Model 3D** | Tích hợp [robot.urdf](robot/description/robot.urdf) và cấu hình [lidar_view.rviz](robot/ros2_configs/nav2/lidar_view.rviz) | Hiển thị mô hình 3D thực tế của HC-Robot, Occupancy Grid độ tương phản cao, chùm tia LiDAR và vệt đường vàng. |

---

### Bước 8: Khởi Chạy Giả Lập 3D & Tự Hành Né Vật Cản (Gazebo Sim + RViz2 LiDAR)

Dành cho kiểm thử và trình diễn tính năng Robot tự hành trong môi trường 3D mô phỏng (**Digital Twin**) mà không cần phần cứng Raspberry Pi 5.

#### 1. Các thành phần trong kịch bản giả lập
- **Gazebo Sim (Harmonic 8):** Mô phỏng thế giới vật lý 3D sa bàn sảnh khách sạn rộng **8m x 6m**, 6 cột trụ vật cản và chú robot HC-Robot với hệ truyền động vi sai (Differential Drive).
- **Robot State Publisher (RSP):** Tính toán và xuất cây khung tọa độ TF (`base_link`, `left_wheel`, `right_wheel`, `laser_frame`, `camera_link`).
- **ROS-Gazebo Parameter Bridge (`ros_gz_bridge`):** Cầu nối đồng bộ 2 chiều dữ liệu thời gian thực giữa Gazebo và ROS 2:
  - `/clock`: Đồng bộ Simulation Time chính xác tới mili-giây.
  - `/cmd_vel`: Nhận lệnh điều khiển vận tốc tuyến tính ($v_x$) và vận tốc góc ($\omega_z$).
  - `/odom`: Xuất tọa độ và vận tốc xe phục vụ định vị Odometry.
  - `/scan`: Xuất dữ liệu cảm biến Laser LiDAR 360° (360 tia quét độ phân giải $1^\circ$).
- **RViz2 Visualization:** Hiển thị trực quan 3D chuyên dụng:
  - `RobotModel`: Mô hình xe 3D sắc nét (`Status: OK`).
  - `LiDAR 360 Rays (Blue Beams)`: Chùm 360 tia laser màu xanh điện quang (**Electric Blue**) phóng quét từ đỉnh robot ra toàn khán phòng, tự động gập và tạo bóng khi va chạm cột trụ.
  - `Obstacle Pillars (White)`: Tọa độ 6 cột trụ trắng được định vị chuẩn xác.
  - `LaserScan (Hit Points)`: Các điểm va chạm sáng rực trên chướng ngại vật.
- **Autonomous APF Navigator ([autonomous_navigator.py](robot/scripts/autonomous_navigator.py)):** Node điều khiển tự hành tuần tra khép kín qua 5 Waypoints kết hợp thuật toán **Trường thế nhân tạo (Artificial Potential Field - APF)** để chủ động phát hiện cột từ xa, tự động hãm phanh và lách sang làn thoáng, tuyệt đối không va chạm.

---

#### 2. Hướng dẫn khởi chạy

##### Cách A: Khởi chạy 1-Click (Khuyên dùng trên Windows)
Tại thư mục gốc dự án `f:\DoAn\HC-Robot`, nhấp đúp chuột vào file:
```text
demo_tu_hanh.bat
```
> Kịch bản sẽ tự động mở WSL2 Ubuntu-24.04, dọn dẹp các tiến trình cũ, khởi động Gazebo Sim, khởi chạy cầu nối ROS 2, mở RViz2 với cấu hình LiDAR tối ưu và kích hoạt robot tự hành tuần tra.

##### Cách B: Khởi chạy bằng lệnh Terminal (WSL2 / Linux)
Mở cửa sổ PowerShell hoặc Terminal WSL2 và chạy lệnh:
```bash
wsl -d Ubuntu-24.04 bash /mnt/f/DoAn/HC-Robot/robot/scripts/launch_autonomous_demo.sh
```

---

#### 3. Quan sát và Đánh giá Demo
Khi hệ thống khởi chạy, bạn sẽ thấy 2 cửa sổ hoạt động đồng bộ:
1. **Cửa sổ Gazebo Sim:**
   - Robot HC-Robot (khung gầm cam, bánh xanh) lăn bánh mượt mà trên sàn gạch sa bàn 8x6m.
   - Khi tiếp cận các cột trụ trắng ở cự ly $< 0.9\text{m}$, robot tự động giảm tốc độ, lách vòng quanh cột theo đường cong mềm mại và tiếp tục tiến về mục tiêu tiếp theo.
2. **Cửa sổ RViz2:**
   - Chùm tia laser 360° màu xanh điện quang tỏa ra từ tâm cảm biến LiDAR, liên tục quét không gian và hiển thị phản xạ vật lý.
   - Telemetry hiển thị chi tiết khoảng cách các hướng trên Terminal:
     ```text
     [LiDAR 360°] Mũi trước: 1.93m | Trái: 1.93m | Phải: 0.12m -> Robot tại: (0.64, 0.00) -> Cách đích: 1.76m
     ```

#### 4. Cách dừng giả lập
Để dừng toàn bộ hệ thống giả lập:
- Nhấn `Ctrl + C` tại cửa sổ Terminal đang chạy script. Kịch bản sẽ tự động dọn dẹp và đóng an toàn tất cả các tiến trình (Gazebo Sim, RViz2, Bridge và Navigator).

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

## 7. TÀI LIỆU KỸ THUẬT CHUYÊN SÂU (DOCUMENTATION INDEX)

Toàn bộ tài liệu chuyên sâu được phân loại và quản lý tập trung trong thư mục [`docs/`](docs/README.md):

* 🤖 **Kiến Trúc & Robot ROS 2**:
  * [Kiến Trúc Mạng ROS 2 Phân Tán (Distributed ROS 2)](docs/guides/distributed_ros2.md)
  * [Cấu Hình Cảm Biến Siêu Âm HC-SR04 & ESP32](docs/guides/ultrasonic_setup.md)
* 🧠 **Trí Tuệ Nhân Tạo (AI Core)**:
  * [Tối Ưu Hóa AI & Audio Pipeline](docs/guides/ai_optimization.md)
  * [Test Harness & Đánh Giá LangGraph](docs/guides/langgraph_harness.md)
  * [Kiến Trúc Thu Thập Đánh Giá Feedback 5 Sao](docs/guides/robot_feedback_architecture.md)
  * [Cơ Chế Bảo Mật Thoát Kiosk (Secret Multi-Tap Gesture)](docs/guides/kiosk_security_exit.md)
* ⚙️ **Kịch Bản & Nghiệp Vụ (Workflows)**:
  * [Đặc Tả 7 Core Workflows (Stepflow)](docs/workflows/stepflow.md)
  * [Báo Cáo Tiến Độ & Bàn Giao Workflow](docs/workflows/workflow_handover.md)
* 🗄️ **Cơ Sở Dữ Liệu & Backend**:
  * [Hướng Dẫn Quản Lý Database Migration Với Alembic](docs/guides/alembic_guide.md)

---

## GIẤY PHÉP & BẢN QUYỀN (LICENSE)

Dự án được phát triển phục vụ Đồ án Hệ thống Robot Trợ lý Dịch vụ Khách sạn Thông minh (HC-Robot).  
*Bản quyền © 2026 HC-Robot Team.*
