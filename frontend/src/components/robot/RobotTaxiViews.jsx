import React from 'react';
import {
  Plane,
  Clock,
  CheckCircle2,
  Navigation,
  Phone,
  PhoneCall,
  UserCheck,
  ArrowLeft,
  Info,
  Mic,
  Edit3,
  Send,
} from 'lucide-react';
import { POPULAR_DESTINATIONS, TAXI_PARTNERS } from './robotTaxiUtils';

export const RobotTaxiViews = ({
  mode, setMode, conciergeStage, setConciergeStage, setConciergeSubStep, countdown, selectedDest, setSelectedDest, customDest, setCustomDest, vehicleType, setVehicleType, note, setNote, isSubmitting, confirmedTicket, voiceGuidance, handleSelectSelfBooking, handleSelectConciergeBooking, handleSelectDestinationCard, handleProceedToReview, handleSubmitConciergeRequest, handleResetAndClose, resolvedDestination, pickupLocation,
}) => (
  <>
          {/* VIEW 1: LỰA CHỌN 2 OPTION (FALLBACK NẾU MỞ Ở DẠNG OPTIONS) */}
          {mode === 'options' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Option 1: Khách tự gọi xe */}
                <div
                  onClick={handleSelectSelfBooking}
                  className="p-3 rounded-2xl bg-stone-800/80 border border-stone-700 hover:border-amber-500/70 hover:bg-stone-800 transition-all cursor-pointer flex items-start gap-2.5 group active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Lựa chọn 1</span>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors leading-tight">
                      Khách Tự Đặt Xe
                    </h3>
                    <p className="text-[11px] text-stone-400 mt-0.5 leading-snug line-clamp-2">
                      Xem danh bạ hotline các hãng taxi uy tín để tự gọi xe.
                    </p>
                  </div>
                </div>

                {/* Option 2: Nhờ Concierge đặt giùm */}
                <div
                  onClick={handleSelectConciergeBooking}
                  className="p-3 rounded-2xl bg-stone-800/80 border border-stone-700 hover:border-emerald-500/70 hover:bg-stone-800 transition-all cursor-pointer flex items-start gap-2.5 group active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Lựa chọn 2</span>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors leading-tight">
                      Nhờ Concierge Đặt Giùm
                    </h3>
                    <p className="text-[11px] text-stone-400 mt-0.5 leading-snug line-clamp-2">
                      Điền form cùng Robot, Concierge sẽ đặt xe và đón tại sảnh.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center text-[11px] text-stone-400">
                Xác thực: <strong className="text-stone-200">{pickupLocation}</strong> · Quý khách có thể nói <em>&quot;Option 1&quot;</em> hoặc <em>&quot;Option 2&quot;</em>
              </div>
            </div>
          )}

          {/* VIEW 2: HIỂN THỊ SỐ ĐIỆN THOẠI KHÁCH TỰ ĐẶT (ĐẾM LÙI 45S) */}
          {mode === 'self_booking' && (
            <div className="space-y-2">
              {/* Countdown banner */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                <span>
                  Màn hình sẽ tự động đóng sau: <strong className="font-mono text-white text-xs">{countdown}s</strong>
                </span>
              </div>

              {/* Grid danh bạ taxi */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {TAXI_PARTNERS.map((partner) => (
                  <a
                    key={partner.id}
                    href={`tel:${partner.hotline.replace(/\s+/g, '')}`}
                    className="p-2.5 rounded-xl bg-stone-800/80 border border-stone-700 hover:border-amber-500/60 transition-colors flex flex-col gap-1 min-w-0"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <h4 className="text-[11px] font-bold text-white truncate">{partner.name}</h4>
                    </div>
                    <span className="text-sm font-mono font-bold text-amber-400 tracking-wide whitespace-nowrap">
                      {partner.hotline}
                    </span>
                    {partner.shortCode ? (
                      <span className="self-start px-1.5 py-0.5 rounded-full bg-stone-700 text-amber-300 font-mono text-[10px] font-bold">
                        Tổng đài {partner.shortCode}
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400 truncate">{partner.desc}</span>
                    )}
                  </a>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setMode('options')}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-semibold cursor-pointer transition-colors"
                >
                  Chọn hình thức khác
                </button>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-bold cursor-pointer transition-colors"
                >
                  Đóng màn hình
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3A: FORM TRỐNG & GIAO TIẾP VỚI KHÁCH ĐỂ LẤY THÔNG TIN CẦN THIẾT */}
          {mode === 'concierge_booking' && conciergeStage === 'form' && (
            <div className="space-y-2">
              {/* Voice Guidance Banner */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30">
                <Mic className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 shrink-0">Rora:</span>
                <p className="text-xs font-semibold text-white truncate">
                  {voiceGuidance || 'Quý khách muốn đi đến đâu ạ?'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                {/* Destination selector */}
                <div className="md:col-span-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-300 truncate">
                      1. Điểm đến {selectedDest ? <span className="text-emerald-400 normal-case ml-1">({resolvedDestination})</span> : null}
                    </label>
                    {selectedDest && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDest('');
                          setCustomDest('');
                          setConciergeSubStep('ask_destination');
                        }}
                        className="text-[11px] text-amber-400 hover:underline cursor-pointer shrink-0"
                      >
                        Chọn lại
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {POPULAR_DESTINATIONS.map((dest) => {
                      const isSelected = selectedDest === dest.name;
                      return (
                        <button
                          key={dest.id}
                          type="button"
                          onClick={() => handleSelectDestinationCard(dest.name)}
                          title={`${dest.name} - ${dest.desc}`}
                          className={`px-2.5 py-1.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-1.5 min-w-0 ${isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500/50'
                            : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800 hover:border-stone-600'
                            }`}
                        >
                          {dest.id === 'dad' ? (
                            <Plane className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <Navigation className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="block text-[11px] font-bold leading-tight truncate">{dest.name}</span>
                            <span className="block text-[10px] text-stone-400 leading-tight truncate">{dest.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDest === 'Điểm đến khác...' && (
                    <input
                      type="text"
                      value={customDest}
                      onChange={(e) => setCustomDest(e.target.value)}
                      placeholder="Nhập địa chỉ hoặc điểm đến (vd: Cầu Rồng, Chợ Hàn...)"
                      className="w-full px-3 py-1.5 bg-stone-800 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 text-[11px] focus:outline-none focus:border-amber-500 animate-in fade-in"
                    />
                  )}
                </div>

                {/* Vehicle Type & Note */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-300">
                    2. Loại xe
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: '4-Seater Sedan', name: '4 Chỗ Sedan', desc: '1 - 3 khách' },
                      { id: '7-Seater SUV', name: '7 Chỗ SUV', desc: '4 - 6 khách' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVehicleType(v.id)}
                        className={`px-2 py-1.5 rounded-xl text-left border transition-all cursor-pointer ${vehicleType === v.id
                          ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500/50'
                          : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800'
                          }`}
                      >
                        <p className="text-[11px] font-bold leading-tight">{v.name}</p>
                        <p className="text-[10px] text-stone-400 leading-tight">{v.desc}</p>
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghi chú (tùy chọn): vd 2 vali lớn..."
                    className="w-full px-2.5 py-1.5 bg-stone-800 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 text-[11px] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setMode('options')}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] transition-all cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleProceedToReview}
                  disabled={!resolvedDestination || isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[11px] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Kiểm tra lại thông tin</span>
                  <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3B: BƯỚC KIỂM TRA LẠI THÔNG TIN (REVIEW & CONFIRMATION) */}
          {mode === 'concierge_booking' && conciergeStage === 'review' && (
            <div className="space-y-2 animate-in fade-in">
              {/* Question Banner */}
              <div className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-center">
                <h3 className="text-xs font-bold text-white">
                  Quý khách vui lòng kiểm tra lại thông tin đặt xe đã đúng chưa ạ?
                </h3>
                <p className="text-[11px] text-stone-300">
                  Nói <strong>&quot;Đúng rồi&quot;</strong> hoặc bấm nút bên dưới để gửi yêu cầu cho Concierge.
                </p>
              </div>

              {/* Review Summary Card */}
              <div className="bg-stone-800/80 border border-stone-700 rounded-xl px-3 py-2 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex items-center justify-between gap-2 py-0.5 border-b border-stone-700/60">
                  <span className="text-stone-400 shrink-0">Điểm đón:</span>
                  <span className="font-bold text-stone-100 truncate">{pickupLocation}</span>
                </div>
                <div className="flex items-center justify-between gap-2 py-0.5 border-b border-stone-700/60">
                  <span className="text-stone-400 shrink-0">Điểm đến:</span>
                  <span className="font-bold text-amber-400 truncate">{resolvedDestination}</span>
                </div>
                <div className="flex items-center justify-between gap-2 py-0.5 border-b border-stone-700/60">
                  <span className="text-stone-400 shrink-0">Loại xe:</span>
                  <span className="font-bold text-stone-100">
                    {vehicleType === '7-Seater SUV' ? 'Xe 7 Chỗ SUV / Van' : 'Xe 4 Chỗ Sedan'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-stone-400 shrink-0">Thời gian đón:</span>
                  <span className="font-semibold text-emerald-400">Ngay lập tức</span>
                </div>
                {note && (
                  <div className="flex items-center justify-between gap-2 py-0.5">
                    <span className="text-stone-400 shrink-0">Ghi chú:</span>
                    <span className="font-medium text-stone-300 italic truncate">{note}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setConciergeStage('form');
                    setConciergeSubStep('ask_destination');
                  }}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitConciergeRequest}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-[11px] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Đang gửi yêu cầu...' : 'Đúng rồi, Gửi yêu cầu'}</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 4: THÔNG BÁO CHUYỂN REQUEST CHO CONCIERGE THÀNH CÔNG */}
          {mode === 'concierge_confirmed' && confirmedTicket && (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">Chuyển tiếp yêu cầu thành công</h3>
                  <p className="text-[11px] text-stone-300">
                    Đã gửi đến <strong className="text-emerald-400">Bộ phận Concierge</strong> · Mã yêu cầu:{' '}
                    <span className="text-amber-400 font-mono font-bold">{confirmedTicket.ticketCode}</span>
                  </p>
                </div>
              </div>

              <div className="bg-stone-800/80 border border-stone-700 rounded-xl px-3 py-2 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex justify-between gap-2 py-0.5 border-b border-stone-700/60">
                  <span className="text-stone-400 shrink-0">Điểm đón:</span>
                  <span className="font-semibold text-stone-200 truncate">{pickupLocation}</span>
                </div>
                <div className="flex justify-between gap-2 py-0.5 border-b border-stone-700/60">
                  <span className="text-stone-400 shrink-0">Điểm đến:</span>
                  <span className="font-semibold text-stone-200 truncate">{confirmedTicket.destination}</span>
                </div>
                <div className="flex justify-between gap-2 py-0.5">
                  <span className="text-stone-400 shrink-0">Loại xe:</span>
                  <span className="font-semibold text-stone-200 truncate">
                    {confirmedTicket.vehicleType === '7-Seater SUV' ? 'Xe 7 Chỗ SUV / Van' : 'Xe 4 Chỗ Sedan'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 py-0.5">
                  <span className="text-stone-400 shrink-0">Xe đến:</span>
                  <span className="font-semibold text-emerald-400">Dự kiến 3 - 5 phút tại sảnh</span>
                </div>
              </div>

              {/* Status Query Hint Banner */}
              <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-stone-300 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Hỏi Robot <em>&quot;Kiểm tra trạng thái đặt taxi&quot;</em> hoặc <em>&quot;Taxi tới chưa&quot;</em> để cập nhật tiến độ xe đón.
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-stone-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Tự động đóng sau: <strong className="font-mono text-white">{countdown}s</strong></span>
                </span>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs transition-all cursor-pointer active:scale-95"
                >
                  Hoàn tất ({countdown}s)
                </button>
              </div>
            </div>
          )}
  </>
);
