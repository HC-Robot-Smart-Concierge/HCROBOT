import React, { useState, useEffect } from 'react';
import { ConciergeBell, X, PhoneCall, Check, ArrowRight } from 'lucide-react';
import { playEarcon } from '../../utils/audioFeedback';

/**
 * EmotionAssistanceModal - Pop-up ho tro truc tiep khi phat hien khach hang kho chiu (Unhappy)
 * Ho tro ca tuong tac cham man hinh (Touch Kiosk) va giong noi (Voice Recognition).
 * Thiet ke toi gian (Minimal Stone Theme), dong bo voi toan bo he thong.
 */
export const EmotionAssistanceModal = ({
  isOpen = false,
  onConfirm = () => {},
  onDismiss = () => {},
  language = 'Tiếng Việt',
  autoCloseSeconds = 15,
}) => {
  const [countdown, setCountdown] = useState(autoCloseSeconds);
  const isEn = language === 'English';

  useEffect(() => {
    if (!isOpen) {
      setCountdown(autoCloseSeconds);
      return undefined;
    }

    setCountdown(autoCloseSeconds);
    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isOpen, autoCloseSeconds, onDismiss]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    try {
      playEarcon('tap');
    } catch {}
    onConfirm();
  };

  const handleDismiss = () => {
    try {
      playEarcon('tap');
    } catch {}
    onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistance-modal-title"
    >
      <div className="relative w-full max-w-[360px] sm:max-w-md bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden p-5 sm:p-6 text-stone-100 flex flex-col gap-4">
        {/* Nut Dong nhanh goc phai */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-colors cursor-pointer z-10"
          title={isEn ? 'Close' : 'Đóng'}
          aria-label={isEn ? 'Close' : 'Đóng'}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Modal */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-stone-800 border border-stone-700 text-stone-200 flex items-center justify-center shrink-0 shadow-inner">
            <ConciergeBell className="w-6 h-6 text-stone-200" />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="assistance-modal-title"
              className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug"
            >
              {isEn ? 'Need Concierge Assistance?' : 'Quý Khách Cần Hỗ Trợ?'}
            </h3>
            <p className="text-xs text-stone-400 font-normal leading-relaxed mt-0.5">
              {isEn
                ? 'Rora noticed you might be experiencing trouble. Would you like to call Concierge staff?'
                : 'Rora nhận thấy quý khách có thể đang gặp bất tiện. Quý khách có cần gọi nhân viên Concierge hỗ trợ không ạ?'}
            </p>
          </div>
        </div>

        {/* Lua chon tuong tac (Touch Options) */}
        <div className="flex flex-col gap-2.5 pt-1">
          {/* Nút Gọi Concierge (Primary action) */}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full p-3.5 rounded-2xl bg-stone-100 hover:bg-white text-stone-900 font-bold text-sm sm:text-base flex items-center justify-between transition-all shadow-md active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="font-bold leading-tight">
                  {isEn ? 'Call Concierge Staff' : 'Gọi Nhân Viên Concierge'}
                </div>
                <div className="text-[11px] text-stone-600 font-normal">
                  {isEn ? 'Connect directly to support desk' : 'Kết nối trực tiếp hỗ trợ ngay'}
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-700 shrink-0" />
          </button>

          {/* Nút Từ Chối (Secondary action) */}
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full p-3 rounded-2xl bg-stone-800/80 hover:bg-stone-800 text-stone-300 hover:text-white font-medium text-xs sm:text-sm flex items-center justify-between border border-stone-700/60 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-stone-700 text-stone-300 flex items-center justify-center">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>{isEn ? 'No, I am fine. Thank you' : 'Không, tôi tự xử lý được. Cảm ơn'}</span>
            </div>
            <span className="text-[11px] text-stone-400 font-mono">
              {countdown}s
            </span>
          </button>
        </div>

        {/* Footer Hint */}
        <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[10px] text-stone-400 font-mono">
          <span>{isEn ? 'Voice recognition enabled' : 'Quý khách có thể nói "Có" hoặc "Không"'}</span>
          <span>{countdown}s</span>
        </div>
      </div>
    </div>
  );
};
