# HUONG DAN KHOI CHAY TOAN BO HE THONG HC-ROBOT
(RASPBERRY PI 5 - BACKEND - FRONTEND - WSL2 ROS 2 - GAZEBO SIM)

Tai lieu nay huong dan quy trinh van hanh va khoi dong day du tat ca cac thanh phan cua he thong HC-Robot, bao gom ca khoi chay tu dong (1-Click) va khoi chay thu cong tung service bang Terminal.

---

## 1. TONG QUAN CAC THANH PHAN HE THONG

| Thanh phan | Moi truong thuc thi | Cong / Giao thuc | Chuc nang chinh |
| :--- | :--- | :--- | :--- |
| **Raspberry Pi 5** | Linux (Debian aarch64) | Port 22 (SSH) | Dieu khien Motor L298N, cam bien LiDAR A1M8, Ultrasonic, Camera |
| **Backend API** | Windows (Python 3.11) | Port 8000 (HTTP/WS) | FastAPI, LangGraph AI Agent, Ollama LLM, Database, REST APIs |
| **Frontend Web** | Windows (Node.js/Vite) | Port 3000 (HTTP) | Man hinh Kiosk Robot, Admin Portal, Phong Gia Lap Workflow |
| **WSL 2 ROS 2 Stack** | Windows WSL2 (Ubuntu 24.04) | Port 9090 (WebSocket) | Rosbridge Suite, SLAM Toolbox, Nav2, Gazebo Simulation |

---

## 2. PHUONG PHAP 1: KHOI CHAY 1-CLICK ALL (KHUYEN DUNG)

Thu muc goc cua project da tich hop san cac script khoi chay tu dong:

### A. Khoi chay tat ca Service tren Laptop (Backend + Frontend + WSL2 ROS 2)
Nhao dup chuot vao file:
```cmd
f:\DoAn\HC-Robot\start_all.bat
```
Script se tu dong:
1. Bat cua so Backend FastAPI tai `http://localhost:8000` (tu kich hoat virtualenv).
2. Bat cua so Frontend React Vite tai `http://localhost:3000`.
3. Bat cua so WSL2 chay Rosbridge WebSocket tai `ws://localhost:9090`.
4. Tu dong mo trinh duyet vao trang Quan tri Admin: `http://localhost:3000/admin`.

### B. Khoi chay Sa ban Mo phong Gazebo (Khi khong co Robot that)
Nhao dup chuot vao file:
```cmd
f:\DoAn\HC-Robot\open_gazebo.bat
```
Hoac khoi chay che do Tu hanh ne vat can:
```cmd
f:\DoAn\HC-Robot\demo_tu_hanh.bat
```

### C. Dung toan bo he thong
Nhao dup chuot vao file:
```cmd
f:\DoAn\HC-Robot\stop_all.bat
```
Script se dong toan bo tien trinh Uvicorn, Python, Node.js va tat instance WSL2.

---

## 3. PHUONG PHAP 2: KHOI DONG THU CONG TUNG DICH VU (TERMINAL)

### BUOC 1: KET NOI VA DIEU KHIEN RASPBERRY PI 5 (SSH)

Robot tren Raspberry Pi 5 co the ket noi thong qua mang VPN Tailscale hoac mang Wi-Fi LAN cuc bo.

#### 1. Ket noi SSH vao Pi 5
Mo PowerShell hoac Command Prompt tren Windows:
```bash
# Ket noi qua dia chi IP Tailscale (uu tien on dinh):
ssh phuc@100.99.72.51

# Hoac ket noi qua Hostname LAN / IP cuc bo:
ssh phuc@raspberrypi.local
# Hoac:
ssh phuc@192.168.1.x
```
*(Mat khau mac dinh theo cau hinh he thong cua Pi 5)*.

#### 2. Kiem tra dich vu tu chay ngam (Systemd Daemon)
Pi 5 da duoc cai dat service tu khoi dong `hc-robot.service` khi cam nguon:
```bash
# Kiem tra trang thai hoat dong cua robot:
sudo systemctl status hc-robot.service

# Xem nhat ky hoat dong (log real-time):
journalctl -u hc-robot.service -f

# Khoi dong lai dich vu robot:
sudo systemctl restart hc-robot.service

# Tam dung dich vu robot:
sudo systemctl stop hc-robot.service
```

#### 3. Chay thu cong chuong trinh robot (neu khong dung systemd)
Neu da dung systemd (`sudo systemctl stop hc-robot.service`), co the chay truc tiep:
```bash
cd ~/HCROBOT/robot
sudo python3 main.py
```

#### 4. Kiem tra luong quet LiDAR va Topic ROS 2 tu Pi 5
```bash
cd ~/HCROBOT/robot/ros2_configs
chmod +x launch_rplidar_tf.sh
./launch_rplidar_tf.sh
```

---

### BUOC 2: MO BACKEND FASTAPI (PORT 8000)

