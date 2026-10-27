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
  Check,
  ArrowRight,
  X,
  ChevronUp,
  ChevronDown,
  QrCode,
  Smartphone,
  Map as MapIcon,
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
    icon: '',
    time: '3 Phút',
    distance: '115m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi từ sảnh Lobby đến Thang máy A và bấm lên Tầng 5.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, rẽ trái đi hết hành lang qua cửa kính là đến Hồ bơi vô cực.',
    coords: { x: 806, y: 420 },
    routeTarget: 'M 1232 415 L 1232 525 L 806 525 L 806 420',
  },
  gym: {
    id: 'gym',
    name: 'Fitness & Gym Center',
    floorId: '7',
    floorLevel: 'TẦNG 5',
    category: 'Thể Thao & Sức Khỏe',
    icon: '',
    time: '3 Phút',
    distance: '110m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 5.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi thẳng xuống phía dưới để vào Phòng Gym.',
    coords: { x: 1180, y: 650 },
    routeTarget: 'M 1232 415 L 1232 525 L 1180 525 L 1180 650',
  },
  spa: {
    id: 'spa',
    name: 'Thảo Mộc Spa & Massage',
    floorId: '7',
    floorLevel: 'TẦNG 5',
    category: 'Chăm Sóc Sức Khỏe',
    icon: '',
    time: '3 Phút',
    distance: '105m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi tới Thang máy A và bấm lên Tầng 5.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, rẽ trái 15m vào cửa phòng Spa.',
    coords: { x: 1054, y: 420 },
    routeTarget: 'M 1232 415 L 1232 525 L 1054 525 L 1054 420',
  },

  // === TẦNG 2: BẾP, NHÀ HÀNG & F&B (MAP 4.PNG MỚI) ===
  restaurant: {
    id: 'restaurant',
    name: 'Nhà Hàng & Quầy Nhận Món (Pickup Area)',
    floorId: '4',
    floorLevel: 'TẦNG 2',
    category: 'Ẩm Thực',
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
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
    icon: '',
    time: '1 Phút',
    distance: '15m',
    isDifferentFloor: false,
    step1Text: 'Đi thẳng qua cửa kính sảnh chính, quầy lễ tân nằm ngay bên tay phải bạn.',
    step2Text: '',
    coords: { x: 995, y: 620 },
    routeTarget: 'M 796 545 L 930 545 C 960 545, 970 620, 995 620',
  },
  restroom_ground: {
    id: 'restroom_ground',
    name: 'Nhà Vệ Sinh Sảnh (Lobby Restroom)',
    floorId: '3',
    floorLevel: 'GROUND',
    category: 'Tiện Ích Vệ Sinh',
    icon: '',
    time: '1 Phút',
    distance: '25m',
    isDifferentFloor: false,
    step1Text: 'Từ sảnh chính, đi về phía tay phải sau quầy lễ tân để vào Nhà Vệ Sinh.',
    step2Text: '',
    coords: { x: 1045, y: 640 },
    routeTarget: 'M 796 545 L 930 545 C 960 545, 970 620, 1045 640',
  },
  parking_car: {
    id: 'parking_car',
    name: 'Bãi Đỗ Xe Ô Tô (Hầm B2)',
    floorId: '1',
    floorLevel: 'HẦM B2',
    category: 'Bãi Xe & Vận Chuyển',
    icon: '',
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
    icon: '',
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
    icon: '',
    time: '4 Phút',
    distance: '120m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Di chuyển tới Thang máy A và bấm lên Tầng 6.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, rẽ trái đi vào sảnh trung tâm là đến Quầy quà lưu niệm.',
    coords: { x: 950, y: 420 },
    routeTarget: 'M 1249 410 L 1249 470 C 1249 480, 1220 480, 1150 480 L 950 420',
  },
};

// Tuyến đường chuẩn chặng 1: Từ Lobby (Ground) -> Thang máy A (đi thẳng qua cửa sảnh x=908 rồi mới lượn lên hành lang thang máy, hoàn toàn không chạm tường)
export const ROUTE_GROUND_TO_ELEVATOR = 'M 796 545 L 930 545 C 960 545, 980 480, 1020 480 L 1232 480 L 1232 415';

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

