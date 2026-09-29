import React from 'react';
import { PhoneCall, AlertTriangle, Radio, ShieldAlert, UserCheck, Phone, CheckCircle2 } from 'lucide-react';

export const KioskStaffAlert = ({ activeStep }) => {
  const params = activeStep?.params || {};
  const isWaitingScreen = params.content_id === 'UI_WAITING_STAFF' || params.screen_mode === 'CALL_STAFF_WAIT';

  if (isWaitingScreen) {
    return (
      <div className="space-y-3 py-1 animate-in fade-in duration-300">
        {/* Luminous Radar & Reception Status Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-50 via-white to-amber-50 border-2 border-rose-300/80 text-center space-y-3 shadow-md">
          {/* Pulsing Alert Radar Ring */}
          <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-rose-400/20 animate-ping opacity-75" />
            <div className="absolute inset-2 rounded-full bg-amber-400/30 animate-pulse" />
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-rose-400/40">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div>
            <h4 className="text-xs sm:text-sm font-black text-rose-900 tracking-wider uppercase flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Đang Kết Nối Khẩn Cấp Tới Quầy Lễ Tân
            </h4>
            <p className="text-xs text-stone-600 mt-1 max-w-sm mx-auto">
              Hệ thống đã phát tín hiệu định vị trực tiếp từ Robot Concierge tới quầy Lễ Tân sảnh chính.
            </p>
          </div>

          {/* Assigned Staff Card */}
          <div className="p-3 rounded-2xl bg-white border border-stone-200/90 shadow-sm flex items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-lg shadow-sm">
                👩‍💼
              </div>
              <div>
                <div className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                  <span>Nguyễn Mai Anh</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ● Đang trực ca
                  </span>
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">Trưởng ca lễ tân Sảnh A • Máy nhánh 101</div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 shadow-sm">
              ETA: ~30 GIÂY
            </span>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between text-[11px] text-stone-600 pt-2 border-t border-rose-100">
            <span className="flex items-center gap-1.5 font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              <Phone className="w-3.5 h-3.5 text-rose-600" /> Hotline: 101 (Miễn phí)
            </span>
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Nhân viên đang đến chỗ bạn
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Fallback / High-priority ticket dispatch
  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 via-white to-amber-50 border-2 border-rose-300/80 space-y-2.5 shadow-md animate-in fade-in duration-300">
      <div className="flex items-center justify-between text-xs font-black">
        <span className="text-rose-800 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
          TÍN HIỆU CẢNH BÁO TRỢ GIÚP KHẨN CẤP
        </span>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
          MỨC ĐỘ: CAO (VIP)
        </span>
      </div>

      <div className="text-xs text-stone-700">
        Khách hàng yêu cầu hỗ trợ trực tiếp tại vị trí:{' '}
        <strong className="text-stone-900 font-extrabold">{params.room_number || 'SẢNH CHÍNH'}</strong>
      </div>

      <div className="p-2.5 rounded-xl bg-white border border-stone-200 text-xs text-stone-800 font-medium">
        Lý do: <em>"{params.note || 'Khách cần trợ giúp trực tiếp tại quầy'}"</em>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold pt-1">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <span>Hệ thống chuông báo lễ tân đã được kích hoạt thành công</span>
      </div>
    </div>
  );
};
