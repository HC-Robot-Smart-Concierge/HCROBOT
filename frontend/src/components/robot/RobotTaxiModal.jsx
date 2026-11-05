import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Car,
  Plane,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Users,
  AlertCircle,
  Navigation,
  Phone,
  PhoneCall,
  UserCheck,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { createTaxiRequest } from '../../services/taxiApi';

export const POPULAR_DESTINATIONS = [
  { id: 'dad', name: 'Sân bay Quốc tế Đà Nẵng (DAD)', desc: '15 phút di chuyển' },
  { id: 'hoian', name: 'Phố cổ Hội An', desc: '40 phút di chuyển' },
  { id: 'banahills', name: 'Bà Nà Hills & Cầu Vàng', desc: '45 phút di chuyển' },
  { id: 'sontra', name: 'Bán đảo Sơn Trà & Chùa Linh Ứng', desc: '20 phút di chuyển' },
  { id: 'mykhe', name: 'Bãi biển Mỹ Khê', desc: '5 phút di chuyển' },
  { id: 'custom', name: 'Điểm đến khác...', desc: 'Nhập địa chỉ tùy chọn' },
];

export const TAXI_PARTNERS = [
  {
    id: 'mailinh',
    name: 'Taxi Mai Linh Đà Nẵng',
    hotline: '0236 3 56 56 56',
    shortCode: '1055',
    color: 'emerald',
    desc: 'Hãng taxi phổ biến nhất, xe có mặt sau 3 đến 5 phút.',
  },
  {
    id: 'vinasun',
    name: 'Taxi Vinasun Đà Nẵng',
    hotline: '0236 3 68 68 68',
    shortCode: null,
    color: 'red',
    desc: 'Đội xe sedan 4 chỗ và SUV 7 chỗ đời mới, phục vụ chuyên nghiệp.',
  },
  {
    id: 'tiensa',
    name: 'Taxi Tiên Sa Đà Nẵng',
    hotline: '0236 3 79 79 79',
    shortCode: null,
    color: 'amber',
    desc: 'Hãng taxi địa phương uy tín, nhận diện xe vàng, phục vụ 24/7.',
  },
  {
    id: 'airport_taxi',
    name: 'Taxi Sân Bay Đà Nẵng',
    hotline: '0236 3 82 82 82',
    shortCode: null,
    color: 'blue',
    desc: 'Chuyên tuyến đưa đón Sân bay Quốc tế Đà Nẵng và tour tham quan.',
  },
];

export const AUTO_CLOSE_SECONDS = 45;

export function isDismissVoiceIntent(transcript) {
  return /cảm ơn|cam on|tắt|tat|đóng|dong|xong rồi|xong roi|thôi|close|dismiss/i.test(transcript || '');
}

export function isSelfBookingVoiceIntent(transcript) {
  return /tự đặt|tự gọi|tự liên hệ|tự book|cho tôi số|cho số|số điện thoại|hotline|option 1|lựa chọn 1|một/i.test(transcript || '');
}

export function isConciergeVoiceIntent(transcript) {
  return /nhờ đặt|đặt giùm|đặt hộ|concierge|nhân viên đặt|lễ tân đặt|hỗ trợ đặt|option 2|lựa chọn 2|hai/i.test(transcript || '');
}

export function buildTaxiBookingPayload({
  activeRoomNumber,
  destination,
  vehicleType = '4-Seater Sedan',
  partySize = 2,
  note = '',
}) {
  const pickupLocation = activeRoomNumber
    ? `Sảnh chính (Khách Phòng ${activeRoomNumber})`
    : 'Sảnh chính & Cổng trước (Main Lobby)';
  const guestName = activeRoomNumber
    ? `Khách Phòng ${activeRoomNumber}`
    : 'Khách tại Sảnh';

  return {
    room_number: activeRoomNumber,
    guest_name: guestName,
    pickup_location: pickupLocation,
    destination: (destination || '').trim(),
    pickup_time: 'Immediate',
    party_size: Number(partySize) || 2,
    vehicle_type: vehicleType,
    description: (note || '').trim()
      ? `Ghi chú: ${(note || '').trim()} | Phiên phòng: ${activeRoomNumber || 'Lobby'}`
      : `Phiên phòng: ${activeRoomNumber || 'Lobby'} | Xe đón tại sảnh`,
  };
}

