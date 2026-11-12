# KIEN TRUC HYBRID CLOUD VA HUONG DAN VAN HANH DEMO HC-ROBOT

Tai lieu mo ta kien truc he thong ket hop Hybrid giua Cloudflare Edge, Laptop Backend (Brain Node) va Raspberry Pi 5 (Robot Node), cung quy trinh van hanh thuc te trong cac buoi trinh dien, bao ve do an.

---

## 1. Tong Quan Kien Truc Hybrid Cloud

He thong HC-Robot ap dung mo hinh **Hybrid Cloud & Edge Computing** - tieu chuan hien dai cho robot thong minh va IoT:

1. **Robot Node (Raspberry Pi 5 tren than xe):**
   - Dam nhan dieu khien thoi gian thuc (Real-time hardware control): Dong co L298N, cam bien khoang cach sieu am Sonar, mat quet laser RPLiDAR A1M8.
   - Phat luong video FPV WebRTC zero-latency truc tiep tu USB Camera (`camera_stream.py` port 8554).
2. **Brain Node (Laptop trung tam):**
   - May chu tinh toan nang (Heavy Computing): ROS 2 SLAM (dong bo ban do va vi tri xe), dieu phoi khao sat phong tu dong.
   - FastAPI Backend (port 8000): Xu ly logic nghiep vu khach san, xac thuc phong, quan ly quang cao, quan ly goi do F&B.
   - WebSocket Real-time Hub: Dieu phoi thong bao hai chieu giua Nhan vien, Khach hang va Robot.
3. **Edge Gateway (Cloudflare Workers CDN):**
   - Host toan bo frontend tinh (React SPA bundle) tai dia chi `https://hcrobot.dinhhoangkha107.workers.dev`.
   - Dong vai tro Reverse Proxy toan cau: Dinh tuyen cac API calls (`/api/*`), file tinh (`/static/*`) va ket noi WebSocket (`wss://`) ve thang Laptop Backend thong qua **Tailscale Funnel** ma khong can thue server Cloud dat tien, khong can mo port modem router.

---

## 2. So Do Luong Du Lieu (Data & Network Architecture)

```
+-------------------------------------------------------------------------+
|                        INTERNET / MANG NGOAI                            |
|        Dien thoai Admin / Khach hang quet QR (4G / Wifi bat ky)         |
+-------------------------------------------------------------------------+
                                    |
                                    | HTTPS / WSS
                                    v
+-------------------------------------------------------------------------+
|                  CLOUDFLARE WORKERS (Edge Gateway)                      |
|             URL: https://hcrobot.dinhhoangkha107.workers.dev             |
|                                                                         |
|  - Asset fetch: index.html, JS/CSS bundles tu Vite dist                 |
|  - Proxy fetch: /api/*, /static/*, Upgrade: websocket                   |
+-------------------------------------------------------------------------+
                                    |
                                    | Reverse Proxy Relay
                                    v
+-------------------------------------------------------------------------+
|                    TAILSCALE FUNNEL (Ingress Tunnel)                    |
|             URL: https://yungwhore.taila9018b.ts.net                    |
|                                                                         |
|  - Tu dong cap SSL/TLS Let's Encrypt                                    |
|  - Tunnel truc tiep toi localhost:8000 tren Laptop                      |
+-------------------------------------------------------------------------+
                                    |
                                    | Local Forward
                                    v
+-------------------------------------------------------------------------+
|                    LAPTOP BACKEND (Brain Node - Windows)                |
|  - FastAPI REST API & WebSocket Notification Hub (Port 8000)            |
|  - SQLite / PostgreSQL Database                                         |
|  - ROS 2 Navigation & SLAM Core (WSL2 Ubuntu 24.04)                     |
|  - Tailscale VPN IP: 100.92.82.61                                       |
+-------------------------------------------------------------------------+
            |                                         |
            | UDP Socket / HTTP Proxy                 | WebSocket WSS
            v                                         v
+---------------------------------------+ +-------------------------------+
|     RASPBERRY PI 5 (Robot Node)       | |     TABLET NGUOC XE ROBOT     |
|  - IP Tailscale: 100.99.72.51         | |  - URL: /robot-screen         |
|  - Port 9999: UDP Command Listener    | |  - Component: RobotScreenPage |
|  - Port 8000: Hardware API & Sonar    | |  - Trinh phat: RobotAdPlayer  |
|  - Port 8554: WebRTC & MJPEG Streamer | |  - AI Face & Emotion Monitor  |
+---------------------------------------+ +-------------------------------+
```

---

## 3. Co Che Day Quang Cao Thoi Gian Thuc (Real-time Ad Push)

Day la vi du dien hinh cho thay suc manh cua mo hinh Hybrid giua dien thoai di dong va man hinh robot:

```
[Dien thoai Admin]
       |
       | 1. POST /api/v1/advertisements/{ad_id}/push
       v
[Cloudflare Worker]
       |
       | 2. Proxy request qua Tailscale Funnel
       v
[Laptop FastAPI]
       |
       | 3. notification_manager.broadcast_to_department("All", payload)
       v (WebSocket)
[Tablet nguc Robot (/robot-screen)]
       |
       | 4. useNotificationWebSocket nhan event 'ADVERTISEMENT_PUSH'
       | 5. Set pushedAd state & bat mode Standby
       v
[Component RobotAdPlayer]
       |
       | 6. Mo toan man hinh (Fullscreen) phat Video / Banner
       |    - Video: Tu dong play, co thanh progress dem nguoc
       |    - CDN: Media duoc stream truc tiep tu Cloudinary
       v
[Khach cham tay vao man hinh] -> Tat quang cao, ve giao dien AI Concierge
```

