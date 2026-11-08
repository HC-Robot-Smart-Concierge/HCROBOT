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

export const computeOrthogonalHeadingAngle = (startPt, endPt) => {
  const dx = endPt.x - startPt.x;
  const dy = endPt.y - startPt.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? -90 : 90;
  }
  return dy <= 0 ? 0 : 180;
};

export const computeSmartRouteFrame = (pathStr, startPt, endPt, mode = 'focus25d') => {
  const nums = (String(pathStr || '').match(/-?\d+(\.\d+)?/g) || []).map(Number);
  let minX = Math.min(startPt.x, endPt.x);
  let maxX = Math.max(startPt.x, endPt.x);
  let minY = Math.min(startPt.y, endPt.y);
  let maxY = Math.max(startPt.y, endPt.y);

  for (let i = 0; i < nums.length - 1; i += 2) {
    const px = nums[i];
    const py = nums[i + 1];
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  const midX = Math.round((minX + maxX) / 2);
  const midY = Math.round((minY + maxY) / 2);
  const spanW = Math.max(420, maxX - minX);
  const spanH = Math.max(360, maxY - minY);

  const isHeading = mode === 'heading';
  const rotZ = isHeading ? computeOrthogonalHeadingAngle(startPt, endPt) : 0;
  const isRotated90 = Math.abs(rotZ) === 90;
  const effSpanW = isRotated90 ? spanH : spanW;
  const effSpanH = isRotated90 ? spanW : spanH;

  const baseW = Math.max(1050, Math.min(1840, effSpanW + 560));
  const baseH = Math.max(950, Math.min(1650, effSpanH + 580));

  const normOffsetX = (920 - midX) / 1840;
  const normOffsetY = (587 - midY) / 1174;

  if (mode === 'flat2d') {
    return {
      midX,
      midY,
      baseW,
      baseH,
      zoom: 1.05,
      panX: Math.round(normOffsetX * 70),
      panY: Math.round(normOffsetY * 45),
      tiltX: 0,
      rotZ: 0,
    };
  }

  const spanRatio = Math.max(effSpanW / 1840, effSpanH / 1174);
  const smartZoom = Number(Math.min(1.52, Math.max(1.22, 1.56 - spanRatio * 0.42)).toFixed(2));
  const panX = Math.max(-95, Math.min(95, Math.round(normOffsetX * 220)));
  const panY = Math.max(-65, Math.min(65, Math.round(normOffsetY * 145)));

  if (isHeading) {
    return {
      midX,
      midY,
      baseW,
      baseH,
      zoom: Number(Math.min(1.42, smartZoom).toFixed(2)),
      panX: Math.round(panX * 0.6),
      panY: Math.round(panY * 0.6),
      tiltX: 20,
      rotZ,
    };
  }

  return {
    midX,
    midY,
    baseW,
    baseH,
    zoom: smartZoom,
    panX,
    panY,
    tiltX: 20,
    rotZ: 0,
  };
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

  // Trạng thái Camera chuẩn Google Maps:
  // - isHeadingUp: Xoay bản đồ theo bội số vuông góc 90° gần nhất (0, 90, -90, 180) để không bao giờ méo tường
  // - is3D: Bật/tắt góc nghiêng 3D nhẹ (20°) tách biệt ở lớp stage ngoài
  const [isHeadingUp, setIsHeadingUp] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [userZoom, setUserZoom] = useState(1.0);
  const [panSvg, setPanSvg] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState(null);

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
  }, [currentDest]);

  // Tầng hiển thị tương ứng với chặng đang chọn
  const activeFloor = useMemo(() => {
    if (!currentDest.isDifferentFloor) {
      return HOTEL_FLOORS.find((f) => f.id === currentDest.floorId) || HOTEL_FLOORS[2];
    }
    const targetFloorId = activeLeg === 1 ? '3' : currentDest.floorId;
    return HOTEL_FLOORS.find((f) => f.id === targetFloorId) || HOTEL_FLOORS[2];
  }, [activeLeg, currentDest]);

  // Tọa độ đầu & cuối của chặng đang hiển thị
  const activeEndpoints = useMemo(() => {
    if (activeLeg === 1) {
      return {
        start: { x: 350, y: 580, label: 'BẠN Ở ĐÂY' },
        end: { x: 1715, y: 560, label: 'THANG MÁY A' },
      };
    }
    return {
      start: currentDest.isDifferentFloor
        ? { x: 1715, y: 560, label: 'RA THANG MÁY' }
        : { x: 350, y: 580, label: 'BẠN Ở ĐÂY' },
      end: {
        x: currentDest.coords.x,
        y: currentDest.coords.y,
        label: (currentDest.name || 'ĐÍCH ĐẾN').toUpperCase().slice(0, 16),
      },
    };
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

  const currentFrame = useMemo(() => {
    return computeSmartRouteFrame(
      activeRoutePath,
      activeEndpoints.start,
      activeEndpoints.end,
      isHeadingUp ? 'heading' : 'focus25d'
    );
  }, [activeRoutePath, activeEndpoints, isHeadingUp]);

  // Khi chuyển chặng hoặc đổi điểm đến -> reset zoom & pan về chính giữa lộ trình
  useEffect(() => {
    setUserZoom(1.0);
    setPanSvg({ x: 0, y: 0 });
  }, [activeLeg, currentDest, isHeadingUp]);

  const handleZoomIn = () => setUserZoom((z) => Math.min(Number((z + 0.22).toFixed(2)), 2.6));
  const handleZoomOut = () => setUserZoom((z) => Math.max(Number((z - 0.22).toFixed(2)), 0.65));
  const handleRecenter = () => {
    setUserZoom(1.0);
    setPanSvg({ x: 0, y: 0 });
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

  const formattedRemaining = useMemo(() => {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    return `Còn ${m}:${s < 10 ? '0' : ''}${s}`;
  }, [remainingSeconds]);

  const isExpired = remainingSeconds <= 0;

  const vbW = Math.round(currentFrame.baseW / userZoom);
  const vbH = Math.round(currentFrame.baseH / userZoom);
  const vbX = Math.round(currentFrame.midX - vbW / 2 - panSvg.x);
  const vbY = Math.round(currentFrame.midY - vbH / 2 - panSvg.y);

  // Giao diện Bản đồ Toàn màn hình chuẩn Google Maps (Bản đồ chiếm 100% diện tích, các nút nổi nhỏ gọn)
  const renderMobileContent = () => (
    <div className="w-full h-[100dvh] bg-[#EFECE6] text-[#1C1917] relative overflow-hidden font-sans select-none antialiased">
      {(isExpired || isManualDismissed) ? (
        <main className="w-full h-full flex items-center justify-center p-5 bg-[#FAF8F5]">
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
        <>
          {/* 1. Thanh Điều Hướng Nổi Nhỏ Gọn Phía Trên (Google Maps Top Pill) */}
          <div className="absolute top-2.5 left-2.5 right-2.5 max-w-lg mx-auto z-30 bg-white/95 backdrop-blur-md border border-[#E3DFD5] rounded-2xl px-3 py-2 shadow-md flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg bg-[#1C1917] text-[#FAF8F5] font-extrabold text-xs flex items-center justify-center shrink-0">
                  {activeLeg}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[9.5px] font-extrabold uppercase tracking-wider text-[#78716C]">
                    <span>{activeLeg === 1 ? 'SẢNH TRỆT' : currentDest.floorLevel}</span>
                    <span>·</span>
                    <span>ĐÍCH: {currentDest.floorLevel}</span>
                  </div>
                  <h1 className="text-[13px] font-extrabold text-[#1C1917] truncate leading-tight">
                    {currentDest.name}
                  </h1>
                </div>
              </div>

              {/* Nút Switch Chặng Siêu Nhỏ Gọn (Chuẩn Google Maps Pill) */}
              {currentDest.isDifferentFloor && (
                <div className="inline-flex items-center bg-[#EFECE6] border border-[#E3DFD5] rounded-full p-0.5 gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveLeg(1)}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-extrabold transition cursor-pointer ${
                      activeLeg === 1
                        ? 'bg-[#1C1917] text-[#FAF8F5] shadow-2xs'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    Chặng 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLeg(2)}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-extrabold transition cursor-pointer ${
                      activeLeg === 2
                        ? 'bg-[#1C1917] text-[#FAF8F5] shadow-2xs'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    Chặng 2
                  </button>
                </div>
              )}
            </div>

            <div className="pt-1 border-t border-[#F0EDE6] text-[11.5px] font-semibold text-[#292524] leading-snug">
              {activeLeg === 1
                ? currentDest.step1Text || 'Đi từ sảnh Lobby đến Thang máy A và bấm lên tầng mục tiêu.'
                : currentDest.step2Text || `Ra khỏi thang máy, đi theo chỉ dẫn tới ${currentDest.name}.`}
            </div>
          </div>

          {/* 2. Bản Đồ Toàn Màn Hình (100% Diện Tích, Xoay Vuông Góc 90° Trong SVG Không Bao Giờ Méo) */}
          <div
            className="absolute inset-0 w-full h-full touch-none cursor-grab active:cursor-grabbing overflow-hidden"
            style={{
              background: 'radial-gradient(circle at 50% 45%, #FAF8F5 0%, #EFECE6 75%, #E5E0D5 100%)',
            }}
            onPointerDown={(e) => {
              if (e.target.closest('button')) return;
              setDragState({
                startX: e.clientX,
                startY: e.clientY,
                startPanX: panSvg.x,
                startPanY: panSvg.y,
                width: e.currentTarget.clientWidth || 375,
              });
            }}
            onPointerMove={(e) => {
              if (!dragState) return;
              const scaleSvgPerPx = (currentFrame.baseW / userZoom) / dragState.width;
              const dx = (e.clientX - dragState.startX) * scaleSvgPerPx;
              const dy = (e.clientY - dragState.startY) * scaleSvgPerPx;
              setPanSvg({
                x: Math.max(-950, Math.min(950, dragState.startPanX + dx)),
                y: Math.max(-750, Math.min(750, dragState.startPanY + dy)),
              });
            }}
            onPointerUp={() => setDragState(null)}
            onPointerCancel={() => setDragState(null)}
          >
            <div
              className="w-full h-full transition-transform duration-300 ease-out"
              style={{
                transform: is3D ? 'perspective(1200px) rotateX(20deg) scale(1.03)' : 'none',
                transformOrigin: '50% 52%',
              }}
            >
              <svg
                viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
                className="w-full h-full block"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <pattern id="guestArchGrid" width="60" height="60" patternUnits="userSpaceOnUse">
                    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(28,25,23,0.045)" strokeWidth="1.5" />
                  </pattern>
                  <filter id="guest-sky-glow" x="-25%" y="-25%" width="150%" height="150%">
                    <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#0284C7" floodOpacity="0.45" />
                  </filter>
                  <filter id="guest-pin-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1C1917" floodOpacity="0.26" />
                  </filter>
                  <filter id="guest-board-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="14" stdDeviation="20" floodColor="#1C1917" floodOpacity="0.11" />
                  </filter>
                </defs>

                <rect x="-3000" y="-3000" width="8000" height="8000" fill="url(#guestArchGrid)" />

                <g transform={`rotate(${currentFrame.rotZ} ${currentFrame.midX} ${currentFrame.midY})`}>
                  <rect
                    x="0"
                    y="0"
                    width="1840"
                    height="1174"
                    rx="22"
                    fill="#FFFFFF"
                    stroke="#E3DFD5"
                    strokeWidth="4"
                    filter="url(#guest-board-shadow)"
                  />
                  <image
                    href={activeFloor.image}
                    x="0"
                    y="0"
                    width="1840"
                    height="1174"
                    preserveAspectRatio="none"
                  />

                  {/* 1. Lớp hào quang lộ trình */}
                  <path
                    d={activeRoutePath}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="20"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.28"
                    filter="url(#guest-sky-glow)"
                  />
                  {/* 2. Lớp nền lộ trình */}
                  <path
                    d={activeRoutePath}
                    fill="none"
                    stroke="#E0F2FE"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.95"
                  />
                  {/* 3. Tuyến đường nét đứt chuyển động */}
                  <path
                    d={activeRoutePath}
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth="6.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="14 10"
                    className="animate-routeDash"
                  />

                  {/* 4. Hạt dẫn đường chuyển động dọc theo lộ trình */}
                  <g filter="url(#guest-pin-shadow)">
                    <circle r="14" fill="#0EA5E9" opacity="0.24" />
                    <circle r="8.5" fill="#1C1917" stroke="#FFFFFF" strokeWidth="2.5" />
                    <path d="M -2.5 -3 L 4 0 L -2.5 3 Z" fill="#FAF8F5" />
                    <animateMotion
                      key={`${activeLeg}-${currentDest.id}`}
                      dur="3.4s"
                      repeatCount="indefinite"
                      rotate="auto"
                      path={activeRoutePath}
                    />
                  </g>

                  {/* 5. Điểm xuất phát + Nhãn nổi nhỏ gọn tự giữ chữ nằm ngang */}
                  <g transform={`translate(${activeEndpoints.start.x}, ${activeEndpoints.start.y})`}>
                    <circle r="10.5" fill="#1C1917" stroke="#FFFFFF" strokeWidth="3" filter="url(#guest-pin-shadow)" />
                    <g transform={`rotate(${-currentFrame.rotZ})`}>
                      <rect
                        x="-56"
                        y="-38"
                        width="112"
                        height="22"
                        rx="11"
                        fill="#1C1917"
                        stroke="#FAF8F5"
                        strokeWidth="1.8"
                        filter="url(#guest-pin-shadow)"
                      />
                      <text
                        x="0"
                        y="-23"
                        textAnchor="middle"
                        fill="#FAF8F5"
                        fontSize="10.5"
                        fontWeight="800"
                      >
                        {activeEndpoints.start.label}
                      </text>
                    </g>
                  </g>

                  {/* 6. Điểm kết thúc + Nhãn nổi nhỏ gọn tự giữ chữ nằm ngang */}
                  <g transform={`translate(${activeEndpoints.end.x}, ${activeEndpoints.end.y})`}>
                    <circle r="11.5" fill="#0284C7" stroke="#FFFFFF" strokeWidth="3" filter="url(#guest-pin-shadow)" />
                    <circle r="4" fill="#FFFFFF" />
                    <g transform={`rotate(${-currentFrame.rotZ})`}>
                      <rect
                        x="-72"
                        y="-40"
                        width="144"
                        height="24"
                        rx="12"
                        fill="#FFFFFF"
                        stroke="#1C1917"
                        strokeWidth="2"
                        filter="url(#guest-pin-shadow)"
                      />
                      <text
                        x="0"
                        y="-24"
                        textAnchor="middle"
                        fill="#1C1917"
                        fontSize="11"
                        fontWeight="800"
                      >
                        {activeEndpoints.end.label}
                      </text>
                    </g>
                  </g>
                </g>
              </svg>
            </div>
          </div>

          {/* 3. Cụm Nút Điều Khiển Nổi Nhỏ Gọn Bên Phải (Chuẩn Google Maps 38x38px) */}
          <div className="absolute right-2.5 bottom-[72px] z-30 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHeadingUp((v) => !v)}
              className={`w-[38px] h-[38px] rounded-full border shadow-md flex flex-col items-center justify-center text-[11px] font-extrabold leading-none transition cursor-pointer ${
                isHeadingUp
                  ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917]'
                  : 'bg-white/95 text-[#1C1917] border-[#E3DFD5]'
              }`}
              title="Xoay hướng bước đi lên trên"
            >
              <span>↑</span>
              <span className="text-[8px] mt-0.5">Hướng</span>
            </button>

            <button
              type="button"
              onClick={() => setIs3D((v) => !v)}
              className={`w-[38px] h-[38px] rounded-full border shadow-md flex items-center justify-center text-[11px] font-extrabold transition cursor-pointer ${
                is3D
                  ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917]'
                  : 'bg-white/95 text-[#1C1917] border-[#E3DFD5]'
              }`}
              title="Bật/Tắt góc nghiêng 3D"
            >
              {is3D ? '3D' : '2D'}
            </button>

            <button
              type="button"
              onClick={handleRecenter}
              className="w-[38px] h-[38px] rounded-full bg-white/95 text-[#1C1917] border border-[#E3DFD5] shadow-md flex items-center justify-center cursor-pointer"
              title="Căn giữa lộ trình"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="flex flex-col bg-white/95 border border-[#E3DFD5] rounded-full shadow-md overflow-hidden">
              <button
                type="button"
                onClick={handleZoomIn}
                className="w-9 h-8 flex items-center justify-center text-[#1C1917] border-b border-[#EFECE6] active:bg-[#EFECE6] cursor-pointer"
                title="Phóng to"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="w-9 h-8 flex items-center justify-center text-[#1C1917] active:bg-[#EFECE6] cursor-pointer"
                title="Thu nhỏ"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 4. Thanh Nổi Đáy Màn Hình Tối Giản (Google Maps Bottom Pill) */}
          <div className="absolute bottom-3 left-2.5 right-2.5 max-w-lg mx-auto z-30 bg-white/95 backdrop-blur-md border border-[#E3DFD5] rounded-full py-1.5 pl-3.5 pr-2 shadow-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#57534E] truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <span>{currentDest.time || '2 Phút'}</span>
              <span>·</span>
              <span>{formattedRemaining}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {currentDest.isDifferentFloor && (
                <button
                  type="button"
                  onClick={() => setActiveLeg(activeLeg === 1 ? 2 : 1)}
                  className="h-8 px-3 rounded-full bg-[#1C1917] text-[#FAF8F5] text-[11px] font-extrabold flex items-center gap-1 active:scale-95 transition cursor-pointer"
                >
                  <span>{activeLeg === 1 ? 'Chặng 2 →' : '← Chặng 1'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleFinishTicket}
                className="h-8 px-2.5 rounded-full bg-[#EFECE6] border border-[#E3DFD5] text-[#1C1917] text-[11px] font-extrabold flex items-center gap-1 active:scale-95 transition cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Đóng</span>
              </button>
            </div>
          </div>
        </>
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
