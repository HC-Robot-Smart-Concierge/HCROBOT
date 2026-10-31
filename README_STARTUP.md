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
| **Foxglove Bridge** | Windows WSL2 (Ubuntu 24.04) | Port 8765 (WebSocket) | Xem ban do /map, tia /scan, TF realtime tren Foxglove (xem muc 7) |

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
| **Foxglove Bridge** | `ws://localhost:8765` | `ws://100.92.82.61:8765` | Viewer ban do realtime (muc 7) |
| **LiDAR Service Pi 5** | - | `http://100.99.72.51:8000` | API + WebSocket `/api/v1/map/ws` cua `main.py` |
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

---

## 6. CHAY ROS 2: QUET MAP (MAPPING) VA TU HANH (NAVIGATION)

ROS 2 chay trong WSL2 tren laptop. Pi 5 chi doc LiDAR/encoder/IMU va gui sang laptop qua WebSocket; SLAM Toolbox, Nav2 chay tren laptop.

**Thu tu bat bat buoc:**
1. Pi 5: `sudo python3 main.py` (xem Buoc 1). Bridge tren laptop phai ket noi duoc vao Pi.
2. Laptop: Backend (Buoc 2) va Frontend (Buoc 3).
3. Laptop: ROS 2 theo mot trong cac cach duoi day.

> Tat ca lenh `wsl ...` ben duoi chay trong **PowerShell tai thu muc goc HCROBOT** (duong dan `robot/...` la duong dan tuong doi).

### 6.1 Bat ROS 2 o che do QUET MAP

**Cach A - Bam nut tren Web (khong can go lenh):**
Admin Portal -> trang LiDAR -> **"1. Bat Dau Quet Map"**. Backend tu goi `wsl.exe` chay `start_wsl_slam.sh` o che do nen.

**Cach B - Chay tay trong Terminal rieng (de xem log truc tiep):**
```powershell
wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_slam.sh
```
Hoac nhap dup [quet_map_mot_lan.bat](quet_map_mot_lan.bat) (cung stack, mo them RViz).

Script se tat stack cu roi bat lan luot:

| Thanh phan | Vai tro |
| :--- | :--- |
| `robot_state_publisher` | Mo hinh robot (URDF) va cay TF |
| `rosbridge_websocket` (:9090) | Cau noi Web Admin <-> ROS 2 (lai xe, nhan /map) |
| `foxglove_bridge` (:8765) | Cau noi Foxglove <-> ROS 2 |
| `lidar_ws_to_ros2.py` | Doc WebSocket cua Pi -> phat `/scan`, `/odom`, TF |
| `slam_toolbox` (online async) | Ve ban do `/map` tu `/scan` + odom |

Khi thay dong `HE THONG SLAM DANG HOAT DONG TREN LAPTOP WSL2!` la san sang. Dung bang `Ctrl+C`.

> **Khong lam ca A va B cung luc.** Nut "1. Bat Dau Quet Map" se tat stack dang chay va bat lai tu dau, lam mat phan map dang quet do.

**Kiem tra da chay dung:**
- Log tren Pi (`main.py`) phai co: `🤖 Bridge ROS 2 đã kết nối (1); SLAM nội bộ Pi: TẮT`.
- Log bridge tren laptop in dinh ky: `📡 Dang publish /scan (... lag=XX ms, bo khi quay=N)`. `lag` nen duoi ~200 ms; `bo khi quay` tang nhanh nghia la dang quay qua nhanh.
- Kiem tra tan so `/scan` (mo them mot terminal):
  ```powershell
  wsl -d Ubuntu-24.04 -- bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic hz /scan"
  ```

### 6.2 Lai robot de quet
- Di thang ~0.10 m/s (mac dinh tren Web), quay <= 15 deg/s. Giu nut quay: xe tu quay theo xung 0.2 s chay / 0.5 s dung.
- Di doc tuong, cach tuong 0.5 - 1 m (duoi 35 cm se bi phanh an toan).
- Quay tai cho tung goc nho (~45 deg), dung mot chut giua cac lan.
- **Cuoi cung quay lai dung diem xuat phat** de SLAM Toolbox tu nan lai ban do (loop closure).
- Diem xuat phat se la goc toa do (0, 0) cua map moi.

### 6.3 Luu map
**Tren Web:** bam **"2. Luu & Khoa"**, nhap ten moi (vd `lab_v2`, khong trung ten cu). He thong luu xong se tu chuyen sang Navigation.

**Bang lenh** (khi dang o che do quet map):
```powershell
wsl -d Ubuntu-24.04 bash robot/ros2_configs/save_ros2_map.sh lab_v2
```
Ket qua nam trong `robot/maps/`: `lab_v2.yaml`, `lab_v2.pgm` (luu qua Web co them `lab_v2.json`). Lenh nay cung khoa mapping va chuyen Pi sang NAVIGATION; them tham so `--no-pause` neu chi muon luu ma van tiep tuc quet.

