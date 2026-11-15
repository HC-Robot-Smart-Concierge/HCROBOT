import React from 'react';
import { Check, ArrowRight, ChevronDown, QrCode, Map as MapIcon } from 'lucide-react';

export const FloorMapHeaderBar = ({
  isDestSelectorOpen, setIsDestSelectorOpen, currentDest, HOTEL_KEY_FACILITIES, selectedDestKey, setSelectedDestKey, setActiveStep, setAutoPlay, onSelectDestination, activeMode, setActiveMode, onCloseQrModal, activeStep, onStepChange, onClose,
}) => (
  <>
      {/* 1. Thanh tiêu đề nổi (Floating Header Bar): Theme xám nhạt đồng bộ hệ thống, phân tách rõ 1 là Bản Đồ, 2 là Mã QR */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-30 flex items-center justify-between pointer-events-none gap-2">
        {/* Bộ chọn cơ sở vật chất / điểm đến nhanh (Facility Selector Dropdown) */}
        <div className="relative pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsDestSelectorOpen((prev) => !prev)}
            className="flex items-center gap-1.5 sm:gap-2 bg-white/95 hover:bg-stone-50 text-stone-900 px-3 py-1.5 rounded-full border border-[#E3DFD5] hover:border-stone-400 shadow-xs cursor-pointer active:scale-95 transition-all min-w-0"
            title="Nhấn để đổi cơ sở vật chất / điểm đến"
          >
            <span className="font-extrabold text-xs text-stone-900 truncate max-w-[130px] sm:max-w-[190px]">
              {currentDest.name}
            </span>
            <span className="text-[10px] font-mono font-semibold text-stone-700 bg-[#EFECE4] px-1.5 py-0.5 rounded border border-[#E3DFD5] shrink-0 uppercase">
              {currentDest.floorLevel}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-stone-500 transition-transform duration-200 shrink-0 ${
                isDestSelectorOpen ? 'rotate-180 text-stone-900' : ''
              }`}
            />
          </button>

          {/* Menu Dropdown danh sách cơ sở vật chất */}
          {isDestSelectorOpen && (
            <>
              {/* Overlay tàng hình để đóng menu khi click ra ngoài */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsDestSelectorOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1.5 z-50 w-64 max-h-[280px] overflow-y-auto no-scrollbar rounded-2xl bg-white/95 backdrop-blur-xl border border-[#E3DFD5] shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 px-2.5 py-1 border-b border-[#E3DFD5] flex items-center justify-between">
                  <span>Chọn cơ sở vật chất</span>
                  <span className="text-[9px] font-mono text-stone-400">7 ĐIỂM ĐẾN</span>
                </div>
                {HOTEL_KEY_FACILITIES.map((fac) => {
                  const isSelected = fac.key === selectedDestKey;
                  return (
                    <button
                      key={fac.key}
                      type="button"
                      onClick={() => {
                        setSelectedDestKey(fac.key);
                        setIsDestSelectorOpen(false);
                        if (onSelectDestination) {
                          onSelectDestination(fac.key);
                        }
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1A1917] text-white shadow-xs'
                          : 'text-stone-800 hover:bg-[#EFECE4]/80 hover:text-stone-950'
                      }`}
                    >
                      <span className="truncate pr-2">{fac.name}</span>
                      <span
                        className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                          isSelected
                            ? 'bg-stone-800 text-stone-200 border border-stone-700'
                            : 'bg-[#EFECE4] text-stone-600 border border-[#E3DFD5]'
                        }`}
                      >
                        {fac.floor}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Nhóm điều khiển: Bản Đồ / Mã QR, Icon chuyển Chặng & Icon Đã Nhớ */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          {/* Bộ chuyển 2 chế độ: Bản Đồ / Mã QR */}
          <div className="flex items-center bg-[#EFECE4]/90 backdrop-blur-md p-0.5 rounded-full border border-[#E3DFD5] shadow-xs gap-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveMode('map');
                if (onCloseQrModal) {
                  try { onCloseQrModal(); } catch (e) { }
                }
              }}
              className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeMode === 'map'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Xem bản đồ chỉ đường"
            >
              <MapIcon className="w-3.5 h-3.5 text-stone-700" />
              <span>Bản Đồ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('qr')}
              className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeMode === 'qr'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Quét mã QR lưu vào điện thoại"
            >
              <QrCode className="w-3.5 h-3.5 text-stone-700" />
              <span>Mã QR</span>
            </button>
          </div>

          {/* Thay nút chặng 1, 2 bằng cụm icon số tròn nhỏ gọn (1) -> (2) */}
          {activeMode === 'map' && currentDest.isDifferentFloor && (
            <div className="flex items-center bg-[#EFECE4]/90 backdrop-blur-md p-0.5 px-1 rounded-full border border-[#E3DFD5] shadow-xs gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveStep(1);
                  setAutoPlay(false);
                  onStepChange?.(1);
                }}
                className={`w-6 h-6 rounded-full text-[11px] font-black transition-all cursor-pointer flex items-center justify-center ${
                  activeStep === 1
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                }`}
                title="Chặng 1: Sảnh đến Thang máy A"
                aria-label="Chặng 1"
              >
                1
              </button>

              <ArrowRight className="w-3 h-3 text-stone-400 shrink-0" />

              <button
                type="button"
                onClick={() => {
                  setActiveStep(2);
                  setAutoPlay(false);
                  onStepChange?.(2);
                }}
                className={`w-6 h-6 rounded-full text-[11px] font-black transition-all cursor-pointer flex items-center justify-center ${
                  activeStep === 2
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                }`}
                title={`Chặng 2: Thang máy đến ${currentDest.name}`}
                aria-label="Chặng 2"
              >
                2
              </button>
            </div>
          )}

          {/* Thay chữ "Đã nhớ" bằng nút icon Check */}
          {onClose && (
            <button
              type="button"
              onClick={() => {
                if (onCloseQrModal) onCloseQrModal();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-stone-900 hover:bg-black text-white flex items-center justify-center shadow-md active:scale-95 cursor-pointer transition-all border border-stone-800"
              title="Đã nhớ (Đóng)"
              aria-label="Đã nhớ"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
  </>
);
