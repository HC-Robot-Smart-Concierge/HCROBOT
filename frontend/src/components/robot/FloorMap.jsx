import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  Navigation,
  Sparkles,
  Layers,
  ChevronRight,
  Maximize2,
  Volume2,
  Clock,
  Footprints,
  ArrowUpRight,
  RefreshCw,
  Eye,
  CheckCircle2,
  ArrowUp,
  MapPin,
  Plus,
  Minus,
  RotateCcw,
  X,
  ChevronUp,
  ChevronDown,
  QrCode,
  Smartphone,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Danh sách cấu hình 8 Tầng trong khách sạn
export const HOTEL_FLOORS = [
  { id: '1', level: 'B2', name: 'Hầm B2 · Bãi Đỗ Xe Ô Tô', image: '/maps/1.png' },
  { id: '2', level: 'B1', name: 'Hầm B1 · Bãi Xe Máy', image: '/maps/2.png' },
  { id: '3', level: 'Ground', name: 'Tầng Trệt · Sảnh & Tiếp Tân', image: '/maps/3.png' },
  { id: '4', level: 'Tầng 2', name: 'Tầng 2 · Bếp & Nhà Hàng (Kitchen & Pickup)', image: '/maps/4.png' },
  { id: '5', level: 'Tầng 3', name: 'Tầng 3 · Phòng Nghỉ (301-306)', image: '/maps/5.png' },
  { id: '6', level: 'Tầng 4', name: 'Tầng 4 · Phòng Nghỉ (401-409)', image: '/maps/6.png' },
  { id: '7', level: 'Tầng 5', name: 'Tầng 5 · Hồ Bơi, Spa & Gym', image: '/maps/7.png' },
  { id: '8', level: 'Tầng 6', name: 'Tầng 6 · Rooftop Coffee & Bar', image: '/maps/8.png' },
];

