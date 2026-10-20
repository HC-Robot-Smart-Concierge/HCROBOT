import os
import sys
import time
import json
import math
from typing import List, Dict, Any

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Nạp module backend
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.services.hardware.rplidar_service import rplidar_service, MAPS_DIR

def print_ascii_map(grid_data: List[int], width: int = 200, height: int = 200, out_cols: int = 50, out_rows: int = 25):
    """
    Thu nhỏ ma trận 200x200 thành bản đồ ký tự ASCII (out_cols x out_rows) để in trực tiếp lên màn hình console.
    - '#' : Tường / Vật cản (Obstacle 100)
    - '.' : Vùng sàn trống đi lại được (Free space 0)
    - 'R' : Vị trí Robot tại tâm (0, 0)
    - ' ' : Vùng ngoài chưa quét tới (-1)
    """
    cell_w = width // out_cols
    cell_h = height // out_rows
    center_col = out_cols // 2
    center_row = out_rows // 2

    print("\n" + "╔" + "═" * (out_cols * 2) + "╗")
    print("║" + " BẢN ĐỒ 2D OCCUPANCY GRID (SLAM LIDAR) ".center(out_cols * 2) + "║")
    print("╚" + "═" * (out_cols * 2) + "╝")

    for r in range(out_rows - 1, -1, -1):  # Trục Y từ trên xuống
        row_str = ""
        for c in range(out_cols):
            # Nếu là vị trí Robot ở chính giữa
            if c == center_col and r == center_row:
                row_str += "🤖"
                continue

            # Thống kê giá trị trong khối ô con cell_w x cell_h
            has_obstacle = False
            has_free = False
            for dy in range(cell_h):
                gy = r * cell_h + dy
                for dx in range(cell_w):
                    gx = c * cell_w + dx
                    if 0 <= gx < width and 0 <= gy < height:
                        val = grid_data[gy * width + gx]
                        if val == 100:
                            has_obstacle = True
                            break
                        elif val == 0:
                            has_free = True
                if has_obstacle:
                    break

            if has_obstacle:
                row_str += "██"  # Tường / Vật cản
            elif has_free:
                row_str += "  "  # Vùng trống đi lại được
            else:
                row_str += "░░"  # Vùng chưa quét tới
        print(f"│{row_str}│")

    print("└" + "──" * out_cols + "┘")
    print(" CHÚ THÍCH: [██] Tường/Vật cản  [  ] Không gian trống  [🤖] Vị trí Robot  [░░] Vùng ngoài")


def main():
    port = os.getenv("LIDAR_PORT", "COM9")
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        port = sys.argv[1]
        rplidar_service.port = port

    duration = 5.0
    for arg in sys.argv:
        if arg.startswith("--duration="):
            try:
                duration = float(arg.split("=")[1])
            except ValueError:
                pass

    print("=" * 65)
    print(f"  QUÉT LIDAR & TỰ ĐỘNG LƯU BẢN ĐỒ CỐ ĐỊNH (MAP PERSISTENCE)")
    print("=" * 65)
    print(f"[*] Cổng cấu hình: {port} | Thời gian quét: {duration} giây")
    print("[*] Đang kết nối phần cứng LiDAR...")

    connected = rplidar_service.connect()
    
    if connected:
        print(f"✅ Đã kết nối thành công với phần cứng RPLiDAR trên cổng {port}!")
        print("🚀 Đang bật motor quay quét không gian 360 độ...")
        rplidar_service.set_map_lock(False)  # Mở khóa để vẽ map
        rplidar_service.reset_grid_map()     # Xóa trắng để quét mới
        rplidar_service.start_scanning()

        start = time.time()
        while time.time() - start < duration:
            elapsed = time.time() - start
            scans = rplidar_service.get_latest_scans()
            print(f"--> Đang quét... {elapsed:.1f}s / {duration:.1f}s (Số điểm tia: {len(scans):3d})", end="\r")
            time.sleep(0.2)
        print("\n✅ Quét thực tế hoàn tất!")
        rplidar_service.stop()
    else:
        print(f"\n⚠️  Không tìm thấy phần cứng RPLiDAR cắm ở cổng '{port}'.")
        print(f"    (Nguyên nhân: {rplidar_service.last_error or 'Chưa cắm cáp USB'})")
        print("\n[+] Đang tự động nạp Bản đồ sảnh cố định mẫu (Hotel Lobby Fixed Template)...")
        rplidar_service.load_default_saved_map()

    # 1. Lưu bản đồ cố định vào File & DB
    print("\n[+] Đang lưu bản đồ vào Database và File tĩnh...")
    save_res = rplidar_service.save_map_to_storage(
        map_id="phong_lam_viec",
        name="Bản đồ Phòng Làm Việc",
        floor="Phòng Làm Việc"
    )

    # 2. Khóa bản đồ lại cố định
    rplidar_service.set_map_lock(True)
    print("🔒 ĐÃ KHÓA BẢN ĐỒ CỐ ĐỊNH (Static Map Locked - Không bị trôi khi xe quay)!")
    print(f"📁 Đường dẫn file lưu: {save_res.get('file')}")

    # 3. Lấy dữ liệu và in ra màn hình Console
    map_data = rplidar_service.get_grid_map_data()
    grid = map_data["grid_data"]
    w = map_data["width"]
    h = map_data["height"]

    obs_count = sum(1 for c in grid if c == 100)
    free_count = sum(1 for c in grid if c == 0)

    print(f"\n📊 THỐNG KÊ BẢN ĐỒ:")
    print(f"- Kích thước: {w} x {h} ô lưới (Độ phân giải: 0.05m = 10m x 10m)")
    print(f"- Số ô tường/vật cản: {obs_count} ô")
    print(f"- Số ô không gian sàn trống: {free_count} ô")
    print(f"- Trạng thái: CỐ ĐỊNH (Đã lưu vào CSDL)")

    # 4. In bản đồ trực tiếp lên Terminal
    print_ascii_map(grid, width=w, height=h, out_cols=40, out_rows=20)

    print("\n" + "=" * 65)
    print("🎉 HOÀN TẤT! Bạn có thể mở giao diện Web để xem bản đồ đồ họa:")
    print("👉 URL: http://localhost:3000 -> Chọn mục 'LiDAR SLAM Map'")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
