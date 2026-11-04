import React, { useState } from 'react';
import {
  X,
  Car,
  Plane,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Users,
  AlertCircle,
  FileText,
  Navigation,
} from 'lucide-react';
import { createTaxiRequest } from '../../services/taxiApi';

const POPULAR_DESTINATIONS = [
  { id: 'dad', name: 'Sân bay Quốc tế Đà Nẵng (DAD)', desc: '15 phút di chuyển' },
  { id: 'hoian', name: 'Phố cổ Hội An', desc: '40 phút di chuyển' },
  { id: 'banahills', name: 'Bà Nà Hills & Cầu Vàng', desc: '45 phút di chuyển' },
  { id: 'sontra', name: 'Bán đảo Sơn Trà & Chùa Linh Ứng', desc: '20 phút di chuyển' },
  { id: 'mykhe', name: 'Bãi biển Mỹ Khê', desc: '5 phút di chuyển' },
  { id: 'custom', name: 'Điểm đến khác...', desc: 'Nhập địa chỉ tùy chọn' },
];

export const RobotTaxiModal = ({
  isOpen,
  onClose,
  activeRoomNumber = null,
  onSuccess,
  speak,
}) => {
  const [selectedDest, setSelectedDest] = useState(POPULAR_DESTINATIONS[0].name);
  const [customDest, setCustomDest] = useState('');
  const [vehicleType, setVehicleType] = useState('4-Seater Sedan');
  const [partySize, setPartySize] = useState(2);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedTicket, setConfirmedTicket] = useState(null);

  if (!isOpen) return null;

  const resolvedDestination = selectedDest === 'Điểm đến khác...' ? customDest.trim() : selectedDest;
  const pickupLocation = activeRoomNumber
    ? `Sảnh chính (Khách Phòng ${activeRoomNumber})`
    : 'Sảnh chính & Cổng trước (Main Lobby)';
  const guestName = activeRoomNumber
    ? `Khách Phòng ${activeRoomNumber}`
    : 'Khách tại Sảnh';

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!resolvedDestination) {
      setErrorMsg('Vui lòng chọn hoặc nhập điểm đến của quý khách.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        guest_name: guestName,
        pickup_location: pickupLocation,
        destination: resolvedDestination,
        pickup_time: 'Immediate',
        party_size: Number(partySize) || 2,
        vehicle_type: vehicleType,
        description: note.trim()
          ? `Ghi chú: ${note.trim()} | Phiên phòng: ${activeRoomNumber || 'Lobby'}`
          : `Phiên phòng: ${activeRoomNumber || 'Lobby'} | Xe đón tại sảnh`,
      };

      const res = await createTaxiRequest(payload);
      const ticketCode = res?.ticket_code || `TXI-${Math.floor(1000 + Math.random() * 9000)}`;

      setConfirmedTicket({
        ticketCode,
        destination: resolvedDestination,
        vehicleType,
        partySize,
      });

      if (typeof speak === 'function') {
        speak('Dạ yêu cầu gọi xe của quý khách đã được chuyển tới Đội điều phối sảnh. Taxi sẽ có mặt đón quý khách trong vòng 3 đến 5 phút nữa ạ!');
      }

      if (typeof onSuccess === 'function') {
        onSuccess(res || { ticket_code: ticketCode });
      }
    } catch (err) {
      setErrorMsg('Không thể gửi yêu cầu gọi xe. Quý khách vui lòng thử lại hoặc liên hệ Lễ tân.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setConfirmedTicket(null);
    setErrorMsg('');
    onClose();
  };

  return (
    <div
      onClick={handleResetAndClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-stone-900 border border-stone-700/80 rounded-3xl shadow-2xl p-6 text-stone-100 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Đặt Xe & Gọi Taxi Sảnh</h2>
              <p className="text-xs text-stone-400">Điều phối xe 4 - 7 chỗ hoặc đưa đón sân bay trong 3 - 5 phút</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {confirmedTicket ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Gọi xe thành công</h3>
                <p className="text-sm text-stone-300 mt-1">
                  Mã cuốc xe: <span className="font-mono font-bold text-amber-400 text-base">{confirmedTicket.ticketCode}</span>
                </p>
              </div>

              <div className="bg-stone-800/80 border border-stone-700 rounded-2xl p-4 text-left text-xs space-y-2 max-w-md mx-auto">
                <div className="flex justify-between py-1 border-b border-stone-700/60">
                  <span className="text-stone-400">Điểm đón:</span>
                  <span className="font-semibold text-stone-200">{pickupLocation}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-700/60">
                  <span className="text-stone-400">Điểm đến:</span>
                  <span className="font-semibold text-stone-200">{confirmedTicket.destination}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-700/60">
                  <span className="text-stone-400">Loại xe & Số khách:</span>
                  <span className="font-semibold text-stone-200">{confirmedTicket.vehicleType} · {confirmedTicket.partySize} khách</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-400">Thời gian có mặt:</span>
                  <span className="font-semibold text-emerald-400">Dự kiến 3 - 5 phút</span>
                </div>
              </div>

              <p className="text-xs text-stone-400">
                Đội điều phối sảnh và tài xế đang di chuyển tới cổng chính để đón quý khách.
              </p>

              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-8 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-all cursor-pointer shadow-lg active:scale-95"
              >
                Hoàn tất
              </button>
            </div>
          ) : (
            <>
              {/* Room Session Badge */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-800/60 border border-stone-700/70 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-stone-300">
                    Điểm đón: <strong className="text-white">{pickupLocation}</strong>
                  </span>
                </div>
                {activeRoomNumber && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/40">
                    Phòng {activeRoomNumber}
                  </span>
                )}
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Destination selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400">
                  Chọn điểm đến phổ biến
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {POPULAR_DESTINATIONS.map((dest) => {
                    const isSelected = selectedDest === dest.name;
                    return (
                      <button
                        key={dest.id}
                        type="button"
                        onClick={() => setSelectedDest(dest.name)}
                        className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-md'
                            : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold leading-snug">{dest.name}</span>
                          {dest.id === 'dad' ? (
                            <Plane className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />
                          ) : (
                            <Navigation className="w-3.5 h-3.5 text-stone-400 shrink-0 ml-1" />
                          )}
                        </div>
                        <span className="text-[10px] text-stone-400 mt-1">{dest.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedDest === 'Điểm đến khác...' && (
                  <div className="pt-2 animate-in fade-in">
                    <input
                      type="text"
                      value={customDest}
                      onChange={(e) => setCustomDest(e.target.value)}
                      placeholder="Nhập địa chỉ hoặc điểm đến (vd: Cầu Rồng, Bảo tàng Chăm...)"
                      className="w-full px-4 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-stone-100 placeholder-stone-500 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Vehicle Type & Party Size */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                    Loại xe mong muốn
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: '4-Seater Sedan', name: '4 Chỗ Sedan', desc: '1 - 3 khách · Hành lý gọn' },
                      { id: '7-Seater SUV', name: '7 Chỗ SUV / Van', desc: '4 - 6 khách · Nhiều hành lý' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVehicleType(v.id)}
                        className={`w-full p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          vehicleType === v.id
                            ? 'bg-amber-500/15 border-amber-500/60 text-white'
                            : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800'
                        }`}
                      >
                        <p className="text-xs font-bold">{v.name}</p>
                        <p className="text-[10px] text-stone-400">{v.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                    Số lượng khách
                  </label>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-stone-800/60 border border-stone-700/60">
                    <div className="flex items-center gap-2 text-stone-300">
                      <Users className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold">{partySize} người</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                        className="w-7 h-7 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-200 flex items-center justify-center font-bold text-sm cursor-pointer transition-all active:scale-95"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartySize((p) => Math.min(8, p + 1))}
                        className="w-7 h-7 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-200 flex items-center justify-center font-bold text-sm cursor-pointer transition-all active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">
                      Ghi chú thêm
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="vd: Có 2 vali lớn, cần cốp rộng..."
                      className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-stone-100 placeholder-stone-500 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Arrival time notification banner */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Đội xe túc trực 24/7 tại khu vực sảnh. Thời gian xe đến cửa sảnh đón khách: <strong>3 - 5 phút</strong>.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!confirmedTicket && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
            <button
              type="button"
              onClick={handleResetAndClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-all cursor-pointer shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              <Car className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang điều xe...' : 'Xác nhận gọi xe ngay'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RobotTaxiModal;