export const RobotTaxiModal = ({
  isOpen,
  onClose,
  activeRoomNumber = null,
  initialMode = 'options',
  lastVoiceTranscript = '',
  onSuccess,
  speak,
}) => {
  const [mode, setMode] = useState(initialMode);
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SECONDS);
  const [selectedDest, setSelectedDest] = useState(POPULAR_DESTINATIONS[0].name);
  const [customDest, setCustomDest] = useState('');
  const [vehicleType, setVehicleType] = useState('4-Seater Sedan');
  const [partySize, setPartySize] = useState(2);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedTicket, setConfirmedTicket] = useState(null);

  const countdownTimerRef = useRef(null);
  const lastProcessedTranscriptRef = useRef('');

  // Đồng bộ mode khi modal mở lên
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'options');
      setCountdown(AUTO_CLOSE_SECONDS);
      setErrorMsg('');
      setConfirmedTicket(null);
      lastProcessedTranscriptRef.current = '';
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }
  }, [isOpen, initialMode]);

  // Bộ đếm lùi 45s cho màn hình khách tự đặt xe
  useEffect(() => {
    if (isOpen && mode === 'self_booking') {
      setCountdown(AUTO_CLOSE_SECONDS);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
            if (typeof onClose === 'function') {
              onClose();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [isOpen, mode, onClose]);

  // Nhận diện giọng nói để tương tác: chọn option hoặc đóng màn hình khi khách nói "cảm ơn" / "tắt"
  useEffect(() => {
    if (!isOpen || !lastVoiceTranscript) return;

    const transcriptLower = lastVoiceTranscript.toLowerCase().trim();
    if (transcriptLower === lastProcessedTranscriptRef.current) return;
    lastProcessedTranscriptRef.current = transcriptLower;

    if (mode === 'options') {
      if (isSelfBookingVoiceIntent(transcriptLower)) {
        setMode('self_booking');
        if (typeof speak === 'function') {
          speak('Dạ, đây là danh bạ số điện thoại các hãng taxi uy tín tại Đà Nẵng. Màn hình sẽ tự động đóng sau 45 giây hoặc khi quý khách nói cảm ơn ạ.');
        }
      } else if (isConciergeVoiceIntent(transcriptLower)) {
        setMode('concierge_booking');
        if (typeof speak === 'function') {
          speak('Dạ, quý khách vui lòng xác nhận điểm đến và loại xe để nhân viên Concierge hỗ trợ đặt xe ngay cho phòng mình ạ.');
        }
      }
    } else if (mode === 'self_booking') {
      if (isDismissVoiceIntent(transcriptLower)) {
        if (typeof onClose === 'function') {
          onClose();
        }
      }
    }
  }, [isOpen, mode, lastVoiceTranscript, speak, onClose]);

  if (!isOpen) return null;

  const resolvedDestination = selectedDest === 'Điểm đến khác...' ? customDest.trim() : selectedDest;
  const pickupLocation = activeRoomNumber
    ? `Sảnh chính (Khách Phòng ${activeRoomNumber})`
    : 'Sảnh chính & Cổng trước (Main Lobby)';

  const handleSelectSelfBooking = () => {
    setMode('self_booking');
    if (typeof speak === 'function') {
      speak('Dạ, đây là danh bạ số điện thoại các hãng taxi uy tín tại Đà Nẵng. Màn hình sẽ tự động đóng sau 45 giây hoặc khi quý khách nói cảm ơn ạ.');
    }
  };

  const handleSelectConciergeBooking = () => {
    setMode('concierge_booking');
    if (typeof speak === 'function') {
      speak('Dạ, quý khách vui lòng xác nhận điểm đến và loại xe để Concierge hỗ trợ đặt xe ngay cho phòng mình ạ.');
    }
  };

  const handleSubmitConciergeRequest = async (e) => {
    if (e) e.preventDefault();
    if (!resolvedDestination) {
      setErrorMsg('Vui lòng chọn hoặc nhập điểm đến của quý khách.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = buildTaxiBookingPayload({
        activeRoomNumber,
        destination: resolvedDestination,
        vehicleType,
        partySize,
        note,
      });

      const res = await createTaxiRequest(payload);
      const ticketCode = res?.ticket_code || `TX-${Math.floor(10000 + Math.random() * 90000)}`;

      setConfirmedTicket({
        ticketCode,
        destination: resolvedDestination,
        vehicleType,
        partySize,
        roomNumber: activeRoomNumber,
      });
      setMode('concierge_confirmed');

      const roomText = activeRoomNumber ? `phòng ${activeRoomNumber}` : 'quý khách';
      if (typeof speak === 'function') {
        speak(`Dạ em đã chuyển tiếp yêu cầu đặt taxi của ${roomText} đến bộ phận Concierge. Quý khách có thể hỏi em 'Kiểm tra trạng thái đặt taxi' bất kỳ lúc nào để biết tiến độ xe đón ạ!`);
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
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setConfirmedTicket(null);
    setErrorMsg('');
    setMode('options');
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
            {mode !== 'options' && !confirmedTicket && (
              <button
                type="button"
                onClick={() => setMode('options')}
                className="w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition-all cursor-pointer mr-1"
                aria-label="Quay lại"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">Đặt Xe & Taxi Sảnh</h2>
                {activeRoomNumber && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/40">
                    Phòng {activeRoomNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400">
                {mode === 'options' && 'Vui lòng chọn hình thức đặt xe thuận tiện cho quý khách'}
                {mode === 'self_booking' && 'Danh bạ hotline các hãng taxi đối tác uy tín'}
                {mode === 'concierge_booking' && 'Concierge hỗ trợ điều phối xe đón tại sảnh'}
                {mode === 'concierge_confirmed' && 'Yêu cầu đặt xe đã được chuyển tiếp thành công'}
              </p>
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* VIEW 1: LỰA CHỌN 2 OPTION */}
          {mode === 'options' && (
            <div className="space-y-4 py-2">
              <div className="p-3.5 rounded-2xl bg-stone-800/60 border border-stone-700/70 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Xác thực phòng thành công: <strong className="text-white">{pickupLocation}</strong></span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Option 1: Khách tự gọi xe */}
                <div
                  onClick={handleSelectSelfBooking}
                  className="p-5 rounded-3xl bg-stone-800/80 border border-stone-700 hover:border-amber-500/70 hover:bg-stone-800 transition-all cursor-pointer flex flex-col justify-between group shadow-lg active:scale-[0.98]"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                      <PhoneCall className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Lựa chọn 1</span>
                      <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                        Khách Tự Đặt Xe
                      </h3>
                      <p className="text-xs text-stone-300 mt-1.5 leading-relaxed">
                        Hiển thị danh bạ số hotline các hãng taxi uy tín tại Đà Nẵng để quý khách chủ động gọi xe trực tiếp.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-stone-700/60 flex items-center justify-between text-xs font-semibold text-amber-400">
                    <span>Xem số điện thoại</span>
                    <span className="text-stone-400 text-[10px]">(Tự đóng sau 45s)</span>
                  </div>
                </div>

                {/* Option 2: Nhờ Concierge đặt giùm */}
                <div
                  onClick={handleSelectConciergeBooking}
                  className="p-5 rounded-3xl bg-stone-800/80 border border-stone-700 hover:border-emerald-500/70 hover:bg-stone-800 transition-all cursor-pointer flex flex-col justify-between group shadow-lg active:scale-[0.98]"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Lựa chọn 2</span>
                      <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                        Nhờ Concierge Đặt Giùm
                      </h3>
                      <p className="text-xs text-stone-300 mt-1.5 leading-relaxed">
                        Chuyển tiếp yêu cầu sang Bộ phận Concierge. Nhân viên sẽ liên hệ hãng xe và hỗ trợ đón quý khách tại sảnh.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-stone-700/60 flex items-center justify-between text-xs font-semibold text-emerald-400">
                    <span>Gửi yêu cầu điều xe</span>
                    <span className="text-stone-400 text-[10px]">(Hỏi trạng thái bất kỳ lúc nào)</span>
                  </div>
                </div>
              </div>

              <div className="text-center text-[11px] text-stone-400 pt-2">
                Quý khách cũng có thể nói: <em>&quot;Tôi muốn tự đặt&quot;</em> hoặc <em>&quot;Nhờ Concierge đặt giùm&quot;</em>
              </div>
            </div>
          )}

          {/* VIEW 2: HIỂN THỊ SỐ ĐIỆN THOẠI KHÁCH TỰ ĐẶT (ĐẾM LÙI 45S) */}
          {mode === 'self_booking' && (
            <div className="space-y-4">
              {/* Countdown banner */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                  <span>
                    Màn hình sẽ tự động đóng sau: <strong className="font-mono text-white text-sm">{countdown}s</strong>
                  </span>
                </div>
                <span className="text-[11px] text-stone-300">
                  (Hoặc nói <strong>&quot;Cảm ơn&quot;</strong> / <strong>&quot;Tắt&quot;</strong> để đóng ngay)
                </span>
              </div>

              {/* Grid danh bạ taxi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {TAXI_PARTNERS.map((partner) => (
                  <div
                    key={partner.id}
                    className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700 flex flex-col justify-between space-y-2 hover:border-stone-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                        <h4 className="text-xs font-bold text-white">{partner.name}</h4>
                      </div>
                      {partner.shortCode && (
                        <span className="px-2 py-0.5 rounded-full bg-stone-700 text-amber-300 font-mono text-[10px] font-bold">
                          Tổng đài {partner.shortCode}
                        </span>
                      )}
                    </div>

                    <a
                      href={`tel:${partner.hotline.replace(/\s+/g, '')}`}
                      className="text-lg font-mono font-bold text-amber-400 tracking-wider hover:underline"
                    >
                      {partner.hotline}
                    </a>

                    <p className="text-[11px] text-stone-400 leading-snug">{partner.desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setMode('options')}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Quay lại chọn hình thức khác
                </button>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold cursor-pointer transition-colors"
                >
                  Đóng màn hình
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3: FORM NHỜ CONCIERGE ĐẶT GIÙM */}
          {mode === 'concierge_booking' && (
            <div className="space-y-4">
              {/* Destination selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400">
                  Chọn điểm đến
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
                      placeholder="Nhập địa chỉ hoặc điểm đến (vd: Cầu Rồng, Chợ Hàn...)"
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
                      placeholder="vd: Có 2 vali lớn, cần xe sạch sẽ..."
                      className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-stone-100 placeholder-stone-500 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Informational banner */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200/90">
                <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Yêu cầu sẽ được chuyển ngay đến Bộ phận Concierge. Sau khi gửi, quý khách có thể hỏi Robot: <strong>&quot;Kiểm tra trạng thái đặt taxi&quot;</strong> bất cứ lúc nào.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setMode('options')}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition-all cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleSubmitConciergeRequest}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs transition-all cursor-pointer shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50"
                >
                  <Car className="w-4 h-4" />
                  <span>{isSubmitting ? 'Đang chuyển yêu cầu...' : 'Gửi Yêu Cầu Cho Concierge'}</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 4: THÔNG BÁO CHUYỂN REQUEST CHO CONCIERGE THÀNH CÔNG */}
          {mode === 'concierge_confirmed' && confirmedTicket && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Chuyển tiếp yêu cầu thành công</h3>
                <p className="text-sm text-stone-300 mt-1">
                  Yêu cầu đặt taxi đã được gửi đến <strong className="text-emerald-400">Bộ phận Concierge</strong>
                </p>
                <p className="text-xs text-amber-400 font-mono font-bold mt-1">
                  Mã yêu cầu: {confirmedTicket.ticketCode}
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
                  <span className="text-stone-400">Loại xe:</span>
                  <span className="font-semibold text-stone-200">{confirmedTicket.vehicleType} ({confirmedTicket.partySize} khách)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-400">Thời gian xe đến:</span>
                  <span className="font-semibold text-emerald-400">Dự kiến 3 - 5 phút tại sảnh</span>
                </div>
              </div>

              {/* Status Query Hint Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 max-w-md mx-auto text-left flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white">Tra cứu trạng thái chuyến xe:</span>
                  <p className="text-stone-300 text-[11px] mt-0.5">
                    Quý khách có thể hỏi Robot bất cứ lúc nào: <em>&quot;Kiểm tra trạng thái đặt taxi&quot;</em> hoặc <em>&quot;Taxi tới chưa&quot;</em> để cập nhật tiến độ xe đón.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-8 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm transition-all cursor-pointer shadow-lg active:scale-95"
              >
                Hoàn tất
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RobotTaxiModal;
