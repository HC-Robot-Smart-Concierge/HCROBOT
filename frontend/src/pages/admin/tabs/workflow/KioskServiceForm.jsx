import React, { useState } from 'react';
import { Bed, Sparkles, Car, Shirt, CheckCircle2, Clock, MapPin, Send } from 'lucide-react';

export const KioskServiceForm = ({ activeStep }) => {
  const params = activeStep?.params || {};
  const isConfirmation = params.content_id === 'UI_CONFIRMATION' || params.screen_mode === 'CONFIRMATION';

  const [selectedService, setSelectedService] = useState('water_towel');
  const roomNumber = params.room_number || '402';

  const servicePresets = [
    { id: 'water_towel', icon: Sparkles, label: 'Thêm khăn tắm & Nước suối', time: '5 - 10 phút' },
    { id: 'cleaning', icon: Bed, label: 'Dọn phòng cấp tốc', time: '15 - 20 phút' },
    { id: 'taxi', icon: Car, label: 'Đặt xe đón / Taxi sân bay', time: '10 phút' },
    { id: 'laundry', icon: Shirt, label: 'Giao nhận đồ giặt ủi', time: '30 phút' },
  ];

  if (isConfirmation) {
    return (
      <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-stone-900 border border-emerald-500/40 text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h4 className="text-xs font-black text-emerald-300 uppercase tracking-wide">
              Yêu Cầu Đã Được Tiếp Nhận
            </h4>
            <p className="text-[11px] text-stone-300 mt-0.5">
              Phiếu phục vụ phòng <span className="font-bold text-white font-mono">#{roomNumber}</span> đã chuyển tới đội Buồng Phòng.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-left">
            <div className="p-2 rounded-xl bg-stone-900/80 border border-stone-800">
              <span className="text-[9px] text-stone-400 block">Mã phiếu</span>
              <span className="text-[11px] font-mono font-bold text-amber-300">#REQ-402-HK</span>
            </div>
            <div className="p-2 rounded-xl bg-stone-900/80 border border-stone-800">
              <span className="text-[9px] text-stone-400 block">Thời gian phục vụ</span>
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> 5 - 10 phút
              </span>
            </div>
          </div>

          <div className="text-[10px] text-stone-400 italic">
            Nhân viên buồng phòng đang chuẩn bị và sẽ đến phòng quý khách ngay!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between pb-1">
        <h4 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
          <Bed className="w-3.5 h-3.5" />
          Biểu Mẫu Yêu Cầu Dịch Vụ Buồng Phòng
        </h4>
        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
          PHÒNG #{roomNumber}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {servicePresets.map((s) => {
          const SIcon = s.icon;
          const isSelected = selectedService === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedService(s.id)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/50'
                  : 'bg-stone-900/70 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <SIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-stone-400'}`} />
                <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-stone-300'}`}>
                  {s.label}
                </span>
              </div>
              <span className="text-[9px] text-stone-500 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> Dự kiến {s.time}
              </span>
            </button>
          );
        })}
      </div>

      {/* Guest Note & Instructions */}
      <div className="p-2.5 rounded-xl bg-stone-900/90 border border-stone-800 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-stone-300">
          <span>Ghi chú từ khách hàng:</span>
          <span className="text-stone-500 text-[9px]">Giọng nói hoặc Chạm màn hình</span>
        </div>
        <div className="p-2 rounded-lg bg-stone-950 border border-stone-800 text-[11px] text-amber-200 font-medium">
          "Thêm 2 chai nước suối khoáng & 1 bộ khăn tắm lớn"
        </div>
      </div>

      <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between text-[10px]">
        <span className="text-blue-300 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-blue-400" /> Vị trí Robot: Sảnh Tầng 1
        </span>
        <span className="text-emerald-400 font-bold flex items-center gap-1">
          <Send className="w-3 h-3" /> Đã kết nối Housekeeping Dispatch
        </span>
      </div>
    </div>
  );
};
