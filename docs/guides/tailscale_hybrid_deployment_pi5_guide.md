# HƯỚNG DẪN TRIỂN KHAI HYBRID CLOUD & VẬN HÀNH DEMO HC-ROBOT (TAILSCALE + CLOUDFLARE + PI 5)

> **Tài liệu liên quan:**
> - Kiến trúc ROS 2 phân tán: [[distributed_ros2|Hệ Thống ROS 2 Phân Tán (Pi 5 & Laptop)]]
> - Đặc tả phần cứng & Edge Computing: [[hardware_architecture|Đặc Tả Phần Cứng & ROS 2 Edge]]
> - Kiến trúc tổng thể hệ thống: [[../02-Architecture|02-Architecture (Kiến trúc tổng thể)]]

Tài liệu tổng hợp toàn diện kiến trúc **Hybrid Cloud & Edge Computing** của dự án HC-Robot, cơ chế định tuyến mạng P2P WireGuard, Funnel Ingress, Cloudflare Workers, giải thích chi tiết **vì sao hệ thống dùng chung duy nhất một Backend trên Laptop**, cùng **quy trình khởi động thực chiến khi đi demo/bảo vệ đồ án**.

---

## 1. Tổng Quan Kiến Trúc Hybrid Cloud

Hệ thống phân chia trách nhiệm rõ ràng giữa các tầng:

```
+---------------------------------------------------------------------------------+
|                       ĐIỆN THOẠI (MÀN HÌNH GẮN TRÊN XE ROBOT)                   |
|                   Mở URL: https://hcrobot.dinhhoangkha107.workers.dev/robot-screen      |
|  - Giao diện MobileRobotScreen tối ưu màn hình cảm ứng di động                  |
|  - Robot Face biểu cảm, Speech Recognition, AI Voice Dialog                     |
|  - Trình phát quảng cáo RobotAdPlayer toàn màn hình (Fullscreen)                |
+---------------------------------------------------------------------------------+
                                    |
                                    | HTTPS / WSS
                                    v
+---------------------------------------------------------------------------------+
|                      CLOUDFLARE WORKERS (Edge Gateway)                          |
|             URL: https://hcrobot.dinhhoangkha107.workers.dev                    |
|  - Phục vụ Single Page Application (React Vite dist) < 15ms                     |
|  - Reverse Proxy: /api/*, /static/*, và Upgrade: websocket                      |
+---------------------------------------------------------------------------------+
                                    |
                                    | Reverse Proxy Relay
                                    v
+---------------------------------------------------------------------------------+
|                       TAILSCALE FUNNEL (Ingress Tunnel)                         |
|             URL: https://yungwhore.taila9018b.ts.net                            |
|  - Tự động quản lý chứng chỉ SSL/TLS Let's Encrypt                              |
|  - Forward cổng 8000 về máy Laptop cá nhân                                      |
+---------------------------------------------------------------------------------+
                                    |
                                    | Localhost Forward
                                    v
+---------------------------------------------------------------------------------+
|                 LAPTOP (BRAIN SERVER & ADMIN / STAFF CONSOLE)                   |
|  1. Brain Server (Chạy ngầm):                                                   |
|     - FastAPI Backend & WebSocket Notification Hub (Port 8000)                  |
|     - ROS 2 SLAM Navigation & CycloneDDS Unicast (WSL2 Ubuntu 24.04)            |
|     - AI Engine: LangGraph StateGraph, EdgeTTS, Faster Whisper                  |
|  2. Operator Console (Mở trình duyệt trên Laptop):                              |
|     - Admin Portal (/admin): Bản đồ SLAM/LiDAR, Camera FPV, Đẩy quảng cáo       |
|     - Staff Dashboards (/dashboard/*): Concierge Video Call, Reception, Kitchen |
+---------------------------------------------------------------------------------+
                                    |
                                    | Đường truyền WireGuard P2P Direct (UDP < 5ms)
                                    v
+---------------------------------------------------------------------------------+
|                          RASPBERRY PI 5 (Robot Node trên xe)                    |
|  - IP Tailscale: 100.99.72.51                                                   |
|  - Port 9999: UDP Motor Driver (L298N) & Watchdog an toàn                       |
|  - Port 8000: Hardware API, Sonar HC-SR04, Quản lý Pin                          |
|  - Port 8554: WebRTC FPV Camera Streamer                                        |
|  - RPLiDAR A1M8 (/scan, /tf)                                                    |
+---------------------------------------------------------------------------------+
```

