import React, { useState, useEffect, useMemo } from 'react';
import { calculateFloorRoute } from '../../services/indoorNavigation/index.js';
import {
  HOTEL_FLOORS,
  HOTEL_DESTINATIONS,
  ROUTE_GROUND_TO_ELEVATOR,
  createEphemeralTicket,
  getDetectedNetworkHosts,
  getMobileGuestMapUrl,
  detectDestinationPoi,
  HOTEL_KEY_FACILITIES,
} from './floorMapWayfindingUtils';
import { FloorMapHeaderBar } from './FloorMapHeaderBar';
import { FloorMapContentViews } from './FloorMapContentViews';

export {
  HOTEL_FLOORS,
  HOTEL_DESTINATIONS,
  ROUTE_GROUND_TO_ELEVATOR,
  createEphemeralTicket,
  getDetectedNetworkHosts,
  getMobileGuestMapUrl,
  detectDestinationPoi,
  HOTEL_KEY_FACILITIES,
};

export const FloorMap = ({
  destinationKey = 'infinity_pool',
  onSelectDestination,
  className = '',
  onClose,
  defaultZoom = 1.0,
  showQrModalExternal = false,
  qrCountdown = null,
  onCloseQrModal = null,
  currentStepExternal = null,
  onStepChange = null,
}) => {
  // Điểm đến được chọn (hỗ trợ chuyển đổi nhanh trực tiếp giữa các cơ sở vật chất)
  const [selectedDestKey, setSelectedDestKey] = useState(destinationKey);
  const [isDestSelectorOpen, setIsDestSelectorOpen] = useState(false);

  useEffect(() => {
    setSelectedDestKey(destinationKey);
  }, [destinationKey]);

  // Lấy dữ liệu điểm đến hiện tại
  const currentDest = HOTEL_DESTINATIONS[selectedDestKey] || HOTEL_DESTINATIONS.infinity_pool;

  // Hỗ trợ chuyển đổi nhanh giữa Wi-Fi LAN và Tailscale VPN trên màn hình Robot
  const networkHosts = useMemo(() => getDetectedNetworkHosts(), []);

  const [preferredHostIp, setPreferredHostIp] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('aurora_qr_network_ip');
        if (saved) return saved;
      }
      if (typeof window !== 'undefined') {
        const h = window.location.hostname;
        if (h && h !== 'localhost' && h !== '127.0.0.1') return h;
      }
    } catch {
      // ignore storage error
    }
    return networkHosts.lanIp || networkHosts.tailscaleIp;
  });

  const handleSelectNetworkIp = (ip) => {
    setPreferredHostIp(ip);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('aurora_qr_network_ip', ip);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aurora-qr-ip-changed', { detail: ip }));
      }
    } catch {
      // ignore storage error
    }
  };

  useEffect(() => {
    const onIpChanged = (e) => {
      if (e?.detail) setPreferredHostIp(e.detail);
    };
    window.addEventListener('aurora-qr-ip-changed', onIpChanged);
    return () => window.removeEventListener('aurora-qr-ip-changed', onIpChanged);
  }, []);

  // Giữ URL mã QR cố định trong suốt vòng đời của điểm đến này để mã QR không bị giật ma trận
  const qrMapUrl = useMemo(() => {
    return getMobileGuestMapUrl(currentDest.id, preferredHostIp);
  }, [currentDest.id, preferredHostIp]);

  // Trạng thái Chặng:
  // 1: Chặng 1 (Tầng Trệt ra Thang Máy)
  // 2: Chặng 2 (Từ Thang Máy ra Điểm Đích trên tầng mục tiêu)
  const [activeStep, setActiveStep] = useState(currentDest.isDifferentFloor ? (currentStepExternal || 1) : 2);
  const [autoPlay, setAutoPlay] = useState(true);
  const [isHovering, setIsHovering] = useState(false);

  // Thông báo thay đổi chặng lên component cha (Mobile / Kiosk)
  useEffect(() => {
    if (onStepChange) {
      onStepChange(activeStep);
    }
  }, [activeStep, onStepChange]);

  // Tính toán lộ trình động thông minh với wall-clearance & graph-search
  const activeRoute = useMemo(() => {
    if (activeStep === 1) {
      return { pathString: ROUTE_GROUND_TO_ELEVATOR, isValid: true };
    }
    if (currentDest.routeTarget) {
      return { pathString: currentDest.routeTarget, isValid: true };
    }
    const r = calculateFloorRoute(
      currentDest.isDifferentFloor ? 'ELEVATOR' : 'STANDBY',
      currentDest.coords,
      currentDest.floorId
    );
    return { pathString: r.pathString || currentDest.routeTarget, isValid: r.isValid };
  }, [activeStep, currentDest]);

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

  // Tự động chuyển chặng từ 1 sang 2 sau 10 giây (nếu không có điều phối ngoài) để khách thấy toàn bộ hành trình
  useEffect(() => {
    if (currentStepExternal != null) {
      setActiveStep(currentDest.isDifferentFloor ? currentStepExternal : 2);
      return;
    }
    if (!currentDest.isDifferentFloor) {
      setActiveStep(2);
      return;
    }
    // Reset về chặng 1 khi đổi điểm đến mới
    setActiveStep(1);
    if (!autoPlay) return;

    const timer = setTimeout(() => {
      setActiveStep(2);
      onStepChange?.(2);
    }, 10000);

    return () => clearTimeout(timer);
  }, [selectedDestKey, autoPlay, currentDest.isDifferentFloor, currentStepExternal, onStepChange]);

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

      <FloorMapHeaderBar
        isDestSelectorOpen={isDestSelectorOpen}
        setIsDestSelectorOpen={setIsDestSelectorOpen}
        currentDest={currentDest}
        HOTEL_KEY_FACILITIES={HOTEL_KEY_FACILITIES}
        selectedDestKey={selectedDestKey}
        setSelectedDestKey={setSelectedDestKey}
        setActiveStep={setActiveStep}
        setAutoPlay={setAutoPlay}
        onSelectDestination={onSelectDestination}
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        onCloseQrModal={onCloseQrModal}
        activeStep={activeStep}
        onStepChange={onStepChange}
        onClose={onClose}
      />

      <FloorMapContentViews
        activeMode={activeMode}
        setIsHovering={setIsHovering}
        handlePointerDown={handlePointerDown}
        handlePointerMove={handlePointerMove}
        handlePointerUp={handlePointerUp}
        isDragging={isDragging}
        zoomLevel={zoomLevel}
        pan={pan}
        activeFloor={activeFloor}
        activeStep={activeStep}
        currentDest={currentDest}
        activeRoute={activeRoute}
        ROUTE_GROUND_TO_ELEVATOR={ROUTE_GROUND_TO_ELEVATOR}
        qrMapUrl={qrMapUrl}
        qrCountdown={qrCountdown}
        networkHosts={networkHosts}
        preferredHostIp={preferredHostIp}
        handleSelectNetworkIp={handleSelectNetworkIp}
        setActiveMode={setActiveMode}
        onCloseQrModal={onCloseQrModal}
      />
    </div>
  );
};
