import React, { useState } from 'react';
import { Utensils, ConciergeBell, X, Building, CheckCircle2 } from 'lucide-react';
import { playEarcon } from '../../utils/audioFeedback';

export const OFFICIAL_ROOMS = {
  floor3: ['301', '302', '303', '304', '305', '306', '307', '308', '309', '310'],
  floor4: ['401', '402', '403', '404', '405', '406', '407', '408', '409', '410'],
};

/**
 * RoomPickerModal - Bảng Chọn Số Phòng Cảm Ứng Dành Cho Kiosk Robot & Mobile
 * Dùng cho các luồng tra cứu trạng thái đơn món / dịch vụ (KHÔNG CẦN MÃ PIN)
 * Thiết kế giao diện xám đá tối giản (Minimal Stone Theme), đồng bộ 100% với hệ thống Kiosk
 */
export const RoomPickerModal = ({
  isOpen,
  onClose,
  onSelectRoom,
  title = 'Kiểm Tra Tiến Độ Dịch Vụ & Đơn Hàng',
  subtitle = 'Quý khách vui lòng chọn số phòng để Rora báo tiến độ ngay ạ',
  initialFloor = '3',
  iconType = 'concierge',
}) => {
  const [activeFloor, setActiveFloor] = useState(initialFloor || '3');

  if (!isOpen) return null;

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-picker-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="relative w-full max-w-[340px] sm:max-w-md bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden p-4 sm:p-5 text-stone-100 flex flex-col gap-3">
        {/* Nut Dong */}
        <button
          type="button"
          onClick={() => {
            try { playEarcon('tap'); } catch {}
            if (onClose) onClose();
          }}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-colors cursor-pointer z-10"
          title="Đóng bảng chọn phòng"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Modal */}
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

        {/* Tab Chon Tang (Tang 3 / Tang 4) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-800/80 rounded-xl border border-stone-700/60">
          <button
            type="button"
            onClick={() => {
              try { playEarcon('tap'); } catch {}
              setActiveFloor('3');
            }}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeFloor === '3'
                ? 'bg-stone-100 text-stone-900 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Tầng 3 (301 - 310)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              try { playEarcon('tap'); } catch {}
              setActiveFloor('4');
            }}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeFloor === '4'
                ? 'bg-stone-100 text-stone-900 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Tầng 4 (401 - 410)</span>
          </button>
        </div>

        {/* Luoi 10 Phong (5 Cot x 2 Hang) */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5 px-0.5">
            Chạm vào số phòng của bạn:
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {currentRooms.map((rNum) => (
              <button
                key={rNum}
                type="button"
                onClick={() => handlePickRoom(rNum)}
                className="h-10 sm:h-12 rounded-xl bg-stone-800/90 hover:bg-stone-750 active:bg-stone-700 active:scale-95 border border-stone-700/60 text-stone-100 font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer select-none shadow-sm"
              >
                {rNum}
              </button>
            ))}
          </div>
        </div>

        {/* Chan Modal: Ghi chu nhanh */}
        <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[10px] text-stone-400">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            Tra cứu trực tiếp, không yêu cầu mã PIN
          </span>
          <span className="text-[10px] text-stone-500 font-mono">
            Rora Concierge AI
          </span>
        </div>
      </div>
    </div>
  );
};