// Danh bạ các điểm đến (POI) nổi bật
export const HOTEL_DESTINATIONS = {
  // === TẦNG 5 ===
  infinity_pool: {
    id: 'infinity_pool',
    name: 'Hồ Bơi Vô Cực (Infinity Pool)',
    floorId: '7',
    floorLevel: 'TẦNG 5',
    category: 'Thư Giãn & Bơi Lội',
    icon: '🏊',
    time: '3 Phút',
    distance: '115m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi từ sảnh Lobby đến Thang máy A và bấm lên Tầng 5.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, rẽ trái đi hết hành lang qua cửa kính là đến Hồ bơi vô cực.',
    coords: { x: 740, y: 380 },
    routeTarget: 'M 1249 410 L 1249 470 C 1249 480, 1235 480, 1220 480 L 960 480 C 930 480, 915 510, 908 560 C 900 600, 850 590, 820 560 L 820 450 C 820 420, 790 390, 740 380',
  },
  gym: {
    id: 'gym',
    name: 'Fitness & Gym Center',
    floorId: '7',
    floorLevel: 'TẦNG 5',
    category: 'Thể Thao & Sức Khỏe',
    icon: '💪',
    time: '3 Phút',
    distance: '110m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 5.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi thẳng xuống phía dưới để vào Phòng Gym.',
    coords: { x: 1140, y: 680 },
    routeTarget: 'M 1249 410 L 1249 550 C 1249 570, 1230 600, 1200 630 L 1140 680',
  },
  spa: {
    id: 'spa',
    name: 'Thảo Mộc Spa & Massage',
    floorId: '7',
    floorLevel: 'TẦNG 5',
    category: 'Chăm Sóc Sức Khỏe',
    icon: '💆',
    time: '3 Phút',
    distance: '105m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 5.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, rẽ trái 15m vào cửa phòng Spa.',
    coords: { x: 1040, y: 380 },
    routeTarget: 'M 1249 410 L 1249 470 C 1249 480, 1235 480, 1220 480 L 1080 480 C 1080 460, 1070 440, 1070 430 L 1040 380',
  },

  // === TẦNG 2: BẾP, NHÀ HÀNG & F&B (MAP 4.PNG MỚI) ===
  restaurant: {
    id: 'restaurant',
    name: 'Nhà Hàng & Quầy Nhận Món (Pickup Area)',
    floorId: '4',
    floorLevel: 'TẦNG 2',
    category: 'Ẩm Thực',
    icon: '🍽️',
    time: '2 Phút',
    distance: '80m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi từ sảnh tiếp tân ra Thang máy A và bấm lên Tầng 2.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi thẳng theo hành lang vào Quầy Nhận Món & Nhà hàng.',
    coords: { x: 965, y: 412 },
    routeTarget: 'M 1249 410 L 1249 470 C 1249 480, 1220 480, 1180 480 L 1120 480 C 1060 480, 1000 450, 965 412',
  },
  kitchen: {
    id: 'kitchen',
    name: 'Khu Bếp Chính (Kitchen)',
    floorId: '4',
    floorLevel: 'TẦNG 2',
    category: 'Khu Bếp & Chế Biến',
    icon: '👨‍🍳',
    time: '2 Phút',
    distance: '90m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi từ sảnh tiếp tân ra Thang máy A và bấm lên Tầng 2.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang bên phải rẽ vào cửa Khu Bếp Chính.',
    coords: { x: 860, y: 660 },
    routeTarget: 'M 1249 410 L 1249 536 C 1249 550, 1220 560, 1150 560 L 980 560 C 920 560, 890 600, 860 660',
  },
  preparation_area: {
    id: 'preparation_area',
    name: 'Khu Sơ Chế (Preparation Area)',
    floorId: '4',
    floorLevel: 'TẦNG 2',
    category: 'Khu Vực Bếp',
    icon: '🔪',
    time: '2.5 Phút',
    distance: '95m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 2.',
    step2Text: 'Chặng 2: Đi qua sảnh nhận món sang phòng sơ chế thực phẩm góc bên trái.',
    coords: { x: 642, y: 412 },
    routeTarget: 'M 1249 410 L 1249 470 L 1150 470 L 965 470 L 780 470 C 730 470, 680 450, 642 412',
  },
  warehouse: {
    id: 'warehouse',
    name: 'Kho Nguyên Liệu & Thực Phẩm (Warehouse)',
    floorId: '4',
    floorLevel: 'TẦNG 2',
    category: 'Kho Vận & Thực Phẩm',
    icon: '📦',
    time: '2 Phút',
    distance: '85m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 2.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi thẳng theo hành lang vào Kho thực phẩm bên tay phải.',
    coords: { x: 1315, y: 560 },
    routeTarget: 'M 1249 410 L 1249 560 L 1315 560',
  },
  restroom_f2: {
    id: 'restroom_f2',
    name: 'Nhà Vệ Sinh Tầng 2 (Restroom)',
    floorId: '4',
    floorLevel: 'TẦNG 2',
    category: 'Tiện Ích Vệ Sinh',
    icon: '🚻',
    time: '2 Phút',
    distance: '90m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 2.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi thẳng xuống cuối hành lang để vào Nhà Vệ Sinh Nam/Nữ.',
    coords: { x: 1315, y: 735 },
    routeTarget: 'M 1249 410 L 1249 735 L 1315 735',
  },

  // === TẦNG 4: PHÒNG NGHỈ 401 - 409 (MAP 6.PNG MỚI) ===
  // === TẦNG 4: PHÒNG NGHỈ 401 - 409 (MAP 6.PNG MỚI) ===
  room_401: {
    id: 'room_401',
    name: 'Phòng Nghỉ 401',
    floorId: '6',
    floorLevel: 'TẦNG 4',
    category: 'Phòng Khách',
    icon: '🛏️',
    time: '2.5 Phút',
    distance: '85m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Ra Thang máy A tại sảnh và bấm lên Tầng 4.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, rẽ vào hành lang và bước vào Phòng 401 ngay cạnh thang máy.',
    coords: { x: 1105, y: 370 },
    routeTarget: 'M 1249 410 L 1249 540 L 1105 540 L 1105 390',
  },
  room_402: {
    id: 'room_402',
    name: 'Phòng Nghỉ 402',
    floorId: '6',
    floorLevel: 'TẦNG 4',
    category: 'Phòng Khách',
    icon: '🛏️',
    time: '2.5 Phút',
    distance: '90m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Ra Thang máy A tại sảnh và bấm lên Tầng 4.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang rẽ vào Phòng 402 dãy bên phải.',
    coords: { x: 945, y: 370 },
    routeTarget: 'M 1249 410 L 1249 540 L 945 540 L 945 390',
  },
  room_403: {
    id: 'room_403',
    name: 'Phòng Nghỉ 403',
    floorId: '6',
    floorLevel: 'TẦNG 4',
    category: 'Phòng Khách',
    icon: '🛏️',
    time: '3 Phút',
    distance: '95m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Ra Thang máy A tại sảnh và bấm lên Tầng 4.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi thẳng theo hành lang tới Phòng 403 bên tay phải.',
    coords: { x: 785, y: 370 },
    routeTarget: 'M 1249 410 L 1249 540 L 785 540 L 785 390',
  },
  room_404: {
    id: 'room_404',
    name: 'Phòng Nghỉ 404',
    floorId: '6',
    floorLevel: 'TẦNG 4',
    category: 'Phòng Khách',
    icon: '🛏️',
    time: '3 Phút',
    distance: '100m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Ra Thang máy A tại sảnh và bấm lên Tầng 4.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi hết hành lang tới Phòng 404 góc bên phải cuối dãy.',
    coords: { x: 620, y: 370 },
    routeTarget: 'M 1249 410 L 1249 540 L 620 540 L 620 390',
  },
  room_405: {
    id: 'room_405',
    name: 'Phòng Nghỉ 405',
    floorId: '6',
    floorLevel: 'TẦNG 4',
    category: 'Phòng Khách',
    icon: '🛏️',
    time: '3 Phút',
    distance: '105m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Ra Thang máy A tại sảnh và bấm lên Tầng 4.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi hết hành lang sang góc trái dãy dưới là Phòng 405.',
    coords: { x: 622, y: 705 },
    routeTarget: 'M 1249 410 L 1249 540 L 622 540 L 622 690',
  },
  room_406: {
    id: 'room_406',
    name: 'Phòng Nghỉ 406',
    floorId: '6',
    floorLevel: 'TẦNG 4',
    category: 'Phòng Khách',
    icon: '🛏️',
    time: '3 Phút',
    distance: '100m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Ra Thang máy A tại sảnh và bấm lên Tầng 4.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang rẽ vào Phòng 406.',
    coords: { x: 790, y: 705 },
    routeTarget: 'M 1249 410 L 1249 540 L 790 540 L 790 690',
  },
  room_407: {
    id: 'room_407',
    name: 'Phòng Nghỉ 407',
    floorId: '6',
    floorLevel: 'TẦNG 4',
    category: 'Phòng Khách',
    icon: '🛏️',
    time: '2.5 Phút',
    distance: '95m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Ra Thang máy A tại sảnh và bấm lên Tầng 4.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang rẽ vào Phòng 407 dãy đối diện.',
    coords: { x: 960, y: 705 },
    routeTarget: 'M 1249 410 L 1249 540 L 960 540 L 960 690',
  },
  room_408: {
    id: 'room_408',
    name: 'Phòng Nghỉ 408',
    floorId: '6',
    floorLevel: 'TẦNG 4',
    category: 'Phòng Khách',
    icon: '🛏️',
    time: '2.5 Phút',
    distance: '90m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Ra Thang máy A tại sảnh và bấm lên Tầng 4.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi thẳng xuống dãy phòng đối diện để vào Phòng 408.',
    coords: { x: 1128, y: 705 },
    routeTarget: 'M 1249 410 L 1249 540 L 1128 540 L 1128 690',
  },
  room_409: {
    id: 'room_409',
    name: 'Phòng Nghỉ 409',
    floorId: '6',
    floorLevel: 'TẦNG 4',
    category: 'Phòng Khách',
    icon: '🛏️',
    time: '2.5 Phút',
    distance: '85m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Ra Thang máy A tại sảnh và bấm lên Tầng 4.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi thẳng xuống góc phải dãy phòng đối diện là Phòng 409.',
    coords: { x: 1296, y: 705 },
    routeTarget: 'M 1249 410 L 1249 540 L 1296 540 L 1296 690',
  },

  // === TẦNG 6 ===
  rooftop_coffee: {
    id: 'rooftop_coffee',
    name: 'Rooftop Coffee & View',
    floorId: '8',
    floorLevel: 'TẦNG 6',
    category: 'Cafe Sân Thượng',
    icon: '☕',
    time: '4 Phút',
    distance: '130m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Di chuyển tới Thang máy A và bấm lên Tầng 6 (Cao nhất).',
    step2Text: 'Chặng 2: Rẽ trái theo hành lang sang khu vực cafe view toàn cảnh thành phố.',
    coords: { x: 740, y: 380 },
    routeTarget: 'M 1249 410 L 1249 470 C 1249 480, 1235 480, 1220 480 L 960 480 C 930 480, 915 510, 908 560 C 900 600, 850 590, 820 560 L 820 450 C 820 420, 790 390, 740 380',
  },
  bar: {
    id: 'bar',
    name: 'Sky Lounge Bar',
    floorId: '8',
    floorLevel: 'TẦNG 6',
    category: 'Đồ Uống & Rượu Vang',
    icon: '🍸',
    time: '4 Phút',
    distance: '120m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 6.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, rẽ trái 10m là đến Quầy Bar.',
    coords: { x: 1040, y: 380 },
    routeTarget: 'M 1249 410 L 1249 470 C 1249 480, 1235 480, 1220 480 L 1080 480 C 1080 450, 1060 420, 1040 380',
  },
  karaoke: {
    id: 'karaoke',
    name: 'Phòng VIP Karaoke',
    floorId: '8',
    floorLevel: 'TẦNG 6',
    category: 'Giải Trí Âm Nhạc',
    icon: '🎤',
    time: '4 Phút',
    distance: '125m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 6.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi thẳng xuống cuối hành lang vào Phòng Karaoke.',
    coords: { x: 1140, y: 680 },
    routeTarget: 'M 1249 410 L 1249 550 C 1249 570, 1230 600, 1200 630 L 1140 680',
  },

  // === TẦNG TRỆT & HẦM ===
  front_desk: {
    id: 'front_desk',
    name: 'Quầy Lễ Tân (Front Desk)',
    floorId: '3',
    floorLevel: 'GROUND',
    category: 'Dịch Vụ Khách Hàng',
    icon: '🛎️',
    time: '1 Phút',
    distance: '15m',
    isDifferentFloor: false,
    step1Text: 'Đi thẳng qua cửa kính sảnh chính, quầy lễ tân nằm ngay bên tay phải bạn.',
    step2Text: '',
    coords: { x: 1045, y: 640 },
    routeTarget: 'M 796 545 C 850 545, 880 545, 908 545 C 940 545, 980 580, 1045 640',
  },
  parking_car: {
    id: 'parking_car',
    name: 'Bãi Đỗ Xe Ô Tô (Hầm B2)',
    floorId: '1',
    floorLevel: 'HẦM B2',
    category: 'Bãi Xe & Vận Chuyển',
    icon: '🚗',
    time: '2 Phút',
    distance: '90m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Di chuyển tới Thang máy A và bấm xuống Hầm B2.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, rẽ trái để vào khu vực đỗ xe ô tô.',
    coords: { x: 950, y: 520 },
    routeTarget: 'M 1249 410 L 1249 470 C 1249 480, 1220 480, 1150 480 L 950 520',
  },
  parking_bike: {
    id: 'parking_bike',
    name: 'Bãi Giữ Xe Máy (Hầm B1)',
    floorId: '2',
    floorLevel: 'HẦM B1',
    category: 'Bãi Xe & Vận Chuyển',
    icon: '🏍️',
    time: '2 Phút',
    distance: '85m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Di chuyển tới Thang máy A và bấm xuống Hầm B1.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, rẽ phải vào khu vực giữ xe máy an toàn.',
    coords: { x: 950, y: 520 },
    routeTarget: 'M 1249 410 L 1249 470 C 1249 480, 1220 480, 1150 480 L 950 520',
  },
  gift_shop: {
    id: 'gift_shop',
    name: 'Cửa Hàng Lưu Niệm (Gift Shop)',
    floorId: '8',
    floorLevel: 'TẦNG 6',
    category: 'Mua Sắm & Quà Tặng',
    icon: '🎁',
    time: '4 Phút',
    distance: '120m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Di chuyển tới Thang máy A và bấm lên Tầng 6.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, rẽ trái đi vào sảnh trung tâm là đến Quầy quà lưu niệm.',
    coords: { x: 950, y: 420 },
    routeTarget: 'M 1249 410 L 1249 470 C 1249 480, 1220 480, 1150 480 L 950 420',
  },
};