// Cache URL vé QR theo destinationKey để mã QR ổn định, không bị render lại giật giật khi đếm ngược
const qrTicketCache = new Map();

// Hàm tạo URL chỉ đường di động siêu nhẹ (Standalone 15KB map.html) tối ưu cho quét QR
export const getMobileGuestMapUrl = (destKey) => {
  const now = Date.now();
  const cached = qrTicketCache.get(destKey);
  // Nếu đã tạo vé trong vòng 10 phút thì giữ nguyên mã QR để không bị giật/đổi hình
  if (cached && cached.expiresAt > now + 60 * 1000) {
    return cached.url;
  }

  const token = createEphemeralTicket(destKey);
  let url = '';
  try {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : ':5173';
      const lanIp = localStorage.getItem('aurora_custom_lan_ip') || '192.168.1.149';
      url = `${window.location.protocol}//${lanIp}${port}/map.html?t=${token}`;
    } else {
      url = `${origin}/map.html?t=${token}`;
    }
  } catch {
    url = `http://192.168.1.149:5173/map.html?t=${token}`;
  }

  qrTicketCache.set(destKey, { url, expiresAt: now + 15 * 60 * 1000 });
  return url;
};

/**
 * Nhận diện nhanh điểm đến / POI từ câu nói người dùng ngay trên Client (0ms latency)
 * để màn hình robot LẬP TỨC chuyển sang chế độ bản đồ chỉ đường RT-05 mà không cần chờ LLM.
 */