Mo mot Terminal (PowerShell / CMD) tai Laptop:
```powershell
# Di chuyen vao thu muc backend:
cd f:\DoAn\HC-Robot\backend

# Kich hoat Virtual Environment:
.\venv\Scripts\activate

# Khoi chay Uvicorn Server:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Dia chi kiem tra API Docs (Swagger UI): `http://localhost:8000/docs`
- Kiem tra Health Check: `http://localhost:8000/health`

---

### BUOC 3: MO FRONTEND REACT VITE (PORT 3000)

Mo mot Terminal moi tai Laptop:
```powershell
# Di chuyen vao thu muc frontend:
cd f:\DoAn\HC-Robot\frontend

# Khoi chay Vite Development Server:
npm run dev
```

- Man hinh Kiosk Robot: `http://localhost:3000/`
- Man hinh Quan Tri Admin Portal: `http://localhost:3000/admin`
- Tab Phong Gia Lap Workflow / Gazebo: `http://localhost:3000/admin` (Chon tab Workflow -> Phong Gia Lap Gazebo).

---

### BUOC 4: MO WSL2 (ROS 2, GAZEBO & ROSBRIDGE WEBSOCKET)

Mo mot Terminal moi tai Laptop:

#### 1. Truyen vao moi truong WSL2 Ubuntu 24.04:
```bash
wsl -d Ubuntu-24.04
```

#### 2. Khoi chay Rosbridge WebSocket Server (Port 9090)
Day la cau noi giua Web Frontend va cac node ROS 2:
```bash
bash /mnt/f/DoAn/HC-Robot/robot/ros2_configs/start_wsl_slam.sh
```
Kiem tra WebSocket hoat dong tai: `ws://localhost:9090` hoac `ws://100.92.82.61:9090`.

#### 3. Khoi chay Sa ban Mo phong Gazebo (Tuy chon)
Trong mot tab WSL2 khac:
```bash
bash /mnt/f/DoAn/HC-Robot/robot/scripts/launch_gazebo.sh
```

#### 4. Khoi chay Node Dieu huong Tu hanh (Autonomous Navigator)
Node nay nhan lenh toa do tu Web qua `/goal_pose` va ban tin hieu ve `/goal_reached`:
```bash
python3 /mnt/f/DoAn/HC-Robot/robot/scripts/autonomous_navigator.py
```

---

## 4. BANG TRA CUU DIA CHI & PORT TRONG MANG

| Dich vu | Dia chi cuc bo (Localhost) | Dia chi mang VPN (Tailscale) | Ghi chu |
| :--- | :--- | :--- | :--- |
| **Backend API** | `http://localhost:8000` | `http://100.92.82.61:8000` | REST API & WebSocket |
| **Backend Swagger** | `http://localhost:8000/docs` | `http://100.92.82.61:8000/docs` | Tai lieu kiem thu API |
| **Frontend Kiosk** | `http://localhost:3000` | `http://100.92.82.61:3000` | Giao dien khach hang |
| **Admin Portal** | `http://localhost:3000/admin` | `http://100.92.82.61:3000/admin` | Quan tri vien |
| **ROS 2 Rosbridge** | `ws://localhost:9090` | `ws://100.92.82.61:9090` | WebSocket bridge |
| **Raspberry Pi 5** | `ssh phuc@raspberrypi.local` | `ssh phuc@100.99.72.51` | May chu dieu khien xe |
| **Ollama Local LLM** | `http://localhost:11434` | - | AI model Llama/Qwen |

---

## 5. XU LY SU CO THUONG GAP (TROUBLESHOOTING)

### 1. Khong ket noi duoc SSH vao Raspberry Pi 5
- Kiem tra xem Pi 5 da duoc cap nguon va den bao trang thai co sang on dinh khong.
- Kiem tra trang thai Tailscale tren Laptop:
  ```powershell
  tailscale status
  ```
  Dam bao thiet bi `hc_pi5` co trang thai `online`. Neu chua online, kiem tra lai mang Wi-Fi cua Pi.

### 2. Frontend bao loi "Mat ket noi ROS 2 Bridge"
- Kiem tra xem tien trinh Rosbridge tren WSL2 da duoc mo chua:
  ```bash
  wsl -d Ubuntu-24.04 ss -tulpn | grep 9090
  ```
- Neu chua co, chay lenh:
  ```bash
  ros2 launch rosbridge_server rosbridge_websocket_launch.xml
  ```
- Luu y: Ngay ca khi khong bat ROS 2 Bridge, giao dien Phong Gia Lap tren Web van tu dong chay che do Web Animation muot ma.

### 3. Xung dot cong (Port already in use)
Neu cong 8000 hoac 3000 bi chiem boi tien trinh cu, su dung file `stop_all.bat` hoac lenh sau de giai phong:
```powershell
# Giai phong port 8000:
netstat -ano | findstr :8000
taskkill /PID <PID_NUMBER> /F

# Giai phong port 3000:
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
```

### 4. Khong nhan duoc cong Serial LiDAR tren Pi 5
Tren Pi 5, kiem tra quyen doc cong Serial:
```bash
ls -l /dev/ttyUSB*
sudo chmod 666 /dev/ttyUSB0
```
