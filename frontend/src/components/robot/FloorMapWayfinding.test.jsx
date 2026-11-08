import { describe, it, expect } from 'vitest';

import { HOTEL_DESTINATIONS, HOTEL_FLOORS, getMobileGuestMapUrl } from './FloorMap';



describe('FloorMap Wayfinding Logic & Contract Tests', () => {

  it('does not contain any emoji characters in destination names or step instructions', () => {

    const destinations = Object.values(HOTEL_DESTINATIONS);

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;



    destinations.forEach((dest) => {

      expect(emojiRegex.test(dest.name)).toBe(false);

      expect(emojiRegex.test(dest.icon || '')).toBe(false);

      expect(emojiRegex.test(dest.step1Text)).toBe(false);

      expect(emojiRegex.test(dest.step2Text)).toBe(false);

      expect(emojiRegex.test(dest.floorLevel)).toBe(false);

    });

  });



  it('verifies all hotel floors have clean naming without emojis', () => {

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    HOTEL_FLOORS.forEach((floor) => {

      expect(emojiRegex.test(floor.name)).toBe(false);

      expect(emojiRegex.test(floor.level)).toBe(false);

    });

  });



  it('generates a valid, mobile-optimized standalone QR map URL for guest handoff with redundant dest fallback', async () => {

    const url = getMobileGuestMapUrl('infinity_pool');

    expect(url).toBeDefined();

    expect(url).toContain('map.html?t=');
    expect(url).toContain('&dest=infinity_pool');

    const { parseGuestMapParams } = await import('../../pages/guest/GuestMapPage');
    const queryStr = url.split('?')[1] || '';
    const parsed = parseGuestMapParams(`?${queryStr}`);
    expect(parsed.destKey).toBe('infinity_pool');
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());
    expect(parsed.ticketId.length).toBeGreaterThan(0);

    // Alternative flow 1: Corrupted token falls back to &dest=
    const fallbackParsed = parseGuestMapParams('?t=corrupted_base64_&&dest=gym');
    expect(fallbackParsed.destKey).toBe('gym');

    // Alternative flow 2: Alias destination keys normalize properly
    expect(parseGuestMapParams('?dest=luxury_spa').destKey).toBe('spa');
    expect(parseGuestMapParams('?dest=sky_bar').destKey).toBe('bar');
    expect(parseGuestMapParams('?dest=pool').destKey).toBe('infinity_pool');

  });



  it('ensures each destination has complete multi-step routing attributes', () => {

    Object.values(HOTEL_DESTINATIONS).forEach((dest) => {

      expect(dest.id).toBeDefined();

      expect(dest.name).toBeDefined();

      expect(dest.floorLevel).toBeDefined();

      expect(dest.coords).toBeDefined();

      expect(dest.coords.x).toBeGreaterThan(0);

      expect(dest.coords.y).toBeGreaterThan(0);

      expect(dest.time).toBeDefined();

      expect(dest.distance).toBeDefined();



      if (dest.isDifferentFloor) {

        expect(dest.step1Text).toContain('Thang máy');

        expect(dest.routeTarget).toBeDefined();

      }

    });

  });



  it('ensures FloorMap source code does not contain bounce animation or zoom buttons', async () => {

    const fs = await import('fs');

    const path = await import('path');

    const code = fs.readFileSync(path.resolve('src/components/robot/FloorMap.jsx'), 'utf8');



    // Không còn animation giật nảy

    expect(code).not.toContain('animate-bounce');



    // Không còn nút phóng to thu nhỏ zoom

    expect(code).not.toContain('handleZoomIn');

    expect(code).not.toContain('handleZoomOut');

    expect(code).not.toContain('handleResetZoom');

  });



  it('provides a complete key facilities list for quick switching without emojis', async () => {

    const { HOTEL_KEY_FACILITIES } = await import('./FloorMap');

    expect(Array.isArray(HOTEL_KEY_FACILITIES)).toBe(true);

    expect(HOTEL_KEY_FACILITIES.length).toBeGreaterThanOrEqual(7);



    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    HOTEL_KEY_FACILITIES.forEach((fac) => {

      expect(fac.key).toBeDefined();

      expect(fac.name).toBeDefined();

      expect(fac.floor).toBeDefined();

      expect(emojiRegex.test(fac.name)).toBe(false);

      expect(emojiRegex.test(fac.floor)).toBe(false);

      expect(HOTEL_DESTINATIONS[fac.key]).toBeDefined();

    });

  });



  it('correctly detects destination POI fast-path for instant RT-05 map activation', async () => {

    const { detectDestinationPoi } = await import('./FloorMap');



    // Các câu hỏi điều hướng thông dụng

    expect(detectDestinationPoi('Nhà hàng ở đâu vậy robot')).toBe('restaurant');

    expect(detectDestinationPoi('Chỉ đường ra hồ bơi')).toBe('infinity_pool');

    expect(detectDestinationPoi('Phòng 401 ở đâu')).toBe('room_401');

    expect(detectDestinationPoi('Cho tôi hỏi phòng 305 đi lối nào')).toBe('room_305');

    expect(detectDestinationPoi('Nhà vệ sinh ở đâu')).toBe('restroom_ground');

    expect(detectDestinationPoi('Đi toilet tầng 2')).toBe('restroom_f2');

    expect(detectDestinationPoi('Chỉ tôi đường ra bãi đỗ xe ô tô')).toBe('parking_car');

    expect(detectDestinationPoi('Phòng tập gym ở đâu')).toBe('gym');

    expect(detectDestinationPoi('Đi spa massage')).toBe('spa');

    expect(detectDestinationPoi('Hãy giới thiệu cho tôi về hồ bơi')).toBe('infinity_pool');

    expect(detectDestinationPoi('Chỉ đường lên Rooftop Coffee')).toBe('rooftop_coffee');
    expect(detectDestinationPoi('Quầy bar ở đâu')).toBe('bar');
    expect(detectDestinationPoi('Phòng karaoke ở tầng mấy')).toBe('karaoke');
    expect(detectDestinationPoi('Cửa hàng lưu niệm ở đâu')).toBe('gift_shop');
    expect(detectDestinationPoi('Bãi giữ xe máy ở đâu')).toBe('parking_bike');



    // Không kích hoạt với địa điểm bên ngoài khách sạn

    expect(detectDestinationPoi('Sân bay Nội Bài ở đâu')).toBeNull();

    expect(detectDestinationPoi('Chợ Bến Thành đi đường nào')).toBeNull();



    // Không kích hoạt với câu hỏi chào hỏi thông thường

    expect(detectDestinationPoi('Xin chào robot')).toBeNull();

    expect(detectDestinationPoi('Thời tiết hôm nay thế nào')).toBeNull();



    // Không kích hoạt với câu hỏi tổng quan dịch vụ / tiện ích của khách sạn

    expect(detectDestinationPoi('Hãy giới thiệu các dịch vụ về khách sạn')).toBeNull();

    expect(detectDestinationPoi('Giới thiệu dịch vụ khách sạn')).toBeNull();

    expect(detectDestinationPoi('Khách sạn có những tiện ích gì')).toBeNull();

    expect(detectDestinationPoi('Các dịch vụ của khách sạn')).toBeNull();



    // Câu hỏi chỉ đường về phòng chung chung (không có số phòng) -> KHÔNG hardcode phòng mặc định, trả về null để robot hỏi lại số phòng

    expect(detectDestinationPoi('Chỉ đường đến phòng')).toBeNull();

    expect(detectDestinationPoi('Đường về phòng')).toBeNull();

    expect(detectDestinationPoi('Chỉ đường lên phòng')).toBeNull();

    expect(detectDestinationPoi('Tìm phòng')).toBeNull();

    expect(detectDestinationPoi('Phòng ở đâu')).toBeNull();



    // Không kích hoạt bản đồ nhà vệ sinh khi hỏi về băng vệ sinh, dọn dẹp hoặc đồ dùng cá nhân
    expect(detectDestinationPoi('Mua băng vệ sinh ở đâu')).toBeNull();
    expect(detectDestinationPoi('Khách sạn có bán băng vệ sinh không')).toBeNull();
    expect(detectDestinationPoi('Cần băng vệ sinh khẩn cấp')).toBeNull();
    expect(detectDestinationPoi('Đồ vệ sinh cá nhân lấy ở đâu')).toBeNull();
    expect(detectDestinationPoi('Dọn vệ sinh phòng giúp tôi')).toBeNull();

    // Khi khách đã có số phòng trong phiên tương tác

    expect(detectDestinationPoi('Chỉ đường đến phòng', '405')).toBe('room_405');

    expect(detectDestinationPoi('Đường về phòng', '302')).toBe('room_302');



    // Khách hỏi số phòng cụ thể hoặc trả lời số phòng

    expect(detectDestinationPoi('Chỉ đường đến phòng 401')).toBe('room_401');

    expect(detectDestinationPoi('401')).toBe('room_401');

    expect(detectDestinationPoi('Chỉ đường đến phòng 301')).toBe('room_301');

    expect(detectDestinationPoi('301')).toBe('room_301');

    expect(detectDestinationPoi('Phòng 402 ở đâu')).toBe('room_402');

    expect(detectDestinationPoi('402')).toBe('room_402');

  });

  it('computes smart camera auto-focus and distortion-free orthogonal heading-up rotation for QR mobile wayfinding', async () => {
    const { computeSmartRouteFrame, computeOrthogonalHeadingAngle } = await import('../../pages/guest/GuestMapPage');

    const pathStr = 'M 350 580 L 1165 580 L 1165 410 L 1465 410';
    const startPt = { x: 350, y: 580 };
    const endPt = { x: 1465, y: 410 };

    const focus25d = computeSmartRouteFrame(pathStr, startPt, endPt, 'focus25d');
    expect(focus25d.tiltX).toBe(20);
    expect(focus25d.rotZ).toBe(0);
    expect(focus25d.midX).toBeGreaterThan(800);
    expect(focus25d.baseW).toBeGreaterThanOrEqual(1050);

    const headingLeg1 = computeSmartRouteFrame(pathStr, startPt, endPt, 'heading');
    expect(headingLeg1.rotZ).toBe(-90);
    expect(Math.abs(headingLeg1.rotZ) % 90).toBe(0);

    // Chặng 2 (Từ Thang máy A 1715,560 đi tới Phòng VIP Karaoke 1450,880 hoặc Phòng 301 1656,220)
    // luôn phải xoay chuẩn +90 độ (Thang máy ở dưới đáy nhìn thẳng lên trên)
    const karaokeLeg2 = computeSmartRouteFrame(
      'M 1715 560 L 1490 560 L 1450 600 L 1450 880',
      { x: 1715, y: 560 },
      { x: 1450, y: 880 },
      'heading'
    );
    expect(karaokeLeg2.rotZ).toBe(90);
    expect(computeOrthogonalHeadingAngle({ x: 1715, y: 560 })).toBe(90);
    expect(computeOrthogonalHeadingAngle({ x: 350, y: 580 })).toBe(-90);

    const flat2d = computeSmartRouteFrame(pathStr, startPt, endPt, 'flat2d');
    expect(flat2d.tiltX).toBe(0);
    expect(flat2d.rotZ).toBe(0);
  });

});



