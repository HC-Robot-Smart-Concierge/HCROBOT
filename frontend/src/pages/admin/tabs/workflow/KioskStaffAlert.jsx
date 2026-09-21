import React from 'react';
import { PhoneCall, AlertTriangle, Radio, ShieldAlert, UserCheck, Phone, CheckCircle2 } from 'lucide-react';

export const KioskStaffAlert = ({ activeStep }) => {
  const params = activeStep?.params || {};
  const isWaitingScreen = params.content_id === 'UI_WAITING_STAFF' || params.screen_mode === 'CALL_STAFF_WAIT';

  if (isWaitingScreen) {
    return (
      <div className="space-y-3 animate-in fade-in duration-300">
        {/* Radar & Status */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-red-950/70 via-stone-900 to-amber-950/50 border border-red-500/50 text-center space-y-3 shadow-xl">
          {/* Pulsing Radar Ring */}
          <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping opacity-75" />
            <div className="absolute inset-2 rounded-full bg-amber-500/30 animate-pulse" />
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-red-500/40">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black text-red-300 tracking-wider uppercase flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Đang Kết Nối Khẩn Cấp Tới Lễ Tân
            </h4>
            <p className="text-[11px] text-stone-300 mt-1">
              Hệ thống đã phát tín hiệu định vị trực tiếp từ Robot Concierge tới quầy Lễ Tân chính.
            </p>
          </div>

          {/* Assigned Staff Card */}
          <div className="p-2.5 rounded-xl bg-stone-900/90 border border-stone-700 flex items-center justify-between text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 font-bold text-xs">
                👩‍💼
              </div>
              <div>
                <div className="text-[11px] font-extrabold text-white flex items-center gap-1">
                  Nguyễn Mai Anh <span className="text-[9px] text-emerald-400 font-normal">● Đang trực</span>
                </div>
                <div className="text-[9px] text-stone-400">Trưởng ca lễ tân Sảnh A • Hotline máy nhánh 101</div>
              </div>
            </div>
            <span className="px-2 py-1 rounded-lg text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ETA: ~30 GIÂY
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1 border-t border-stone-800">
            <span className="flex items-center gap-1 text-amber-300">
              <Phone className="w-3 h-3" /> Gọi khẩn cấp: 101 (Miễn phí)
            </span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <UserCheck className="w-3 h-3" /> Nhân viên đang đến chỗ bạn
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Fallback / High-priority ticket dispatch
  return (
    <div className="p-3 rounded-2xl bg-gradient-to-r from-red-950/60 to-stone-900 border border-red-500/40 space-y-2 animate-in fade-in duration-300">
      <div className="flex items-center justify-between text-xs font-black">
        <span className="text-red-400 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
          TÍN HIỆU CẢNH BÁO TRỢ GIÚP KHẨN CẤP
        </span>
        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-red-500/30 text-red-300 border border-red-500/40 animate-pulse">
          MỨC ĐỘ: CAO (VIP)
        </span>
      </div>

      <div className="text-[11px] text-stone-200">
        Khách hàng yêu cầu hỗ trợ trực tiếp tại vị trí:{' '}
        <strong className="text-white font-bold">{params.room_number || 'SẢNH CHÍNH'}</strong>
      </div>

      <div className="p-2 rounded-lg bg-stone-950/80 border border-stone-800 text-[10px] text-amber-300">
        Lý do: <em>"{params.note || 'Khách cần trợ giúp trực tiếp tại quầy'}"</em>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Hệ thống chuông báo lễ tân đã được kích hoạt thành công</span>
      </div>
    </div>
  );
};
