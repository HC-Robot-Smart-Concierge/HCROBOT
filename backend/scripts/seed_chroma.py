import sys
import os
import io

# Reconfigure stdout for UTF-8 encoding on Windows terminal
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.chroma import get_concierge_collection


def seed_hotel_knowledge():
    collection = get_concierge_collection("concierge_kb")
    
    # Dữ liệu tri thức mẫu của khách sạn
    docs = [
        {
            "id": "kb_pool_001",
            "document": "Hồ bơi vô cực nằm ở tầng 5 của khách sạn. Thời gian mở cửa từ 06:00 đến 22:00 hàng ngày. Khăn tắm và nước uống được phục vụ miễn phí tại quầy hồ bơi.",
            "metadata": {"category": "facilities", "facility": "swimming_pool"}
        },
        {
            "id": "kb_wifi_001",
            "document": "Mạng Wi-Fi miễn phí của khách sạn có tên là 'HCRobot_Guest_WiFi'. Mật khẩu truy cập là 'welcome2026'. Quý khách có thể kết nối ở tất cả các khu vực sảnh và phòng nghỉ.",
            "metadata": {"category": "general", "facility": "wifi"}
        },
        {
            "id": "kb_breakfast_001",
            "document": "Nhà hàng Buffet sáng 'Grand Gourmet' phục vụ tại tầng 2 từ 06:30 đến 10:00 sáng. Bữa sáng đã bao gồm trong giá phòng đối với khách đặt phòng kèm ăn sáng.",
            "metadata": {"category": "dining", "facility": "restaurant"}
        },
        {
            "id": "kb_housekeeping_001",
            "document": "Dịch vụ dọn phòng hoạt động từ 08:00 đến 20:00 hàng ngày. Khách hàng có thể yêu cầu thêm khăn tắm, chăn gối hoặc đồ dùng cá nhân thông qua Robot hoặc ứng dụng di động.",
            "metadata": {"category": "services", "facility": "housekeeping"}
        },
        {
            "id": "kb_checkout_001",
            "document": "Giờ trả phòng (Check-out) tiêu chuẩn là 12:00 trưa. Giờ nhận phòng (Check-in) là 14:00. Nếu quý khách muốn trả phòng muộn, vui lòng liên hệ lễ tân để được hỗ trợ.",
            "metadata": {"category": "policies", "facility": "reception"}
        }
    ]
    
    ids = [d["id"] for d in docs]
    documents = [d["document"] for d in docs]
    metadatas = [d["metadata"] for d in docs]
    
    print("[+] Đang nạp dữ liệu tri thức khách sạn vào ChromaDB...")
    collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )
    print(f"[SUCCESS] Đã nạp thành công {len(docs)} tài liệu vào collection 'concierge_kb'!")


if __name__ == "__main__":
    seed_hotel_knowledge()