### 6.4 Tu hanh (Navigation) voi map da luu
```powershell
.\chay_navigation_map_tinh.bat lab_v2
# hoac
wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_navigation.sh lab_v2
```
Bat Map Server + AMCL + Nav2 voi map tinh; LaserScan chi dung de dinh vi va tranh vat can, khong sua map.

Sau do tren Admin Portal -> **Ban Do Vat Ly**:
1. Chon map o o **"Ban do:"** tren thanh tieu de (diem moc / vung duoc luu rieng cho tung map).
2. Bam **"Chon tren map"**, click dung cho robot dang dung (keo de chon huong dau xe), roi **"Dinh vi lai"**. Khi cac cham laser xanh nam de len tuong den la da dinh vi dung.

### 6.5 Bien moi truong lien quan (tren Pi 5)
| Bien | Gia tri | Y nghia |
| :--- | :--- | :--- |
| `HCROBOT_PI_INTERNAL_SLAM` | `auto` (mac dinh) / `on` / `off` | SLAM noi bo tren Pi. `auto`: tu tat khi bridge ROS 2 ket noi de Pi khong bi nghen; frontier exploration van luon bat. |
| `HCROBOT_LIDAR_OFFSET` | `180.0` | Goc lap LiDAR (do) so voi dau xe |

Vi du ep tat SLAM noi bo: `sudo HCROBOT_PI_INTERNAL_SLAM=off python3 main.py`

---

## 7. SETUP FOXGLOVE (XEM BAN DO REALTIME)

Foxglove la cong cu xem du lieu ROS 2 (thay cho RViz), ket noi vao `foxglove_bridge` o cong **8765**. Bridge da duoc bat san trong `start_wsl_slam.sh` va `start_wsl_navigation.sh`, khong can chay rieng.

### 7.1 Cai dat (lam mot lan)
1. Kiem tra goi bridge trong WSL (neu chua co thi cai):
   ```bash
   wsl -d Ubuntu-24.04
   sudo apt update && sudo apt install -y ros-jazzy-foxglove-bridge
   ```
2. Chon cach xem:
   - **Foxglove Web**: mo `https://app.foxglove.dev` (can tai khoan Foxglove mien phi).
   - **Foxglove Desktop**: tai tai `https://foxglove.dev/download` (nen dung khi ket noi tu may khac qua IP Tailscale).

### 7.2 Ket noi
**Cach nhanh:** Admin Portal -> tab Foxglove -> **"MO FOXGLOVE TAB RIENG"** (tu dien san `ws://127.0.0.1:8765`). Huy hieu `BRIDGE ONLINE (:8765)` mau xanh nghia la bridge dang chay.

**Cach thu cong:** trong Foxglove chon **Open connection -> Foxglove WebSocket**, nhap:
- Tren chinh laptop chay WSL: `ws://localhost:8765`
- Tu may khac trong Tailscale: `ws://100.92.82.61:8765` (dung Foxglove Desktop; ban Web tren https co the bi trinh duyet chan ket noi `ws://` toi IP khong phai localhost).

### 7.3 Nap layout cua du an
1. Lay file layout: [frontend/public/foxglove/hcrobot-slam-layout.json](frontend/public/foxglove/hcrobot-slam-layout.json) (hoac bam **"TAI LAYOUT 2D"** tren tab Foxglove).
2. Trong Foxglove: **Layouts -> Import from file**, chon file tren, roi chon layout **HCROBOT SLAM 2D**.
3. Kiem tra cai dat panel 3D:
   - **Fixed frame** va **Display frame**: `map`; **Follow mode**: Off.
   - Bat cac topic: `/map`, `/scan`, `/tf`, `/foxglove/robot_marker`.
   - Khong them lop URDF custom (Foxglove Web ve sai hinh tren may nay); dung `/foxglove/robot_marker` de hien robot.

### 7.4 Xu ly su co Foxglove
| Hien tuong | Cach kiem tra / xu ly |
| :--- | :--- |
| `BRIDGE OFFLINE (:8765)` / khong ket noi duoc | `wsl -d Ubuntu-24.04 -- bash -lc "ss -tulpn \| grep 8765"`. Khong co thi ROS 2 chua chay (muc 6.1). Khi bat qua Web, log o `/tmp/hcrobot-foxglove.log` trong WSL. |
| Ket noi duoc nhung khong thay ban do | Fixed frame phai la `map`; khi quet map phai lai robot mot doan thi `/map` moi co du lieu. |
| Thay `/scan` nhung ban do bi nhoe khi quay | Xem log bridge (`lag`, `bo khi quay`) o muc 6.1; quay cham lai. |
| May khac khong ket noi duoc | Dung Foxglove Desktop; kiem tra Tailscale (`tailscale status`) va Windows Firewall cho cong 8765. |
