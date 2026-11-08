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

export const computeOrthogonalHeadingAngle = (startPt) => {
  return startPt && startPt.x >= 920 ? 90 : -90;
};

const projectPointToSvgScreen = (x, y, rotZ) => {
  if (rotZ === -90) {
    return { sx: y, sy: 1840 - x };
  }
  if (rotZ === 90) {
    return { sx: 1174 - y, sy: x };
  }
  return { sx: x, sy: y };
};

export const computeSmartRouteFrame = (pathStr, startPt, endPt, mode = 'heading') => {
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

  const isHeading = mode === 'heading';
  const rotZ = isHeading ? computeOrthogonalHeadingAngle(startPt) : 0;
  const svgW = rotZ === 0 ? 1840 : 1174;
  const svgH = rotZ === 0 ? 1174 : 1840;

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

  const cw = typeof window !== 'undefined' && window.innerWidth ? Math.min(window.innerWidth, 430) : 390;
  const ch = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 760;
  const svgScale = Math.min(cw / svgW, ch / svgH);

  const fitW = (cw * 0.82) / ((spanSW + 340) * svgScale);
  const fitH = (ch * 0.62) / ((spanSH + 420) * svgScale);
  const zoom = Number(Math.min(1.65, Math.max(1.06, Math.min(fitW, fitH))).toFixed(2));

  const panX = Math.round((svgW / 2 - midSX) * svgScale * zoom);
  const panY = Math.round((svgH / 2 - midSY) * svgScale * zoom);

  if (mode === 'flat2d') {
    return {
      midX,
      midY,
      baseW: 1840,
      baseH: 1174,
      zoom: 1.05,
      panX,
      panY,
      tiltX: 0,
      rotZ: 0,
    };
  }

  return {
    midX,
    midY,
    baseW: svgW,
    baseH: svgH,
    zoom,
    panX,
    panY,
    tiltX: 20,
    rotZ,
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
  // - isHeadingUp = true (Mặc định):
  //   + Chặng 1: Xoay -90° từ Sảnh nhìn thẳng lên Thang máy A
  //   + Chặng 2: Xoay +90° từ Thang máy A nhìn thẳng lên hành lang & phòng đích
  const [isHeadingUp, setIsHeadingUp] = useState(true);
  const [is3D, setIs3D] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.25);
  const [pan, setPan] = useState({ x: 0, y: 0 });
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

  // Khi chuyển chặng hoặc đổi điểm đến -> tự động căn giữa lộ trình bằng GPU
  useEffect(() => {
    setZoomLevel(currentFrame.zoom);
    setPan({ x: currentFrame.panX, y: currentFrame.panY });
  }, [currentFrame]);

  const clampZoom = (z) => Math.min(3.2, Math.max(0.65, Number(z.toFixed(3))));
  const clampPanX = (x, z = zoomLevel) => {
    const limit = Math.round(540 * Math.max(1, z * 0.85));
    return Math.max(-limit, Math.min(limit, Number(x.toFixed(2))));
  };
  const clampPanY = (y, z = zoomLevel) => {
    const limit = Math.round(660 * Math.max(1, z * 0.85));
    return Math.max(-limit, Math.min(limit, Number(y.toFixed(2))));
  };

  const handleZoomIn = () => {
    setZoomLevel((z) => {
      const nextZoom = clampZoom(z + 0.22);
      const ratio = nextZoom / z;
      setPan((p) => ({
        x: clampPanX(p.x * ratio, nextZoom),
        y: clampPanY(p.y * ratio, nextZoom),
      }));
      return nextZoom;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel((z) => {
      const nextZoom = clampZoom(z - 0.22);
      const ratio = nextZoom / z;
      setPan((p) => ({
        x: clampPanX(p.x * ratio, nextZoom),
        y: clampPanY(p.y * ratio, nextZoom),
      }));
      return nextZoom;
    });
  };

  const handleRecenter = () => {
    setZoomLevel(currentFrame.zoom);
    setPan({ x: currentFrame.panX, y: currentFrame.panY });
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

  const worldTransform =
    currentFrame.rotZ === -90
      ? 'translate(0, 1840) rotate(-90)'
      : currentFrame.rotZ === 90
        ? 'translate(1174, 0) rotate(90)'
        : 'translate(0, 0) rotate(0)';

  // Giao diện Bản đồ Toàn màn hình chuẩn Google Maps (Bản đồ chiếm 100% diện tích, GPU 60-120fps)
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

          {/* 2. Bản Đồ Toàn Màn Hình (100% Diện Tích, GPU translate3d 60-120fps) */}
          <div
            className="absolute inset-0 w-full h-full touch-none cursor-grab active:cursor-grabbing overflow-hidden"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(28, 25, 23, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(28, 25, 23, 0.04) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
            onTouchStart={(e) => {
              if (e.target.closest('button')) return;
              if (e.touches.length === 1) {
                setDragState({
                  mode: 'pan',
                  startX: e.touches[0].clientX,
                  startY: e.touches[0].clientY,
                  startPanX: pan.x,
                  startPanY: pan.y,
                });
              } else if (e.touches.length >= 2) {
                const rect = e.currentTarget.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.max(12, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
                const midX = (t1.clientX + t2.clientX) / 2 - centerX;
                const midY = (t1.clientY + t2.clientY) / 2 - centerY;
                setDragState({
                  mode: 'pinch',
                  startDist: dist,
                  startZoom: zoomLevel,
                  startPanX: pan.x,
                  startPanY: pan.y,
                  startMidX: midX,
                  startMidY: midY,
                });
              }
            }}
            onTouchMove={(e) => {
              if (!dragState) return;
              if (e.touches.length >= 2 && dragState.mode === 'pinch') {
                const rect = e.currentTarget.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.max(12, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
                const midX = (t1.clientX + t2.clientX) / 2 - centerX;
                const midY = (t1.clientY + t2.clientY) / 2 - centerY;
                const nextZoom = clampZoom(dragState.startZoom * (dist / dragState.startDist));
                const zoomRatio = nextZoom / dragState.startZoom;
                const nextPanX = midX - (dragState.startMidX - dragState.startPanX) * zoomRatio;
                const nextPanY = midY - (dragState.startMidY - dragState.startPanY) * zoomRatio;

                setZoomLevel(nextZoom);
                setPan({
                  x: clampPanX(nextPanX, nextZoom),
                  y: clampPanY(nextPanY, nextZoom),
                });
              } else if (e.touches.length === 1 && dragState.mode === 'pan') {
                const dx = e.touches[0].clientX - dragState.startX;
                const dy = e.touches[0].clientY - dragState.startY;
                setPan({
                  x: clampPanX(dragState.startPanX + dx, zoomLevel),
                  y: clampPanY(dragState.startPanY + dy, zoomLevel),
                });
              }
            }}
            onTouchEnd={(e) => {
              if (e.touches.length === 1) {
                setDragState({
                  mode: 'pan',
                  startX: e.touches[0].clientX,
                  startY: e.touches[0].clientY,
                  startPanX: pan.x,
                  startPanY: pan.y,
                });
              } else if (e.touches.length === 0) {
                setDragState(null);
              }
            }}
            onTouchCancel={() => setDragState(null)}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch' || e.target.closest('button')) return;
              setDragState({
                mode: 'mouse',
                startX: e.clientX,
                startY: e.clientY,
                startPanX: pan.x,
                startPanY: pan.y,
              });
            }}
            onPointerMove={(e) => {
              if (e.pointerType === 'touch' || !dragState || dragState.mode !== 'mouse') return;
              const dx = e.clientX - dragState.startX;
              const dy = e.clientY - dragState.startY;
              setPan({
                x: clampPanX(dragState.startPanX + dx, zoomLevel),
                y: clampPanY(dragState.startPanY + dy, zoomLevel),
              });
            }}
            onPointerUp={(e) => {
              if (e.pointerType === 'touch') return;
              setDragState(null);
            }}
            onPointerCancel={(e) => {
              if (e.pointerType === 'touch') return;
              setDragState(null);
            }}
            onWheel={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const cursorX = e.clientX - (rect.left + rect.width / 2);
              const cursorY = e.clientY - (rect.top + rect.height / 2);
              const factor = e.deltaY < 0 ? 1.12 : 0.89;
              const nextZoom = clampZoom(zoomLevel * factor);
              const zoomRatio = nextZoom / zoomLevel;
              setZoomLevel(nextZoom);
              setPan({
                x: clampPanX(cursorX - (cursorX - pan.x) * zoomRatio, nextZoom),
                y: clampPanY(cursorY - (cursorY - pan.y) * zoomRatio, nextZoom),
              });
            }}
          >
            <div
              className="w-full h-full transition-transform duration-300 ease-out"
              style={{
                transform: is3D ? 'perspective(1200px) rotateX(20deg) scale(1.03)' : 'none',
                transformOrigin: '50% 52%',
              }}
            >
              <div
                className={`w-full h-full ${dragState ? '' : 'transition-transform duration-250 ease-out'}`}
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoomLevel})`,
                  transformOrigin: '50% 50%',
                  willChange: 'transform',
                }}
              >
                <svg
                  viewBox={currentFrame.rotZ === 0 ? '0 0 1840 1174' : '0 0 1174 1840'}
                  className="w-full h-full block"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <g transform={worldTransform}>
                    <rect
                      x="0"
                      y="0"
                      width="1840"
                      height="1174"
                      rx="22"
                      fill="#FFFFFF"
                      stroke="#E3DFD5"
                      strokeWidth="5"
                    />
                    <image
                      href={activeFloor.image}
                      x="0"
                      y="0"
                      width="1840"
                      height="1174"
                      preserveAspectRatio="none"
                    />

                    {/* 1. Lớp hào quang lộ trình nhẹ */}
                    <path
                      d={activeRoutePath}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="24"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.28"
                    />
                    {/* 2. Lớp nền lộ trình */}
                    <path
                      d={activeRoutePath}
                      fill="none"
                      stroke="#0284C7"
                      strokeWidth="11"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.92"
                    />
                    {/* 3. Tuyến đường nét đứt chuyển động */}
                    <path
                      d={activeRoutePath}
                      fill="none"
                      stroke="#E0F2FE"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="14 10"
                      className="animate-routeDash"
                    />

                    {/* 4. Điểm xuất phát + Nhãn nổi nhỏ gọn tự giữ chữ nằm ngang */}
                    <g transform={`translate(${activeEndpoints.start.x}, ${activeEndpoints.start.y})`}>
                      <circle r="18" fill="#1C1917" opacity="0.16" />
                      <circle r="11" fill="#1C1917" stroke="#FFFFFF" strokeWidth="3.5" />
                      <g transform={`rotate(${-currentFrame.rotZ})`}>
                        <rect
                          x="-58"
                          y="-40"
                          width="116"
                          height="23"
                          rx="11.5"
                          fill="#1C1917"
                          stroke="#FAF8F5"
                          strokeWidth="2"
                        />
                        <text
                          x="0"
                          y="-25"
                          textAnchor="middle"
                          fill="#FAF8F5"
                          fontSize="11"
                          fontWeight="800"
                        >
                          {activeEndpoints.start.label}
                        </text>
                      </g>
                    </g>

                    {/* 5. Điểm kết thúc + Nhãn nổi nhỏ gọn tự giữ chữ nằm ngang */}
                    <g transform={`translate(${activeEndpoints.end.x}, ${activeEndpoints.end.y})`}>
                      <circle r="20" fill="#0284C7" opacity="0.2" />
                      <circle r="12" fill="#0284C7" stroke="#FFFFFF" strokeWidth="3.5" />
                      <circle r="4.5" fill="#FFFFFF" />
                      <g transform={`rotate(${-currentFrame.rotZ})`}>
                        <rect
                          x="-74"
                          y="-42"
                          width="148"
                          height="25"
                          rx="12.5"
                          fill="#FFFFFF"
                          stroke="#1C1917"
                          strokeWidth="2.2"
                        />
                        <text
                          x="0"
                          y="-26"
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