// Tuyến đường chuẩn chặng 1: Từ Lobby (Ground) -> Thang máy A
export const ROUTE_GROUND_TO_ELEVATOR = 'M 796 545 C 850 545, 880 545, 908 545 C 935 545, 955 480, 990 480 L 1210 480 C 1235 480, 1249 460, 1249 410';

// Tạo vé chỉ đường dùng 1 lần (Ephemeral One-time Ticket có thời hạn 15 phút)
export const createEphemeralTicket = (destKey) => {
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000; // Có hiệu lực trong 15 phút
  const payload = {
    d: destKey,
    e: expiresAt,
    n: Math.random().toString(36).substring(2, 8),
  };
  try {
    return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return `${destKey}_${expiresAt}`;
  }
};

// Hàm tạo URL chỉ đường di động siêu nhẹ (Standalone 15KB map.html) tối ưu cho quét QR
export const getMobileGuestMapUrl = (destKey) => {
  const token = createEphemeralTicket(destKey);
  try {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : ':5173';
      const lanIp = localStorage.getItem('aurora_custom_lan_ip') || '192.168.1.149';
      return `${window.location.protocol}//${lanIp}${port}/map.html?t=${token}`;
    }
    return `${origin}/map.html?t=${token}`;
  } catch {
    return `http://192.168.1.149:5173/map.html?t=${token}`;
  }
};

