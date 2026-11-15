import React from 'react';

export const GuestMapSvgViewport = ({
  dragState,
  setDragState,
  pan,
  setPan,
  zoomLevel,
  setZoomLevel,
  clampZoom,
  clampPanX,
  clampPanY,
  is3D,
  currentFrame,
  worldTransform,
  activeFloor,
  activeRoutePath,
  activeEndpoints,
}) => (
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

            {/* 4. Điểm xuất phát */}
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

            {/* 5. Điểm kết thúc */}
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
);
