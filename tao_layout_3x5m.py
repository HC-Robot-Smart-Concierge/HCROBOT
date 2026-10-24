#!/usr/bin/env python3
"""
TẠO & KHÓA LAYOUT CỨNG 3M x 5M CHO HC-ROBOT
- Khóa cứng 4 bức tường xung quanh (X: [-1.5m, +1.5m], Y: [-2.5m, +2.5m]).
- Vùng xám bên ngoài giữ nguyên không đổi (không bị mở rộng bậy bạ).
- Cơ chế sương mù (Fog of War): Robot đi đến đâu mở sàn trắng đến đó.
- Xuất đầy đủ 3 định dạng: JSON (Web Admin), YAML & PGM (ROS 2 Nav2).
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error

# UTF-8 cho Windows CMD
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
ROBOT_DIR = os.path.join(ROOT_DIR, "robot")
MAPS_DIR = os.path.join(ROBOT_DIR, "maps")
STATIC_MAPS_DIR = os.path.join(ROOT_DIR, "backend", "static", "maps")
os.makedirs(MAPS_DIR, exist_ok=True)
os.makedirs(STATIC_MAPS_DIR, exist_ok=True)

sys.path.insert(0, ROBOT_DIR)
from scripts.lidar_service import RPLidarSLAMCore


def print_ascii_preview(grid_data, width=800, height=800, origin_x=-10.0, origin_y=-10.0, res=0.025):
    """Vẽ bản đồ ASCII mô phỏng khu vực phòng 3x5m trên console."""
    # Trích xuất vùng quanh phòng: X: [-2.0m, +2.0m], Y: [-3.0m, +3.0m]
    x_min, x_max = -2.0, 2.0
    y_min, y_max = -3.0, 3.0

    cols = 40
    rows = 24
    dx_world = (x_max - x_min) / cols
    dy_world = (y_max - y_min) / rows

    print("\n" + "╔" + "═" * (cols * 2) + "╗")
    print("║" + " BẢN ĐỒ LAYOUT CỨNG 3m x 5m (FOG OF WAR SẴN SÀNG) ".center(cols * 2) + "║")
    print("╚" + "═" * (cols * 2) + "╝")

    for r in range(rows - 1, -1, -1):
        row_str = ""
        wy1 = y_min + r * dy_world
        wy2 = y_min + (r + 1) * dy_world
        gy1 = max(0, int((wy1 - origin_y) / res))
        gy2 = min(height, int((wy2 - origin_y) / res) + 1)

        for c in range(cols):
            wx1 = x_min + c * dx_world
            wx2 = x_min + (c + 1) * dx_world
            gx1 = max(0, int((wx1 - origin_x) / res))
            gx2 = min(width, int((wx2 - origin_x) / res) + 1)

            # Robot tại tâm (0, 0)
            if wx1 <= 0.0 <= wx2 and wy1 <= 0.0 <= wy2:
                row_str += "🤖"
                continue

            has_wall = False
            has_free = False
            for gy in range(gy1, gy2):
                for gx in range(gx1, gx2):
                    v = grid_data[gy * width + gx]
                    if v == 100:
                        has_wall = True
                        break
                    elif v == 0:
                        has_free = True
                if has_wall:
                    break

            if has_wall:
                row_str += "██"  # Tường cứng cố định
            elif has_free:
                row_str += "  "  # Vùng trắng đã khám phá
            else:
                row_str += "░░"  # Vùng xám (sương mù / ngoài phòng)

        print(f"│{row_str}│")

    print("└" + "──" * cols + "┘")
    print(" [██] Tường cứng cố định (100)  [  ] Sàn trắng tự do (0)  [🤖] Robot (0,0)  [░░] Vùng xám (-1)\n")


def notify_pi5_server(pi5_ip="100.99.72.51", port=8000):
    """Thông báo cho LiDAR Service trên Raspberry Pi 5 chuyển sang Layout Cứng 3x5m."""
    url = f"http://{pi5_ip}:{port}/api/v1/map/layout/3x5m"
    try:
        req = urllib.request.Request(
            url,
            data=b"{}",
            headers={"Content-Type": "application/json", "User-Agent": "HC-Robot-3x5m-Setup"}
        )
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get("status") == "SUCCESS":
                print(f"✅ ĐÃ ĐỒNG BỘ LAYOUT 3x5M LÊN RASPBERRY PI 5 ({pi5_ip}:{port})!")
                return True
    except Exception as e:
        print(f"ℹ️  Pi 5 chưa bật service tại {pi5_ip}:{port} (sẽ nạp tự động khi Pi 5 khởi động)")
    return False


def main():
    map_name = "phong_3x5m"
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        map_name = sys.argv[1]

    print("=" * 68)
    print("      HC-ROBOT: KHỞI TẠO BẢN ĐỒ LAYOUT CỨNG 3M x 5M CHUẨN XÁC      ")
    print("=" * 68)
    print(" • Kích thước thực tế: Chiều ngang 3.0m (X) × Chiều dọc 5.0m (Y)")
    print(" • 4 bức tường xung quanh: CỐ ĐỊNH 100% (Khóa cứng, không bị tia laser xóa đè)")
    print(" • Vùng xám bên ngoài: CỐ ĐỊNH (Tia laser không bao giờ mở rộng ra ngoài)")
    print(" • Cơ chế khám phá: Đi đến đâu mở sương mù trắng đến đó (Fog of War)")
    print(" • Định dạng file: JSON (Web Admin), YAML (Nav2) & PGM (Occupancy Grid)")
    print("=" * 68)

    # 1. Khởi tạo core và dựng layout 3x5m
    core = RPLidarSLAMCore(port="/dev/null")
    res = core.init_fixed_layout_3x5m(map_name)

    # 2. Sao chép thêm bản đồ sang backend/static/maps để Web Admin nạp offline nếu cần
    json_src = res["json_path"]
    json_dst = os.path.join(STATIC_MAPS_DIR, f"{map_name}.json")
    try:
        with open(json_src, "r", encoding="utf-8") as f_in, open(json_dst, "w", encoding="utf-8") as f_out:
            f_out.write(f_in.read())
        print(f"📁 Đã đồng bộ sang backend: {json_dst}")
    except Exception as e:
        print(f"⚠️  Lỗi copy sang static maps: {e}")

    # 3. In thông số bản đồ
    print("\n📊 KẾT QUẢ TẠO BẢN ĐỒ 3x5M:")
    print(f" - Tên bản đồ:       {res['name']}")
    print(f" - Số ô tường cứng:  {res['occupied_cells']} ô (dày 5.0cm)")
    print(f" - Số ô sàn khởi đầu:{res['free_cells']} ô (bán kính 0.5m quanh robot)")
    print(f" - File JSON:        {res['json_path']}")
    print(f" - File ROS 2 YAML:  {res['yaml_path']}")
    print(f" - File Ảnh PGM:     {res['pgm_path']}")

    # 4. Hiển thị hình ảnh ASCII
    print_ascii_preview(core.grid_data, core.grid_width, core.grid_height, core.origin_x, core.origin_y, core.resolution)

    # 5. Gửi sang Raspberry Pi 5 nếu có kết nối
    pi5_ip = os.getenv("PI5_IP", "100.99.72.51")
    notify_pi5_server(pi5_ip)

    print("=" * 68)
    print("🎉 HOÀN TẤT THÀNH CÔNG!")
    print("👉 Bây giờ bạn có thể:")
    print("   1. Mở Web Admin (http://localhost:3000) -> Kho Bản Đồ -> Chọn 'phong_3x5m'")
    print("   2. Hoặc chạy lệnh Navigation trên bản đồ cứng: chay_navigation_map_tinh.bat phong_3x5m")
    print("=" * 68)


if __name__ == "__main__":
    main()
