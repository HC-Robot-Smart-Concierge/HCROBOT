import React, { useState, useEffect } from 'react';
import { Tag, QrCode, Clock, Gift, Flame, ArrowRight, Sparkles, Percent } from 'lucide-react';

export const KioskPromoSlide = ({ activeStep }) => {
  const params = activeStep?.params || {};
  const [countdown, setCountdown] = useState(params.timeout || params.slide_duration_sec || 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
      {/* Radiant Resort Billboard Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50/70 to-rose-50 border-2 border-amber-300/80 p-4 sm:p-5 shadow-lg">
        {/* Decorative Ambient Radial Glows */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-rose-400/20 rounded-full blur-2xl pointer-events-none" />

        {/* Promo Header Badge & Live Countdown */}
        <div className="flex items-center justify-between relative z-10 mb-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
            <Flame className="w-3.5 h-3.5 fill-white text-white" />
            <span>Ưu Đãi Đặc Biệt Mùa Hè</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100/90 px-2.5 py-1 rounded-full border border-amber-300 flex items-center gap-1 shadow-sm">
            <Clock className="w-3 h-3 text-amber-700" /> Đổi slide sau {countdown}s
          </span>
        </div>

        {/* Big Offer Banner */}
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-amber-500 text-white text-xs font-black">
              <Percent className="w-3.5 h-3.5" />
            </span>
            <h3 className="text-sm sm:text-base font-black text-stone-900 tracking-tight leading-snug">
              {params.display_banner || 'AURORA SUMMER ESCAPE: GIẢM 20% DỊCH VỤ SPA & ẨM THỰC'}
            </h3>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed font-medium">
            Tận hưởng trọn vẹn kỳ nghỉ dưỡng 5 sao với đặc quyền ẩm thực Á - Âu tại tầng 1 và gói trị liệu thư giãn thảo mộc tự nhiên tại tầng 3.
          </p>
        </div>

        {/* 2 Crisp Perks Cards */}
        <div className="grid grid-cols-2 gap-2.5 pt-3 relative z-10">
          <div className="p-2.5 rounded-xl bg-white/90 backdrop-blur-sm border border-amber-200/90 shadow-sm flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-stone-900 block">Tặng Set Trà Chiều</span>
              <span className="text-[9px] text-stone-500 block">Dành cho bàn từ 2 khách</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/90 backdrop-blur-sm border border-rose-200/90 shadow-sm flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-stone-900 block">Tặng Voucher Spa 200k</span>
              <span className="text-[9px] text-stone-500 block">Áp dụng liệu trình từ 60 phút</span>
            </div>
          </div>
        </div>

        {/* QR Code Action Footer */}
        <div className="mt-3 pt-3 border-t border-amber-200/70 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-900 font-bold">
              <QrCode className="w-5 h-5 text-stone-800" />
            </div>
            <div>
              <span className="text-[11px] font-black text-stone-900 block">Quét QR nhận mã ưu đãi</span>
              <span className="text-[9px] text-stone-500 block">Áp dụng trực tiếp tại quầy thanh toán</span>
            </div>
          </div>
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1"
          >
            <span>Nhận ngay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