---

## 2. Vì Sao Hệ Thống Dùng Chung Được Duy Nhất Một Backend?

Sở dĩ Laptop, Điện thoại (trên xe) và Raspberry Pi 5 dùng chung được duy nhất một Backend trên Laptop là nhờ sự kết hợp của 4 kỹ thuật mạng sau:

### 2.1. Backend mở cổng trên tất cả giao diện mạng (`--host 0.0.0.0`)

Khi chạy lệnh:
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Thay vì chỉ bó hẹp ở `127.0.0.1` (chỉ máy Laptop tự gọi chính nó), cờ `0.0.0.0` biến cổng 8000 thành một "ngã tư" tiếp nhận dữ liệu từ tất cả các card mạng:
- **Từ Localhost (`127.0.0.1`):** Trình duyệt trên Laptop (`localhost:3000`) gọi vào trực tiếp với độ trễ 0ms.
- **Từ VPN Tailnet (`100.92.82.61`):** Raspberry Pi 5 (`100.99.72.51`) gửi dữ liệu cảm biến, camera và nhận lệnh UDP trực tiếp.
- **Từ Internet công cộng:** Tiếp nhận các gói tin chuyển tiếp từ Tailscale Funnel.

### 2.2. Tailscale Funnel mở "đường hầm" ra Internet công cộng (Public Ingress)

Bình thường, máy tính cá nhân nằm sau Router Wi-Fi gia đình (NAT) và không có IP tĩnh công cộng, nên thiết bị bên ngoài (dùng 4G) không thể kết nối tới được.

Khi kích hoạt **Tailscale Funnel**:
- Tailscale cấp cho Laptop một tên miền công cộng có sẵn chứng chỉ bảo mật SSL/TLS: `https://yungwhore.taila9018b.ts.net`.
- Mọi request gửi tới tên miền này từ ngoài Internet sẽ được mạng lưới Tailscale dẫn truyền xuyên qua tường lửa Router về thẳng cổng 8000 của Laptop mà không cần mở port modem (Port Forwarding).

### 2.3. Cloudflare Worker làm trạm trung chuyển (Reverse Proxy)

Khi điện thoại mở giao diện từ link `https://hcrobot.dinhhoangkha107.workers.dev`:
- Cloudflare gửi file HTML/CSS/JS tĩnh về cho điện thoại hiển thị.
- Khi điện thoại gọi API hoặc mở kết nối WebSocket (ví dụ: `/api/v1/...` hoặc `/api/v1/operations/ws/notifications`), đoạn mã trong `worker.js` trên Cloudflare Edge sẽ tự động đổi địa chỉ đích:
  ```javascript
  // Chuyển tiếp toàn bộ API calls từ điện thoại về Laptop Backend
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/static')) {
    const targetUrl = new URL(`https://yungwhore.taila9018b.ts.net${url.pathname}${url.search}`);
    if (request.headers.get('Upgrade') === 'websocket') {
      return fetch(targetUrl.toString(), request);
    }
    return await fetch(proxyRequest);
  }
  ```
- Điện thoại chỉ cần biết nó đang nói chuyện với Cloudflare, còn thực chất toàn bộ dữ liệu đang chạy thẳng về Backend trên Laptop.

### 2.4. Bộ nhớ và Cơ sở dữ liệu duy nhất (Single Source of Truth - SSOT)

Do chỉ có **một Backend duy nhất chạy trên Laptop**:

```
                              [Laptop Backend :8000]
                                 ├── 1 Database duy nhất (SQLite / Postgres)
                                 └── 1 WebSocket Hub duy nhất (Trong RAM)
                                           ▲              ▲
                                           │              │
                       [ws_client 1: Laptop]              [ws_client 2: Điện thoại xe]
