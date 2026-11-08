# HƯỚNG DẪN TRIỂN KHAI HYBRID BACKEND & KẾT NỐI P2P VỚI RASPBERRY PI 5 QUA TAILSCALE

> **Tài liệu liên quan:**
> - Kiến trúc ROS 2 phân tán: [[distributed_ros2|Hệ Thống ROS 2 Phân Tán (Pi 5 & Laptop)]]
> - Đặc tả phần cứng & Edge Computing: [[hardware_architecture|Đặc Tả Phần Cứng & ROS 2 Edge]]
> - Kiến trúc tổng thể hệ thống: [[../02-Architecture|02-Architecture (Kiến trúc tổng thể)]]

Tài liệu này hướng dẫn chi tiết cách biến Laptop cá nhân thành Backend Server trung tâm, triển khai mô hình **Hybrid Network** kết hợp:
1. **Private Tailnet (P2P Direct Connection):** Kết nối trực tiếp siêu tốc, độ trễ cực thấp (< 5ms) giữa Laptop Server và Raspberry Pi 5 trên thân Robot.
2. **Tailscale Funnel (Public Internet HTTPS):** Cung cấp tên miền có chứng chỉ SSL/TLS tự động (Let's Encrypt) cho khách lưu trú dùng 4G quét mã QR xem sơ đồ tầng (Guest Map) và Admin quản trị từ xa.
3. **Edge Static Hosting (Vercel / Cloudflare Pages):** Triển khai Frontend với mạng lưới CDN toàn cầu tải giao diện tức thì.

---

## 1. Sơ Đồ Kiến Trúc Mạng Hybrid (Network Topology)

```
                              [ INTERNET / MẠNG NGOÀI ]
                     Khách dùng 4G quét QR • Admin truy cập từ xa
                                        │
                                        ▼
                         [ CLOUDFLARE PAGES / VERCEL ]
                           https://guest-map.hotel.com
                         (Phục vụ HTML/JS/CSS tĩnh < 10ms)
                                        │
                                        │ Gọi REST API (HTTPS)
                                        ▼
                           [ TAILSCALE FUNNEL (HTTPS) ]
                      https://laptop-server.tailnet.ts.net
                                        │
       ═════════════════════════════════╪═════════════════════════════════
                                        │ Relay Ingress
                                        ▼
                        [ LAPTOP SERVER (WINDOWS / WSL2) ]
                        • FastAPI Backend (:8000)
                        • AI Core (Groq / Gemini / Ollama Qwen)
                        • ROS 2 Navigation & Rosbridge (:9090)
                        • Tailscale IP: 100.x.y.z
                                        ▲
                                        │
               ĐƯỜNG TRUYỀN WIREGUARD P2P DIRECT (UDP NAT TRAVERSAL)
                  Độ trễ: 1ms - 5ms | Băng thông: Tối đa card mạng
                                        │
                                        ▼
                          [ RASPBERRY PI 5 TRÊN ROBOT ]
                          • Tailscale IP: 100.99.72.51
                          • RPLiDAR A1M8 (/scan, /tf)
                          • Motor Controller (/cmd_vel)
                          • Pi5 Camera Stream (MJPEG :8554)
                          • Màn hình Kiosk cục bộ (:3000)
```

---

## 2. Thiết Lập Trên Laptop Server (Host Server)

### 2.1. Cài đặt và cấu hình Tailscale
1. Tải và cài đặt Tailscale client trên Windows từ trang chủ Tailscale.
2. Đăng nhập tài khoản quản trị Tailscale.
3. Kiểm tra địa chỉ IP Tailnet được cấp cho Laptop:
   ```powershell
   tailscale ip -4
   # Ví dụ: 100.92.82.61
   ```

### 2.2. Khởi chạy Backend FastAPI đa giao diện
File khởi chạy của dự án (`backend/run.py`) đã được bind vào địa chỉ `0.0.0.0:8000`:
```python
uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
```
*Lưu ý: Không đổi host thành `127.0.0.1` vì sẽ chặn toàn bộ kết nối đến từ card mạng Tailscale và Pi 5.*

### 2.3. Mở cổng Windows Firewall
Mặc định Windows Firewall chặn traffic từ mạng ảo Tailscale vào port 8000, 8554, 9090. Mở PowerShell với quyền Administrator:
```powershell
New-NetFirewallRule -DisplayName "HCRobot Backend 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "HCRobot Rosbridge 9090" -Direction Inbound -LocalPort 9090 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "HCRobot Camera 8554" -Direction Inbound -LocalPort 8554 -Protocol TCP -Action Allow
```

### 2.4. Ngăn chặn Laptop rơi vào trạng thái Sleep khi gập nắp
Laptop làm server bắt buộc phải cắm sạc liên tục và không được tự ngắt kết nối:
1. Mở **Control Panel** -> **Power Options** -> **Choose what closing the lid does**.
2. Tại cột **Plugged in**:
   - **When I close the lid:** Chọn **Do nothing**.
3. Tại **Change when the computer sleeps**:
   - **Put the computer to sleep:** Chọn **Never**.

### 2.5. Kích hoạt Tailscale Funnel (Cổng HTTPS Công Cộng)
Để khách ngoài internet (điện thoại 4G) có thể truy cập mà không cần cài Tailscale:
```powershell
# Chuyển tiếp cổng 8000 thành HTTPS nội bộ
tailscale serve --bg 8000

# Mở cổng Funnel ra toàn cầu qua cổng 443
tailscale funnel --bg 443 on

# Xem trạng thái và lấy URL Public được cấp:
tailscale funnel status
# Kết quả: https://laptop-server.tailnet-id.ts.net
```

---

## 3. Cấu Hình Kết Nối P2P Trực Tiếp Với Raspberry Pi 5

Mục tiêu cốt lõi: Traffic giữa Pi 5 và Laptop **phải đi thẳng (Direct Connection - P2P)** qua giao thức WireGuard UDP, tuyệt đối không đi vòng qua máy chủ trung gian (DERP Relay) để đạt độ trễ nhỏ hơn 5ms.

### 3.1. Cài đặt Tailscale trên Raspberry Pi 5 (Linux)
SSH vào Pi 5 hoặc mở terminal trên Pi 5:
```bash
# 1. Cài đặt tự động Tailscale qua script chính thức
curl -fsSL https://tailscale.com/install.sh | sh

# 2. Bật dịch vụ Tailscale
sudo systemctl enable --now tailscaled

# 3. Đăng nhập và gia nhập cùng mạng Tailnet với Laptop
sudo tailscale up --accept-routes
```
Mở đường link xác thực trên trình duyệt để duyệt Pi 5 vào cùng mạng Tailnet với Laptop.

### 3.2. Kiểm tra trạng thái kết nối P2P (Direct vs Relay)
Trên terminal Pi 5, kiểm tra tình trạng kết nối tới Laptop:
```bash
tailscale status
```
Kết quả hiển thị tương tự:
```text
100.99.72.51    pi5-robot            user@  linux   -
100.92.82.61    laptop-server        user@  windows active; direct 192.168.1.15:41641, tx 45210 rx 58120
```
> **Dấu hiệu P2P thành công:** Xuất hiện chữ **`direct`** kèm địa chỉ IP nội mạng LAN hoặc địa chỉ WAN công cộng.
> Nếu hiển thị **`relay "sin"`** hoặc **`relay "tyo"`**, kết nối đang bị nghẽn và phải đi vòng qua server DERP tại Singapore/Tokyo.

Kiểm tra độ trễ thực tế:
```bash
tailscale ping 100.92.82.61
```
- Nếu đạt chuẩn P2P nội bộ: `pong from laptop-server (100.92.82.61) via 192.168.1.15:41641 in 1.4ms (direct)`
- Độ trễ chuẩn phải nằm trong khoảng **1ms đến 5ms**.

### 3.3. Tối ưu NAT Traversal để luôn đạt Direct P2P 100%
Nếu hai máy nằm ở hai mạng khác nhau (ví dụ: Pi 5 dùng 4G phát từ điện thoại, Laptop nối mạng cáp quang gia đình):
1. **Bật UPnP trên Router Wi-Fi nhà:** Cho phép Tailscale tự động mở cổng UDP ngẫu nhiên cho NAT Traversal.
2. **Cố định cổng lắng nghe WireGuard trên Pi 5:**
   ```bash
   sudo tailscale up --port=41641 --accept-routes
   ```
3. Chạy kiểm tra chuẩn đoán mạng của Tailscale:
   ```bash
   tailscale netcheck
   ```
   Đảm bảo trường `UDP: true` và `MappingVariesByDestIP: false` để Direct P2P hoạt động tối ưu.

### 3.4. Cấu hình ROS 2 và Dịch Vụ trên Pi 5 gọi Backend Laptop
Cấu hình địa chỉ IP Tailnet của Laptop (`100.92.82.61`) vào file môi trường trên Pi 5:

1. **Cấu hình ROS 2 CycloneDDS (`cyclonedds.xml`):**
   Khai báo IP Laptop vào danh sách Peers:
   ```xml
   <?xml version="1.0" encoding="UTF-8" ?>
   <CycloneDDS>
     <Domain>
       <General>
         <NetworkInterfaceAddress>tailscale0</NetworkInterfaceAddress>
       </General>
       <Discovery>
         <Peers>
           <Peer address="100.92.82.61"/>
         </Peers>
       </Discovery>
     </Domain>
   </CycloneDDS>
   ```

2. **Cấu hình MJPEG Camera Stream trỏ về Backend:**
   Pi 5 stream video qua cổng 8554 nội bộ hoặc gửi frame trực tiếp lên Backend:
   ```bash
   # URL stream chuẩn cho backend laptop đọc:
   http://100.99.72.51:8554/stream
   ```

3. **Cấu hình Rosbridge WebSocket Client:**
   Web Kiosk trên Robot kết nối thẳng tới:
   ```text
   ws://100.92.82.61:9090
   ```

---

## 4. Cấu Hình Triển Khai Frontend Hybrid

Để tránh lỗi **Mixed Content** (trình duyệt chặn request HTTP khi trang đang mở bằng HTTPS):

### 4.1. Cấu hình Dynamic API Client trong Frontend
Tại file cấu hình API Frontend (`frontend/src/services/apiConfig.js` hoặc `aiApi.js`), sử dụng cơ chế phát hiện môi trường động:

```javascript
/**
 * Dynamic API Base URL Resolver
 * - Môi trường Robot Kiosk / LAN nội bộ: Sử dụng IP Private Tailnet trực tiếp (độ trễ < 2ms).
 * - Môi trường Khách quét QR / Admin từ xa: Sử dụng Public HTTPS URL từ Tailscale Funnel.
 */
export const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000';

  const host = window.location.hostname;

  // 1. Nếu đang mở trực tiếp trên Robot hoặc cùng mạng Tailnet
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('100.')) {
    return 'http://100.92.82.61:8000';
  }

  // 2. Nếu khách đang truy cập từ ngoài internet (Vercel / Cloudflare / 4G)
  return 'https://laptop-server.tailnet-id.ts.net';
};
```

### 4.2. Triển khai Frontend lên Vercel / Cloudflare Pages
1. Đăng nhập Vercel hoặc Cloudflare Pages, kết nối với Git Repository.
2. Thiết lập Build Settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Cấu hình Environment Variable trên Vercel:
   ```env
   VITE_API_URL=https://laptop-server.tailnet-id.ts.net
   ```
4. Khi build hoàn tất, Vercel cung cấp URL HTTPS miễn phí (ví dụ: `https://hcrobot.vercel.app`).
   - Mã QR hiển thị trên màn hình Robot chỉ cần chứa link: `https://hcrobot.vercel.app/guest-map?poi=infinity_pool`.
   - Khách dùng điện thoại quét mã QR sẽ tải giao diện cực nhanh từ CDN của Vercel và gửi dữ liệu về Laptop Server qua đường truyền bảo mật của Tailscale Funnel.

---

## 5. Bảng Tổng Hợp Kiểm Tra Định Kỳ (Verification Checklist)

| Hạng mục kiểm tra | Lệnh thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- |
| **P2P Pi 5 <-> Laptop** | `tailscale ping 100.92.82.61` | Đạt `direct`, ping $< 5\text{ ms}$ |
| **FastAPI Backend Port** | `curl http://100.92.82.61:8000/health` | HTTP 200 `{"status":"ok"}` |
| **Funnel Public HTTPS** | `curl https://laptop-server.ts.net/health` | HTTP 200 với SSL hợp lệ |
| **ROS 2 Topic Discovery** | `ros2 topic list` (trên Laptop) | Thấy topic `/scan` từ Pi 5 |
| **Power Management** | Gập nắp Laptop thử nghiệm 5 phút | SSH và API vẫn phản hồi liên tục |

