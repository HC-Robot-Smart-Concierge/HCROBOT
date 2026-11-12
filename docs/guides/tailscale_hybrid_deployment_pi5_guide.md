# HUONG DAN TRIEN KHAI HYBRID CLOUD & VAN HANH DEMO HC-ROBOT (TAILSCALE + CLOUDFLARE + PI 5)

> **Tai lieu lien quan:**
> - Kien truc ROS 2 phan tan: [[distributed_ros2|He Thong ROS 2 Phan Tan (Pi 5 & Laptop)]]
> - Dac ta phan cung & Edge Computing: [[hardware_architecture|Dac Ta Phan Cung & ROS 2 Edge]]
> - Kien truc tong the he thong: [[../02-Architecture|02-Architecture (Kien truc tong the)]]

Tai lieu tong hop toan dien kien truc **Hybrid Cloud & Edge Computing** cua du an HC-Robot, co che dinh tuyen mang P2P WireGuard, Funnel Ingress, Cloudflare Workers, cung **quy trinh khoi dong thuc chien khi di demo/bao ve do an**.

---

## 1. Tong Quan Kien Truc Hybrid Cloud

He thong phan chia trach nhiem ro rang giua 3 tang:

```
+---------------------------------------------------------------------------------+
|                       DIEN THOAI (MAN HINH GAN TREN XE ROBOT)                   |
|                   Mo URL: https://hcrobot.dinhhoangkha107.workers.dev/robot-screen      |
|  - Giao dien MobileRobotScreen toi uu man hinh cam ung di dong                  |
|  - Robot Face bieu cam, Speech Recognition, AI Voice Dialog                     |
|  - Trinh phat quang cao RobotAdPlayer toan man hinh (Fullscreen)                |
+---------------------------------------------------------------------------------+
                                    |
                                    | HTTPS / WSS
                                    v
+---------------------------------------------------------------------------------+
|                      CLOUDFLARE WORKERS (Edge Gateway)                          |
|             URL: https://hcrobot.dinhhoangkha107.workers.dev                    |
|  - Phuc vu Single Page Application (React Vite dist) < 15ms                     |
|  - Reverse Proxy: /api/*, /static/*, va Upgrade: websocket                      |
+---------------------------------------------------------------------------------+
                                    |
                                    | Reverse Proxy Relay
                                    v
+---------------------------------------------------------------------------------+
|                       TAILSCALE FUNNEL (Ingress Tunnel)                         |
|             URL: https://yungwhore.taila9018b.ts.net                            |
|  - Tu dong quan ly chung chi SSL/TLS Let's Encrypt                              |
|  - Forward cong 8000 ve may Laptop ca nhan                                      |
+---------------------------------------------------------------------------------+
                                    |
                                    | Localhost Forward
                                    v
+---------------------------------------------------------------------------------+
|                 LAPTOP (BRAIN SERVER & ADMIN / STAFF CONSOLE)                   |
|  1. Brain Server (Chay ngam):                                                   |
|     - FastAPI Backend & WebSocket Notification Hub (Port 8000)                  |
|     - ROS 2 SLAM Navigation & CycloneDDS Unicast (WSL2 Ubuntu 24.04)            |
|     - AI Engine: LangGraph StateGraph, EdgeTTS, Faster Whisper                  |
|  2. Operator Console (Mo trinh duyet tren Laptop):                              |
|     - Admin Portal (/admin): Ban do SLAM/LiDAR, Camera FPV, Day quang cao       |
|     - Staff Dashboards (/dashboard/*): Concierge Video Call, Reception, Kitchen |
+---------------------------------------------------------------------------------+
                                    |
                                    | Duong truyen WireGuard P2P Direct (UDP < 5ms)
                                    v
+---------------------------------------------------------------------------------+
|                          RASPBERRY PI 5 (Robot Node tren xe)                    |
|  - IP Tailscale: 100.99.72.51                                                   |
|  - Port 9999: UDP Motor Driver (L298N) & Watchdog an toan                       |
|  - Port 8000: Hardware API, Sonar HC-SR04, Quan ly Pin                          |
|  - Port 8554: WebRTC FPV Camera Streamer                                        |
|  - RPLiDAR A1M8 (/scan, /tf)                                                    |
+---------------------------------------------------------------------------------+
```