```

- **Database:** Khi Admin trên Laptop đổi trạng thái món ăn thành "Đang nấu", dữ liệu ghi vào Database trên Laptop.
- **WebSocket Hub:**
  - Trình duyệt Laptop kết nối vào WebSocket $\rightarrow$ Backend lưu socket này là Client A.
  - Điện thoại kết nối vào WebSocket $\rightarrow$ Backend lưu socket này là Client B.
  - Khi có sự kiện (Đổi trạng thái món / Đẩy quảng cáo), Backend chỉ cần phát (`broadcast`) một lần là cả Client A và Client B đều nhận được gói tin cùng lúc.

---

## 3. Cơ Chế Hoạt Động Các Tính Năng Thời Gian Thực

### 3.1. Đẩy quảng cáo thời gian thực (Real-time Ad Push)
1. **Admin thao tác trên Laptop:** Mở Admin Portal (`/admin`), vào tab Quảng cáo và nhấn nút **"Phát ngay / Đẩy xuống xe"**.
2. **Backend xử lý & Broadcast:** Request gửi tới `POST /api/v1/advertisements/{ad_id}/push`. Laptop Backend gọi `notification_manager.broadcast_to_department("All", payload)` bắn gói tin WebSocket JSON tới điện thoại robot.
3. **Điện thoại (Màn hình Robot) nhận tín hiệu:** Điện thoại gắn trên xe đang mở `/robot-screen` nhận sự kiện `ADVERTISEMENT_PUSH` qua WebSocket, tự động chuyển sang trạng thái Standby và bật component `RobotAdPlayer`.
4. **Phát Fullscreen:** Video hoặc Banner được tải trực tiếp từ Cloudinary CDN toàn cầu với băng thông tối đa. Khi khách chạm tay vào màn hình điện thoại, quảng cáo tự động tắt để trở về màn hình tiếp đón AI Concierge.

### 3.2. Điều khiển xe không độ trễ (Teleop UDP)
- Admin trên **Laptop** bấm nút di chuyển WASD trên giao diện Robot Operations (hoặc dùng cần gạt Joystick) $\rightarrow$ Backend trên Laptop nhận request và bắn gói UDP Datagram (`drive:speed:turn` hoặc `stop`) tới `100.99.72.51:9999` trên Pi 5.
- Độ trễ phản hồi chỉ từ **30ms đến 60ms**.

### 3.3. Camera FPV WebRTC P2P (Zero Latency)
- Admin trên **Laptop** xem trực tiếp hình ảnh đầu xe qua giao thức WebRTC P2P với Pi 5 (`http://100.99.72.51:8554/offer`).
- Streamer trên Pi 5 (`camera_stream.py`) thu thập đầy đủ ứng viên mạng (Vanilla ICE candidates) qua máy chủ STUN Google và trả về SDP Answer.
- Trình duyệt trên Laptop và Pi 5 bắt tay trực tiếp qua UDP P2P, giúp luồng video đạt 15-30 fps cực mượt mà không làm nghẽn máy chủ.

---

## 4. Các Lệnh Khởi Động Hệ Thống (Startup Commands)

### 4.1. Khởi động trên Laptop (Brain Server & Admin Console)

Mỗi lần bật máy Laptop để demo, mở PowerShell và thực hiện:

```powershell
# 1. Kiểm tra trạng thái Tailscale và Funnel (đã lưu cấu hình nền vĩnh viễn)
tailscale status
tailscale serve status
# Nếu Funnel chưa bật, chạy lệnh:
# tailscale funnel --bg 8000

# 2. Khởi động Backend FastAPI (lắng nghe tất cả card mạng port 8000)
cd f:\DoAn\HC-Robot\backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> **Lưu ý:** Không đổi host thành `127.0.0.1` vì sẽ chặn kết nối từ Tailscale Funnel và Pi 5.

### 4.2. Khởi động trên Raspberry Pi 5 (Robot Node)

Khi cấp nguồn cho Pi 5 (qua pin hoặc adapter), từ Laptop mở terminal SSH:

```bash
# 1. SSH vào Pi 5 qua Tailscale IP
ssh phuc@100.99.72.51

# 2. Khởi động tiến trình điều khiển phần cứng xe (động cơ, sonar, lidar)
python3 ~/HCROBOT/robot/main.py --no-camera &

# 3. Khởi động WebRTC FPV Camera Streamer
nohup /home/phuc/HCROBOT/robot/.venv/bin/python ~/HCROBOT/robot/scripts/camera_stream.py --port 8554 </dev/null >/tmp/camera_stream.log 2>&1 &

