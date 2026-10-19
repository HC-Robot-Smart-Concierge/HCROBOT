import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Bell,
  Globe,
  Sparkles,
  Clock,
  Star,
  Send,
  CheckCircle,
  Bed,
  Coffee,
  Waves,
  Check,
  ChevronRight,
  Volume2,
  Bot,
  Mic,
} from 'lucide-react';
import { KioskServiceForm } from './KioskServiceForm';
import { KioskStaffAlert } from './KioskStaffAlert';
import { KioskPromoSlide } from './KioskPromoSlide';
import { Kiosk2DMapPreview } from './Kiosk2DMapPreview';
import { KioskMediaPromo } from './KioskMediaPromo';
import { KioskWayfindingQR } from './KioskWayfindingQR';
import { KioskDiningMenu } from './KioskDiningMenu';

export const KioskDisplayPreview = ({
  activeStep,
  transcript = '',
  isListening = false,
  silenceRemaining = 30,
  onNextStep = () => {},
}) => {
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [hasRated, setHasRated] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('vi');

  useEffect(() => {
    if (activeStep?.type === 'FEEDBACK') {
      setHasRated(false);
      setFeedbackRating(5);
    }
  }, [activeStep?.type]);

  if (!activeStep) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-stone-500 text-xs">
        <Bot className="w-8 h-8 mb-2 text-stone-400" />
        <span className="font-bold text-stone-700">Robot đang ở chế độ chờ (Idle Standby)</span>
        <span className="text-[11px] mt-1 text-stone-500">
          Nhấn nút Chạy thử kịch bản để bắt đầu chu trình!
        </span>
      </div>
    );
  }

  const params = activeStep.params || {};
  const contentId = params.content_id || '';
  const screenType = params.screen_type || '';
  const screenMode = params.screen_mode || '';

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-4 bg-gradient-to-br from-stone-50 via-white to-amber-50/40 rounded-2xl border border-stone-200/90 shadow-inner overflow-y-auto select-none">

      {/* 1. MOVE: MEDIA PROMO, CHỈ ĐƯỜNG QR HOẶC 2D MINI MAP */}
      {activeStep.type === 'MOVE' && (
        screenMode === 'MAP_WAYFINDING' || screenMode === 'SHOW_QR_NAVIGATION' ? (
          <KioskWayfindingQR activeStep={activeStep} />
        ) : params.show_media_on_move || params.media_type || params.media_url || params.screen_mode === 'PROMO_VIDEO' || params.screen_mode === 'PROMO_IMAGE' ? (
          <KioskMediaPromo activeStep={activeStep} isMoving={true} />
        ) : (
          <Kiosk2DMapPreview activeStep={activeStep} />
        )
      )}

      {/* 2. SHOW: SPECIALIZED SCREENS */}
      {activeStep.type === 'SHOW' && (
        <>
          {/* A. Chỉ Đường Thông Minh Kèm Mã QR Di Động */}
          {(screenMode === 'MAP_WAYFINDING' ||
            screenMode === 'SHOW_QR_NAVIGATION' ||
            contentId === 'MAP_WAYFINDING' ||
            screenType === 'MAP') && (
            <KioskWayfindingQR activeStep={activeStep} />
          )}

          {/* B. Thực Đơn Ẩm Thực Nhà Hàng & Đặt Món */}
          {(screenMode === 'DINING_MENU' ||
            screenMode === 'RESTAURANT_ORDER' ||
            contentId === 'UI_CATEGORIES' ||
            contentId === 'UI_RECOMMEND_LIST') && (
            <KioskDiningMenu activeStep={activeStep} />
          )}

          {/* C. Video hoặc Poster Hình ảnh quảng cáo chuyên dụng */}
          {(screenMode === 'PROMO_VIDEO' ||
            screenMode === 'PROMO_IMAGE' ||
            params.media_type === 'VIDEO' ||
            params.media_type === 'IMAGE' ||
            Boolean(params.media_url)) && (
            <KioskMediaPromo activeStep={activeStep} />
          )}

          {/* D. Room Service Form or Confirmation */}
          {(contentId === 'UI_SERVICE_FORM' || contentId === 'UI_CONFIRMATION' || screenMode === 'SERVICE_FORM') && (
            <KioskServiceForm activeStep={activeStep} />
          )}

          {/* E. Waiting Staff Emergency Radar */}
          {(contentId === 'UI_WAITING_STAFF' || screenMode === 'CALL_STAFF_WAIT') && (
            <KioskStaffAlert activeStep={activeStep} />
          )}

          {/* F. Summer Promotion Slide */}
          {(contentId === 'PROMO_SUMMER' || screenType === 'SLIDE' || screenMode === 'PROMO_SLIDE') &&
            screenMode !== 'PROMO_VIDEO' &&
            screenMode !== 'PROMO_IMAGE' &&
            !params.media_url && (
              <KioskPromoSlide activeStep={activeStep} />
            )}

          {/* E. Language Selector */}
          {(screenType === 'LANGUAGE_SELECT' || contentId === 'UI_LANG' || screenMode === 'LANGUAGE_SELECTOR') && (
            <div className="space-y-3 py-2 animate-in fade-in duration-300">
              <div className="text-center space-y-1">
                <span className="inline-flex p-2 rounded-xl bg-amber-100/70 text-amber-700 text-xs mb-1">
                  <Globe className="w-4 h-4" />
                </span>
                <h4 className="text-sm font-extrabold text-stone-800">
                  Vui Lòng Chọn Ngôn Ngữ Phục Vụ
                </h4>
                <p className="text-xs text-stone-500 font-medium">
                  Please select your preferred language
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('vi')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-sm ${
                    selectedLanguage === 'vi'
                      ? 'bg-gradient-to-b from-amber-50 to-orange-50/60 border-amber-500 shadow-md shadow-amber-200/50 scale-[1.02]'
                      : 'bg-white border-stone-200 hover:border-amber-300 hover:bg-stone-50/80'
                  }`}
                >
                  <div className="w-10 h-8 rounded-lg bg-red-600 text-yellow-300 font-black text-xs flex items-center justify-center border border-red-700 shadow-xs">
                    VN
                  </div>
                  <div className="text-center">
                    <span className="block text-xs font-black text-stone-900">Tiếng Việt</span>
                    <span className="text-[10px] text-stone-500 font-medium">Xin chào quý khách</span>
                  </div>
                  {selectedLanguage === 'vi' && (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLanguage('en')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-sm ${
                    selectedLanguage === 'en'
                      ? 'bg-gradient-to-b from-amber-50 to-orange-50/60 border-amber-500 shadow-md shadow-amber-200/50 scale-[1.02]'
                      : 'bg-white border-stone-200 hover:border-amber-300 hover:bg-stone-50/80'
                  }`}
                >
                  <div className="w-10 h-8 rounded-lg bg-blue-700 text-white font-black text-xs flex items-center justify-center border border-blue-800 shadow-xs">
                    EN
                  </div>
                  <div className="text-center">
                    <span className="block text-xs font-black text-stone-900">English</span>
                    <span className="text-[10px] text-stone-500 font-medium">Welcome to Aurora</span>
                  </div>
                  {selectedLanguage === 'en' && (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* G. Services Grid Default (Luminous 5-Star Amenities Directory) */}
          {(screenMode === 'SERVICES_GRID' || contentId === 'UI_MAIN_MENU' || (!screenType && !contentId && !screenMode)) && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-stone-900">
                      {params.display_banner || 'Tiện Ích & Dịch Vụ Nghỉ Dưỡng 5 Sao'}
                    </h4>
                    <p className="text-[10px] text-stone-500">Chạm để xem thông tin chi tiết từng dịch vụ</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                  TIỆN ÍCH LOBBY
                </span>
              </div>

              {/* 4 Crisp Luminous Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Amenity 1 */}
                <div className="p-3 rounded-2xl bg-white border border-stone-200/90 shadow-sm hover:shadow-md hover:border-amber-400 transition-all flex flex-col items-center text-center cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Bed className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-stone-900">Phòng Nghỉ</span>
                  <span className="text-[9px] text-stone-500 mt-0.5">Dịch vụ phòng 24/7</span>
                  <span className="mt-2 text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Tầng 4 - 18
                  </span>
                </div>

                {/* Amenity 2 */}
                <div className="p-3 rounded-2xl bg-white border border-stone-200/90 shadow-sm hover:shadow-md hover:border-rose-400 transition-all flex flex-col items-center text-center cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-50 to-pink-100 text-rose-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-stone-900">Spa & Trị Liệu</span>
                  <span className="text-[9px] text-stone-500 mt-0.5">Thảo mộc tự nhiên</span>
                  <span className="mt-2 text-[9px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    Tầng 3
                  </span>
                </div>

                {/* Amenity 3 */}
                <div className="p-3 rounded-2xl bg-white border border-stone-200/90 shadow-sm hover:shadow-md hover:border-cyan-400 transition-all flex flex-col items-center text-center cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-100 text-cyan-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Waves className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-stone-900">Hồ Bơi Vô Cực</span>
                  <span className="text-[9px] text-stone-500 mt-0.5">Nước ấm bốn mùa</span>
                  <span className="mt-2 text-[9px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
                    Tầng Thượng
                  </span>
                </div>

                {/* Amenity 4 */}
                <div className="p-3 rounded-2xl bg-white border border-stone-200/90 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all flex flex-col items-center text-center cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-stone-900">Lounge & Cafe</span>
                  <span className="text-[9px] text-stone-500 mt-0.5">Thư giãn sảnh chính</span>
                  <span className="mt-2 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Sảnh Tầng 1
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. RECOMMEND MODE: Luminous AI Suggestion */}
      {activeStep.type === 'RECOMMEND' && (
        <div className="space-y-3 py-1 animate-in fade-in duration-300">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 via-white to-orange-50 border border-amber-300/80 shadow-md space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3" />
                AI CONCIERGE GỢI Ý THÔNG MINH
              </span>
              <span className="text-[10px] text-stone-400 font-medium">Dành riêng cho quý khách</span>
            </div>

            <div className="text-sm font-black text-stone-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{params.highlight_item || 'Set Trà Chiều Thảo Mộc & Dịch Vụ Spa Thư Giãn Tầng 3'}</span>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Dựa trên sở thích của quý khách, Robot đề xuất trải nghiệm dịch vụ thư giãn kết hợp trà chiều thượng hạng với ưu đãi giảm 20% hôm nay.
            </p>

            <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-xs font-bold">
              <span className="text-amber-800">Quý khách có muốn Robot đặt giữ chỗ ngay không?</span>
              <button
                type="button"
                onClick={onNextStep}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Xác nhận đặt</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. COMMUNICATE MODE: 2-Way AI Conversation & 30s Silence Timeout */}
      {activeStep.type === 'COMMUNICATE' && (
        <div className="flex flex-col items-center justify-center py-4 space-y-4 animate-in fade-in duration-300">
          {/* Dual Pulsing AI Orb (Mic + Speaker) */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-sky-200/50 animate-ping opacity-60" />
            <div className="absolute inset-2 rounded-full bg-sky-100/60 animate-pulse" />
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-lg text-2xl font-bold">
              <Bot className="w-8 h-8 animate-bounce duration-1000" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span>Đang Đối Thoại Trực Tiếp Hai Chiều (AI Communicate)</span>
            </div>
            <h4 className="text-sm font-black text-stone-900 mt-2">
              {params.initial_prompt || params.speech_text || params.text || 'Dạ em chào quý khách! Em có thể hỗ trợ gì cho quý khách ạ?'}
            </h4>
          </div>

          {/* Real-time Customer Speech Transcript Display */}
          {transcript && transcript.trim() ? (
            <div className="w-full max-w-md p-3.5 rounded-2xl bg-white border border-sky-200 shadow-md text-left animate-in zoom-in-95">
              <span className="text-[10px] font-black uppercase text-sky-700 flex items-center gap-1">
                <Mic className="w-3.5 h-3.5" />
                Khách đang nói (Reset đếm 30s im lặng):
              </span>
              <p className="text-sm font-extrabold text-stone-900 mt-1">
                "{transcript}"
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px] text-stone-600 bg-white/90 px-3.5 py-1.5 rounded-full border border-stone-200 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-sky-600 animate-spin duration-3000" />
              <span>
                Không nhận tiếng nói trong <strong>{silenceRemaining ?? (params.silence_timeout_sec || 30)}s</strong> sẽ tự động sang bước tiếp theo
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onNextStep}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Xong cuộc trò chuyện</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 5. LISTEN MODE: Radiant Laptop Mic Radar & Live Speech Bubble */}
      {activeStep.type === 'LISTEN' && (
        <div className="flex flex-col items-center justify-center py-5 space-y-3 animate-in fade-in duration-300">
          {/* Luminous Pulsing Mic Orb */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-stone-300/30 animate-ping opacity-60" />
            <div className="absolute inset-2 rounded-full bg-stone-200/50 animate-pulse" />
            <div className="w-14 h-14 rounded-full bg-[#262626] text-[#F2EFE9] flex items-center justify-center shadow-lg text-xl font-bold">
              <Mic className="w-6 h-6" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <h4 className="text-sm font-black text-stone-900 flex items-center justify-center gap-1.5">
              <span>Đang Lắng Nghe Qua Micro Máy Tính</span>
              <span className="w-2 h-2 rounded-full bg-[#262626] animate-pulse" />
            </h4>
            <p className="text-xs text-stone-600 max-w-md mx-auto">
              {params.prompt_hint || 'Quý khách vui lòng nói yêu cầu hoặc chạm màn hình để chọn...'}
            </p>
          </div>

          {/* Real-time Laptop Speech Transcript Display */}
          {transcript && transcript.trim() ? (
            <div className="w-full max-w-md p-3.5 rounded-2xl bg-white border border-slate-200 shadow-md text-left animate-in zoom-in-95">
              <span className="text-[10px] font-black uppercase text-[#262626] flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5" />
                Nội dung vừa nhận diện từ giọng nói:
              </span>
              <p className="text-sm font-extrabold text-stone-900 mt-1">
                "{transcript}"
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px] text-stone-500 bg-white/80 px-3 py-1.5 rounded-full border border-stone-200">
              <Clock className="w-3.5 h-3.5 text-stone-600" />
              <span>Chờ phản hồi trong {params.timeout || params.timeout_sec || 15} giây</span>
            </div>
          )}

          {/* Quick Action Tap Button */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onNextStep}
              className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Tiếp tục bước kế tiếp</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 5. CREATE_REQUEST DISPATCH BADGE */}
      {activeStep.type === 'CREATE_REQUEST' && (
        params.service_type === 'CALL_STAFF' || params.urgency === 'HIGH' ? (
          <KioskStaffAlert activeStep={activeStep} />
        ) : (
          <div className="p-4 rounded-2xl bg-white border border-stone-300 shadow-md space-y-2.5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[#262626] flex items-center gap-1.5 font-extrabold">
                <Send className="w-4 h-4" />
                PHIẾU DỊCH VỤ #{params.room_number ? `REQ-${params.room_number}` : 'REQ-882'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                TIẾP NHẬN
              </span>
            </div>
            <div className="text-xs text-stone-700">
              Đã gửi thông báo đến bộ phận:{' '}
              <strong className="text-stone-900 font-extrabold">
                {params.target_department || 'Housekeeping'}
              </strong>
            </div>
            {params.note && (
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800 font-medium">
                Ghi chú: <em>"{params.note}"</em>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-[#262626] font-bold pt-1">
              <CheckCircle className="w-4 h-4 text-[#262626]" />
              <span>Hệ thống buồng phòng đã tiếp nhận yêu cầu</span>
            </div>
          </div>
        )
      )}

      {/* 6. FEEDBACK: 5-STAR INTERACTIVE */}
      {activeStep.type === 'FEEDBACK' && (
        <div className="flex flex-col items-center justify-center py-4 space-y-3 animate-in fade-in duration-300">
          <div className="text-center space-y-1">
            <h4 className="text-sm font-extrabold text-stone-900 px-3">
              {params.question_text || 'Quý khách có hài lòng với sự hỗ trợ của Robot không?'}
            </h4>
            <p className="text-xs text-stone-500">Đánh giá của quý khách giúp chúng tôi phục vụ tốt hơn</p>
          </div>

          <div className="flex items-center gap-2.5 py-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => {
                  setFeedbackRating(star);
                  setHasRated(true);
                }}
                className="p-1 rounded-full hover:scale-125 transition-transform cursor-pointer"
                title={`${star} sao`}
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    star <= feedbackRating
                      ? 'fill-stone-800 text-stone-800'
                      : 'text-stone-300 hover:text-stone-400'
                  }`}
                />
              </button>
            ))}
          </div>

          {hasRated ? (
            <div className="p-3 rounded-2xl bg-stone-100 border border-stone-300 text-stone-900 text-xs font-bold text-center animate-in zoom-in-95 shadow-sm max-w-md">
              {params.thank_you_message || 'Cảm ơn quý khách đã đánh giá! Chúc quý khách một kỳ nghỉ tuyệt vời tại Aurora.'}
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-stone-700 bg-stone-100 px-3 py-1 rounded-full border border-stone-300">
              Chạm vào số sao để gửi đánh giá
            </span>
          )}
        </div>
      )}
    </div>
  );
};
