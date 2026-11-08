import React, { useState, useMemo, useEffect } from 'react';
import {
  Compass,
  Clock,
  Footprints,
  PhoneCall,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  MapPin,
  Building2,
  Check,
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
import { calculateFloorRoute } from '../../services/indoorNavigation/indoorPathfinder';

const DESTINATION_ALIASES = {
  luxury_spa: 'spa',
  sky_bar: 'bar',
  pool: 'infinity_pool',
  wc: 'restroom_ground',
  toilet: 'restroom_ground',
  lobby: 'front_desk',
  reception: 'front_desk',
};

const resolveKnownDestKey = (rawKey) => {
  if (!rawKey || typeof rawKey !== 'string') return null;
  const trimmed = rawKey.trim();
  const mapped = DESTINATION_ALIASES[trimmed] || trimmed;
  return HOTEL_DESTINATIONS[mapped] ? mapped : null;
};

const normalizeDestKey = (rawKey) => {
  return resolveKnownDestKey(rawKey) || 'infinity_pool';
};

export const parseGuestMapParams = (searchStr = '') => {
  let destKey = 'infinity_pool';
  let expiresAt = Date.now() + 15 * 60 * 1000;
  let ticketId = '';

  try {
    const params = new URLSearchParams(searchStr);
    const tokenParam = params.get('t') || params.get('token');
    const destParam = params.get('dest');

    if (tokenParam) {
      try {
        let b64 = tokenParam.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const parsed = JSON.parse(atob(b64));
        const resolvedFromToken = resolveKnownDestKey(parsed.d);
        if (resolvedFromToken) {
          destKey = resolvedFromToken;
        } else if (destParam) {
          destKey = normalizeDestKey(destParam);
        }
        if (parsed.e && !Number.isNaN(Number(parsed.e))) expiresAt = Number(parsed.e);
        if (parsed.n) ticketId = String(parsed.n);
      } catch {
        // Fallback nếu token có định dạng destKey_expiresAt hoặc lấy từ ?dest=
        let recovered = false;
        if (tokenParam.includes('_')) {
          const parts = tokenParam.split('_');
          const maybeExpire = Number(parts[parts.length - 1]);
          const maybeDest = resolveKnownDestKey(parts.slice(0, -1).join('_'));
          if (maybeDest && !Number.isNaN(maybeExpire) && maybeExpire > 1000000000000) {
            destKey = maybeDest;
            expiresAt = maybeExpire;
            recovered = true;
          }
        }
        if (!recovered && destParam) {
          destKey = normalizeDestKey(destParam);
        }
      }
    } else if (destParam) {
      destKey = normalizeDestKey(destParam);
    }
  } catch {
    destKey = 'infinity_pool';
  }

  return { destKey, expiresAt, ticketId };
};

export const GuestMapPage = () => {
  const initialTicket = useMemo(() => {
    let rawSearch = '';
    try {
      if (typeof window !== 'undefined') {
        rawSearch = window.location.search || sessionStorage.getItem('aurora_qr_search') || '';
      }
    } catch {
      rawSearch = '';
    }
    return parseGuestMapParams(rawSearch);
  }, []);

  const [currentDestKey, setCurrentDestKey] = useState(initialTicket.destKey);
  const [expiresAt] = useState(initialTicket.expiresAt);
  const [ticketId] = useState(initialTicket.ticketId);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.floor((initialTicket.expiresAt - Date.now()) / 1000))
  );
  const [isManualDismissed, setIsManualDismissed] = useState(() => {
    try {
      return Boolean(
        initialTicket.ticketId &&
          localStorage.getItem(`aurora_finished_ticket_${initialTicket.ticketId}`)
      );
    } catch {
      return false;
    }
  });

  const currentDest = useMemo(() => {
    return HOTEL_DESTINATIONS[currentDestKey] || HOTEL_DESTINATIONS.infinity_pool;
  }, [currentDestKey]);

  // 1: Chặng 1 (Từ Sảnh Trệt đến Thang Máy A)
  // 2: Chặng 2 (Từ Thang Máy đến Điểm đến trên tầng mục tiêu)
  const [activeLeg, setActiveLeg] = useState(() => (currentDest.isDifferentFloor ? 1 : 2));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isIphoneMockup, setIsIphoneMockup] = useState(false);
  const [mockupOrientation, setMockupOrientation] = useState('portrait');

  // Zoom & Pan state cho màn hình điện thoại
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isCopied, setIsCopied] = useState(false);

  // Đếm ngược thời hạn vé 15 phút
  useEffect(() => {
    const timer = setInterval(() => {
      const secs = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(secs);
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

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

  // Tính toán đường đi chuẩn qua cửa
  const activeRoutePath = useMemo(() => {
    if (activeLeg === 1) {
      const leg1 = calculateFloorRoute({
        floorId: '3',
        start: { x: 350, y: 580 },
        end: { x: 1715, y: 560 },
      });
      return leg1.valid && leg1.pathString ? leg1.pathString : ROUTE_GROUND_TO_ELEVATOR;
    }

    if (currentDest.routeTarget) {
      return currentDest.routeTarget;
    }

    const startPt = currentDest.isDifferentFloor ? { x: 1715, y: 560 } : { x: 350, y: 580 };
    const leg2 = calculateFloorRoute({
      floorId: currentDest.floorId,
      start: startPt,
      end: currentDest.coords,
      targetRoomId: currentDest.id,
    });
    return leg2.valid && leg2.pathString ? leg2.pathString : currentDest.routeTarget;
  }, [activeLeg, currentDest]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.35, 3.0));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.35, 0.85));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFinishTicket = () => {
    try {
      if (ticketId) {
        localStorage.setItem(`aurora_finished_ticket_${ticketId}`, '1');
      }
    } catch {
      // ignore storage error
    }
    setIsManualDismissed(true);
  };

  const handleReopenTicket = () => {
    try {
      if (ticketId) {
        localStorage.removeItem(`aurora_finished_ticket_${ticketId}`);
      }
    } catch {
      // ignore storage error
    }
    setIsManualDismissed(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Chỉ đường đến ${currentDest.name} - Aurora Grand Hotel`,
          text: `Sơ đồ chỉ đường 2 chặng đến ${currentDest.name} (${currentDest.floorLevel}).`,
          url: window.location.href,
        });
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard?.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const formattedRemaining = useMemo(() => {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    return `Còn ${m}:${s < 10 ? '0' : ''}${s}`;
  }, [remainingSeconds]);

  const isExpired = remainingSeconds <= 0;

  // Nội dung chính giao diện Bản đồ Mobile (Trắng sữa & Đen đồng bộ 100% với Web & map.html)
  const renderMobileContent = () => (
    <div className="w-full min-h-screen bg-[#FAF8F5] text-[#1C1917] flex flex-col font-sans select-none antialiased">
      {/* 1. Header Khách Sạn Trắng Sữa & Đen */}
      <header className="w-full bg-[#FAF8F5]/95 border-b border-[#E3DFD5] px-3.5 py-2.5 sticky top-0 z-40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#1C1917] flex items-center justify-center text-[#FAF8F5] shadow-sm shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#78716C]">
              Aurora Grand Hotel
            </div>
            <h1 className="text-xs sm:text-sm font-extrabold text-[#1C1917] truncate leading-tight">
              {currentDest.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFECE6] border border-[#E3DFD5] text-[11px] font-bold text-[#1C1917]">
            <span className="w-2 h-2 rounded-full bg-[#1C1917] animate-pulse" />
            <span>{formattedRemaining}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsIphoneMockup(!isIphoneMockup)}
            className="hidden md:flex p-1.5 px-2.5 rounded-xl bg-[#EFECE6] hover:bg-[#E3DFD5] text-[#1C1917] border border-[#E3DFD5] transition cursor-pointer items-center gap-1 text-[11px] font-bold"
            title="Đổi chế độ xem khung iPhone"
          >
            {isIphoneMockup ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
            <span>{isIphoneMockup ? 'Mở Rộng' : 'Khung iPhone'}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="p-1.5 px-2 rounded-xl bg-[#EFECE6] hover:bg-[#E3DFD5] text-[#1C1917] border border-[#E3DFD5] transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
            title="Chia sẻ lộ trình"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isCopied ? 'Đã sao chép' : 'Chia sẻ'}</span>
          </button>
        </div>
      </header>

      {/* Màn hình khi khách bấm đóng hoặc vé hết hạn (Có nút Alternative Flow mở lại ngay nếu lỡ tay bấm) */}
      {(isExpired || isManualDismissed) ? (
        <main className="flex-1 flex items-center justify-center p-5 bg-[#FAF8F5]">
          <div className="bg-white border border-[#E3DFD5] rounded-3xl p-6 max-w-sm w-full text-center shadow-lg flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[#EFECE6] border border-[#E3DFD5] flex items-center justify-center text-[#1C1917]">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-base font-extrabold text-[#1C1917]">
              {isManualDismissed && !isExpired ? 'Đã Đóng Chỉ Dẫn Đường Đi' : 'Chỉ Dẫn Đã Hết Hạn'}
            </h2>
            <p className="text-xs text-[#78716C] leading-relaxed">
              {isManualDismissed && !isExpired
                ? `Bạn đã xác nhận nhớ lộ trình tới ${currentDest.name}. Nếu cần xem lại bản đồ ngay lúc này, bạn có thể mở lại bên dưới.`
                : 'Vé chỉ đường này có hiệu lực 15 phút để đảm bảo an ninh và riêng tư. Quý khách vui lòng quét lại mã trên Robot Concierge Rora tại sảnh khách sạn.'}
            </p>
            {!isExpired && isManualDismissed && (
              <button
                type="button"
                onClick={handleReopenTicket}
                className="mt-2 w-full py-2.5 px-4 rounded-xl bg-[#1C1917] text-[#FAF8F5] text-xs font-bold shadow-sm active:scale-95 transition cursor-pointer"
              >
                Xem lại bản đồ chỉ dẫn
              </button>
            )}
          </div>
        </main>
      ) : (
        /* 2. Container Nội Dung Chính */
        <main className="w-full max-w-xl landscape:max-w-6xl mx-auto flex-1 px-3 py-2.5 flex flex-col landscape:flex-row landscape:items-stretch gap-3">
          {/* Cột Bản Đồ */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {/* Chuyển Chặng (2 Segmented Tabs) */}
            {currentDest.isDifferentFloor && (
              <div className="w-full grid grid-cols-2 p-1 bg-[#EFECE6] rounded-2xl border border-[#E3DFD5]">
                <button
                  type="button"
                  onClick={() => setActiveLeg(1)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeLeg === 1
                      ? 'bg-[#1C1917] text-[#FAF8F5] shadow-sm'
                      : 'text-[#78716C] hover:text-[#1C1917]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                      activeLeg === 1 ? 'bg-white/20 text-white' : 'bg-black/10 text-[#57534E]'
                    }`}
                  >
                    1
                  </span>
                  <span className="truncate">Chặng 1: Sảnh → Thang máy</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLeg(2)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeLeg === 2
                      ? 'bg-[#1C1917] text-[#FAF8F5] shadow-sm'
                      : 'text-[#78716C] hover:text-[#1C1917]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                      activeLeg === 2 ? 'bg-white/20 text-white' : 'bg-black/10 text-[#57534E]'
                    }`}
                  >
                    2
                  </span>
                  <span className="truncate">Chặng 2: Ra {currentDest.floorLevel}</span>
                </button>
              </div>
            )}

            {/* Khung Bản Đồ */}
            <div
              className={`w-full rounded-2xl bg-[#F5F2EB] border border-[#E3DFD5] overflow-hidden relative shadow-sm transition-all ${
                isFullscreen
                  ? 'fixed inset-0 z-50 rounded-none border-none'
                  : 'h-[280px] sm:h-[350px] landscape:h-[calc(100vh-125px)] landscape:min-h-[260px]'
              }`}
            >
              {/* Badge Tầng Hiện Tại Góc Trên Trái */}
              <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 bg-white/92 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#E3DFD5] text-[10px] font-extrabold text-[#1C1917] shadow-xs uppercase tracking-wide">
                <Building2 className="w-3 h-3 text-[#1C1917]" />
                <span>
                  {activeLeg === 1 ? 'TẦNG TRỆT · SẢNH & TIẾP TÂN' : `${currentDest.floorLevel} · ${currentDest.name}`}
                </span>
              </div>

              {/* Quick Zoom Controls Góc Phải Trên */}
              <div className="absolute top-2.5 right-2.5 z-20 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="w-8 h-8 rounded-lg bg-white/92 hover:bg-[#EFECE6] text-[#1C1917] border border-[#E3DFD5] shadow-xs flex items-center justify-center cursor-pointer"
                  title="Phóng to"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="w-8 h-8 rounded-lg bg-white/92 hover:bg-[#EFECE6] text-[#1C1917] border border-[#E3DFD5] shadow-xs flex items-center justify-center cursor-pointer"
                  title="Thu nhỏ"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="w-8 h-8 rounded-lg bg-white/92 hover:bg-[#EFECE6] text-[#1C1917] border border-[#E3DFD5] shadow-xs flex items-center justify-center cursor-pointer"
                  title="Khôi phục"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="w-8 h-8 rounded-lg bg-white/92 hover:bg-[#EFECE6] text-[#1C1917] border border-[#E3DFD5] shadow-xs flex items-center justify-center cursor-pointer"
                  title="Toàn màn hình"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Map Layer Zoomable Container */}
              <div
                className="w-full h-full relative transition-transform duration-150 p-1.5"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  key={activeFloor.image}
                  src={activeFloor.image}
                  alt={activeFloor.name}
                  className="w-full h-full object-contain pointer-events-none select-none rounded-lg"
                />

                <svg
                  viewBox="0 0 1840 1174"
                  className="absolute inset-0 w-full h-full pointer-events-none z-10 p-1.5"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <filter id="guest-sky-glow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#38BDF8" floodOpacity="0.5" />
                      <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7DD3FC" floodOpacity="0.7" />
                    </filter>
                  </defs>

                  {activeLeg === 1 && (
                    <g>
                      <path
                        d={activeRoutePath}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="14"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.35"
                        filter="url(#guest-sky-glow)"
                      />
                      <path
                        d={activeRoutePath}
                        fill="none"
                        stroke="#0EA5E9"
                        strokeWidth="6.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="12 8"
                        className="animate-routeDash"
                      />
                      <circle cx="350" cy="580" r="14" fill="#1C1917" stroke="#FFFFFF" strokeWidth="3.5" />
                      <circle cx="1715" cy="560" r="14" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="3.5" />
                    </g>
                  )}

                  {activeLeg === 2 && (
                    <g>
                      <path
                        d={activeRoutePath}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="14"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.35"
                        filter="url(#guest-sky-glow)"
                      />
                      <path
                        d={activeRoutePath}
                        fill="none"
                        stroke="#0EA5E9"
                        strokeWidth="6.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="12 8"
                        className="animate-routeDash"
                      />
                      {currentDest.isDifferentFloor ? (
                        <circle cx="1715" cy="560" r="14" fill="#1C1917" stroke="#FFFFFF" strokeWidth="3.5" />
                      ) : (
                        <circle cx="350" cy="580" r="14" fill="#1C1917" stroke="#FFFFFF" strokeWidth="3.5" />
                      )}
                      <circle
                        cx={currentDest.coords.x}
                        cy={currentDest.coords.y}
                        r="14"
                        fill="#0EA5E9"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                      />
                    </g>
                  )}
                </svg>
              </div>
            </div>
          </div>

          {/* Cột Chi Tiết Chỉ Dẫn & Nút Bấm */}
          <div className="w-full landscape:w-[340px] landscape:max-h-[calc(100vh-110px)] landscape:overflow-y-auto flex flex-col gap-2.5">
            {/* Thẻ Hướng Dẫn Chi Tiết Chặng Đang Xem */}
            <div className="w-full p-3.5 rounded-2xl bg-white border border-[#E3DFD5] shadow-xs flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#78716C]">
                  Lộ trình chi tiết
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-[#EFECE6] border border-[#E3DFD5] text-[#1C1917] font-extrabold text-[10px] uppercase tracking-wide">
                  {currentDest.floorLevel}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E3DFD5] flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#1C1917] text-[#FAF8F5] font-extrabold text-xs flex items-center justify-center shrink-0">
                  {activeLeg}
                </div>
                <p className="text-xs font-medium text-[#1C1917] leading-relaxed">
                  {activeLeg === 1
                    ? currentDest.step1Text || 'Đi từ sảnh Lobby đến Thang máy A và bấm lên tầng mục tiêu.'
                    : currentDest.step2Text || `Ra khỏi thang máy, đi theo biển chỉ dẫn tới ${currentDest.name}.`}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-[#78716C] font-medium">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#1C1917]" />
                    <span>{currentDest.time || '2 Phút'}</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Footprints className="w-3.5 h-3.5 text-[#1C1917]" />
                    <span>{currentDest.distance || '90m'}</span>
                  </span>
                </div>

                {currentDest.isDifferentFloor && (
                  <button
                    type="button"
                    onClick={() => setActiveLeg(activeLeg === 1 ? 2 : 1)}
                    className="text-[11px] font-bold text-[#1C1917] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{activeLeg === 1 ? 'Xem Chặng 2' : 'Xem Chặng 1'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Switcher Các Điểm Khác */}
            <div className="w-full flex flex-col gap-1 pt-0.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] px-1">
                Chuyển nhanh điểm khác
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                {Object.values(HOTEL_DESTINATIONS).map((dest) => {
                  const isSelected = dest.id === currentDest.id;
                  return (
                    <button
                      type="button"
                      key={dest.id}
                      onClick={() => {
                        setCurrentDestKey(dest.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer border ${
                        isSelected
                          ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917] shadow-xs'
                          : 'bg-white text-[#57534E] border-[#E3DFD5] hover:text-[#1C1917] hover:bg-[#EFECE6]'
                      }`}
                    >
                      <span>{dest.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* 3. Footer Đóng Chỉ Dẫn / Gọi Lễ Tân */}
      {!isExpired && !isManualDismissed && (
        <footer className="w-full bg-[#FAF8F5] border-t border-[#E3DFD5] px-3.5 py-2.5 sticky bottom-0 z-30 flex items-center gap-2 max-w-xl landscape:max-w-6xl mx-auto">
          <button
            type="button"
            onClick={handleFinishTicket}
            className="flex-1 py-3 px-4 rounded-xl bg-[#1C1917] hover:bg-stone-800 text-[#FAF8F5] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm active:scale-98 transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Tôi đã nhớ đường · Đóng chỉ dẫn</span>
          </button>

          <a
            href="tel:02438886666"
            className="py-3 px-3.5 rounded-xl bg-[#EFECE6] hover:bg-[#E3DFD5] text-[#1C1917] border border-[#E3DFD5] text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 active:scale-95 transition cursor-pointer"
            title="Gọi Lễ Tân"
          >
            <PhoneCall className="w-4 h-4" />
            <span className="hidden sm:inline">Lễ Tân</span>
          </a>
        </footer>
      )}
    </div>
  );

  if (isIphoneMockup) {
    const isLandscape = mockupOrientation === 'landscape';

    return (
      <div className="w-full min-h-screen bg-[#EFECE6] flex flex-col items-center justify-center py-5 px-3">
        <div className="mb-3 flex items-center gap-3 bg-white border border-[#E3DFD5] px-3.5 py-2 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1C1917]" />
            <span className="text-xs font-bold text-[#1C1917]">
              Khung Điện Thoại ({isLandscape ? '852 × 393 px' : '393 × 852 px'})
            </span>
          </div>

          <div className="w-[1px] h-4 bg-[#E3DFD5]" />

          <button
            type="button"
            onClick={() => setMockupOrientation(isLandscape ? 'portrait' : 'landscape')}
            className="px-2.5 py-1 rounded-lg bg-[#EFECE6] hover:bg-[#E3DFD5] text-[#1C1917] border border-[#E3DFD5] text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>{isLandscape ? 'Xoay Đứng' : 'Xoay Ngang'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsIphoneMockup(false)}
            className="px-2.5 py-1 rounded-lg bg-[#1C1917] text-[#FAF8F5] text-xs font-bold transition cursor-pointer flex items-center gap-1"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Toàn màn hình</span>
          </button>
        </div>

        <div
          className={`bg-[#1C1917] p-3 shadow-2xl border-[8px] border-[#2A2B2E] relative flex flex-col overflow-hidden transition-all duration-300 ${
            isLandscape
              ? 'w-[852px] max-w-[95vw] h-[393px] max-h-[85vh] rounded-[46px]'
              : 'w-[393px] max-w-[95vw] h-[852px] max-h-[90vh] rounded-[54px]'
          }`}
        >
          <div className="flex-1 overflow-y-auto rounded-[38px] custom-scrollbar bg-[#FAF8F5]">
            {renderMobileContent()}
          </div>
        </div>
      </div>
    );
  }

  return renderMobileContent();
};