# 4. Kiểm tra 2 tiến trình đã chạy thành công:
pgrep -fa "main.py|camera_stream.py"
```

### 4.3. Mở giao diện người dùng (Clients Mapping)

- **Trên Điện thoại (Màn hình gắn trên thân Robot):**
  Mở trình duyệt Chrome trên điện thoại truy cập:
  `https://hcrobot.dinhhoangkha107.workers.dev/robot-screen`
  *(Giao diện tự động nhận diện Mobile Viewport, hiển thị khuôn mặt robot biểu cảm, nút mic chạm để nói, và sẵn sàng nhận lệnh quảng cáo toàn màn hình).*
- **Trên Laptop (Admin & Operator Console):**
  Mở trình duyệt trên Laptop truy cập:
  `https://localhost:3000/admin` (hoặc các dashboard: `/dashboard/kitchen`, `/dashboard/room-service`, `/dashboard/concierge`)
  *(Đây là nơi Admin xem bản đồ LiDAR 2D, lái xe từ xa, quản lý đơn hàng, và đẩy quảng cáo xuống điện thoại trên robot).*

---

## 5. Chế Độ Dự Phòng 100% Local (Khi Không Có Mạng Internet)

Nếu phòng thi hoặc hội trường bị phá sóng 4G và không có kết nối Internet:

1. **Kết nối Wi-Fi nội bộ:**
   - Laptop, Pi 5 và Điện thoại gắn trên Robot kết nối chung vào một Router Wi-Fi di động (không cần Internet).
   - Lấy IP LAN của Laptop (ví dụ: `192.168.1.100` bằng lệnh `ipconfig`).
2. **Chạy Frontend trực tiếp trên Laptop:**
   ```powershell
   cd f:\DoAn\HC-Robot\frontend
   npm run dev -- --host
   ```
3. **Mở ứng dụng qua IP LAN nội bộ:**
   - **Điện thoại trên Robot:** Mở `http://192.168.1.100:3000/robot-screen`.
   - **Laptop Admin:** Mở `http://localhost:3000/admin`.
   - Hệ thống vẫn hoạt động đầy đủ 100% tính năng (điều khiển xe, camera, đổi trạng thái món, đẩy quảng cáo).

---

## 6. Cấu Hình Tự Động Hóa trên Pi 5 (Systemd Services)

Để khi cắm điện pin vào Pi 5 xe tự động chạy 100% mà không cần gõ lệnh SSH, cài đặt 2 service sau trên Pi 5:

### 6.1. Service điều khiển xe (`/etc/systemd/system/hcrobot-main.service`)
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

### 6.2. Service Camera WebRTC (`/etc/systemd/system/hcrobot-camera.service`)
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

### 6.3. Kích hoạt service trên Pi 5:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hcrobot-main.service
sudo systemctl enable --now hcrobot-camera.service
```

---

## 7. Bảng Tra Cứu Xử Lý Sự Cố Nhanh (Troubleshooting)

| Hiện tượng | Nguyên nhân | Lệnh khắc phục nhanh |
| :--- | :--- | :--- |
| Camera đen màn hình / Kernel báo lỗi `-71` | Chip USB Camera bị sụt áp nguồn khi động cơ chạy | Gõ trên SSH Pi 5: `sudo usbreset 4c4a:4a55` (hoặc rút cắm lại cáp USB) |
| Web báo "Pi5 Offline" | Timeout kiểm tra quá ngắn hoặc chưa bật camera_stream | Kiểm tra: `curl http://100.99.72.51:8554/health` |
| Web báo lỗi 502 Bad Gateway | Tailscale Funnel chưa bật hoặc Laptop chưa chạy Backend | Kiểm tra: `tailscale serve status` và bật lại Uvicorn `:8000` |
| Không truyền được lệnh lái xe | `main.py` trên Pi 5 bị crash hoặc port 9999 bị chặn | SSH Pi 5 gõ: `pgrep -fa main.py` |
| Màn hình robot không nhận quảng cáo | Kết nối WebSocket bị ngắt | Tải lại trang `/robot-screen` trên Điện thoại |
| Ping Pi 5 bị relay chậm | Kết nối chưa đạt Direct P2P | Gõ trên Pi 5: `tailscale status`, kiểm tra xem có chữ `direct` chưa |
