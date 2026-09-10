import os
import sys
import asyncio
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8')

from app.services.ai.tts_service import tts_service

COMMON_PHRASES = [
    # 1. Lời chào các buổi
    "Dạ em chào buổi sáng quý khách! Chúc quý khách một ngày mới tràn đầy năng lượng tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?",
    "Dạ em chào quý khách! Chúc quý khách một buổi chiều thật vui vẻ tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?",
    "Dạ em chào buổi tối quý khách! Chúc quý khách một buổi tối thư thái tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?",
    "Dạ em chào quý khách! Em là trợ lý Robot Concierge của khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?",
    
    # 2. Lời cảm ơn & Tạm biệt
    "Dạ không có gì ạ! Chúc quý khách một kỳ nghỉ thật tuyệt vời tại khách sạn Aurora. Quý khách cần em hỗ trợ gì nữa không ạ?",
    "Dạ tạm biệt quý khách! Chúc quý khách một ngày tốt lành và hẹn sớm gặp lại ạ.",
    "Dạ em là HCRobot, trợ lý lễ tân thông minh tại khách sạn Aurora Grand. Em có thể hỗ trợ quý khách chỉ đường, gọi món, đặt phòng và tra cứu tiện ích khách sạn ạ.",

    # 3. Tiện ích & Wifi
    "Dạ wifi miễn phí tại sảnh và các phòng là 'Aurora_Guest', mật khẩu kết nối là 'aurora2026' ạ.",
    "Dạ hồ bơi vô cực nằm ở Tầng 4 của khách sạn, mở cửa từ 6 giờ sáng đến 10 giờ tối ạ. Quý khách có cần em gọi nước uống lên hồ bơi không ạ?",
    "Dạ phòng tập thể hình Fitness Center nằm tại Tầng 3 của khách sạn, mở cửa 24/7 và hoàn toàn miễn phí cho khách lưu trú ạ.",
    "Dạ Aurora Spa nằm tại Tầng 5, mở cửa từ 9 giờ sáng đến 10 giờ tối. Quý khách có muốn em đặt lịch hẹn trước với chuyên viên không ạ?",
    "Dạ giờ trả phòng chuẩn của khách sạn là 12 giờ trưa. Quý khách có muốn em đặt xe đưa đón sân bay giúp mình không ạ?",
    "Dạ giờ nhận phòng tiêu chuẩn là từ 14 giờ chiều. Nếu đến sớm, quý khách có thể gửi hành lý tại quầy lễ tân hoàn toàn miễn phí ạ.",
    "Dạ sảnh thang máy chính nằm ngay phía sau quầy lễ tân bên tay phải của quý khách ạ.",
    "Dạ nhà vệ sinh sảnh tầng trệt nằm ở cuối hành lang bên tay trái, cạnh quầy Lounge ạ.",

    # 4. FSM Slots
    "Dạ em sẽ hỗ trợ dọn phòng và tiện ích buồng phòng cho quý khách ngay ạ! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?",
    "Dạ em sẽ hỗ trợ đồ ăn và thức uống cho quý khách ngay ạ! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?",
    "Dạ em sẽ hỗ trợ hỗ trợ hành lý cho quý khách ngay ạ! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?",
    "Dạ em sẽ hỗ trợ kỹ thuật bảo trì cho quý khách ngay ạ! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?",

    # 5. Thông báo hệ thống
    "Xin lỗi quý khách, không thể kết nối tới AI Server.",
]

async def warm_cache():
    print(f"Bắt đầu Pre-warm Audio Cache cho {len(COMMON_PHRASES)} câu thoại thông dụng...")
    for i, phrase in enumerate(COMMON_PHRASES, 1):
        t0 = time.perf_counter()
        b64, _, prov = await tts_service.synthesize(phrase, provider='edge')
        t1 = time.perf_counter()
        dur = (t1 - t0) * 1000
        print(f"[{i}/{len(COMMON_PHRASES)}] '{phrase[:30]}...' -> {dur:.2f} ms ({prov})")
    
    print("\n--- TEST TRUY XUẤT LẦN 2 TỪ CACHE (0ms) ---")
    test_phrase = COMMON_PHRASES[7]  # Pass wifi
    t0 = time.perf_counter()
    b64, _, prov = await tts_service.synthesize(test_phrase, provider='edge')
    t1 = time.perf_counter()
    print(f"Cache Hit (Pass Wifi): {(t1 - t0)*1000:.2f} ms ({prov})")

if __name__ == '__main__':
    asyncio.run(warm_cache())
