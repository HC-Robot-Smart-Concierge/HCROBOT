import React, { useState, useEffect } from 'react';
import { Sparkles, Tag, QrCode, Clock, Gift, Flame, ArrowRight } from 'lucide-react';

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
    <div className="space-y-2.5 animate-in fade-in zoom-in-95 duration-300">
      {/* Billboard Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600/30 via-purple-900/40 to-stone-900 border border-amber-400/40 p-4 shadow-2xl">
        {/* Glow Ambient */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Promo Header */}
        <div className="flex items-center justify-between relative z-10 mb-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400 text-stone-950 text-[10px] font-black uppercase tracking-wider shadow">
            <Flame className="w-3.5 h-3.5 fill-red-600 text-red-600" />
            <span>Ưu Đãi Đặc Biệt Mùa Hè</span>
          </div>
          <span className="text-[10px] font-mono text-stone-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" /> Đổi slide sau {countdown}s
          </span>
        </div>

        {/* Big Offer Banner */}
        <div className="relative z-10 space-y-1">
          <h3 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
            <span>☀️</span>
            <span>{params.display_banner || 'AURORA SUMMER ESCAPE: GIẢM 20% DỊCH VỤ SPA & ẨM THỰC'}</span>
          </h3>
          <p className="text-[10px] text-stone-300 leading-relaxed">
            Thưởng thức ẩm thực cao cấp tại Nhà hàng Tầng 1 và thư giãn với liệu trình Massage Thảo Mộc tại tầng 3.
          </p>
        </div>

        {/* Perks Grid */}
        <div className="grid grid-cols-2 gap-2 mt-3 relative z-10">
          <div className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-300">
              <Gift className="w-3 h-3 text-amber-400" /> Spa & Trị Liệu
            </div>
            <div className="text-xs font-black text-white">Giảm 20% Toàn Menu</div>
            <div className="text-[9px] text-stone-400">Áp dụng 09:00 - 17:00 hàng ngày</div>
          </div>

          <div className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-300">
              <Tag className="w-3 h-3 text-cyan-400" /> Buffet Hải Sản Tối
            </div>
            <div className="text-xs font-black text-white">Tặng 1 Ly Cocktail VIP</div>
            <div className="text-[9px] text-stone-400">Dành riêng cho khách lưu trú</div>
          </div>
        </div>

        {/* QR & Voucher Action */}
        <div className="mt-3 p-2.5 rounded-xl bg-stone-900/90 border border-amber-500/30 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-white text-stone-950 flex items-center justify-center shadow">
              <QrCode className="w-7 h-7" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-stone-200">Quét mã nhận Voucher điện tử</div>
              <div className="text-[9px] text-amber-400 font-mono font-black">CODE: AURORA-SUMMER26</div>
            </div>
          </div>
          <button
            type="button"
            className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors shadow"
          >
            <span>Nhận ngay</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
