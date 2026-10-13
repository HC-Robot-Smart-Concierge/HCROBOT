import os
import sys
import time

# Thêm thư mục backend vào path để dùng rplidar_service
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.services.hardware.rplidar_service import rplidar_service

def main():
    port = os.getenv("LIDAR_PORT", "COM9")
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        port = sys.argv[1]
        rplidar_service.port = port

    print("=" * 60)
    print(f"  KHOI CHAY KIEM TRA PHAN CUNG RPLIDAR ({port})")
    print("=" * 60)
    print("Dang ket noi va khoi dong motor quay LiDAR...")

    success = rplidar_service.connect()
    if not success:
        print(f"\n❌ LOI: Khong the ket noi voi RPLiDAR tren cong {port}!")
        print(f"Chi tiet: {rplidar_service.last_error}")
        print("\n💡 Meo khac phuc:")
        print("1. Mo Device Manager kiem tra lai cong COM thuc te.")
        print("2. Chay lai voi ten cong COM: python test_lidar.py COM3 (thay COM3 bang cong thuc te).")
        return

    print("✅ Ket noi thanh cong! Motor LiDAR dang quay...")
    rplidar_service.start_scanning()
    print("Dang doc luong tia laser 360 do (Nhan Ctrl+C de dung)...")
    print("-" * 60)

    try:
        start_time = time.time()
        while True:
            time.sleep(0.5)
            scans = rplidar_service.get_latest_scans()
            count = len(scans)
            if count > 0:
                first = scans[0]
                min_dist = min(p["distance"] for p in scans)
                max_dist = max(p["distance"] for p in scans)
                print(f"[LiDAR OK] So diem: {count:3d} pts | Cu ly gan nhat: {min_dist:.2f}m | Xa nhat: {max_dist:.2f}m | Mau: goc={first['angle']}° culy={first['distance']}m")
            else:
                print("[LiDAR] Dang cho luong du lieu tia quét tu cam bien...")
    except KeyboardInterrupt:
        print("\n🛑 Dang tat motor va dong ket noi LiDAR...")
    finally:
        rplidar_service.stop()
        print("✅ Da dung LiDAR an toan.")

if __name__ == "__main__":
    main()
