import React, { useState, useMemo, useEffect } from 'react';
import {
  Compass,
  Navigation,
  Clock,
  Footprints,
  PhoneCall,
  ChevronRight,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  MapPin,
  Building2,
  CheckCircle2,
  ArrowRight,
  Share2,
  Smartphone,
  Monitor,
  RotateCw,
} from 'lucide-react';
import {
  HOTEL_FLOORS,
  HOTEL_DESTINATIONS,
  ROUTE_GROUND_TO_ELEVATOR,
} from '../../components/robot/FloorMap';

export const GuestMapPage = () => {
  // Đọc tham số điểm đến từ URL query ?dest=...
  const [currentDestKey, setCurrentDestKey] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('dest') || 'infinity_pool';
    } catch {
      return 'infinity_pool';
    }
  });

  const currentDest = useMemo(() => {
    return HOTEL_DESTINATIONS[currentDestKey] || HOTEL_DESTINATIONS.infinity_pool;
  }, [currentDestKey]);

  // Trạng thái Chặng hiển thị trên điện thoại:
  // 1: Chặng 1 (Từ Sảnh Trệt đến Thang Máy A)
  // 2: Chặng 2 (Từ Thang Máy đến Điểm đến trên tầng mục tiêu)
  const [activeLeg, setActiveLeg] = useState(() => (currentDest.isDifferentFloor ? 1 : 2));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isIphoneMockup, setIsIphoneMockup] = useState(false);
  const [mockupOrientation, setMockupOrientation] = useState('portrait'); // 'portrait' | 'landscape'

  // Zoom & Pan state cho màn hình điện thoại
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isCopied, setIsCopied] = useState(false);

  // Khi đổi điểm đến -> tự động đặt chặng phù hợp
  useEffect(() => {
    setActiveLeg(currentDest.isDifferentFloor ? 1 : 2);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  }, [currentDest]);

  // Tầng hiển thị tương ứng với chặng đang chọn
  const activeFloor = useMemo(() => {
    if (!currentDest.isDifferentFloor) {
      return HOTEL_FLOORS.find((f) => f.id === currentDest.floorId) || HOTEL_FLOORS[2];
    }
    const targetFloorId = activeLeg === 1 ? '3' : currentDest.floorId;
    return HOTEL_FLOORS.find((f) => f.id === targetFloorId) || HOTEL_FLOORS[2];
  }, [activeLeg, currentDest]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.35, 3.0));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.35, 0.85));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Chỉ đường đến ${currentDest.name} - Aurora Grand Hotel`,
          text: `Sơ đồ chỉ đường 2 chặng đến ${currentDest.name} (${currentDest.floorLevel}).`,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      navigator.clipboard?.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  // Nội dung chính giao diện Bản đồ Mobile (Hỗ trợ cả Dọc và Xoay Ngang Landscape)
  const renderMobileContent = () => (
    <div className="w-full min-h-full bg-[#0C0F17] text-stone-100 flex flex-col font-sans select-none antialiased">
      {/* 1. Header Khách Sạn Cao Cấp */}
      <header className="w-full bg-[#141923]/95 border-b border-stone-800/90 px-3.5 py-2.5 sticky top-0 z-40 backdrop-blur-md shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-900/30">
            <Compass className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <div className="text-[9px] font-black tracking-widest uppercase text-emerald-400">
              Aurora Grand Hotel
            </div>
            <h1 className="text-xs font-extrabold text-white leading-tight">
              Bản Đồ 2 Chặng · {currentDest.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Nút bật/tắt Khung iPhone chỉ hiện trên máy tính Desktop */}
          <button
            onClick={() => setIsIphoneMockup(!isIphoneMockup)}
            className="hidden md:flex p-1.5 px-2.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer items-center gap-1 text-[11px] font-bold"
            title="Đổi chế độ xem khung iPhone"
          >
            {isIphoneMockup ? <Monitor className="w-3.5 h-3.5 text-amber-400" /> : <Smartphone className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isIphoneMockup ? 'Mở Rộng' : 'Khung iPhone'}</span>
          </button>

          <button
            onClick={handleShare}
            className="p-1.5 px-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
            title="Chia sẻ lộ trình"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">{isCopied ? 'Đã sao chép' : 'Chia sẻ'}</span>
          </button>
        </div>
      </header>

      {/* 2. Container Nội Dung: Dọc (Portrait) -> 1 Cột, Xoay Ngang (Landscape) -> 2 Cột Song Song */}
      <main className="w-full max-w-xl landscape:max-w-6xl mx-auto flex-1 px-3 py-2.5 flex flex-col landscape:flex-row landscape:items-stretch gap-3">
        {/* Khung Bản Đồ (Trên mobile xoay ngang: Chiếm trọn bên trái) */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div
            className={`w-full rounded-2xl bg-stone-950 border border-stone-800 overflow-hidden relative shadow-2xl transition-all ${
              isFullscreen
                ? 'fixed inset-0 z-50 rounded-none border-none'
                : 'h-[270px] sm:h-[340px] landscape:h-[calc(100vh-125px)] landscape:min-h-[260px]'
            }`}
          >
            {/* Badge Tầng Hiện Tại Góc Trên Trái */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-stone-950/85 backdrop-blur-md px-2 py-0.5 rounded-lg border border-stone-800 text-[10px] font-bold text-stone-200 shadow-md">
              <Building2 className="w-3 h-3 text-emerald-400" />
              <span>
                {activeLeg === 1 ? 'Sảnh Trệt (Lobby)' : currentDest.floorLevel}
              </span>
            </div>

            {/* Quick Zoom Controls Góc Phải Trên */}
            <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5 bg-stone-950/85 backdrop-blur-md p-0.5 rounded-lg border border-stone-800 shadow-md">
              <button
                onClick={handleZoomIn}
                className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center text-[10px] font-bold cursor-pointer"
                title="Phóng to"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={handleZoomOut}
                className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center text-[10px] font-bold cursor-pointer"
                title="Thu nhỏ"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                onClick={handleResetZoom}
                className="w-6 h-6 rounded hover:bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center text-[10px] cursor-pointer"
                title="Khôi phục"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="w-6 h-6 rounded hover:bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center text-[10px] cursor-pointer ml-0.5"
                title="Toàn màn hình"
              >
                {isFullscreen ? <Minimize2 className="w-3 h-3 text-amber-400" /> : <Maximize2 className="w-3 h-3 text-stone-300" />}
              </button>
            </div>

            {/* Map Layer Zoomable Container */}
            <div
              className="w-full h-full relative transition-transform duration-150"
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
              }}
            >
              {/* Ảnh Mặt Bằng Tầng */}
              <img
                src={activeFloor.image}
                alt={activeFloor.name}
                className="w-full h-full object-contain pointer-events-none select-none"
              />

              {/* Lớp SVG Chỉ Đường Động Đúng Tọa Độ 1920 x 1080 */}
              <svg
                viewBox="0 0 1920 1080"
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <filter id="guest-neon-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#10B981" floodOpacity="0.8" />
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#34D399" floodOpacity="0.9" />
                  </filter>
                  <filter id="guest-amber-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#F59E0B" floodOpacity="0.8" />
                  </filter>
                </defs>

                {/* CHẶNG 1: TẦNG TRỆT (LOBBY -> THANG MÁY A) */}
                {activeLeg === 1 && (
                  <g>
                    <path
                      d={ROUTE_GROUND_TO_ELEVATOR}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.3"
                      filter="url(#guest-neon-glow)"
                    />
                    <path
                      d={ROUTE_GROUND_TO_ELEVATOR}
                      fill="none"
                      stroke="#059669"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="18 14"
                      className="animate-routeDash"
                    />

                    {/* Chấm Bạn Đang Ở Đây tại Lobby */}
                    <g transform="translate(796, 545)">
                      <circle r="36" fill="#10B981" opacity="0.25" className="animate-ping" />
                      <circle r="20" fill="#10B981" opacity="0.4" />
                      <circle r="14" fill="#059669" stroke="#ffffff" strokeWidth="4" />
                      <rect x="-85" y="-56" width="170" height="32" rx="16" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
                      <text x="0" y="-35" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">
                        BẠN ĐANG Ở ĐÂY
                      </text>
                    </g>

                    {/* Vị trí Thang Máy A */}
                    <g transform="translate(1249, 400)">
                      <circle r="30" fill="#F59E0B" opacity="0.25" className="animate-ping" />
                      <circle r="18" fill="#F59E0B" stroke="#ffffff" strokeWidth="4" filter="url(#guest-amber-glow)" />
                      <text x="0" y="5" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold">
                        🛗
                      </text>
                      <rect x="-95" y="-54" width="190" height="32" rx="16" fill="#0f172a" stroke="#F59E0B" strokeWidth="2" />
                      <text x="0" y="-33" textAnchor="middle" fill="#FDE68A" fontSize="13" fontWeight="bold">
                        THANG MÁY LÊN {currentDest.floorLevel}
                      </text>
                    </g>
                  </g>
                )}

                {/* CHẶNG 2: TẦNG ĐÍCH (THANG MÁY -> ĐIỂM ĐẾN) */}
                {activeLeg === 2 && (
                  <g>
                    <path
                      d={currentDest.routeTarget}
                      fill="none"
                      stroke="#06B6D4"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.3"
                      filter="url(#guest-neon-glow)"
                    />
                    <path
                      d={currentDest.routeTarget}
                      fill="none"
                      stroke="#0284C7"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="18 14"
                      className="animate-routeDash"
                    />

                    {/* Vị trí xuất phát chặng 2 */}
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

                    {/* Ghim đích đến Google Maps */}
                    <g transform={`translate(${currentDest.coords.x}, ${currentDest.coords.y})`}>
                      <circle r="32" fill="#ef4444" opacity="0.2" className="animate-ping" />
                      <path
                        d="M 0 0 C -16 -16, -24 -36, -24 -52 C -24 -72, -10 -84, 0 -84 C 10 -84, 24 -72, 24 -52 C 24 -36, 16 -16, 0 0 Z"
                        fill="#dc2626"
                        stroke="#ffffff"
                        strokeWidth="3.5"
                      />
                      <circle cx="0" cy="-54" r="10" fill="#ffffff" />
                      <rect x="-105" y="-124" width="210" height="34" rx="17" fill="#0f172a" stroke="#ef4444" strokeWidth="2.5" />
                      <text x="0" y="-102" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="extrabold">
                        {currentDest.name}
                      </text>
                    </g>
                  </g>
                )}
              </svg>
            </div>
          </div>
        </div>

        {/* Cột Chi Tiết Chỉ Dẫn & Nút Bấm: Xoay ngang thành cột bên phải cuộn được */}
        <div className="w-full landscape:w-[340px] landscape:max-h-[calc(100vh-110px)] landscape:overflow-y-auto flex flex-col gap-2.5">
          {/* Destination Card Info */}
          <div className="w-full p-3 rounded-2xl bg-gradient-to-r from-stone-900 via-[#18202F] to-stone-900 border border-emerald-500/25 shadow-xl flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl p-1.5 rounded-xl bg-stone-800/90 border border-stone-700/80 shrink-0">
                  {currentDest.icon || '📍'}
                </span>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold uppercase text-emerald-400 tracking-wider">
                    {currentDest.category || 'Tiện ích'}
                  </span>
                  <h2 className="text-sm font-extrabold text-white truncate leading-tight">
                    {currentDest.name}
                  </h2>
                </div>
              </div>

              <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-[10px] shrink-0 uppercase tracking-wide">
                {currentDest.floorLevel}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1.5 border-t border-stone-800/80 text-[10px] text-stone-300 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{currentDest.time || '2 Phút'}</span>
              </span>
              <span className="text-stone-600">•</span>
              <span className="flex items-center gap-1">
                <Footprints className="w-3 h-3 text-emerald-400" />
                <span>{currentDest.distance || '90m'}</span>
              </span>
              <span className="text-stone-600">•</span>
              <span className="text-stone-400 truncate">
                {activeFloor.name}
              </span>
            </div>
          </div>

          {/* 3. Chuyển Chặng (2 Segmented Tabs) */}
          {currentDest.isDifferentFloor && (
            <div className="w-full grid grid-cols-2 p-1 bg-stone-900 rounded-2xl border border-stone-800 shadow-inner">
              <button
                onClick={() => setActiveLeg(1)}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeLeg === 1
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-black/25 flex items-center justify-center text-[9px] font-black">
                  1
                </span>
                <span className="truncate">Chặng 1: Thang Máy</span>
              </button>

              <button
                onClick={() => setActiveLeg(2)}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeLeg === 2
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-black/25 flex items-center justify-center text-[9px] font-black">
                  2
                </span>
                <span className="truncate">Chặng 2: Đến Nơi</span>
              </button>
            </div>
          )}

          {/* Thẻ Hướng Dẫn Chi Tiết Chặng Đang Xem */}
          <div className="w-full p-3 rounded-2xl bg-stone-900 border border-stone-800 shadow-lg flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center border border-emerald-500/40">
                  {activeLeg}
                </span>
                <span className="text-[11px] font-bold text-stone-200">
                  {activeLeg === 1 ? 'Chặng 1: Từ Sảnh Trệt' : `Chặng 2: Tại ${currentDest.floorLevel}`}
                </span>
              </div>

              {currentDest.isDifferentFloor && (
                <button
                  onClick={() => setActiveLeg(activeLeg === 1 ? 2 : 1)}
                  className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>{activeLeg === 1 ? 'Chặng 2' : 'Chặng 1'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <p className="text-xs font-semibold text-stone-100 leading-relaxed">
              {activeLeg === 1
                ? currentDest.step1Text || 'Từ quầy tiếp tân, đi thẳng theo sảnh chính tới Thang máy A.'
                : currentDest.step2Text || `Ra khỏi thang máy, đi theo biển chỉ dẫn tới ${currentDest.name}.`}
            </p>

            <div className="p-2 rounded-xl bg-stone-800/60 border border-stone-700/60 flex items-start gap-1.5 text-[10px] text-stone-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-normal">
                <span className="font-bold text-amber-300">Mẹo: </span>
                {activeLeg === 1
                  ? 'Thang máy A cạnh cầu thang bộ. Bấm số tầng trên bảng trong thang.'
                  : 'Nếu cần hỗ trợ, bạn có thể gọi phím 0 gặp Lễ tân bất cứ lúc nào.'}
              </div>
            </div>
          </div>

          {/* Quick Switcher Các Điểm Khác */}
          <div className="w-full flex flex-col gap-1 pt-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 px-1">
              Chuyển nhanh điểm khác
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {Object.values(HOTEL_DESTINATIONS).map((dest) => {
                const isSelected = dest.id === currentDest.id;
                return (
                  <button
                    key={dest.id}
                    onClick={() => {
                      setCurrentDestKey(dest.id);
                      window.history.replaceState(null, '', `?view=guest_map&dest=${dest.id}`);
                    }}
                    className={`px-2 py-1 rounded-xl text-[10px] font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-md'
                        : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-white hover:bg-stone-800'
                    }`}
                  >
                    <span>{dest.icon}</span>
                    <span>{dest.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* 3. Footer Hỗ Trợ 24/7 Bấm Gọi Nhanh */}
      <footer className="w-full bg-[#141923] border-t border-stone-800 px-3.5 py-2 sticky bottom-0 z-30 flex items-center justify-between max-w-xl landscape:max-w-6xl mx-auto">
        <div className="flex flex-col">
          <span className="text-[9px] text-stone-400 font-bold uppercase">Tổng đài hỗ trợ</span>
          <span className="text-xs font-extrabold text-white">Lễ Tân Khách Sạn (Phím 0)</span>
        </div>

        <a
          href="tel:02438886666"
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Gọi Lễ Tân</span>
        </a>
      </footer>
    </div>
  );

  // Nếu đang bật Khung Mô Phỏng iPhone trên Desktop (Hỗ trợ cả Dọc và Xoay Ngang)
  if (isIphoneMockup) {
    const isLandscape = mockupOrientation === 'landscape';

    return (
      <div className="w-full min-h-screen bg-[#07090E] flex flex-col items-center justify-center py-5 px-3">
        {/* Thanh công cụ desktop bên ngoài khung điện thoại */}
        <div className="mb-3 flex items-center gap-3 bg-stone-900/90 border border-stone-800 px-3.5 py-2 rounded-2xl shadow-xl">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-stone-200">
              Giả lập iPhone 15 Pro ({isLandscape ? '852 × 393 px (Ngang)' : '393 × 852 px (Dọc)'})
            </span>
          </div>

          <div className="w-[1px] h-4 bg-stone-700" />

          {/* Nút Xoay Ngang / Dọc Trực Tiếp */}
          <button
            onClick={() => setMockupOrientation(isLandscape ? 'portrait' : 'landscape')}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            title="Xoay ngang / dọc điện thoại"
          >
            <RotateCw className="w-3.5 h-3.5 animate-spin-slow" />
            <span>{isLandscape ? 'Xoay Đứng' : 'Xoay Ngang'}</span>
          </button>

          <button
            onClick={() => setIsIphoneMockup(false)}
            className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-bold transition cursor-pointer flex items-center gap-1"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Toàn màn hình</span>
          </button>
        </div>

        {/* Khung iPhone 15 Pro Titanium Sang Trọng (Co giãn theo orientation) */}
        <div
          className={`bg-black p-3 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.95)] border-[10px] border-[#2A2B2E] ring-2 ring-stone-700/60 relative flex flex-col overflow-hidden transition-all duration-300 ${
            isLandscape
              ? 'w-[852px] max-w-[95vw] h-[393px] max-h-[85vh] rounded-[46px]'
              : 'w-[393px] max-w-[95vw] h-[852px] max-h-[90vh] rounded-[54px]'
          }`}
        >
          {/* Dynamic Island Pill */}
          <div
            className={`absolute bg-black rounded-full z-50 flex items-center justify-between px-2.5 border border-stone-900 shadow-inner ${
              isLandscape
                ? 'top-1/2 left-3.5 -translate-y-1/2 w-7 h-24 flex-col py-2'
                : 'top-3.5 left-1/2 -translate-x-1/2 w-28 h-6'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-[#0a0a0a]" />
            <div className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
          </div>

          {/* Màn hình nội dung bên trong iPhone */}
          <div className="flex-1 overflow-y-auto rounded-[38px] custom-scrollbar bg-[#0C0F17]">
            {renderMobileContent()}
          </div>
        </div>
      </div>
    );
  }

  // Mặc định: Hiển thị responsive toàn màn hình (Mobile first)
  return renderMobileContent();
};
