import React, { useState } from 'react';
import {
  Navigation,
  Sparkles,
  MapPin,
  Clock,
  Footprints,
  Smartphone,
  QrCode,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { HOTEL_DESTINATIONS, getMobileGuestMapUrl } from '../../../../components/robot/FloorMap';

export const KioskWayfindingQR = ({ activeStep }) => {
  const params = activeStep?.params || {};
  const initialKey =
    params.destination_key ||
    params.target_destination ||
    params.destination ||
    'infinity_pool';

  const [selectedKey, setSelectedKey] = useState(initialKey);
  const destination = HOTEL_DESTINATIONS[selectedKey] || HOTEL_DESTINATIONS.infinity_pool;
  const qrUrl = getMobileGuestMapUrl(selectedKey);

  const destinationOptions = Object.values(HOTEL_DESTINATIONS).slice(0, 8);

  return (
    <div className="space-y-3.5 animate-in fade-in duration-300 select-none">
      {/* Header chỉ đường */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Navigation className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-stone-900 uppercase tracking-wide">
                Chỉ Đường & Sơ Đồ Khách Sạn
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {destination.floorLevel}
              </span>
            </div>
            <p className="text-[10px] text-stone-500 font-medium">
              Chỉ dẫn chi tiết từng chặng và quét mã QR mang theo trên điện thoại
            </p>
          </div>
        </div>

        {/* Quick Destination Selector */}
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="text-[11px] font-bold bg-white text-stone-800 border border-stone-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
        >
          {destinationOptions.map((dest) => (
            <option key={dest.id} value={dest.id}>
              {dest.name} ({dest.floorLevel})
            </option>
          ))}
        </select>
      </div>

      {/* Main Container: 2 Cột - Bên trái Lộ trình & Thông số, Bên phải Mã QR Code */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-stretch">
        {/* Cột trái: Lộ trình từng bước (7 cols) */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-3 p-3.5 rounded-2xl bg-white border border-stone-200/90 shadow-sm">
          {/* Destination Hero info */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5" />
              <span>Đích đến của quý khách</span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-stone-900 leading-snug">
              {destination.name}
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-medium text-stone-600 pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>{destination.time || '2 - 3 Phút'}</span>
              </span>
              <span className="flex items-center gap-1">
                <Footprints className="w-3.5 h-3.5 text-cyan-600" />
                <span>{destination.distance || '95m'}</span>
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>{destination.floorLevel}</span>
              </span>
            </div>
          </div>

          {/* Step 1 & Step 2 Checklist */}
          <div className="space-y-2 pt-1 border-t border-stone-100">
            <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 flex items-start gap-2.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                1
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-stone-900 block">Chặng 1: Di chuyển tới thang máy</span>
                <span className="text-[11px] text-stone-600 leading-relaxed block">
                  {destination.step1Text || 'Từ sảnh chính đi thẳng qua cửa sảnh tới Thang máy A.'}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-2.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                2
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-emerald-950 block">Chặng 2: Tiếp cận đích đến</span>
                <span className="text-[11px] text-emerald-800 leading-relaxed block">
                  {destination.step2Text || `Ra khỏi thang máy, rẽ theo biển chỉ dẫn để đến ${destination.name}.`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải: Mã QR Code để lưu vào điện thoại (5 cols) */}
        <div className="md:col-span-5 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950 via-stone-900 to-stone-900 text-white border border-emerald-500/30 shadow-md flex flex-col items-center justify-between text-center space-y-2">
          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Quét QR Mang Chỉ Dẫn Theo</span>
            </div>
            <p className="text-[10px] text-stone-300 font-medium">
              Mở camera điện thoại quét mã bên dưới
            </p>
          </div>

          {/* QR Code Container */}
          <div className="p-2 bg-white rounded-xl shadow-lg border border-white/20 flex items-center justify-center">
            <QRCodeSVG
              value={qrUrl}
              size={120}
              level="M"
              includeMargin={false}
            />
          </div>

          <div className="text-[10px] text-stone-400 font-mono">
            Vé chỉ dẫn có hiệu lực 15 phút
          </div>
        </div>
      </div>
    </div>
  );
};
