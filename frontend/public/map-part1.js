    // Xóa cache Service Worker cũ trên điện thoại để tránh bị kẹt redirect về trang chủ
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(regs) {
          regs.forEach(function(r) { r.update(); });
        }).catch(function() {});
      }
      if (window.caches) {
        window.caches.keys().then(function(keys) {
          keys.forEach(function(k) {
            if (k !== 'hc-robot-app-cache-v3') window.caches.delete(k);
          });
        }).catch(function() {});
      }
    } catch (e) {}

    // === DỮ LIỆU BẢN ĐỒ & ĐIỂM ĐẾN (Chuẩn hệ tọa độ thống nhất 1840x1174) ===
    const FLOOR_IMAGES = {
      '1': '/maps/floor_b2.png',
      '2': '/maps/floor_b1.png',
      '3': '/maps/floor_1.png',
      '4': '/maps/floor_2.png',
      '5': '/maps/floor_3.png',
      '6': '/maps/floor_4.png',
      '7': '/maps/floor_5.png',
      '8': '/maps/floor_6.png',
    };

    // Chặng 1 chuẩn từ vị trí Robot (x=350, y=580) đến Thang máy A (x=1715, y=560)
    const ROUTE_GROUND_TO_ELEVATOR = 'M 350 580 L 350 860 Q 350 880, 370 880 L 1330 880 Q 1350 880, 1362 864 L 1568 576 Q 1580 560, 1600 560 L 1715 560';

    const DESTINATIONS = {
      // === TẦNG 5: HỒ BƠI, SPA & GYM ===
      infinity_pool: {
        name: 'Hồ Bơi Vô Cực (Infinity Pool)',
        shortLabel: 'HỒ BƠI VÔ CỰC',
        floorId: '7',
        floorLevel: 'TẦNG 5',
        isDiff: true,
        step1: 'Chặng 1: Đi từ sảnh Lobby đến Thang máy A và bấm lên Tầng 5.',
        step2: 'Chặng 2: Ra khỏi thang máy, rẽ trái đi hết hành lang qua cửa kính là đến Hồ bơi vô cực.',
        coords: { x: 380, y: 230 },
        route: 'M 1715 560 L 1005 560 Q 940 560, 900 620 L 870 700 Q 855 745, 820 745 L 680 745 Q 600 745, 600 680 L 600 360 Q 600 270, 520 250 L 380 230'
      },
      gym: {
        name: 'Fitness & Gym Center',
        shortLabel: 'PHÒNG GYM',
        floorId: '7',
        floorLevel: 'TẦNG 5',
        isDiff: true,
        step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 5.',
        step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng xuống phía dưới để vào Phòng Gym.',
        coords: { x: 1450, y: 880 },
        route: 'M 1715 560 L 1490 560 Q 1450 560, 1450 600 L 1450 715 L 1450 880'
      },
      spa: {
        name: 'Thảo Mộc Spa & Massage',
        shortLabel: 'THẢO MỘC SPA',
        floorId: '7',
        floorLevel: 'TẦNG 5',
        isDiff: true,
        step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 5.',
        step2: 'Chặng 2: Ra khỏi thang máy, rẽ trái 15m vào cửa phòng Spa.',
        coords: { x: 1080, y: 230 },
        route: 'M 1715 560 L 1120 560 Q 1080 560, 1080 520 L 1080 458 L 1080 230'
      },

      // === TẦNG 2: BẾP & NHÀ HÀNG ===
      restaurant: {
        name: 'Nhà Hàng & Quầy Nhận Món',
        shortLabel: 'NHÀ HÀNG',
        floorId: '4',
        floorLevel: 'TẦNG 2',
        isDiff: true,
        step1: 'Chặng 1: Đi từ sảnh tiếp tân ra Thang máy A và bấm lên Tầng 2.',
        step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng theo hành lang vào Quầy Nhận Món & Nhà hàng.',
        coords: { x: 1080, y: 230 },
        route: 'M 1715 560 L 1080 560 Q 1080 530, 1080 480 L 1080 230'
      },
      kitchen: {
        name: 'Khu Bếp Chính (Kitchen Area)',
        shortLabel: 'KHU BẾP CHÍNH',
        floorId: '4',
        floorLevel: 'TẦNG 2',
        isDiff: true,
        step1: 'Chặng 1: Đi từ sảnh tiếp tân ra Thang máy A và bấm lên Tầng 2.',
        step2: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang bên phải rẽ vào cửa Khu Bếp Chính.',
        coords: { x: 1450, y: 880 },
        route: 'M 1715 560 L 1450 560 Q 1450 630, 1450 720 L 1450 880'
      },
      warehouse: {
        name: 'Kho Thực Phẩm & Nguyên Liệu',
        shortLabel: 'KHO THỰC PHẨM',
        floorId: '4',
        floorLevel: 'TẦNG 2',
        isDiff: true,
        step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 2.',
        step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng theo hành lang vào Kho thực phẩm bên tay phải.',
        coords: { x: 1560, y: 190 },
        route: 'M 1715 560 L 1560 560 Q 1560 500, 1560 400 L 1560 190'
      },
      preparation_area: {
        name: 'Khu Sơ Chế & Chuẩn Bị',
        shortLabel: 'KHU SƠ CHẾ',
        floorId: '4',
        floorLevel: 'TẦNG 2',
        isDiff: true,
        step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 2.',
        step2: 'Chặng 2: Ra khỏi thang máy, đi hết hành lang sang phía bên trái để vào Khu Sơ Chế.',
        coords: { x: 380, y: 750 },
        route: 'M 1715 560 L 600 560 Q 500 560, 450 650 L 380 750'
      },
      restroom_f2: {
        name: 'Nhà Vệ Sinh Tầng 2',
        shortLabel: 'WC TẦNG 2',
        floorId: '4',
        floorLevel: 'TẦNG 2',
        isDiff: true,
        step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 2.',
        step2: 'Chặng 2: Ra khỏi thang máy, đi hết hành lang về góc trái phía trên là Nhà Vệ Sinh Tầng 2.',
        coords: { x: 380, y: 230 },
        route: 'M 1715 560 L 600 560 Q 500 560, 450 400 L 380 230'
      },

      // === TẦNG 3: PHÒNG NGHỈ 301 - 310 ===
      room_301: { name: 'Phòng Nghỉ 301', shortLabel: 'PHÒNG 301', floorId: '5', floorLevel: 'TẦNG 3', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 3.', step2: 'Chặng 2: Ra khỏi thang máy, rẽ vào hành lang và bước vào Phòng 301 ngay cạnh thang máy.', coords: { x: 1656, y: 220 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 540 L 1656 220' },
      room_302: { name: 'Phòng Nghỉ 302', shortLabel: 'PHÒNG 302', floorId: '5', floorLevel: 'TẦNG 3', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 3.', step2: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang rẽ vào Phòng 302 dãy bên phải.', coords: { x: 1288, y: 220 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 540 L 1656 240 Q 1656 220, 1636 220 L 1288 220' },
      room_303: { name: 'Phòng Nghỉ 303', shortLabel: 'PHÒNG 303', floorId: '5', floorLevel: 'TẦNG 3', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 3.', step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng theo hành lang tới Phòng 303 bên tay phải.', coords: { x: 920, y: 220 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 540 L 1656 240 Q 1656 220, 1636 220 L 920 220' },
      room_304: { name: 'Phòng Nghỉ 304', shortLabel: 'PHÒNG 304', floorId: '5', floorLevel: 'TẦNG 3', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 3.', step2: 'Chặng 2: Ra khỏi thang máy, đi hết hành lang tới Phòng 304 góc bên phải cuối dãy.', coords: { x: 552, y: 220 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 540 L 1656 240 Q 1656 220, 1636 220 L 552 220' },
      room_305: { name: 'Phòng Nghỉ 305', shortLabel: 'PHÒNG 305', floorId: '5', floorLevel: 'TẦNG 3', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 3.', step2: 'Chặng 2: Ra khỏi thang máy, đi hết hành lang sang góc trái dãy dưới là Phòng 305.', coords: { x: 184, y: 220 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 540 L 1656 240 Q 1656 220, 1636 220 L 184 220' },
      room_306: { name: 'Phòng Nghỉ 306', shortLabel: 'PHÒNG 306', floorId: '5', floorLevel: 'TẦNG 3', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 3.', step2: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang rẽ vào Phòng 306.', coords: { x: 184, y: 920 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 580 L 1656 900 Q 1656 920, 1636 920 L 184 920' },
      room_307: { name: 'Phòng Nghỉ 307', shortLabel: 'PHÒNG 307', floorId: '5', floorLevel: 'TẦNG 3', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 3.', step2: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang rẽ vào Phòng 307 dãy đối diện.', coords: { x: 552, y: 920 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 580 L 1656 900 Q 1656 920, 1636 920 L 552 920' },
      room_308: { name: 'Phòng Nghỉ 308', shortLabel: 'PHÒNG 308', floorId: '5', floorLevel: 'TẦNG 3', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 3.', step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng xuống dãy phòng đối diện để vào Phòng 308.', coords: { x: 920, y: 920 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 580 L 1656 900 Q 1656 920, 1636 920 L 920 920' },
      room_309: { name: 'Phòng Nghỉ 309', shortLabel: 'PHÒNG 309', floorId: '5', floorLevel: 'TẦNG 3', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 3.', step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng xuống góc phải dãy phòng đối diện là Phòng 309.', coords: { x: 1288, y: 920 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 580 L 1656 900 Q 1656 920, 1636 920 L 1288 920' },
      room_310: { name: 'Phòng Nghỉ 310', shortLabel: 'PHÒNG 310', floorId: '5', floorLevel: 'TẦNG 3', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 3.', step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng tới cuối dãy đối diện là Phòng 310.', coords: { x: 1656, y: 920 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 580 L 1656 920' },

      // === TẦNG 4: PHÒNG NGHỈ 401 - 410 ===
      room_401: { name: 'Phòng Nghỉ 401', shortLabel: 'PHÒNG 401', floorId: '6', floorLevel: 'TẦNG 4', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 4.', step2: 'Chặng 2: Ra khỏi thang máy, rẽ vào hành lang và bước vào Phòng 401 ngay cạnh thang máy.', coords: { x: 1656, y: 220 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 540 L 1656 220' },
      room_402: { name: 'Phòng Nghỉ 402', shortLabel: 'PHÒNG 402', floorId: '6', floorLevel: 'TẦNG 4', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 4.', step2: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang rẽ vào Phòng 402 dãy bên phải.', coords: { x: 1288, y: 220 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 540 L 1656 240 Q 1656 220, 1636 220 L 1288 220' },
      room_403: { name: 'Phòng Nghỉ 403', shortLabel: 'PHÒNG 403', floorId: '6', floorLevel: 'TẦNG 4', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 4.', step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng theo hành lang tới Phòng 403 bên tay phải.', coords: { x: 920, y: 220 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 540 L 1656 240 Q 1656 220, 1636 220 L 920 220' },
      room_404: { name: 'Phòng Nghỉ 404', shortLabel: 'PHÒNG 404', floorId: '6', floorLevel: 'TẦNG 4', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 4.', step2: 'Chặng 2: Ra khỏi thang máy, đi hết hành lang tới Phòng 404 góc bên phải cuối dãy.', coords: { x: 552, y: 220 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 540 L 1656 240 Q 1656 220, 1636 220 L 552 220' },
      room_405: { name: 'Phòng Nghỉ 405', shortLabel: 'PHÒNG 405', floorId: '6', floorLevel: 'TẦNG 4', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 4.', step2: 'Chặng 2: Ra khỏi thang máy, đi hết hành lang sang góc trái dãy dưới là Phòng 405.', coords: { x: 184, y: 220 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 540 L 1656 240 Q 1656 220, 1636 220 L 184 220' },
      room_406: { name: 'Phòng Nghỉ 406', shortLabel: 'PHÒNG 406', floorId: '6', floorLevel: 'TẦNG 4', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 4.', step2: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang rẽ vào Phòng 406.', coords: { x: 184, y: 920 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 580 L 1656 900 Q 1656 920, 1636 920 L 184 920' },
      room_407: { name: 'Phòng Nghỉ 407', shortLabel: 'PHÒNG 407', floorId: '6', floorLevel: 'TẦNG 4', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 4.', step2: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang rẽ vào Phòng 407 dãy đối diện.', coords: { x: 552, y: 920 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 580 L 1656 900 Q 1656 920, 1636 920 L 552 920' },
      room_408: { name: 'Phòng Nghỉ 408', shortLabel: 'PHÒNG 408', floorId: '6', floorLevel: 'TẦNG 4', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 4.', step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng xuống dãy phòng đối diện để vào Phòng 408.', coords: { x: 920, y: 920 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 580 L 1656 900 Q 1656 920, 1636 920 L 920 920' },
      room_409: { name: 'Phòng Nghỉ 409', shortLabel: 'PHÒNG 409', floorId: '6', floorLevel: 'TẦNG 4', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 4.', step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng xuống góc phải dãy phòng đối diện là Phòng 409.', coords: { x: 1288, y: 920 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 580 L 1656 900 Q 1656 920, 1636 920 L 1288 920' },
      room_410: { name: 'Phòng Nghỉ 410', shortLabel: 'PHÒNG 410', floorId: '6', floorLevel: 'TẦNG 4', isDiff: true, step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 4.', step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng tới cuối dãy đối diện là Phòng 410.', coords: { x: 1656, y: 920 }, route: 'M 1715 560 L 1676 560 Q 1656 560, 1656 580 L 1656 920' },

      // === TẦNG 6: ROOFTOP & BAR ===
      rooftop_coffee: {
        name: 'Rooftop Coffee & Lounge',
        shortLabel: 'ROOFTOP COFFEE',
        floorId: '8',
        floorLevel: 'TẦNG 6',
        isDiff: true,
        step1: 'Chặng 1: Di chuyển tới Thang máy A và bấm lên Tầng 6 (Cao nhất).',
        step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng theo hành lang qua cửa trung tâm vào khu vực Rooftop Coffee.',
        coords: { x: 380, y: 230 },
        route: 'M 1715 560 L 1005 560 Q 940 560, 900 620 L 870 700 Q 855 745, 820 745 L 680 745 Q 600 745, 600 680 L 600 360 Q 600 270, 520 250 L 380 230'
      },
      bar: {
        name: 'Sky Lounge Bar',
        shortLabel: 'SKY LOUNGE BAR',
        floorId: '8',
        floorLevel: 'TẦNG 6',
        isDiff: true,
        step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 6.',
        step2: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang rẽ vào Quầy Bar ở giữa.',
        coords: { x: 1080, y: 230 },
        route: 'M 1715 560 L 1120 560 Q 1080 560, 1080 520 L 1080 458 L 1080 230'
      },
      karaoke: {
        name: 'Phòng VIP Karaoke',
        shortLabel: 'VIP KARAOKE',
        floorId: '8',
        floorLevel: 'TẦNG 6',
        isDiff: true,
        step1: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 6.',
        step2: 'Chặng 2: Ra khỏi thang máy, rẽ trái theo hành lang vào Phòng VIP Karaoke.',
        coords: { x: 1450, y: 880 },
        route: 'M 1715 560 L 1490 560 Q 1450 560, 1450 600 L 1450 715 L 1450 880'
      },
      gift_shop: {
        name: 'Cửa Hàng Lưu Niệm (Gift Shop)',
        shortLabel: 'GIFT SHOP',
        floorId: '8',
        floorLevel: 'TẦNG 6',
        isDiff: true,
        step1: 'Chặng 1: Di chuyển tới Thang máy A và bấm lên Tầng 6.',
        step2: 'Chặng 2: Ra khỏi thang máy, đi qua cửa trung tâm và rẽ vào Cửa Hàng Lưu Niệm bên trái.',
        coords: { x: 200, y: 750 },
        route: 'M 1715 560 L 1005 560 Q 940 560, 900 620 L 870 700 Q 855 745, 820 745 L 430 745 Q 375 745, 375 670 L 200 750'
      },

      // === TẦNG TRỆT & HẦM ===
      front_desk: {
        name: 'Quầy Lễ Tân (Front Desk)',
        shortLabel: 'QUẦY LỄ TÂN',
        floorId: '3',
        floorLevel: 'GROUND',
        isDiff: false,
        step1: 'Từ sảnh chính, rẽ phải vào quầy Lễ tân ở khu vực trung tâm sảnh.',
        step2: '',
        coords: { x: 880, y: 570 },
        route: 'M 350 580 L 350 860 Q 350 880, 370 880 L 780 880 Q 800 880, 805 861 L 880 570'
      },
      restroom_ground: {
        name: 'Nhà Vệ Sinh Tầng Trệt',
        shortLabel: 'WC SẢNH TRỆT',
        floorId: '3',
        floorLevel: 'GROUND',
        isDiff: false,
        step1: 'Từ sảnh chính, đi về phía tay phải sau quầy lễ tân để vào Nhà Vệ Sinh.',
        step2: '',
        coords: { x: 1600, y: 1000 },
        route: 'M 350 580 L 350 860 Q 350 880, 370 882 L 1600 1000'
      },
      parking_car: {
        name: 'Bãi Đỗ Xe Ô Tô (Hầm B2)',
        shortLabel: 'BÃI Ô TÔ B2',
        floorId: '1',
        floorLevel: 'HẦM B2',
        isDiff: true,
        step1: 'Chặng 1: Di chuyển tới Thang máy A và bấm xuống Hầm B2.',
        step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng theo hành lang tới khu vực đỗ xe ô tô Hầm B2.',
        coords: { x: 880, y: 850 },
        route: 'M 1715 560 L 880 850'
      },
      parking_bike: {
        name: 'Bãi Giữ Xe Máy (Hầm B1)',
        shortLabel: 'BÃI XE MÁY B1',
        floorId: '2',
        floorLevel: 'HẦM B1',
        isDiff: true,
        step1: 'Chặng 1: Di chuyển tới Thang máy A và bấm xuống Hầm B1.',
        step2: 'Chặng 2: Ra khỏi thang máy, đi thẳng theo làn di chuyển vào Bãi đỗ xe máy Hầm B1.',
        coords: { x: 920, y: 500 },
        route: 'M 1715 560 L 920 500'
      }
    };

    const DEST_ALIASES = {
      luxury_spa: 'spa',
      sky_bar: 'bar',
      pool: 'infinity_pool',
      wc: 'restroom_ground',
      toilet: 'restroom_ground',
      lobby: 'front_desk',
      reception: 'front_desk'
    };

    function resolveDestKey(raw) {
      if (!raw || typeof raw !== 'string') return 'infinity_pool';
      const k = raw.trim();
      const mapped = DEST_ALIASES[k] || k;
      return DESTINATIONS[mapped] ? mapped : 'infinity_pool';
    }

    // Parse Token hoặc Query
    let currentDestKey = 'infinity_pool';
    let expiresAt = Date.now() + 15 * 60 * 1000;
    let ticketId = '';

    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('t') || urlParams.get('token');
    const fallbackDestParam = urlParams.get('dest');

    if (tokenParam) {
      try {
        let b64 = tokenParam.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const parsed = JSON.parse(atob(b64));
        if (parsed.d) currentDestKey = resolveDestKey(parsed.d);
        if (parsed.e) expiresAt = Number(parsed.e);
        if (parsed.n) ticketId = parsed.n;
      } catch (e) {
        if (fallbackDestParam) currentDestKey = resolveDestKey(fallbackDestParam);
      }
    } else if (fallbackDestParam) {
      currentDestKey = resolveDestKey(fallbackDestParam);
    }

    const dest = DESTINATIONS[currentDestKey] || DESTINATIONS.infinity_pool;
    let activeStep = dest.isDiff ? 1 : 2;

    // Preload sẵn ảnh tầng để khi chuyển Chặng 1 <-> Chặng 2 không bị khựng load ảnh
    try {
      const preload1 = new Image();
      preload1.src = FLOOR_IMAGES['3'];
      if (dest.floorId && FLOOR_IMAGES[dest.floorId]) {
        const preload2 = new Image();
        preload2.src = FLOOR_IMAGES[dest.floorId];
      }
    } catch (e) {}

    // Trạng thái Camera chuẩn Google Maps:
    // - isHeadingUp = true (Mặc định):
    //   + Chặng 1: Xoay -90° để từ Sảnh (ở dưới đáy) nhìn thẳng LÊN Thang máy A (ở trên)
    //   + Chặng 2: Xoay +90° để từ Thang máy A (ở dưới đáy) nhìn thẳng LÊN các phòng đích (ở trên)
    let isHeadingUp = true;
    let is3D = false;
    let currentZoom = 1.25;
    let panX = 0;
    let panY = 0;
    let currentRotZ = -90;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startPanX = 0;
    let startPanY = 0;
    let rafId = 0;

    // Chặng 1 (xuất phát từ Sảnh x=350) -> xoay -90° (Sảnh ở đáy nhìn lên Thang máy)
    // Chặng 2 (xuất phát từ Thang máy x=1715) -> xoay +90° (Thang máy ở đáy nhìn thẳng lên hành lang & phòng đích)
    function computeOrthogonalHeadingAngle(startPt) {
      return startPt.x >= 920 ? 90 : -90;
    }

    // Chuyển đổi tọa độ (x, y) trên bản đồ gốc (1840x1174) sang tọa độ sau khi xoay trong SVG
    function projectPointToSvgScreen(x, y, rotZ) {
      if (rotZ === -90) {
        return { sx: y, sy: 1840 - x };
      }
      if (rotZ === 90) {
        return { sx: 1174 - y, sy: x };
      }
      return { sx: x, sy: y };
    }

    // Tính toán độ phóng đại & dịch tâm trên GPU để lộ trình luôn nằm ngay chính giữa màn hình
    function computeSmartRouteFrame(pathStr, startPt, endPt, headingUp) {
      const rotZ = headingUp ? computeOrthogonalHeadingAngle(startPt) : 0;
      const svgW = rotZ === 0 ? 1840 : 1174;
      const svgH = rotZ === 0 ? 1174 : 1840;

      const nums = (pathStr.match(/-?\d+(\.\d+)?/g) || []).map(Number);
      const sStart = projectPointToSvgScreen(startPt.x, startPt.y, rotZ);
      const sEnd = projectPointToSvgScreen(endPt.x, endPt.y, rotZ);

      let minSX = Math.min(sStart.sx, sEnd.sx);
      let maxSX = Math.max(sStart.sx, sEnd.sx);
      let minSY = Math.min(sStart.sy, sEnd.sy);
      let maxSY = Math.max(sStart.sy, sEnd.sy);

      for (let i = 0; i < nums.length - 1; i += 2) {
        const pt = projectPointToSvgScreen(nums[i], nums[i + 1], rotZ);
        if (pt.sx < minSX) minSX = pt.sx;
        if (pt.sx > maxSX) maxSX = pt.sx;
        if (pt.sy < minSY) minSY = pt.sy;
        if (pt.sy > maxSY) maxSY = pt.sy;
      }

      const midSX = (minSX + maxSX) / 2;
      const midSY = (minSY + maxSY) / 2;
      const spanSW = Math.max(340, maxSX - minSX);
      const spanSH = Math.max(380, maxSY - minSY);

      const container = document.getElementById('mapContainer');
      const cw = container ? container.clientWidth : 390;
      const ch = container ? container.clientHeight : 760;

      // Tỷ lệ quy đổi 1 đơn vị SVG sang pixel màn hình thực tế (preserveAspectRatio="xMidYMid meet")
      const svgScale = Math.min(cw / svgW, ch / svgH);

      // Tính độ zoom vừa khít vùng lộ trình vào khoảng trống giữa thanh trên và thanh dưới
      const fitW = (cw * 0.82) / ((spanSW + 340) * svgScale);
      const fitH = (ch * 0.62) / ((spanSH + 420) * svgScale);
      const zoom = Number(Math.min(1.65, Math.max(1.06, Math.min(fitW, fitH))).toFixed(2));

      // Dịch tâm lộ trình (midSX, midSY) về chính giữa màn hình
      const offsetX = (svgW / 2 - midSX) * svgScale * zoom;
      const offsetY = (svgH / 2 - midSY) * svgScale * zoom;

      return {
        rotZ,
        svgW,
        svgH,
        zoom,
        panX: Math.round(offsetX),
        panY: Math.round(offsetY)
      };
    }