export const FloorMap = ({
  destinationKey = 'infinity_pool',
  onSelectDestination,
  className = '',
  onClose,
  defaultZoom = 2.2,
  showQrModalExternal = false,
  qrCountdown = null,
  onCloseQrModal = null,
}) => {
  // Lấy dữ liệu điểm đến hiện tại (Mặc định là Hồ bơi vô cực nếu không truyền)
  const currentDest = HOTEL_DESTINATIONS[destinationKey] || HOTEL_DESTINATIONS.infinity_pool;

  // Trạng thái Chặng:
  // 1: Chặng 1 (Tầng Trệt ra Thang Máy)
  // 2: Chặng 2 (Từ Thang Máy ra Điểm Đích trên tầng mục tiêu)
  const [activeStep, setActiveStep] = useState(currentDest.isDifferentFloor ? 1 : 2);
  const [autoPlay, setAutoPlay] = useState(true);
  const [isHovering, setIsHovering] = useState(false);

  // Zoom & Pan state để phóng to loại bỏ viền trắng thừa của Canva
  const [zoomLevel, setZoomLevel] = useState(defaultZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInstructionBanner, setShowInstructionBanner] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);

  // Tầng đang hiển thị ảnh trên màn hình
  // Nếu chặng 1 -> Tầng 3 (Ground). Nếu chặng 2 -> Tầng mục tiêu của điểm đến.
  const activeFloorId = useMemo(() => {
    if (!currentDest.isDifferentFloor) return currentDest.floorId;
    return activeStep === 1 ? '3' : currentDest.floorId;
  }, [activeStep, currentDest]);

  const activeFloor = HOTEL_FLOORS.find((f) => f.id === activeFloorId) || HOTEL_FLOORS[2];

  // Tự động chuyển chặng từ 1 sang 2 sau 4.5 giây để khách thấy toàn bộ hành trình
  useEffect(() => {
    if (!currentDest.isDifferentFloor) {
      setActiveStep(2);
      return;
    }
    // Reset về chặng 1 khi đổi điểm đến mới
    setActiveStep(1);
    if (!autoPlay) return;

    const timer = setTimeout(() => {
      setActiveStep(2);
    }, 4500);

    return () => clearTimeout(timer);
  }, [destinationKey, autoPlay, currentDest.isDifferentFloor]);

  // Sync zoom khi đổi điểm đến hoặc defaultZoom
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoomLevel(defaultZoom);
  }, [destinationKey, defaultZoom]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(4.0, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(1.0, Number((z - 0.25).toFixed(2))));
  const handleResetZoom = () => {
    setZoomLevel(defaultZoom);
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <div className={`relative bg-white rounded-2xl md:rounded-3xl overflow-hidden border-2 border-stone-200/90 shadow-2xl flex flex-col ${className || 'w-[720px] h-[558px] shrink-0'}`}>
      
      {/* 2. Map Canvas Area (Chiếm trọn 100% diện tích, các nút và thông tin nổi trên nền kính) */}
      <div 
        className="w-full h-full flex-1 relative bg-stone-50 overflow-hidden flex items-center justify-center select-none touch-none"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* 1. Thanh tiêu đề nổi (Floating Header Bar): Siêu gọn, không chiếm chiều dọc bản đồ */}
        <div className="absolute top-2.5 left-2.5 right-2.5 z-30 flex items-center justify-between pointer-events-none gap-2">
          {/* Tên phòng/điểm đến badge nhỏ gọn (Glassmorphism Pill) */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-stone-950/85 backdrop-blur-md text-white px-2.5 sm:px-3 py-1.5 rounded-full border border-stone-700/80 shadow-xl pointer-events-auto min-w-0">
            <span className="text-sm shrink-0">{currentDest.icon}</span>
            <span className="font-extrabold text-xs text-white truncate max-w-[140px] sm:max-w-[200px]">
              {currentDest.name}
            </span>
            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0 uppercase">
              {currentDest.floorLevel}
            </span>
          </div>

          {/* Nút Chuyển Chặng (Nếu khác tầng) & Nút Đã nhớ */}
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
            {currentDest.isDifferentFloor && (
              <div className="flex items-center bg-stone-950/85 backdrop-blur-md p-0.5 rounded-full border border-stone-700/80 shadow-xl gap-0.5">
                <button
                  onClick={() => {
                    setActiveStep(1);
                    setAutoPlay(false);
                  }}
                  className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                    activeStep === 1
                      ? 'bg-emerald-500 text-stone-950 shadow-md'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <span>🛗 Chặng 1</span>
                </button>

                <button
                  onClick={() => {
                    setActiveStep(2);
                    setAutoPlay(false);
                  }}
                  className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                    activeStep === 2
                      ? 'bg-emerald-500 text-stone-950 shadow-md'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <span>{currentDest.icon} Chặng 2</span>
                </button>
              </div>
            )}

            {/* Nút Quét QR lưu vào điện thoại */}
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="h-8 px-2.5 rounded-full bg-stone-900/90 hover:bg-stone-800 text-emerald-400 border border-emerald-500/40 text-[10px] sm:text-xs font-bold flex items-center gap-1 active:scale-95 shadow-xl cursor-pointer"
              title="Quét mã QR lưu chỉ dẫn trên điện thoại"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">QR Điện Thoại</span>
            </button>

            {/* Nút Đã nhớ */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] sm:text-xs font-black flex items-center gap-1 active:scale-95 shadow-xl cursor-pointer"
                title="Đóng bản đồ chỉ đường"
              >
                <span>✓</span>
                <span>Đã nhớ</span>
              </button>
            )}
          </div>
        </div>

        {/* Floating Zoom & Pan Controls: Đặt ở góc trái bên dưới huy hiệu tên phòng */}
        <div className="absolute top-12 left-2.5 z-20 flex items-center bg-stone-900/90 backdrop-blur-md rounded-xl p-0.5 border border-stone-700/80 shadow-lg gap-0.5 pointer-events-auto">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs flex items-center justify-center active:scale-95 cursor-pointer"
            title="Phóng to bản đồ"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <span className="px-1.5 text-[10px] font-mono font-bold text-emerald-400 select-none">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs flex items-center justify-center active:scale-95 cursor-pointer"
            title="Thu nhỏ bản đồ"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="w-7 h-7 rounded-lg hover:bg-stone-800 text-stone-300 hover:text-white text-xs flex items-center justify-center active:scale-95 cursor-pointer ml-0.5"
            title="Khôi phục góc nhìn"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Khung Zoom & Pan đồng bộ cả Ảnh và SVG (Cắt bỏ viền trắng thừa của Canva) */}
        <div
          className={`w-full h-full relative ${isDragging ? 'cursor-grabbing duration-0' : 'cursor-grab duration-150'} transition-transform`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Ảnh mặt bằng gốc của tầng */}
          <img
            src={activeFloor.image}
            alt={activeFloor.name}
            className="w-full h-full object-contain pointer-events-none select-none"
          />

          {/* Lớp SVG Chỉ Đường Động (Vẽ bám theo tỷ lệ 1920 x 1080 gốc của Canva) */}
          <svg
            viewBox="0 0 1920 1080"
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            preserveAspectRatio="xMidYMid meet"
          >
          <defs>
            {/* Hiệu ứng bóng phát sáng dạ quang Neon */}
            <filter id="neon-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#10B981" floodOpacity="0.8" />
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#34D399" floodOpacity="0.9" />
            </filter>
            
            <filter id="amber-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#F59E0B" floodOpacity="0.8" />
            </filter>

            {/* Gradient màu cho vạch đường */}
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>

          {/* VẼ LỘ TRÌNH CHẶNG 1: TẦNG TRỆT (LOBBY -> THANG MÁY A) */}
          {activeStep === 1 && (
            <g className="animate-fadeIn">
              {/* Lớp viền phát sáng mờ phía sau */}
              <path
                d={ROUTE_GROUND_TO_ELEVATOR}
                fill="none"
                stroke="#10B981"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.3"
                filter="url(#neon-glow)"
              />

              {/* Lớp đường đứt chuyển động phong cách Google Maps */}
              <path
                d={ROUTE_GROUND_TO_ELEVATOR}
                fill="none"
                stroke="#059669"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="16 12"
                className="animate-routeDash"
              />

              {/* VỊ TRÍ ROBOT HIỆN TẠI (YOU ARE HERE) - Chấm xanh radar tại Lobby */}
              <g transform="translate(796, 545)">
                {/* Vòng radar lan tỏa */}
                <circle r="36" fill="#10B981" opacity="0.25" className="animate-ping" />
                <circle r="22" fill="#10B981" opacity="0.4" />
                <circle r="14" fill="#059669" stroke="#ffffff" strokeWidth="4" />
                {/* Badge You are here */}
                <rect x="-85" y="-56" width="170" height="32" rx="16" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
                <text x="0" y="-35" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">
                  BẠN ĐANG Ở ĐÂY
                </text>
              </g>

              {/* VỊ TRÍ THANG MÁY ĐẾN (ELEVATOR GOAL) - Chấm vàng hổ phách nhấp nháy */}
              <g transform="translate(1249, 400)">
                <circle r="30" fill="#F59E0B" opacity="0.25" className="animate-ping" />
                <circle r="18" fill="#F59E0B" stroke="#ffffff" strokeWidth="4" filter="url(#amber-glow)" />
                <text x="0" y="5" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold">
                  🛗
                </text>
                {/* Badge Thang Máy A */}
                <rect x="-95" y="-54" width="190" height="32" rx="16" fill="#0f172a" stroke="#F59E0B" strokeWidth="2" />
                <text x="0" y="-33" textAnchor="middle" fill="#FDE68A" fontSize="13" fontWeight="bold">
                  THANG MÁY LÊN {currentDest.floorLevel}
                </text>
              </g>
            </g>
          )}

          {/* VẼ LỘ TRÌNH CHẶNG 2: TẦNG ĐÍCH (TỪ THANG MÁY -> PHÒNG/KHU VỰC ĐÍCH) */}
          {activeStep === 2 && (
            <g className="animate-fadeIn">
              {/* Lớp viền phát sáng mờ phía sau */}
              <path
                d={currentDest.routeTarget}
                fill="none"
                stroke="#06B6D4"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.3"
                filter="url(#neon-glow)"
              />

              {/* Lớp đường đứt chuyển động phong cách Google Maps */}
              <path
                d={currentDest.routeTarget}
                fill="none"
                stroke="#0284C7"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="16 12"
                className="animate-routeDash"
              />

              {/* VỊ TRÍ XUẤT PHÁT: THANG MÁY (Nếu khác tầng) hoặc ROBOT LOBBY (Nếu cùng tầng) */}
              {currentDest.isDifferentFloor ? (
                <g transform="translate(1249, 410)">
                  <circle r="18" fill="#0ea5e9" stroke="#ffffff" strokeWidth="4" />
                  <rect x="-90" y="-50" width="180" height="30" rx="15" fill="#0f172a" stroke="#0ea5e9" strokeWidth="2" />
                  <text x="0" y="-30" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">
                    CỬA THANG MÁY
                  </text>
                </g>
              ) : (
                <g transform="translate(796, 545)">
                  <circle r="36" fill="#10B981" opacity="0.25" className="animate-ping" />
                  <circle r="14" fill="#059669" stroke="#ffffff" strokeWidth="4" />
                  <rect x="-85" y="-56" width="170" height="32" rx="16" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
                  <text x="0" y="-35" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">
                    BẠN ĐANG Ở ĐÂY
                  </text>
                </g>
              )}

              {/* ĐIỂM ĐÍCH ĐẾN (DESTINATION PIN) - Ghim giọt nước nảy Google Maps */}
              <g transform={`translate(${currentDest.coords.x}, ${currentDest.coords.y})`}>
                <circle r="32" fill="#ef4444" opacity="0.2" className="animate-ping" />
                {/* Ghim giọt nước 3D */}
                <path
                  d="M 0 0 C -16 -16, -24 -36, -24 -52 C -24 -72, -10 -84, 0 -84 C 10 -84, 24 -72, 24 -52 C 24 -36, 16 -16, 0 0 Z"
                  fill="#dc2626"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  className="animate-bounce"
                />
                <circle cx="0" cy="-54" r="10" fill="#ffffff" className="animate-bounce" />
                {/* Tên điểm đến */}
                <rect x="-105" y="-124" width="210" height="34" rx="17" fill="#0f172a" stroke="#ef4444" strokeWidth="2.5" />
                <text x="0" y="-102" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="extrabold">
                  {currentDest.name}
                </text>
              </g>
            </g>
          )}
        </svg>
        </div>

        {/* Thanh chọn tầng dọc bên phải (Vertical Floor Picker) */}
        <div className="absolute right-3.5 top-3.5 flex flex-col gap-1 z-20 bg-stone-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-stone-700/80 shadow-xl">
          <div className="text-[9px] font-black tracking-wider text-stone-400 text-center uppercase pb-1 border-b border-stone-800">
            Tầng
          </div>
          {[...HOTEL_FLOORS].reverse().map((fl) => {
            const isDestinationFloor = fl.id === currentDest.floorId;
            const isCurrentlyViewing = fl.id === activeFloorId;

            return (
              <button
                key={fl.id}
                onClick={() => {
                  setAutoPlay(false);
                  if (fl.id === '3') setActiveStep(1);
                  else if (fl.id === currentDest.floorId) setActiveStep(2);
                }}
                className={`w-9 h-8 rounded-xl text-xs font-black transition-all flex items-center justify-center relative cursor-pointer ${
                  isCurrentlyViewing
                    ? 'bg-emerald-500 text-stone-950 font-black shadow-md scale-105'
                    : isDestinationFloor
                    ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
                title={fl.name}
              >
                {fl.level}
                {isDestinationFloor && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 absolute top-1 right-1 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Hộp chỉ dẫn từng chặng (Turn-by-turn Navigation Banner) dưới đáy bản đồ */}
        {showInstructionBanner ? (
          <div className="absolute bottom-2 left-2.5 right-14 bg-stone-950/90 backdrop-blur-md rounded-xl p-2 px-3 border border-stone-800/90 text-white flex items-center justify-between z-20 shadow-xl animate-fadeIn">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs shrink-0 border border-emerald-500/30">
                {activeStep === 1 ? '1' : '2'}
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-stone-100 leading-tight line-clamp-2">
                {activeStep === 1 ? currentDest.step1Text : currentDest.step2Text}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 pl-2.5 border-l border-stone-800 text-[10px] sm:text-xs">
              <span className="flex items-center gap-1 text-stone-300 font-medium">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{currentDest.time}</span>
              </span>
              <span className="flex items-center gap-1 text-stone-300 font-medium">
                <Footprints className="w-3 h-3 text-emerald-400" />
                <span>{currentDest.distance}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowInstructionBanner(false)}
                className="w-5 h-5 rounded hover:bg-stone-800 flex items-center justify-center text-stone-400 hover:text-white cursor-pointer ml-0.5"
                title="Thu gọn chỉ dẫn"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowInstructionBanner(true)}
            className="absolute bottom-2 left-2.5 z-20 px-2.5 py-1 rounded-lg bg-stone-900/90 backdrop-blur-md border border-stone-700 text-stone-200 hover:text-white text-[10px] font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            <ChevronUp className="w-3 h-3 text-emerald-400" />
            <span>Chỉ dẫn chặng {activeStep}</span>
          </button>
        )}

        {/* THẺ MÃ QR HIỆN SẴN TRỰC TIẾP TRÊN BẢN ĐỒ (Quét ngay không cần bấm nút) */}
        <div
          onClick={() => setShowQrModal(true)}
          className="absolute bottom-16 left-2.5 z-20 bg-stone-950/92 backdrop-blur-md p-2 rounded-2xl border border-emerald-500/50 shadow-2xl flex items-center gap-2.5 cursor-pointer hover:border-emerald-400 hover:scale-[1.03] transition-all group animate-fadeIn"
          title="Chạm vào để phóng to mã QR"
        >
          <div className="p-1 bg-white rounded-xl shrink-0 shadow-sm">
            <QRCodeSVG
              value={getMobileGuestMapUrl(currentDest.id)}
              size={64}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="flex flex-col pr-1 text-left">
            <div className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-400 uppercase tracking-wide">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Quét Lưu Chỉ Dẫn</span>
            </div>
            <p className="text-[10px] text-stone-200 font-medium leading-tight mt-0.5 max-w-[140px]">
              Mang theo bản đồ 2 chặng trên điện thoại
            </p>
            <span className="text-[9px] text-emerald-400/80 font-bold mt-0.5 group-hover:text-emerald-300 transition-colors">
              Chạm để phóng to ↗
            </span>
          </div>
        </div>

        {/* Modal Quét Mã QR Phóng To Trên Kiosk */}
        {(showQrModal || showQrModalExternal) && (
          <div
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => {
              setShowQrModal(false);
              if (onCloseQrModal) onCloseQrModal();
            }}
          >
            <div
              className="w-[360px] max-w-[95%] bg-stone-900 border border-emerald-500/40 rounded-3xl p-5 shadow-2xl flex flex-col items-center gap-4 text-center text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between w-full border-b border-stone-800 pb-2.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <Smartphone className="w-4 h-4" />
                  <span>Lưu Bản Đồ Trên Điện Thoại</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowQrModal(false);
                    if (onCloseQrModal) onCloseQrModal();
                  }}
                  className="w-7 h-7 rounded-full bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Countdown badge khi được kích hoạt tự động ở cuối request chỉ đường */}
              {qrCountdown !== null && qrCountdown >= 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tự động đóng sau {qrCountdown}s</span>
                </div>
              )}

              <div className="p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center">
                <QRCodeSVG
                  value={getMobileGuestMapUrl(currentDest.id)}
                  size={190}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="flex flex-col gap-1">
                <h4 className="font-extrabold text-sm text-stone-100">
                  {currentDest.name} ({currentDest.floorLevel})
                </h4>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Quý khách vui lòng bật camera điện thoại để quét mã QR và xem sơ đồ 2 chặng đường đi trực tiếp nhé ạ.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowQrModal(false);
                  if (onCloseQrModal) onCloseQrModal();
                }}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
