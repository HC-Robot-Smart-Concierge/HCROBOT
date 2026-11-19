import React, { useEffect, useState } from 'react';
import { Utensils, ConciergeBell, X, Building, CheckCircle2 } from 'lucide-react';
import { playEarcon } from '../../utils/audioFeedback';

export const OFFICIAL_ROOMS = {
  floor3: ['301', '302', '303', '304', '305', '306', '307', '308', '309', '310'],
  floor4: ['401', '402', '403', '404', '405', '406', '407', '408', '409', '410'],
};

/**
 * RoomPickerModal - Bảng Chọn Số Phòng Cảm Ứng Dành Cho Kiosk Robot & Mobile
 * Hỗ trợ theme tối (tra cứu trạng thái trực tiếp) và theme sáng tối giản (đồng bộ bước chọn phòng).
 */
export const RoomPickerModal = ({
  isOpen,
  onClose,
  onSelectRoom,
  title = 'Kiểm Tra Tiến Độ Dịch Vụ & Đơn Hàng',
  subtitle = 'Quý khách vui lòng chọn số phòng để Rora báo tiến độ ngay ạ',
  initialFloor = '3',
  selectedRoom = '',
  iconType = 'concierge',
  variant = 'dark',
  floorLabels = null,
}) => {
  const [activeFloor, setActiveFloor] = useState(initialFloor || '3');

  useEffect(() => {
    if (isOpen && initialFloor) {
      setActiveFloor(initialFloor);
    }
  }, [isOpen, initialFloor]);

  if (!isOpen) return null;

  const isLight = variant === 'light';
  const floorTabs = [
    {
      id: '3',
      label: floorLabels?.floor3 || (isLight ? 'Tầng 3 (P.301 - 310)' : 'Tầng 3 (301 - 310)'),
    },
    {
      id: '4',
      label: floorLabels?.floor4 || (isLight ? 'Tầng 4 (P.401 - 410)' : 'Tầng 4 (401 - 410)'),
    },
  ];

  const handlePickRoom = (roomNum) => {
    try {
      playEarcon('tap');
    } catch {}
    if (onSelectRoom) {
      onSelectRoom(roomNum);
    }
    if (onClose) {
      onClose();
    }
  };

  const currentRooms = activeFloor === '3' ? OFFICIAL_ROOMS.floor3 : OFFICIAL_ROOMS.floor4;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 select-none overscroll-contain ${
        isLight ? 'bg-black/60 backdrop-blur-xs' : 'bg-black/80 backdrop-blur-sm'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-picker-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        className={`relative w-full max-h-[92vh] overflow-y-auto overscroll-contain touch-pan-y shadow-2xl transition-all ${
          isLight
            ? 'max-w-[340px] sm:max-w-sm p-5 sm:p-6 rounded-3xl bg-white border border-[#E3DFD5] text-stone-900 space-y-3.5'
            : 'max-w-[340px] sm:max-w-md p-4 sm:p-5 rounded-2xl bg-stone-900 border border-stone-800 text-stone-100 flex flex-col gap-3'
        }`}
      >
        {/* Nút Đóng */}
        <button
          type="button"
          onClick={() => {
            try { playEarcon('tap'); } catch {}
            if (onClose) onClose();
          }}
          className={`absolute z-10 w-8 h-8 flex items-center justify-center transition-colors cursor-pointer ${
            isLight
              ? 'top-3.5 right-3.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800'
              : 'top-3 right-3 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-stone-200'
          }`}
          title="Đóng"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Modal */}
        {isLight ? (
          <div className="text-center px-6">
            <h3 id="room-picker-title" className="text-sm sm:text-base font-extrabold text-stone-900">
              {title}
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">{subtitle}</p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 pr-8">
            <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700/60 text-stone-300 flex items-center justify-center shrink-0">
              {iconType === 'concierge' || iconType === 'service' ? (
                <ConciergeBell className="w-5 h-5 text-stone-300" />
              ) : (
                <Utensils className="w-5 h-5 text-stone-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                id="room-picker-title"
                className="text-sm sm:text-base font-bold text-stone-100 tracking-tight leading-snug truncate"
              >
                {title}
              </h3>
              <p className="text-[11px] text-stone-400 font-normal leading-tight mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>
        )}

        {/* Tab Chọn Tầng (Tầng 3 / Tầng 4) */}
        <div
          className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border ${
            isLight ? 'bg-stone-100 border-stone-200' : 'bg-stone-800/80 border-stone-700/60'
          }`}
        >
          {floorTabs.map((tab) => {
            const isTabActive = activeFloor === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  try { playEarcon('tap'); } catch {}
                  setActiveFloor(tab.id);
                }}
                className={`py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isLight
                    ? `rounded-lg ${isTabActive ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'}`
                    : `px-3 rounded-lg ${isTabActive ? 'bg-stone-100 text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-200'}`
                }`}
              >
                {!isLight && <Building className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Lưới 10 Phòng (5 Cột x 2 Hàng) */}
        <div>
          {!isLight && (
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5 px-0.5">
              Chạm vào số phòng của bạn:
            </div>
          )}
          <div className="grid grid-cols-5 gap-1.5">
            {currentRooms.map((rNum) => {
              const isSelected = Boolean(selectedRoom && String(selectedRoom).trim() === rNum);
              return (
                <button
                  key={rNum}
                  type="button"
                  onClick={() => handlePickRoom(rNum)}
                  className={
                    isLight
                      ? `py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer select-none active:scale-95 ${
                          isSelected
                            ? 'bg-[#1A1917] text-white shadow-sm'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-900 border border-stone-200/80'
                        }`
                      : 'h-10 sm:h-12 rounded-xl bg-stone-800/90 hover:bg-stone-750 active:bg-stone-700 active:scale-95 border border-stone-700/60 text-stone-100 font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer select-none shadow-sm'
                  }
                >
                  {rNum}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chân Modal (chỉ hiển thị cho dark lookup mode) */}
        {!isLight && (
          <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[10px] text-stone-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Tra cứu trực tiếp, không yêu cầu mã PIN
            </span>
            <span className="text-[10px] text-stone-500 font-mono">
              Rora Concierge AI
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
