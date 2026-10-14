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
} from 'lucide-react';

// Danh sách cấu hình 8 Tầng trong khách sạn
export const HOTEL_FLOORS = [
  { id: '1', level: 'B2', name: 'Hầm B2 · Bãi Đỗ Xe Ô Tô', image: '/maps/1.png' },
  { id: '2', level: 'B1', name: 'Hầm B1 · Bãi Xe Máy', image: '/maps/2.png' },
  { id: '3', level: 'Ground', name: 'Tầng Trệt · Sảnh & Tiếp Tân', image: '/maps/3.png' },
  { id: '4', level: 'Tầng 2', name: 'Tầng 2 · Nhà Hàng & Bếp', image: '/maps/4.png' },
  { id: '5', level: 'Tầng 3', name: 'Tầng 3 · Phòng Nghỉ (301-306)', image: '/maps/5.png' },
  { id: '6', level: 'Tầng 4', name: 'Tầng 4 · Phòng Nghỉ (401-406)', image: '/maps/6.png' },
  { id: '7', level: 'Tầng 5', name: 'Tầng 5 · Hồ Bơi, Spa & Gym', image: '/maps/7.png' },
  { id: '8', level: 'Tầng 6', name: 'Tầng 6 · Rooftop Coffee & Bar', image: '/maps/8.png' },
];

// Danh bạ các điểm đến (POI) nổi bật
export const HOTEL_DESTINATIONS = {
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
  restaurant: {
    id: 'restaurant',
    name: 'Nhà Hàng Buffet Á - Âu',
    floorId: '4',
    floorLevel: 'TẦNG 2',
    category: 'Ẩm Thực',
    icon: '🍽️',
    time: '2 Phút',
    distance: '80m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Đi từ sảnh tiếp tân ra Thang máy A và bấm lên Tầng 2.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, rẽ vào sảnh chính nhà hàng (bàn ăn trung tâm).',
    coords: { x: 950, y: 520 },
    routeTarget: 'M 1249 410 L 1249 470 C 1249 480, 1230 480, 1180 480 L 1120 480 C 1060 480, 1000 500, 950 520',
  },
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
  room_401: {
    id: 'room_401',
    name: 'Phòng Nghỉ 401 (Deluxe)',
    floorId: '6',
    floorLevel: 'TẦNG 4',
    category: 'Phòng Khách',
    icon: '🛏️',
    time: '3 Phút',
    distance: '95m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Ra Thang máy A tại sảnh và bấm lên Tầng 4.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi dọc hành lang rẽ vào Phòng 401 bên phải.',
    coords: { x: 1040, y: 380 },
    routeTarget: 'M 1249 410 L 1249 520 C 1249 530, 1230 530, 1150 530 L 1050 530 C 1050 490, 1050 440, 1040 380',
  },
  room_402: {
    id: 'room_402',
    name: 'Phòng Nghỉ 402 (Suite)',
    floorId: '6',
    floorLevel: 'TẦNG 4',
    category: 'Phòng Khách',
    icon: '🛏️',
    time: '3 Phút',
    distance: '105m',
    isDifferentFloor: true,
    step1Text: 'Chặng 1: Ra Thang máy A tại sảnh và bấm lên Tầng 4.',
    step2Text: 'Chặng 2: Ra khỏi thang máy, đi hết hành lang rẽ vào Phòng 402 góc bên trái.',
    coords: { x: 740, y: 380 },
    routeTarget: 'M 1249 410 L 1249 520 C 1249 530, 1230 530, 1150 530 L 760 530 C 750 490, 750 440, 740 380',
  },
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
};

// Tuyến đường chuẩn chặng 1: Từ Lobby (Ground) -> Thang máy A
const ROUTE_GROUND_TO_ELEVATOR = 'M 796 545 C 850 545, 880 545, 908 545 C 935 545, 955 480, 990 480 L 1210 480 C 1235 480, 1249 460, 1249 410';