export const detectDestinationPoi = (rawPrompt) => {
  if (!rawPrompt || typeof rawPrompt !== 'string') return null;
  const p = rawPrompt.toLowerCase().trim();

  // Bỏ qua các địa điểm ngoại vi khách sạn
  const externalPlaces = [
    'sân bay', 'airport', 'nội bài', 'tân sơn nhất', 'ga tàu', 'ga hà nội',
    'bến xe', 'bãi biển', 'ra biển', 'chợ', 'chợ đêm', 'bến thành',
    'phố cổ', 'hồ gươm', 'trung tâm thương mại', 'vincom', 'bệnh viện',
    'bảo tàng', 'ngoài khách sạn', 'địa điểm du lịch', 'tour', 'bắt taxi', 'bắt xe', 'grab'
  ];
  if (externalPlaces.some((k) => p.includes(k))) return null;

  // Bỏ qua các câu hỏi tổng quan về dịch vụ / tiện ích của khách sạn (không nhắm đến 1 địa điểm cụ thể)
  const generalOverviewKeywords = [
    'dịch vụ về khách sạn', 'dịch vụ của khách sạn', 'dịch vụ khách sạn',
    'các dịch vụ', 'tiện ích khách sạn', 'các tiện ích', 'tiện ích của khách sạn',
    'cơ sở vật chất', 'khách sạn có gì', 'khách sạn có những gì', 'khách sạn có những dịch vụ gì',
    'khách sạn có những tiện ích gì', 'giới thiệu khách sạn', 'giới thiệu về khách sạn',
    'thông tin về khách sạn', 'thông tin khách sạn', 'hotel amenities', 'hotel facilities',
    'all services', 'ở đây có gì', 'có những dịch vụ gì', 'có những tiện ích gì'
  ];
  if (generalOverviewKeywords.some((k) => p.includes(k))) return null;

  // Ý định hỏi đường / điều hướng / tìm vị trí
  const navIntentKeywords = [
    'ở đâu', 'o dau', 'chỗ nào', 'cho nao', 'nơi nào', 'noi nao',
    'tầng mấy', 'tang may', 'ở tầng', 'o tang', 'hướng nào', 'huong nao',
    'đường đi', 'duong di', 'đường đến', 'duong den', 'đường ra', 'duong ra',
    'chỉ đường', 'chi duong', 'dẫn đường', 'dan duong', 'hướng dẫn đường',
    'lối đi', 'loi di', 'lối lên', 'loi len', 'lối xuống', 'loi xuong',
    'làm sao để đến', 'lam sao de den', 'cách đi', 'cach di', 'cách đến', 'cach den',
    'đi đến', 'di den', 'đi tới', 'di toi', 'đi ra', 'di ra', 'đi lên', 'di len', 'đi xuống', 'di xuong',
    'dẫn tôi', 'dan toi', 'dắt tôi', 'cho tôi đến', 'cho toi den',
    'tôi muốn đến', 'toi muon den', 'tôi muốn đi', 'toi muon di',
    'đưa tôi', 'dua toi', 'tìm đường', 'tim duong', 'vị trí', 'vi tri', 'chỉ tôi', 'chi toi',
    'where is', 'where are', "where's", 'which floor', 'how to get', 'how do i get',
    'way to', 'directions to', 'show me the way', 'take me to', 'lead me to', 'navigate to',
    'giới thiệu', 'gioi thieu', 'thông tin về', 'introduce', 'tell me about',
    'bản đồ', 'sơ đồ', 'map'
  ];

  const directLocPhrases = [
    'đi vệ sinh', 'di ve sinh', 'đi toilet', 'di toilet', 'đi wc', 'di wc',
    'ra lễ tân', 'ra quầy', 'lên hồ bơi', 'ra hồ bơi', 'xuống bãi xe',
    'vào thang máy', 'lên phòng gym', 'đi massage', 'đi spa'
  ];

  const words = p.split(/\s+/);
  const isShortLocation = words.length <= 4 && [
    'toilet', 'vệ sinh', 'wc', 'hồ bơi', 'pool', 'gym', 'spa',
    'nhà hàng', 'buffet', 'lễ tân', 'reception', 'bãi xe', 'bar', 'cà phê', 'cafe'
  ].some((k) => p.includes(k));

  const room4xxMatch = p.match(/\b(?:phòng|p\.?|phong)?\s*(40[1-9])\b/);
  const room3xxMatch = p.match(/\b(?:phòng|p\.?|phong)?\s*(30[1-9])\b/);

  const hasNavIntent = Boolean(room4xxMatch || room3xxMatch) ||
    navIntentKeywords.some((k) => p.includes(k)) ||
    directLocPhrases.some((k) => p.includes(k)) ||
    isShortLocation;

  if (!hasNavIntent) return null;

  // 1. Nhận diện phòng 4xx (401 -> 409)
  if (room4xxMatch) return `room_${room4xxMatch[1]}`;

  // 2. Nhận diện phòng 3xx (301 -> 309)
  if (room3xxMatch) return `room_${room3xxMatch[1]}`;

  // 3. Nhà vệ sinh
  if (['vệ sinh', 've sinh', 'toilet', 'wc', 'restroom', 'washroom'].some((k) => p.includes(k))) {
    if (['tầng 2', 'nhà hàng', 'bếp', 'kho'].some((k) => p.includes(k))) return 'restroom_f2';
    return 'restroom_ground';
  }

  // 4. Nhà hàng & F&B
  if (['nhà bếp', 'nha bep', 'khu bếp', 'bếp chính', 'kitchen'].some((k) => p.includes(k))) return 'kitchen';
  if (['sơ chế', 'so che', 'chuẩn bị món', 'preparation'].some((k) => p.includes(k))) return 'preparation_area';
  if (['kho hàng', 'kho hang', 'kho nguyên liệu', 'kho thực phẩm', 'warehouse'].some((k) => p.includes(k))) return 'warehouse';
  if (['nhà hàng', 'nha hang', 'buffet', 'ăn sáng', 'quầy nhận món', 'pickup', 'restaurant'].some((k) => p.includes(k))) return 'restaurant';

  // 5. Tầng 5 & 6 tiện ích
  if (['hồ bơi', 'ho boi', 'bể bơi', 'pool', 'bơi'].some((k) => p.includes(k))) return 'infinity_pool';
  if (['rooftop', 'cafe', 'cà phê', 'coffee'].some((k) => p.includes(k))) return 'rooftop_coffee';
  if (['quầy bar', 'quay bar', 'sky bar', 'sky lounge', 'uống rượu', 'bar'].some((k) => p.includes(k))) return 'bar';
  if (['karaoke', 'hát karaoke', 'phòng hát'].some((k) => p.includes(k))) return 'karaoke';
  if (['gym', 'thể hình', 'the hinh', 'fitness', 'tập gym'].some((k) => p.includes(k))) return 'gym';
  if (['spa', 'massage', 'xông hơi', 'mát xa'].some((k) => p.includes(k))) return 'spa';
  if (['lưu niệm', 'gift shop', 'cửa hàng quà'].some((k) => p.includes(k))) return 'gift_shop';

  // 6. Tầng trệt & bãi xe
  if (['lễ tân', 'tiếp tân', 'quầy lễ tân', 'bàn lễ tân', 'front desk', 'check-in', 'check in', 'reception'].some((k) => p.includes(k))) return 'front_desk';
  if (['xe máy', 'gửi xe máy', 'bãi xe máy', 'xe đạp', 'hầm b1'].some((k) => p.includes(k))) return 'parking_bike';
  if (['đỗ ô tô', 'bãi ô tô', 'bãi xe ô tô', 'hầm b2', 'xe hơi', 'bãi xe', 'đỗ xe', 'gửi xe', 'parking'].some((k) => p.includes(k))) return 'parking_car';

  // Nếu người dùng hỏi đường/bản đồ chung chung ("cho tôi xem bản đồ", "chỉ đường cho tôi", "bản đồ khách sạn")
  if (['bản đồ', 'sơ đồ', 'map', 'chỉ đường', 'directions'].some((k) => p.includes(k))) return 'infinity_pool';

  return null;
};

