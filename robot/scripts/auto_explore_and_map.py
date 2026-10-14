#!/usr/bin/env python3
"""
HC-ROBOT: Autonomous Exploration & Auto-Mapping CLI
Chạy 1 lệnh duy nhất để xe tự hành quét toàn bộ không gian phòng, né vật cản,
và tự động lưu bản đồ hoàn chỉnh (.json, .yaml, .pgm).
"""

import os
import sys
import time
import json
import argparse
import urllib.request
import urllib.error

# Hỗ trợ hiển thị UTF-8 trên Windows Command Prompt
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def check_server_status(pi5_ip: str, port: int = 8000) -> bool:
    """Kiểm tra xem LiDAR SLAM Server trên Pi 5 có đang hoạt động không."""
    url = f"http://{pi5_ip}:{port}/api/v1/map/status"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "HC-Robot-AutoExplorer"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get("is_connected", False) or data.get("status") is not None
    except Exception:
        return False


def start_exploration(pi5_ip: str, port: int = 8000, map_name: str = "ban_do_tu_dong") -> bool:
    """Gửi lệnh kích hoạt Frontier Exploration & Auto-Mapping tới Pi 5."""
    url = f"http://{pi5_ip}:{port}/api/v1/map/explore/start"
    payload = json.dumps({"auto_save": True, "save_name": map_name}).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "HC-Robot-AutoExplorer"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            return res.get("status") == "SUCCESS"
    except Exception as e:
        print(f"❌ Lỗi gửi lệnh khám phá: {e}")
        return False


def stop_exploration(pi5_ip: str, port: int = 8000):
    """Gửi lệnh dừng khám phá (nếu user nhấn Ctrl+C)."""
    url = f"http://{pi5_ip}:{port}/api/v1/map/explore/stop"
    req = urllib.request.Request(
        url,
        data=b"{}",
        headers={"Content-Type": "application/json", "User-Agent": "HC-Robot-AutoExplorer"}
    )
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            pass
    except Exception:
        pass


def monitor_exploration_progress(pi5_ip: str, port: int = 8000, map_name: str = "ban_do_tu_dong"):
    """Theo dõi tiến độ tự hành khám phá qua REST polling."""
    status_url = f"http://{pi5_ip}:{port}/api/v1/map/status"
    print(f"\n🚀 ĐANG THEO DÕI TIẾN ĐỘ TỰ HÀNH QUÉT PHÒNG...")
    print(f"   (Nhấn Ctrl+C bất kỳ lúc nào để dừng và lưu bản đồ ngay lập tức)\n")

    start_time = time.time()
    last_print = 0

    try:
        while True:
            time.sleep(1.0)
            now = time.time()
            try:
                req = urllib.request.Request(status_url, headers={"User-Agent": "HC-Robot-AutoExplorer"})
                with urllib.request.urlopen(req, timeout=2.0) as resp:
                    st = json.loads(resp.read().decode('utf-8'))
            except Exception:
                continue

            is_exploring = st.get("is_exploring", False)
            robot_pose = st.get("robot_pose", {})
            rx = robot_pose.get("x", 0.0)
            ry = robot_pose.get("y", 0.0)
            ryaw = robot_pose.get("yaw", 0.0)
            elapsed = int(now - start_time)

            if now - last_print >= 2.0:
                last_print = now
                print(
                    f"⏱️ [{elapsed:03d}s] Vị trí xe: (X={rx:.2f}m, Y={ry:.2f}m, Yaw={ryaw:.1f}°) | "
                    f"Trạng thái: {'ĐANG QUÉT & TỰ HÀNH' if is_exploring else 'ĐÃ XONG'}..."
                )

            # Nếu tiến trình khám phá đã hoàn tất
            if not is_exploring and elapsed > 8:
                print("\n" + "=" * 65)
                print("🎉 QUÁ TRÌNH TỰ HÀNH KHÁM PHÁ ĐÃ HOÀN TẤT THÀNH CÔNG!")
                print(f"💾 Bản đồ đã được tự động lưu trên Pi 5:")
                print(f"   - JSON (Web Admin): robot/maps/{map_name}.json")
                print(f"   - YAML (ROS 2 Nav): robot/maps/{map_name}.yaml")
                print(f"   - PGM  (Ảnh lưới):  robot/maps/{map_name}.pgm")
                print("=" * 65)
                break

    except KeyboardInterrupt:
        print("\n\n🛑 Người dùng yêu cầu dừng tự hành...")
        stop_exploration(pi5_ip, port)
        # Lưu map ngay lập tức
        save_url = f"http://{pi5_ip}:{port}/api/v1/map/save"
        payload = json.dumps({"name": map_name}).encode('utf-8')
        try:
            req = urllib.request.Request(save_url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                print(f"💾 Đã lưu bản đồ khẩn cấp: {map_name}.json / .yaml / .pgm")
        except Exception as e:
            print(f"Lỗi lưu bản đồ: {e}")


def main():
    parser = argparse.ArgumentParser(description="HC-Robot: 1 Lệnh Tự Hành Tự Quét & Lưu Map")
    parser.add_argument("--ip", default=os.getenv("PI5_IP", "100.99.72.51"), help="Địa chỉ IP của Raspberry Pi 5")
    parser.add_argument("--port", type=int, default=8000, help="Cổng LiDAR Server (mặc định 8000)")
    parser.add_argument("--map-name", default="ban_do_khach_san_tu_dong", help="Tên file bản đồ muốn lưu")
    args = parser.parse_args()

    print("=" * 65)
    print("      HC-ROBOT: CHẾ ĐỘ TỰ HÀNH TỰ QUÉT & LƯU BẢN ĐỒ      ")
    print("=" * 65)
    print(f"  Target Pi 5:  http://{args.ip}:{args.port}")
    print(f"  Tên bản đồ:   {args.map_name}")
    print("=" * 65)

    print("🔍 Đang kiểm tra kết nối với hệ thống phần cứng Pi 5...")
    if not check_server_status(args.ip, args.port):
        print(f"❌ Không thể kết nối tới LiDAR SLAM Server tại {args.ip}:{args.port}.")
        print("👉 Hãy chắc chắn bạn đã chạy lệnh trên Pi 5:")
        print("   sudo python3 main.py --no-safety")
        sys.exit(1)

    print("✅ Đã kết nối thành công tới Pi 5!")
    print("🚀 Đang kích hoạt chế độ Frontier Exploration (Khám phá đường biên)...")
    ok = start_exploration(args.ip, args.port, map_name=args.map_name)
    if not ok:
        print("❌ Kích hoạt tự hành thất bại. Hãy kiểm tra log server.")
        sys.exit(1)

    print("🎯 Xe bắt đầu tự động di chuyển, quét tia 360° và né vật cản!")
    monitor_exploration_progress(args.ip, args.port, map_name=args.map_name)


if __name__ == "__main__":
    main()