export const FloorMap = ({
  destinationKey = 'infinity_pool',
  onSelectDestination,
  className = '',
  onClose,
  defaultZoom = 1.6,
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

  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.8, Number((z + 0.25).toFixed(2))));
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
      
      {/* 1. Header Bar: Tiêu đề lộ trình, Nút đổi chặng & Nút Đóng */}
      <div className="h-12 md:h-14 px-3 md:px-5 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white flex items-center justify-between z-20 shrink-0 shadow-md">
        
        {/* Điểm đến badge */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-lg shadow-inner shrink-0">
            {currentDest.icon}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] md:text-xs font-black tracking-wider text-emerald-400 uppercase">
                {currentDest.floorLevel}
              </span>
              <span className="text-[9px] text-stone-400 truncate">• {currentDest.category}</span>
            </div>
            <h3 className="text-xs md:text-sm font-extrabold text-white truncate max-w-[130px] sm:max-w-[220px]">
              {currentDest.name}
            </h3>
          </div>
        </div>

        {/* Nút Chuyển Chặng (Step Pills) & Nút Đóng */}
        <div className="flex items-center gap-2">
          {currentDest.isDifferentFloor ? (
            <div className="flex items-center bg-stone-950/80 p-0.5 rounded-xl border border-stone-700/80 gap-1 shrink-0">
              <button
                onClick={() => {
                  setActiveStep(1);
                  setAutoPlay(false);
                }}
                className={`px-2 py-1 rounded-lg text-[10px] md:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activeStep === 1
                    ? 'bg-emerald-500 text-stone-950 shadow-md'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <span>🛗 Chặng 1: Thang Máy</span>
              </button>

              <button
                onClick={() => {
                  setActiveStep(2);
                  setAutoPlay(false);
                }}
                className={`px-2 py-1 rounded-lg text-[10px] md:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activeStep === 2
                    ? 'bg-emerald-500 text-stone-950 shadow-md'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <span>{currentDest.icon} Chặng 2: {currentDest.floorLevel}</span>
              </button>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] md:text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Cùng Tầng Trệt</span>
            </div>
          )}

          {/* Nút Đóng / Đã nhớ đường */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-2.5 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-xs font-bold flex items-center gap-1 active:scale-95 shadow-md cursor-pointer shrink-0 ml-1"
              title="Đóng bản đồ chỉ đường"
            >
              <span>✓</span>
              <span>Đã nhớ</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Map Canvas Area (Chứa ảnh mặt bằng 1920x1080 + Lớp SVG Polyline dẫn đường) */}
      <div 
        className="w-full flex-1 relative bg-stone-50 overflow-hidden flex items-center justify-center select-none"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Floating Zoom & Pan Controls: +, -, Reset */}
        <div className="absolute top-2 left-2 z-20 flex items-center bg-stone-900/90 backdrop-blur-md rounded-xl p-0.5 border border-stone-700/80 shadow-lg gap-0.5 pointer-events-auto">
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
      </div>

      {/* 3. Footer Quick Chips: Các địa điểm khách hay hỏi nhất */}
      <div className="h-11 md:h-14 px-2 md:px-4 bg-stone-100 border-t border-stone-200 flex items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar z-20 shrink-0">
        <span className="text-[10px] md:text-[11px] font-black text-stone-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 md:w-3.5 h-3 md:h-3.5 text-amber-500" />
          <span>Gợi ý:</span>
        </span>

        {[
          { key: 'infinity_pool', label: '🏊 Hồ bơi (T5)' },
          { key: 'restaurant', label: '🍽️ Nhà hàng (T2)' },
          { key: 'rooftop_coffee', label: '☕ Rooftop Coffee (T6)' },
          { key: 'bar', label: '🍸 Quầy Bar (T6)' },
          { key: 'gym', label: '💪 Phòng Gym (T5)' },
          { key: 'spa', label: '💆 Spa Thảo Mộc (T5)' },
          { key: 'karaoke', label: '🎤 Karaoke (T6)' },
          { key: 'room_401', label: '🛏️ Phòng 401 (T4)' },
          { key: 'front_desk', label: '🛎️ Lễ tân' },
          { key: 'parking_car', label: '🚗 Bãi xe ô tô' },
        ].map((item) => {
          const isSelected = destinationKey === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                if (onSelectDestination) onSelectDestination(item.key);
                setAutoPlay(true);
              }}
              className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl text-[11px] md:text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-md scale-102 ring-2 ring-emerald-300'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

    </div>
  );
};
