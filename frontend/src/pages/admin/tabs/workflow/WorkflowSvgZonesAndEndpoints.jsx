import React from 'react';
import { isPolygonZone } from '../physicalMapZones';
import { getEndpointTemplateInfo } from '../studio/studioConstants';
import { meterToSvg, zoneToSvgRect } from './workflowSimulatorUtils';

/**
 * SVG patterns, 3 functional safety zones (KEEP_OUT, SPEED_ZONE, NO_STOP) with resize handles,
 * and draggable endpoints (WAYPOINT, CHARGER, PARK) for the 2D workflow floorplan.
 */
export const WorkflowSvgZonesAndEndpoints = ({
  currentPath,
  zones,
  showZones,
  selectedZone,
  setSelectedZone,
  isZoneEditMode,
  setIsZoneEditMode,
  dragState,
  endpoints,
  selectedEndpoint,
  setSelectedEndpoint,
  hoveredEndpointId,
  setHoveredEndpointId,
  setIsEndpointEditMode,
  dragEndpointState,
  handleEndpointPointerDown,
  handleZonePointerDown,
  handleSvgPointerUp,
  handleZoneClick,
  handleNavigateToGoal,
  onNotify,
}) => {
  return (
    <>
      <defs>
        {/* Pattern soc cheo do nhe cho KEEP_OUT */}
        <pattern id="keepoutStripes" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="16" stroke="#EF4444" strokeWidth="2" opacity="0.16" />
        </pattern>
        {/* Pattern cham ho phach nhe cho SPEED_ZONE */}
        <pattern id="speedZonePattern" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.5" fill="#F59E0B" opacity="0.18" />
        </pattern>
        {/* Pattern soc cheo do hong nhe cho NO_STOP */}
        <pattern id="nostopStripes" width="14" height="14" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="14" stroke="#F43F5E" strokeWidth="2" opacity="0.16" />
        </pattern>
      </defs>
      {showZones &&
        zones.map((zone) => {
          const rect = zoneToSvgRect(zone);
          const ZoneShape = isPolygonZone(zone) ? 'polygon' : 'rect';
          const shapeProps = isPolygonZone(zone)
            ? { points: zone.vertices.map((p) => `${35 + p.x * 25},${35 + (12.60 - p.y) * 25}`).join(' ') }
            : rect;
          const isKeepOut = zone.type === 'KEEP_OUT';
          const isSpeed = zone.type === 'SPEED_ZONE' || zone.type === 'SLOW_SPEED';
          const isSelected = selectedZone?.id === zone.id;
          const isDraggingThis = dragState?.zoneId === zone.id;

          const fillPattern = isKeepOut
            ? 'url(#keepoutStripes)'
            : isSpeed
            ? 'url(#speedZonePattern)'
            : 'url(#nostopStripes)';

          const strokeColor = isKeepOut ? '#F87171' : isSpeed ? '#FBBF24' : '#FB7185';
          const bgTint = isKeepOut
            ? 'rgba(239, 68, 68, 0.05)'
            : isSpeed
            ? 'rgba(245, 158, 11, 0.05)'
            : 'rgba(244, 63, 94, 0.05)';

          const isZoneInteractable = isZoneEditMode || isSelected;

          return (
            <g
              key={zone.id}
              data-zone="true"
              data-zone-id={zone.id}
              onPointerDown={(e) => {
                if (isZoneInteractable) {
                  handleZonePointerDown(e, zone, 'MOVE');
                }
              }}
              onPointerUp={(e) => {
                handleSvgPointerUp(e);
              }}
              onClick={(e) => handleZoneClick(e, zone)}
              className={`select-none transition-opacity ${
                isZoneInteractable
                  ? isDraggingThis
                    ? 'cursor-grabbing opacity-90 pointer-events-auto'
                    : 'cursor-grab hover:opacity-95 pointer-events-auto'
                  : 'pointer-events-none'
              }`}
            >
              {/* Nen mau tint nhe */}
              <ZoneShape
                {...shapeProps}
                fill={bgTint}
              />
              {/* Lop hoa van pattern */}
              <ZoneShape
                {...shapeProps}
                fill={fillPattern}
              />
              {/* Vien bao net dut ky thuat */}
              <ZoneShape
                {...shapeProps}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isSelected ? '2' : '1.2'}
                strokeDasharray={isKeepOut ? '6 4' : isSpeed ? '5 3' : '4 3'}
                strokeOpacity="0.75"
              />

              {/* Chú thích vùng bằng ICON và MÀU RIÊNG ở góc trên bên phải của vùng (Click vao Icon de chon va sua Vung) */}
              <g
                transform={`translate(${rect.x + rect.width - (isSpeed ? 26 : 16)}, ${rect.y + 4})`}
                className="pointer-events-auto select-none cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextSelected = isSelected ? null : zone;
                  setSelectedZone(nextSelected);
                  setIsZoneEditMode(Boolean(nextSelected));
                  if (nextSelected) {
                    onNotify(`Chế độ sửa vùng: Đã chọn "${zone.name}".`, 'info');
                  }
                }}
                title={`Click vào Icon để chọn và chỉnh sửa Vùng: ${zone.name}`}
              >
                {isKeepOut && (
                  <g filter="drop-shadow(0 1px 2px rgba(0,0,0,0.20))">
                    {/* Vòng nền đỏ riêng biệt */}
                    <circle cx="6.5" cy="6.5" r="6" fill="#DC2626" />
                    {/* Icon Cấm Vào (Ban / Circle Slash) */}
                    <circle cx="6.5" cy="6.5" r="3.8" fill="none" stroke="#FFFFFF" strokeWidth="1.1" />
                    <line x1="3.8" y1="3.8" x2="9.2" y2="9.2" stroke="#FFFFFF" strokeWidth="1.1" />
                  </g>
                )}
                {!isKeepOut && !isSpeed && (
                  <g filter="drop-shadow(0 1px 2px rgba(0,0,0,0.20))">
                    {/* Vòng nền hồng đỏ riêng biệt */}
                    <circle cx="6.5" cy="6.5" r="6" fill="#E11D48" />
                    {/* Icon Cấm Dừng (Stop / Octagon Hand) */}
                    <polygon points="4.5,2.5 8.5,2.5 10.5,4.5 10.5,8.5 8.5,10.5 4.5,10.5 2.5,8.5 2.5,4.5" fill="#FFFFFF" />
                    <rect x="4.5" y="5.8" width="4" height="1.2" rx="0.3" fill="#E11D48" />
                  </g>
                )}
                {isSpeed && (
                  <g filter="drop-shadow(0 1px 2px rgba(0,0,0,0.20))">
                    {/* Pill badge nền cam hổ phách */}
                    <rect x="0" y="0" width="24" height="12" rx="6" fill="#D97706" />
                    {/* Gauge arc & needle */}
                    <path d="M 4 8.5 A 3 3 0 1 1 9 8.5" fill="none" stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round" />
                    <line x1="6.5" y1="6.5" x2="8" y2="5" stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round" />
                    <text
                      x="16"
                      y="8.5"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      className="text-[5.5px] font-mono font-bold"
                      fontFamily="sans-serif"
                    >
                      {zone.speed_limit || 0.2}
                    </text>
                  </g>
                )}
              </g>

              {/* TAY NAM GOC VUONG MINI FIGMA/CAD (6x6px trang vien xam dam, thanh lich, khong hinh tron, khong hao quang) */}
              {isSelected && !isPolygonZone(zone) && (
                <g className="zone-resize-handles">
                  {[
                    { cx: rect.x, cy: rect.y, type: 'RESIZE_NW', cursor: 'cursor-nwse-resize' },
                    { cx: rect.x + rect.width, cy: rect.y, type: 'RESIZE_NE', cursor: 'cursor-nesw-resize' },
                    { cx: rect.x, cy: rect.y + rect.height, type: 'RESIZE_SW', cursor: 'cursor-nesw-resize' },
                    { cx: rect.x + rect.width, cy: rect.y + rect.height, type: 'RESIZE_SE', cursor: 'cursor-nwse-resize' },
                  ].map((handle) => (
                    <g key={handle.type}>
                      {/* Vung nhan click tang hinh de de trỏ chuot */}
                      <rect
                        x={handle.cx - 8}
                        y={handle.cy - 8}
                        width="16"
                        height="16"
                        fill="transparent"
                        className={`${handle.cursor} select-none`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          handleZonePointerDown(e, zone, handle.type);
                        }}
                      />
                      {/* Mau vuong mini Figma style: 6x6px trang vien xam dam */}
                      <rect
                        x={handle.cx - 3}
                        y={handle.cy - 3}
                        width="6"
                        height="6"
                        rx="1"
                        fill="#FFFFFF"
                        stroke="#262626"
                        strokeWidth="1.2"
                        className={`pointer-events-none ${handle.cursor}`}
                      />
                    </g>
                  ))}
                </g>
              )}
            </g>
          );
        })}

      {/* CAC DIEM MOC ENDPOINTS TREN SA BAN - 3 LOAI CHUAN (WAYPOINT, CHARGER, PARK), HO TRO KEO THA & SUA TEN */}
      {endpoints.map((ep) => {
        const wpSvg = meterToSvg(ep.x, ep.y);
        const isTarget =
          currentPath?.targetPoint &&
          Math.abs(currentPath.targetPoint.x - ep.x) < 0.25 &&
          Math.abs(currentPath.targetPoint.y - ep.y) < 0.25;
        const isSelected = selectedEndpoint?.id === ep.id;
        const isDraggingThis = dragEndpointState?.endpointId === ep.id;
        const isHovered = hoveredEndpointId === ep.id;
        const showLabel = isSelected || isDraggingThis || isHovered;

        const tmpl = getEndpointTemplateInfo(ep.type);
        const epColor = tmpl.color || '#262626';

        // Ten diem moc do nguoi dung dat (Ty le nho gon, tinh te)
        const nameText = ep.name || 'Điểm mốc';
        const badgeWidth = Math.max(20, nameText.length * 2.5 + 8);
        const isTopHalf = ep.y > 3.0;
        const badgeOffsetY = isTopHalf ? 7.0 : -7.0;

        return (
          <g
            key={ep.id}
            data-endpoint="true"
            data-endpoint-id={ep.id}
            onMouseEnter={() => setHoveredEndpointId(ep.id)}
            onMouseLeave={() => setHoveredEndpointId((prev) => (prev === ep.id ? null : prev))}
            onPointerDown={(e) => handleEndpointPointerDown(e, ep)}
            onPointerUp={(e) => {
              if (!wasDraggingRef.current) {
                setSelectedEndpoint(ep);
                setSelectedZone(null);
                setIsEndpointEditMode(true);
              }
              handleSvgPointerUp(e);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (wasDraggingRef.current) return;
              setSelectedEndpoint(ep);
              setSelectedZone(null);
              setIsEndpointEditMode(true);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleNavigateToGoal(ep.x, ep.y, ep.name);
            }}
            className={`select-none ${isDraggingThis ? 'cursor-grabbing' : 'cursor-pointer'} group`}
          >
            {/* 1. Vung nhan dien Pointer va Halo khi duoc chon */}
            {isSelected && (
              <circle
                cx={wpSvg.x}
                cy={wpSvg.y}
                r="13"
                fill={epColor}
                fillOpacity="0.12"
                stroke={epColor}
                strokeOpacity="0.6"
                strokeWidth="1.2"
                strokeDasharray="3 2"
                className="animate-pulse pointer-events-none"
              />
            )}

            {/* Vung nhan dien tuong tac rong r=16 de de tro chuot / keo tha */}
            <circle
              cx={wpSvg.x}
              cy={wpSvg.y}
              r="16"
              fill="transparent"
              stroke="transparent"
              className={isDraggingThis ? 'cursor-grabbing' : 'cursor-grab'}
            />

            {/* 2. Diem tron filled dac mau theo loai Endpoint (co vien trang tuong phan ro net) */}
            <circle
              cx={wpSvg.x}
              cy={wpSvg.y}
              r={isSelected ? 6.5 : isHovered ? 5.8 : 4.8}
              fill={epColor}
              stroke="#FFFFFF"
              strokeWidth={isSelected ? '2.0' : isHovered ? '1.8' : '1.4'}
              filter="drop-shadow(0 1px 3px rgba(0,0,0,0.20))"
              className="transition-all duration-150"
            />

            {/* 4. The Nhan ten Endpoint - Ty le nho gon tinh te */}
            {showLabel && (
              <g
                transform={`translate(${wpSvg.x}, ${wpSvg.y + badgeOffsetY})`}
                className="cursor-pointer transition-all duration-150"
              >
                {/* Card nen trang / xam tinh gon */}
                <rect
                  x={-badgeWidth / 2}
                  y="-3.8"
                  width={badgeWidth}
                  height="7.6"
                  rx="1.8"
                  fill={isSelected ? '#18181B' : '#FFFFFF'}
                  stroke={isSelected ? epColor : '#BFBFBD'}
                  strokeWidth={isSelected ? '0.9' : '0.6'}
                  filter="drop-shadow(0 1px 2px rgba(0,0,0,0.14))"
                />

                {/* Dot mau phan biet loai Endpoint */}
                <circle
                  cx={-badgeWidth / 2 + 2.8}
                  cy="0"
                  r="0.9"
                  fill={epColor}
                  className="pointer-events-none"
                />

                {/* Chu ten do nguoi dung dat */}
                <text
                  x="1.5"
                  y="1.1"
                  textAnchor="middle"
                  fill={isSelected ? '#FFFFFF' : '#18181B'}
                  className="text-[3.6px] font-semibold tracking-tight truncate pointer-events-none"
                  fontFamily="sans-serif"
                >
                  {nameText.length > 24 ? nameText.slice(0, 22) + '...' : nameText}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </>
  );
};
