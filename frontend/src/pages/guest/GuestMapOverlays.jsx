import React from 'react';
import {
  Clock,
  Plus,
  Minus,
  RotateCcw,
  Check,
  Monitor,
  RotateCw,
} from 'lucide-react';

export const GuestMapExpiredView = ({
  isManualDismissed,
  isExpired,
  currentDest,
  onReopenTicket,
}) => (
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
          onClick={onReopenTicket}
          className="mt-2 w-full py-2.5 px-4 rounded-xl bg-[#1C1917] text-[#FAF8F5] text-xs font-bold shadow-sm active:scale-95 transition cursor-pointer"
        >
          Xem lại bản đồ chỉ dẫn
        </button>
      )}
    </div>
  </main>
);

export const GuestMapTopHeaderPill = ({ activeLeg, setActiveLeg, currentDest }) => (
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
);

export const GuestMapRightControls = ({
  isHeadingUp,
  onToggleHeadingUp,
  is3D,
  onToggle3D,
  onRecenter,
  onZoomIn,
  onZoomOut,
}) => (
  <div className="absolute right-2.5 bottom-[72px] z-30 flex flex-col items-center gap-2">
    <button
      type="button"
      onClick={onToggleHeadingUp}
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
      onClick={onToggle3D}
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
      onClick={onRecenter}
      className="w-[38px] h-[38px] rounded-full bg-white/95 text-[#1C1917] border border-[#E3DFD5] shadow-md flex items-center justify-center cursor-pointer"
      title="Căn giữa lộ trình"
    >
      <RotateCcw className="w-3.5 h-3.5" />
    </button>

    <div className="flex flex-col bg-white/95 border border-[#E3DFD5] rounded-full shadow-md overflow-hidden">
      <button
        type="button"
        onClick={onZoomIn}
        className="w-9 h-8 flex items-center justify-center text-[#1C1917] border-b border-[#EFECE6] active:bg-[#EFECE6] cursor-pointer"
        title="Phóng to"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        className="w-9 h-8 flex items-center justify-center text-[#1C1917] active:bg-[#EFECE6] cursor-pointer"
        title="Thu nhỏ"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

export const GuestMapBottomPill = ({
  currentDest,
  formattedRemaining,
  activeLeg,
  setActiveLeg,
  onFinishTicket,
}) => (
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
        onClick={onFinishTicket}
        className="h-8 px-2.5 rounded-full bg-[#EFECE6] border border-[#E3DFD5] text-[#1C1917] text-[11px] font-extrabold flex items-center gap-1 active:scale-95 transition cursor-pointer"
      >
        <Check className="w-3 h-3" />
        <span>Đóng</span>
      </button>
    </div>
  </div>
);

export const GuestMapIphoneMockupShell = ({
  mockupOrientation,
  setMockupOrientation,
  setIsIphoneMockup,
  children,
}) => {
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
          {children}
        </div>
      </div>
    </div>
  );
};