### Chi tiet payload WebSocket:
```json
{
  "type": "ADVERTISEMENT_PUSH",
  "advertisement": {
    "id": "ad_123456",
    "title": "Uu dai Dave Drinks 20%",
    "description": "Giam gia nuoc uong tai quay Bar",
    "media_type": "VIDEO",
    "media_url": "https://res.cloudinary.com/demo/video/upload/ad_sample.mp4",
    "thumbnail_url": "https://res.cloudinary.com/demo/image/upload/ad_thumb.jpg",
    "duration_seconds": 15
  },
  "timestamp": "2026-11-12T09:00:00Z"
}
```

---

## 4. Co Che Dieu Khien Xe & Camera FPV WebRTC

1. **Dieu khien dong co (Teleop / E-STOP):**
   - Admin bam nut tien/lui hoac Joystick tren dien thoai.
   - Frontend goi `POST /api/v1/operations/robot/control`.
   - Backend tren Laptop chuyen tiep thanh goi tin UDP socket toi `100.99.72.51:9999`.
   - Pi 5 nhan byte `drive:speed:turn` va xuat xung PWM toi mach L298N trong vong **30ms - 50ms**.
2. **Camera WebRTC P2P (FPV Stream):**
   - Trinh duyet dien thoai tao SDP Offer va gui toi `/api/v1/operations/robot/camera/webrtc-offer`.
   - Pi 5 xu ly SDP Offer, thu thap day du ICE Candidates (Vanilla ICE) qua may chu STUN Google va tra ve SDP Answer.
   - Trinh duyet va Pi 5 bat tay truc tiep qua giao thuc UDP, luong video 15-30 fps hien thi khong do tre ma khong bi chan boi Cloudflare.

---

## 5. Quy Trinh Van Hanh Buoi Demo (Demo Playbook)

### Che do A: Hybrid Mode (Khuyen dung - Yeu cau co Wifi/4G Hotspot)

Che do nay the hien he thong hoan chinh, cho phep giam khao dung dien thoai ca nhan de tuong tac truc tiep:

1. **Buoc 1: Thiet lap mang:**
   - Bat Mobile Hotspot tu dien thoai hoac cuc phat Wifi 4G.
   - Ket noi Laptop, Pi 5 va Tablet Robot vao cung mang Wifi nay.
2. **Buoc 2: Khoi dong Laptop:**
   ```bash
   # Terminal 1: Khoi dong Backend
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

   # Terminal 2: Mo cong Funnel
   tailscale funnel --bg 8000
   ```
3. **Buoc 3: Khoi dong Pi 5 (qua SSH tu Laptop):**
   ```bash
   ssh phuc@100.99.72.51

   # Chay chuong trinh dieu khien phan cung
   python3 ~/HCROBOT/robot/main.py --no-camera &

   # Chay chuong trinh Camera Streamer
   nohup /home/phuc/HCROBOT/robot/.venv/bin/python ~/HCROBOT/robot/scripts/camera_stream.py --port 8554 </dev/null >/tmp/camera_stream.log 2>&1 &
   ```
4. **Buoc 4: Mo giao dien:**
   - **Tren Tablet nguc Robot:** Truy cap `https://hcrobot.dinhhoangkha107.workers.dev/robot-screen` (Fullscreen).
   - **Tren Dien thoai Admin / Giam khao:** Truy cap `https://hcrobot.dinhhoangkha107.workers.dev/admin`.

---

### Che do B: 100% Local Mode (Du phong khong co mang Internet)

Neu phong thi, hoi truong bi pha song hoac mat ket noi 4G:

1. **Buoc 1: Ket noi mang LAN noi bo:**
   - Tat ca thiet bi ket noi vao Router Wifi noi bo (khong can Internet).
   - Xac dinh IP LAN cua Laptop (vi du: `192.168.1.100`).
2. **Buoc 2: Chay Backend & Frontend tren Laptop:**
   ```bash
   # Chay Backend
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

   # Chay Frontend
   cd frontend
   npm run dev -- --host
   ```
3. **Buoc 3: Mo giao dien noi bo:**
   - **Tablet Robot:** Mo `http://192.168.1.100:3000/robot-screen`.
   - **Dien thoai Admin:** Mo `http://192.168.1.100:3000/admin`.
   - He thong van hoat dong 100% tinh nang (dieu khien xe, day quang cao, video call noi bo, nhan dien khuon mat).

---

## 6. Xu Ly Su Co Nhanh Trong Buoi Demo (Troubleshooting)

| Hien tuong | Nguyen nhan | Lenh khac phuc nhanh |
| :--- | :--- | :--- |
| Camera bao loi den man hinh hoac -71 | Chip USB Camera bi sut ap | Chay tren SSH Pi 5: `sudo usbreset 4c4a:4a55` (hoac rut cam lai cap USB) |
| Man hinh robot khong nhan quang cao | Mat ket noi WebSocket | Kiem tra console log Tablet, refresh lai trang `/robot-screen` |
| Bap benh ket noi Cloudflare Funnel | Funnel bi ngat do doi Wifi | Chay lai tren Laptop: `tailscale funnel 8000` |
| Dong co khong chay khi bam phim | Pi 5 chua chay main.py | Kiem tra SSH: `pgrep -fa main.py` |
