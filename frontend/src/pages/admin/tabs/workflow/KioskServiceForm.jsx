import React, { useState } from 'react';
import { Bed, Sparkles, Car, Shirt, CheckCircle2, Clock, MapPin, Send, Droplets } from 'lucide-react';

export const KioskServiceForm = ({ activeStep }) => {
  const params = activeStep?.params || {};
  const isConfirmation = params.content_id === 'UI_CONFIRMATION' || params.screen_mode === 'CONFIRMATION';

  const [selectedService, setSelectedService] = useState('water_towel');
  const roomNumber = params.room_number || '402';

  const servicePresets = [
    {
      id: 'water_towel',
      icon: Droplets,
      label: 'Khăn Tắm & Nước Suối',
      desc: 'Bộ khăn cotton & 2 chai nước khoáng',
      time: '5 - 10 phút',
      color: 'amber',
    },
    {
      id: 'cleaning',
      icon: Bed,
      label: 'Dọn Phòng Cấp Tốc',
      desc: 'Hút bụi & thay drap giường',
      time: '15 - 20 phút',
      color: 'blue',
    },
    {
      id: 'taxi',
      icon: Car,
      label: 'Đặt Xe Đón / Taxi',
      desc: 'Xe đón sảnh chính hoặc sân bay',
      time: '10 phút',
      color: 'emerald',
    },
    {
      id: 'laundry',
      icon: Shirt,
      label: 'Giao Nhận Giặt Ủi',
      desc: 'Giao đồ giặt khô & ủi phẳng',
      time: '30 phút',
      color: 'purple',
    },
  ];

  if (isConfirmation) {
    return (
      <div className="space-y-3 py-1 animate-in fade-in zoom-in-95 duration-300">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-emerald-300 shadow-md text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center text-emerald-600 shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h4 className="text-sm font-black text-emerald-900 uppercase tracking-wide">
              Yêu Cầu Đã Được Tiếp Nhận Thành Công
            </h4>
            <p className="text-xs text-stone-600 mt-1">
              Phiếu phục vụ phòng <span className="font-extrabold text-stone-900 font-mono text-sm px-1.5 py-0.5 rounded bg-emerald-100/70 border border-emerald-200">#{roomNumber}</span> đã được gửi trực tiếp tới đội Buồng Phòng.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1 text-left">
            <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase block">Mã phiếu điện tử</span>
              <span className="text-xs font-mono font-black text-amber-700">#REQ-{roomNumber}-HK</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase block">Thời gian phục vụ dự kiến</span>
              <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" /> 5 - 10 phút
              </span>
            </div>
          </div>

          <div className="text-[11px] text-stone-500 italic pt-1">
            Nhân viên buồng phòng đang chuẩn bị và sẽ đến phòng quý khách ngay!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <Bed className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-stone-900">
              Biểu Mẫu Yêu Cầu Dịch Vụ Buồng Phòng
            </h4>
            <p className="text-[10px] text-stone-500">Chạm chọn tiện ích cần bổ sung</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-sm font-mono">
          PHÒNG #{roomNumber}
        </span>
      </div>

      {/* Preset Service Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {servicePresets.map((s) => {
          const SIcon = s.icon;
          const isSelected = selectedService === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedService(s.id)}
              className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-sm ${
                isSelected
                  ? 'bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-500 ring-2 ring-amber-200 shadow-md scale-[1.01]'
                  : 'bg-white border-stone-200 hover:border-amber-300 hover:bg-stone-50/70'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isSelected ? 'bg-amber-500 text-white shadow-sm' : 'bg-stone-100 text-stone-600'
                }`}>
                  <SIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold text-stone-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" /> {s.time}
                </span>
              </div>
              <div className={`text-xs font-bold ${isSelected ? 'text-stone-900' : 'text-stone-800'}`}>
                {s.label}
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5 line-clamp-1">
                {s.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Guest Note & Instructions */}
      <div className="p-3 rounded-2xl bg-white border border-stone-200/90 shadow-sm space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-stone-700">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Ghi chú từ khách hàng:
          </span>
          <span className="text-stone-400 text-[10px] font-normal">Nói qua micro hoặc chạm màn hình</span>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-stone-800 font-semibold">
          "Thêm 2 chai nước suối khoáng & 1 bộ khăn tắm lớn"
        </div>
      </div>

      {/* Status Pill Footer */}
      <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200/80 flex items-center justify-between text-[11px]">
        <span className="text-blue-900 font-medium flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-600" /> Vị trí Robot: Sảnh Tầng 1
        </span>
        <span className="text-emerald-700 font-bold flex items-center gap-1">
          <Send className="w-3.5 h-3.5 text-emerald-600" /> Đã kết nối Housekeeping Dispatch
        </span>
      </div>
    </div>
  );
};