---

## 2. Co Che Hoat Dong Cac Tinh Nang Thoi Gian Thuc

### 2.1. Day quang cao thoi gian thuc (Real-time Ad Push)
1. **Admin thao tac tren Laptop:** Mo Admin Portal (`/admin`), vao tab Quang cao va nhan nut **"Phat ngay / Day xuong xe"**.
2. **Backend xu ly & Broadcast:** Request gui toi `POST /api/v1/advertisements/{ad_id}/push`. Laptop Backend goi `notification_manager.broadcast_to_department("All", payload)` ban goi tin WebSocket JSON toi dien thoai robot.
3. **Dien thoai (Man hinh Robot) nhan tin hieu:** Dien thoai gan tren xe dang mo `/robot-screen` nhan su kien `ADVERTISEMENT_PUSH` qua WebSocket, tu dong chuyen sang trang thai Standby va bat component `RobotAdPlayer`.
4. **Phat Fullscreen:** Video hoac Banner duoc tai truc tiep tu Cloudinary CDN toan cau voi bang thong toi da. Khi khach cham tay vao man hinh dien thoai, quang cao tu dong tat de tro ve man hinh tiep don AI Concierge.

### 2.2. Dieu khien xe khong do tre (Teleop UDP)
- Admin tren **Laptop** bam nut di chuyen WASD tren giao dien Robot Operations (hoac dung can gat Joystick) $\rightarrow$ Backend tren Laptop nhan request va ban goi UDP Datagram (`drive:speed:turn` hoac `stop`) toi `100.99.72.51:9999` tren Pi 5.
- Do tre phan hoi chi tu **30ms den 60ms**.

### 2.3. Camera FPV WebRTC P2P (Zero Latency)
- Admin tren **Laptop** xem truc tiep hinh anh dau xe qua giao thuc WebRTC P2P voi Pi 5 (`http://100.99.72.51:8554/offer`).
- Streamer tren Pi 5 (`camera_stream.py`) thu thap day du ung vien mang (Vanilla ICE candidates) qua may chu STUN Google va tra ve SDP Answer.
- Trinh duyet tren Laptop va Pi 5 bat tay truc tiep qua UDP P2P, giup luong video dat 15-30 fps cuc muot ma khong lam nghen may chu.

---

## 3. Cac Lenh Khoi Dong He Thong (Startup Commands)

### 3.1. Khoi dong tren Laptop (Brain Server & Admin Console)

Moi lan bat may Laptop de demo, mo PowerShell va thuc hien:

```powershell
# 1. Kiem tra trang thai Tailscale va Funnel (da cau hinh thuong truc)
tailscale status
tailscale serve status
# Neu Funnel chua bat, chay lenh:
# tailscale funnel --bg 8000

# 2. Khoi dong Backend FastAPI (lang nghe tat ca card mang port 8000)
cd f:\DoAn\HC-Robot\backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> **Luu y:** Khong doi host thanh `127.0.0.1` vi se chan ket noi tu Tailscale Funnel va Pi 5.

### 3.2. Khoi dong tren Raspberry Pi 5 (Robot Node)

Khi cap nguon cho Pi 5 (qua pin hoac adapter), tu Laptop mo terminal SSH:

```bash
# 1. SSH vao Pi 5 qua Tailscale IP
ssh phuc@100.99.72.51

# 2. Khoi dong tien trinh dieu khien phan cung xe (dong co, sonar, lidar)
python3 ~/HCROBOT/robot/main.py --no-camera &

# 3. Khoi dong WebRTC FPV Camera Streamer
nohup /home/phuc/HCROBOT/robot/.venv/bin/python ~/HCROBOT/robot/scripts/camera_stream.py --port 8554 </dev/null >/tmp/camera_stream.log 2>&1 &

# 4. Kiem tra 2 tien trinh da chay thanh cong:
pgrep -fa "main.py|camera_stream.py"
```

### 3.3. Mo giao dien nguoi dung (Clients Mapping)

- **Tren Dien thoai (Man hinh gan tren than Robot):**
  Mo trinh duyet Chrome tren dien thoai truy cap:
  `https://hcrobot.dinhhoangkha107.workers.dev/robot-screen`
  *(Giao dien tu dong nhan dien Mobile Viewport, hien thi khuon mat robot bieu cam, nut mic cham de noi, va san sang nhan lenh quang cao toan man hinh).*
