import React, { useState, useMemo, useEffect } from 'react';
import {
  HOTEL_FLOORS,
  HOTEL_DESTINATIONS,
  ROUTE_GROUND_TO_ELEVATOR,
} from '../../components/robot/FloorMap';
import { calculateFloorRoute } from '../../services/indoorNavigation/indoorPathfinder';

import {
  computeOrthogonalHeadingAngle,
  computeSmartRouteFrame,
  parseGuestMapParams,
} from './guestMapGeometry';
import { GuestMapSvgViewport } from './GuestMapSvgViewport';
import {
  GuestMapExpiredView,
  GuestMapTopHeaderPill,
  GuestMapRightControls,
  GuestMapBottomPill,
  GuestMapIphoneMockupShell,
} from './GuestMapOverlays';

export { computeOrthogonalHeadingAngle, computeSmartRouteFrame, parseGuestMapParams };

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

  const renderMobileContent = () => (
    <div className="w-full h-[100dvh] bg-[#EFECE6] text-[#1C1917] relative overflow-hidden font-sans select-none antialiased">
      {(isExpired || isManualDismissed) ? (
        <GuestMapExpiredView
          isManualDismissed={isManualDismissed}
          isExpired={isExpired}
          currentDest={currentDest}
          onReopenTicket={handleReopenTicket}
        />
      ) : (
        <>
          <GuestMapTopHeaderPill
            activeLeg={activeLeg}
            setActiveLeg={setActiveLeg}
            currentDest={currentDest}
          />
          <GuestMapSvgViewport
            dragState={dragState}
            setDragState={setDragState}
            pan={pan}
            setPan={setPan}
            zoomLevel={zoomLevel}
            setZoomLevel={setZoomLevel}
            clampZoom={clampZoom}
            clampPanX={clampPanX}
            clampPanY={clampPanY}
            is3D={is3D}
            currentFrame={currentFrame}
            worldTransform={worldTransform}
            activeFloor={activeFloor}
            activeRoutePath={activeRoutePath}
            activeEndpoints={activeEndpoints}
          />
          <GuestMapRightControls
            isHeadingUp={isHeadingUp}
            onToggleHeadingUp={() => setIsHeadingUp((v) => !v)}
            is3D={is3D}
            onToggle3D={() => setIs3D((v) => !v)}
            onRecenter={handleRecenter}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
          <GuestMapBottomPill
            currentDest={currentDest}
            formattedRemaining={formattedRemaining}
            activeLeg={activeLeg}
            setActiveLeg={setActiveLeg}
            onFinishTicket={handleFinishTicket}
          />
        </>
      )}
    </div>
  );

  if (isIphoneMockup) {
    return (
      <GuestMapIphoneMockupShell
        mockupOrientation={mockupOrientation}
        setMockupOrientation={setMockupOrientation}
        setIsIphoneMockup={setIsIphoneMockup}
      >
        {renderMobileContent()}
      </GuestMapIphoneMockupShell>
    );
  }

  return renderMobileContent();
};