// Danh sách các cơ sở vật chất chính của khách sạn cho bộ chọn nhanh
export const HOTEL_KEY_FACILITIES = [
  { key: 'infinity_pool', name: 'Hồ Bơi Vô Cực Nước Ấm', floor: 'TẦNG 5' },
  { key: 'spa', name: 'Thảo Mộc Spa & Massage', floor: 'TẦNG 5' },
  { key: 'gym', name: 'Trung Tâm Fitness & Gym', floor: 'TẦNG 5' },
  { key: 'restaurant', name: 'Nhà Hàng Aurora & Bếp', floor: 'TẦNG 2' },
  { key: 'rooftop_coffee', name: 'Rooftop Sky Bar & Cafe', floor: 'TẦNG 6' },
  { key: 'front_desk', name: 'Quầy Lễ Tân & Sảnh', floor: 'TẦNG TRỆT' },
  { key: 'parking_car', name: 'Bãi Đỗ Xe & Sạc EV', floor: 'HẦM B2' },
];

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
  // Điểm đến được chọn (hỗ trợ chuyển đổi nhanh trực tiếp giữa các cơ sở vật chất)
  const [selectedDestKey, setSelectedDestKey] = useState(destinationKey);
  const [isDestSelectorOpen, setIsDestSelectorOpen] = useState(false);

  useEffect(() => {
    setSelectedDestKey(destinationKey);
  }, [destinationKey]);

  // Lấy dữ liệu điểm đến hiện tại
  const currentDest = HOTEL_DESTINATIONS[selectedDestKey] || HOTEL_DESTINATIONS.infinity_pool;

  // Giữ URL mã QR cố định trong suốt vòng đời của điểm đến này để mã QR không bị giật ma trận
  const qrMapUrl = useMemo(() => {
    return getMobileGuestMapUrl(currentDest.id);
  }, [currentDest.id]);

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
  // Chế độ hiển thị: 'map' (Bản đồ) hoặc 'qr' (Mã QR) - phân tách rõ ràng "1 là QR 2 là map"
  const [activeMode, setActiveMode] = useState(showQrModalExternal ? 'qr' : 'map');

  useEffect(() => {
    if (showQrModalExternal) {
      setActiveMode('qr');
    }
  }, [showQrModalExternal]);

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
  }, [selectedDestKey, autoPlay, currentDest.isDifferentFloor]);

  // Sync zoom khi đổi điểm đến hoặc defaultZoom
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoomLevel(defaultZoom);
  }, [selectedDestKey, defaultZoom]);

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
    <div className={`relative bg-[#F5F2EB] rounded-2xl md:rounded-3xl overflow-hidden border border-[#E3DFD5] shadow-xl flex flex-col ${className || 'w-[720px] h-[558px] shrink-0'}`}>
      
      {/* 1. Thanh tiêu đề nổi (Floating Header Bar): Theme xám nhạt đồng bộ hệ thống, phân tách rõ 1 là Bản Đồ, 2 là Mã QR */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-30 flex items-center justify-between pointer-events-none gap-2">
        {/* Bộ chọn cơ sở vật chất / điểm đến nhanh (Facility Selector Dropdown) */}
        <div className="relative pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsDestSelectorOpen((prev) => !prev)}
            className="flex items-center gap-1.5 sm:gap-2 bg-white/95 hover:bg-stone-50 text-stone-900 px-3 py-1.5 rounded-full border border-[#E3DFD5] hover:border-stone-400 shadow-xs cursor-pointer active:scale-95 transition-all min-w-0"
            title="Nhấn để đổi cơ sở vật chất / điểm đến"
          >
            <span className="font-extrabold text-xs text-stone-900 truncate max-w-[130px] sm:max-w-[190px]">
              {currentDest.name}
            </span>
            <span className="text-[10px] font-mono font-semibold text-stone-700 bg-[#EFECE4] px-1.5 py-0.5 rounded border border-[#E3DFD5] shrink-0 uppercase">
              {currentDest.floorLevel}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-stone-500 transition-transform duration-200 shrink-0 ${
                isDestSelectorOpen ? 'rotate-180 text-stone-900' : ''
              }`}
            />
          </button>

          {/* Menu Dropdown danh sách cơ sở vật chất */}
          {isDestSelectorOpen && (
            <>
              {/* Overlay tàng hình để đóng menu khi click ra ngoài */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsDestSelectorOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1.5 z-50 w-64 max-h-[280px] overflow-y-auto no-scrollbar rounded-2xl bg-white/95 backdrop-blur-xl border border-[#E3DFD5] shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 px-2.5 py-1 border-b border-[#E3DFD5] flex items-center justify-between">
                  <span>Chọn cơ sở vật chất</span>
                  <span className="text-[9px] font-mono text-stone-400">7 ĐIỂM ĐẾN</span>
                </div>
                {HOTEL_KEY_FACILITIES.map((fac) => {
                  const isSelected = fac.key === selectedDestKey;
                  return (
                    <button
                      key={fac.key}
                      type="button"
                      onClick={() => {
                        setSelectedDestKey(fac.key);
                        setIsDestSelectorOpen(false);
                        if (onSelectDestination) {
                          onSelectDestination(fac.key);
                        }
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1A1917] text-white shadow-xs'
                          : 'text-stone-800 hover:bg-[#EFECE4]/80 hover:text-stone-950'
                      }`}
                    >
                      <span className="truncate pr-2">{fac.name}</span>
                      <span
                        className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                          isSelected
                            ? 'bg-stone-800 text-stone-200 border border-stone-700'
                            : 'bg-[#EFECE4] text-stone-600 border border-[#E3DFD5]'
                        }`}
                      >
                        {fac.floor}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Nhóm điều khiển: Bản Đồ / Mã QR, Icon chuyển Chặng & Icon Đã Nhớ */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          {/* Bộ chuyển 2 chế độ: Bản Đồ / Mã QR */}
          <div className="flex items-center bg-[#EFECE4]/90 backdrop-blur-md p-0.5 rounded-full border border-[#E3DFD5] shadow-xs gap-0.5">
            <button
              type="button"
              onClick={() => {
                if (onCloseQrModal) onCloseQrModal();
                setActiveMode('map');
              }}
              className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeMode === 'map'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Xem bản đồ chỉ đường"
            >
              <MapIcon className="w-3.5 h-3.5 text-stone-700" />
              <span>Bản Đồ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('qr')}
              className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeMode === 'qr'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Quét mã QR lưu vào điện thoại"
            >
              <QrCode className="w-3.5 h-3.5 text-stone-700" />
              <span>Mã QR</span>
            </button>
          </div>

          {/* Thay nút chặng 1, 2 bằng cụm icon số tròn nhỏ gọn (1) -> (2) */}
          {activeMode === 'map' && currentDest.isDifferentFloor && (
            <div className="flex items-center bg-[#EFECE4]/90 backdrop-blur-md p-0.5 px-1 rounded-full border border-[#E3DFD5] shadow-xs gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveStep(1);
                  setAutoPlay(false);
                }}
                className={`w-6 h-6 rounded-full text-[11px] font-black transition-all cursor-pointer flex items-center justify-center ${
                  activeStep === 1
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                }`}
                title="Chặng 1: Sảnh đến Thang máy A"
                aria-label="Chặng 1"
              >
                1
              </button>

              <ArrowRight className="w-3 h-3 text-stone-400 shrink-0" />

              <button
                type="button"
                onClick={() => {
                  setActiveStep(2);
                  setAutoPlay(false);
                }}
                className={`w-6 h-6 rounded-full text-[11px] font-black transition-all cursor-pointer flex items-center justify-center ${
                  activeStep === 2
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                }`}
                title={`Chặng 2: Thang máy đến ${currentDest.name}`}
                aria-label="Chặng 2"
              >
                2
              </button>
            </div>
          )}

          {/* Thay chữ "Đã nhớ" bằng nút icon Check */}
          {onClose && (
            <button
              type="button"
              onClick={() => {
                if (onCloseQrModal) onCloseQrModal();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-stone-900 hover:bg-black text-white flex items-center justify-center shadow-md active:scale-95 cursor-pointer transition-all border border-stone-800"
              title="Đã nhớ (Đóng)"
              aria-label="Đã nhớ"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* 2. CHẾ ĐỘ 1: BẢN ĐỒ (activeMode === 'map') */}
      {activeMode === 'map' && (
        <div 
          className="w-full h-full flex-1 relative bg-[#F8F6F1] overflow-hidden flex items-center justify-center select-none touch-none"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Khung Zoom & Pan đồng bộ cả Ảnh và SVG (Đã loại bỏ cụm nút Zoom theo yêu cầu) */}
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

            {/* Lớp SVG Chỉ Đường: Tập trung vào đường đi, không nhảy nhót */}
            <svg
              viewBox="0 0 1920 1080"
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <filter id="sky-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#38BDF8" floodOpacity="0.5" />
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7DD3FC" floodOpacity="0.7" />
                </filter>
              </defs>

              {/* VẼ LỘ TRÌNH CHẶNG 1: TẦNG TRỆT (LOBBY -> THANG MÁY A) - Màu xanh nhạt dễ nhìn */}
              {activeStep === 1 && (
                <g className="animate-fadeIn">
                  <path
                    d={ROUTE_GROUND_TO_ELEVATOR}
                    fill="none"
                    stroke="#7DD3FC"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.3"
                    filter="url(#sky-glow)"
                  />
                  <path
                    d={ROUTE_GROUND_TO_ELEVATOR}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="14 10"
                    className="animate-routeDash"
                  />
                  {/* Điểm xuất phát tĩnh (Chấm xanh nhạt tinh gọn) */}
                  <g transform="translate(796, 545)">
                    <circle r="14" fill="#38BDF8" opacity="0.25" />
                    <circle r="8" fill="#0EA5E9" stroke="#ffffff" strokeWidth="2.5" />
                  </g>
                  {/* Điểm thang máy đích chặng 1 */}
                  <g transform="translate(1232, 415)">
                    <circle r="14" fill="#38BDF8" opacity="0.25" />
                    <circle r="8" fill="#38BDF8" stroke="#ffffff" strokeWidth="2.5" />
                  </g>
                </g>
              )}

              {/* VẼ LỘ TRÌNH CHẶNG 2: TẦNG ĐÍCH (TỪ THANG MÁY -> PHÒNG/KHU VỰC ĐÍCH) - Màu xanh nhạt dễ nhìn */}
              {activeStep === 2 && (
                <g className="animate-fadeIn">
                  <path
                    d={currentDest.routeTarget}
                    fill="none"
                    stroke="#7DD3FC"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.3"
                    filter="url(#sky-glow)"
                  />
                  <path
                    d={currentDest.routeTarget}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="14 10"
                    className="animate-routeDash"
                  />
                  {/* Điểm xuất phát chặng 2: chấm xanh nhạt tinh gọn */}
                  {currentDest.isDifferentFloor ? (
                    <g transform="translate(1232, 415)">
                      <circle r="14" fill="#38BDF8" opacity="0.25" />
                      <circle r="8" fill="#0EA5E9" stroke="#ffffff" strokeWidth="2.5" />
                    </g>
                  ) : (
                    <g transform="translate(796, 545)">
                      <circle r="14" fill="#38BDF8" opacity="0.25" />
                      <circle r="8" fill="#0EA5E9" stroke="#ffffff" strokeWidth="2.5" />
                    </g>
                  )}
                  {/* Điểm đích: chấm tròn xanh nhạt tinh tế kết thúc đường đi, không dùng icon mốc ghim to che chữ */}
                  <g transform={`translate(${currentDest.coords.x}, ${currentDest.coords.y})`}>
                    <circle r="14" fill="#38BDF8" opacity="0.3" />
                    <circle r="8" fill="#0EA5E9" stroke="#ffffff" strokeWidth="2.5" />
                  </g>
                </g>
              )}
            </svg>
          </div>
        </div>
      )}

      {/* 3. CHẾ ĐỘ 2: MÃ QR (activeMode === 'qr') - Tối ưu bố cục ngang cho màn hình Landscape/Kiosk */}
      {activeMode === 'qr' && (
        <div className="w-full h-full flex-1 flex items-center justify-center p-3 sm:p-4 bg-[#F5F2EB] text-stone-900 relative select-none animate-fadeIn pt-14 pb-2">
          <div className="bg-white border border-[#E3DFD5] rounded-3xl p-4 sm:p-5 shadow-xl flex flex-row items-center gap-5 sm:gap-6 max-w-[560px] w-auto">
            {/* Cột trái: Mã QR sắc nét, kích thước chuẩn vừa vặn không bị tràn */}
            <div className="p-2.5 bg-white rounded-2xl shadow-xs border-2 border-[#E3DFD5] flex items-center justify-center shrink-0">
              <QRCodeSVG
                value={qrMapUrl}
                size={135}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Cột phải: Thông tin & Hướng dẫn & Nút chuyển */}
            <div className="flex flex-col items-start text-left gap-1.5 min-w-0 max-w-[280px] sm:max-w-[320px]">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                <Smartphone className="w-3.5 h-3.5 text-stone-700 shrink-0" />
                <span>Lưu trên điện thoại</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900 truncate">
                  {currentDest.name}
                </h3>
                <span className="text-[10px] font-mono font-semibold text-stone-700 bg-[#EFECE4] px-1.5 py-0.5 rounded border border-[#E3DFD5] uppercase shrink-0">
                  {currentDest.floorLevel}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span>{currentDest.time}</span>
                </span>
                <span className="text-stone-300">·</span>
                <span className="flex items-center gap-1">
                  <Footprints className="w-3.5 h-3.5 text-stone-400" />
                  <span>{currentDest.distance}</span>
                </span>
              </div>

              <p className="text-[11px] text-stone-600 leading-snug mt-0.5">
                Quét mã bằng camera điện thoại để xem bản đồ và chỉ dẫn đường đi trực tiếp.
              </p>

              {qrCountdown !== null && qrCountdown >= 0 && (
                <div className="px-2 py-0.5 rounded-full bg-[#EFECE4] text-stone-700 border border-[#E3DFD5] text-[10px] font-mono mt-0.5">
                  Tự động đóng sau {qrCountdown}s
                </div>
              )}

              <div className="pt-1 w-full">
                <button
                  type="button"
                  onClick={() => {
                    if (onCloseQrModal) onCloseQrModal();
                    setActiveMode('map');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-[#EFECE4] hover:bg-stone-200 text-stone-800 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-[#E3DFD5] active:scale-95"
                >
                  <MapIcon className="w-3.5 h-3.5 text-stone-700" />
                  <span>Xem Bản Đồ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