- **Tren Laptop (Admin & Operator Console):**
  Mo trinh duyet tren Laptop truy cap:
  `https://hcrobot.dinhhoangkha107.workers.dev/admin` (hoac `http://localhost:3000/admin` khi dev)
  *(Day la noi Admin xem ban do LiDAR 2D, lai xe tu xa, quan ly don hang, va day quang cao xuong dien thoai tren robot).*

---

## 4. Che Do Du Phong 100% Local (Khi khong co mang Internet)

Neu phong thi hoac hoi truong bi pha song 4G va khong co ket noi Internet:

1. **Ket noi Wifi noi bo:**
   - Laptop, Pi 5 va Dien thoai gan tren Robot ket noi chung vao mot Router Wifi di dong (khong can Internet).
   - Lay IP LAN cua Laptop (vi du: `192.168.1.100` bang lenh `ipconfig`).
2. **Chay Frontend truc tiep tren Laptop:**
   ```powershell
   cd f:\DoAn\HC-Robot\frontend
   npm run dev -- --host
   ```
3. **Mo ung dung qua IP LAN noi bo:**
   - **Dien thoai tren Robot:** Mo `http://192.168.1.100:3000/robot-screen`.
   - **Laptop Admin:** Mo `http://localhost:3000/admin`.
   - He thong van hoat dong day du 100% tinh nang (dieu khien, camera, day quang cao, video call).

---

## 5. Cau Hinh Tu Dong Hoa tren Pi 5 (Systemd Services)

De khi cam dien pin vao Pi 5 xe tu dong chay 100% ma khong can go lenh SSH, cai dat 2 service sau tren Pi 5:

### 5.1. Service dieu khien xe (`/etc/systemd/system/hcrobot-main.service`)
```ini
[Unit]
Description=HC-Robot Main Hardware Controller
After=network.target tailscaled.service

[Service]
Type=simple
User=phuc
WorkingDirectory=/home/phuc/HCROBOT/robot
ExecStart=/usr/bin/python3 /home/phuc/HCROBOT/robot/main.py --no-camera
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 5.2. Service Camera WebRTC (`/etc/systemd/system/hcrobot-camera.service`)
```ini
[Unit]
Description=HC-Robot WebRTC Camera Streamer
After=network.target tailscaled.service

[Service]
Type=simple
User=phuc
WorkingDirectory=/home/phuc/HCROBOT/robot
ExecStart=/home/phuc/HCROBOT/robot/.venv/bin/python /home/phuc/HCROBOT/robot/scripts/camera_stream.py --port 8554
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 5.3. Kich hoat service tren Pi 5:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hcrobot-main.service
sudo systemctl enable --now hcrobot-camera.service
```

---

## 6. Bang Tra Cuu Xu Ly Su Co Nhanh (Troubleshooting)

| Hien tuong | Nguyen nhan | Lenh khac phuc nhanh |
| :--- | :--- | :--- |
| Camera den man hinh / Kernel bao loi `-71` | Chip USB Camera bi sut ap nguon khi dong co chay | Go tren SSH Pi 5: `sudo usbreset 4c4a:4a55` (hoac rut cam lai cap USB) |
| Web bao "Pi5 Offline" | Timeout kiem tra qua ngan hoac chua bat camera_stream | Kiem tra: `curl http://100.99.72.51:8554/health` |
| Web bao loi 502 Bad Gateway | Tailscale Funnel chua bat hoac Laptop chua chay Backend | Kiem tra: `tailscale serve status` va bat lai Uvicorn `:8000` |
| Khong truyen duoc lenh lai xe | `main.py` tren Pi 5 bi crash hoac port 9999 bi chan | SSH Pi 5 go: `pgrep -fa main.py` |
| Man hinh robot khong nhan quang cao | Ket noi WebSocket bi ngat | Tai lai trang `/robot-screen` tren Tablet |
| Ping Pi 5 bi relay cham | Ket noi chua dat Direct P2P | Go tren Pi 5: `tailscale status`, kiem tra xem co chu `direct` chua |
