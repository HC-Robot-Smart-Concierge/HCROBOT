import os
import glob
import subprocess

def main():
    print("=" * 60)
    print(" BÁO CÁO CÔNG SUẤT VÀ NGUỒN CẤP USB TRÊN RASPBERRY PI 5")
    print("=" * 60)

    try:
        max_curr = subprocess.check_output(["sudo", "vcgencmd", "get_config", "usb_max_current_enable"]).decode().strip()
        volts = subprocess.check_output(["sudo", "vcgencmd", "measure_volts"]).decode().strip()
        throttled = subprocess.check_output(["sudo", "vcgencmd", "get_throttled"]).decode().strip()
        temp = subprocess.check_output(["sudo", "vcgencmd", "measure_temp"]).decode().strip()
        print(f"[*] Cấu hình USB Max Current: {max_curr} (1 = 1.6A Full Power)")
        print(f"[*] Điện áp SoC Pi 5       : {volts}")
        print(f"[*] Nhiệt độ CPU           : {temp}")
        print(f"[*] Cờ Throttling          : {throttled} (0x0 = Bình thường, không sụt áp)")
    except Exception as e:
        print(f"[!] Lỗi đọc vcgencmd: {e}")

    print("-" * 60)
    print(" BẢNG XẾP HẠNG TIÊU THỤ ĐIỆN NĂNG CÁC THIẾT BỊ USB (MaxPower):")
    print("-" * 60)

    devices = []
    for d in glob.glob("/sys/bus/usb/devices/[0-9]-*"):
        pwr_path = os.path.join(d, "bMaxPower")
        if not os.path.exists(pwr_path):
            continue
        try:
            with open(pwr_path, "r") as f:
                pwr_str = f.read().strip()
            
            pwr_num = int(pwr_str.replace("mA", "")) if "mA" in pwr_str else 0
            
            prod = "Unknown"
            prod_path = os.path.join(d, "product")
            if os.path.exists(prod_path):
                with open(prod_path, "r") as f:
                    prod = f.read().strip()

            vid = ""
            vid_path = os.path.join(d, "idVendor")
            if os.path.exists(vid_path):
                with open(vid_path, "r") as f:
                    vid = f.read().strip()

            pid = ""
            pid_path = os.path.join(d, "idProduct")
            if os.path.exists(pid_path):
                with open(pid_path, "r") as f:
                    pid = f.read().strip()

            devices.append({
                "port": os.path.basename(d),
                "power_str": pwr_str,
                "power_num": pwr_num,
                "product": prod,
                "hwid": f"{vid}:{pid}",
            })
        except Exception:
            pass

    devices.sort(key=lambda x: x["power_num"], reverse=True)
    total_power = sum(d["power_num"] for d in devices)

    for i, dev in enumerate(devices, 1):
        print(f" {i}. [{dev['power_str']:>6}] {dev['product']:<28} ({dev['hwid']}) tại cổng {dev['port']}")

    print("-" * 60)
    print(f" [*] TỔNG CÔNG SUẤT TIÊU THỤ ĐĂNG KÝ: ~{total_power}mA / 1600mA tối đa của Pi 5")
    print("=" * 60)

if __name__ == "__main__":
    main()
