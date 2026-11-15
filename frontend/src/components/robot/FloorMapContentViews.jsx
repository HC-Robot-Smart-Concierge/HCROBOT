import React from 'react';
import { Clock, Footprints, Smartphone, Map as MapIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export const FloorMapContentViews = ({
  activeMode, setIsHovering, handlePointerDown, handlePointerMove, handlePointerUp, isDragging, zoomLevel, pan, activeFloor, activeStep, currentDest, activeRoute, ROUTE_GROUND_TO_ELEVATOR, qrMapUrl, qrCountdown, networkHosts, preferredHostIp, handleSelectNetworkIp, setActiveMode, onCloseQrModal,
}) => (
  <>
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
            {/* Ảnh mặt bằng gốc của tầng - key bắt buộc để mobile Safari render lại texture khi đổi tầng */}
            <img
              key={activeFloor.image}
              src={activeFloor.image}
              alt={activeFloor.name}
              className="w-full h-full object-contain pointer-events-none select-none"
              style={{ imageRendering: '-webkit-optimize-contrast' }}
            />

            {/* Lớp SVG Chỉ Đường: Đồng bộ viewBox với kích thước thực tế */}
            <svg
              viewBox={`0 0 ${activeFloor.width || 1840} ${activeFloor.height || 1174}`}
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
                    d={activeRoute.pathString || ROUTE_GROUND_TO_ELEVATOR}
                    fill="none"
                    stroke="#7DD3FC"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.3"
                    filter="url(#sky-glow)"
                  />
                  <path
                    d={activeRoute.pathString || ROUTE_GROUND_TO_ELEVATOR}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="14 10"
                    className="animate-routeDash"
                  />
                  {/* Điểm xuất phát tĩnh (Chấm xanh nhạt tinh gọn) */}
                  <g transform="translate(350, 580)">
                    <circle r="14" fill="#38BDF8" opacity="0.25" />
                    <circle r="8" fill="#0EA5E9" stroke="#ffffff" strokeWidth="2.5" />
                  </g>
                  {/* Điểm thang máy đích chặng 1 */}
                  <g transform="translate(1715, 560)">
                    <circle r="14" fill="#38BDF8" opacity="0.25" />
                    <circle r="8" fill="#38BDF8" stroke="#ffffff" strokeWidth="2.5" />
                  </g>
                </g>
              )}

              {/* VẼ LỘ TRÌNH CHẶNG 2: TẦNG ĐÍCH (TỪ THANG MÁY -> PHÒNG/KHU VỰC ĐÍCH) - Màu xanh nhạt dễ nhìn */}
              {activeStep === 2 && (
                <g className="animate-fadeIn">
                  <path
                    d={activeRoute.pathString || currentDest.routeTarget}
                    fill="none"
                    stroke="#7DD3FC"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.3"
                    filter="url(#sky-glow)"
                  />
                  <path
                    d={activeRoute.pathString || currentDest.routeTarget}
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
                    <g transform="translate(1715, 560)">
                      <circle r="14" fill="#38BDF8" opacity="0.25" />
                      <circle r="8" fill="#0EA5E9" stroke="#ffffff" strokeWidth="2.5" />
                    </g>
                  ) : (
                    <g transform="translate(350, 580)">
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

              <div className="w-full flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleSelectNetworkIp(networkHosts.lanIp)}
                  className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                    preferredHostIp === networkHosts.lanIp
                      ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917]'
                      : 'bg-[#FAF8F5] text-stone-600 border-[#E3DFD5] hover:bg-[#EFECE4]'
                  }`}
                  title={`Quét qua Wi-Fi nội bộ (${networkHosts.lanIp})`}
                >
                  Wi-Fi ({networkHosts.lanIp})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectNetworkIp(networkHosts.tailscaleIp)}
                  className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                    preferredHostIp === networkHosts.tailscaleIp
                      ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917]'
                      : 'bg-[#FAF8F5] text-stone-600 border-[#E3DFD5] hover:bg-[#EFECE4]'
                  }`}
                  title={`Quét qua Tailscale (${networkHosts.tailscaleIp})`}
                >
                  Tailscale ({networkHosts.tailscaleIp})
                </button>
              </div>

              {qrCountdown !== null && qrCountdown >= 0 && (
                <div className="px-2 py-0.5 rounded-full bg-[#EFECE4] text-stone-700 border border-[#E3DFD5] text-[10px] font-mono mt-0.5">
                  Tự động đóng sau {qrCountdown}s
                </div>
              )}

              <div className="pt-1 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('map');
                    if (onCloseQrModal) {
                      try { onCloseQrModal(); } catch (e) { }
                    }
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

  </>
);
