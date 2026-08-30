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
    
    # Dữ liệu tri thức mẫu phong phú có kèm tiêu đề, danh mục và hình ảnh minh họa cho Robot
    docs = [
        {
            "id": "kb_restaurant_policy_001",
            "document": "Nhà hàng Skyview & Grand Gourmet áp dụng chính sách đặt bàn trước tối thiểu 2 giờ cho nhóm từ 4 người trở lên. Khu vực phòng ăn VIP (Private Dining) yêu cầu đặt trước 24 giờ. Hủy bàn miễn phí trước 1 giờ. Trang phục lịch sự (Smart Casual) được khuyến nghị khi dùng bữa tại Skyview Lounge tầng 25.",
            "metadata": {
                "title": "Restaurant Booking Policy",
                "category": "Dining",
                "facility": "restaurant",
                "floor": "Tầng 2 & Tầng 25",
                "status": "Active",
                "primary_image": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80",
                "gallery_images": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80,https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&auto=format&fit=crop&q=80,https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80",
                "last_updated": "2026-08-28"
            }
        },
        {
            "id": "kb_pool_001",
            "document": "Hồ bơi vô cực nằm ở tầng 4 (Khu Wellness) của khách sạn Aurora Grand. Thời gian mở cửa từ 06:00 đến 22:00 hàng ngày. Khăn tắm và nước khoáng được phục vụ miễn phí tại quầy hồ bơi. Trẻ em dưới 12 tuổi cần người lớn đi kèm.",
            "metadata": {
                "title": "Hồ Bơi Vô Cực (Infinity Pool)",
                "category": "Facilities",
                "facility": "swimming_pool",
                "floor": "Tầng 4",
                "status": "Active",
                "primary_image": "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&auto=format&fit=crop&q=80",
                "gallery_images": "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&auto=format&fit=crop&q=80,https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&auto=format&fit=crop&q=80",
                "last_updated": "2026-08-25"
            }
        },
        {
            "id": "kb_spa_001",
            "document": "Aurora Serenity Spa & Massage nằm tại tầng 4, mở cửa từ 09:00 đến 22:00. Dịch vụ cung cấp xông hơi đá muối Himalaya, massage đá nóng, chăm sóc da mặt cao cấp. Khách lưu trú tại khách sạn được giảm giá 15% tất cả các liệu trình.",
            "metadata": {
                "title": "Aurora Serenity Spa & Wellness",
                "category": "Wellness",
                "facility": "spa",
                "floor": "Tầng 4",
                "status": "Active",
                "primary_image": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80",
                "gallery_images": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80,https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&auto=format&fit=crop&q=80",
                "last_updated": "2026-08-26"
            }
        },
        {
            "id": "kb_deluxe_suite_001",
            "document": "Hạng phòng Deluxe King Suite có diện tích 55m2, ban công ngắm toàn cảnh thành phố, giường đệm lông ngỗng King-size, bồn tắm nằm đá cẩm thạch và quầy mini-bar miễn phí set trà bánh chào mừng.",
            "metadata": {
                "title": "Deluxe King Suite & Amenities",
                "category": "Accommodations",
                "facility": "rooms",
                "floor": "Tầng 12 - 24",
                "status": "Active",
                "primary_image": "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&auto=format&fit=crop&q=80",
                "gallery_images": "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&auto=format&fit=crop&q=80,https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop&q=80",
                "last_updated": "2026-08-20"
            }
        },
        {
            "id": "kb_wifi_001",
            "document": "Mạng Wi-Fi tốc độ cao miễn phí của khách sạn có tên là 'AuroraGrand_Guest_WiFi'. Mật khẩu truy cập là 'welcome2026'. Quý khách có thể kết nối không giới hạn tại sảnh lobby, phòng ngủ và nhà hàng.",
            "metadata": {
                "title": "Mạng Wi-Fi & Hỗ Trợ Kỹ Thuật",
                "category": "General",
                "facility": "wifi",
                "floor": "Toàn bộ khách sạn",
                "status": "Active",
                "primary_image": "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80",
                "last_updated": "2026-08-15"
            }
        },
        {
            "id": "kb_checkout_001",
            "document": "Giờ nhận phòng (Check-in) tiêu chuẩn là 14:00. Giờ trả phòng (Check-out) là 12:00 trưa. Khách hàng có nhu cầu trả phòng muộn (Late Check-out) trước 18:00 sẽ phụ thu 50% tiền phòng tùy vào tình trạng phòng trống.",
            "metadata": {
                "title": "Quy Định Check-in & Check-out",
                "category": "Policies",
                "facility": "reception",
                "floor": "Quầy Lễ Tân (Tầng 1)",
                "status": "Active",
                "primary_image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80",
                "last_updated": "2026-08-27"
            }
        }
    ]
    
    ids = [d["id"] for d in docs]
    documents = [d["document"] for d in docs]
    metadatas = [d["metadata"] for d in docs]
    
    print("[+] Đang nạp dữ liệu tri thức khách sạn kèm ảnh minh họa vào ChromaDB...")
    collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )
    print(f"[SUCCESS] Đã nạp thành công {len(docs)} tài liệu vào collection 'concierge_kb'!")


if __name__ == "__main__":
    seed_hotel_knowledge()
