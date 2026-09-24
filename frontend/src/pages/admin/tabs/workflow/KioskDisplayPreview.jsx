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
} from 'lucide-react';
import { KioskServiceForm } from './KioskServiceForm';
import { KioskStaffAlert } from './KioskStaffAlert';
import { KioskPromoSlide } from './KioskPromoSlide';
import { Kiosk2DMapPreview } from './Kiosk2DMapPreview';

export const KioskDisplayPreview = ({
  activeStep,
  transcript = '',
  isListening = false,
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
        <span className="text-3xl mb-2">🤖</span>
        <span className="font-bold text-stone-700">Robot đang ở chế độ chờ (Idle Standby)</span>
        <span className="text-[11px] mt-1 text-stone-500">
          Nhấn nút ▶ Chạy thử kịch bản để bắt đầu chu trình!
        </span>
      </div>
    );
  }

  const params = activeStep.params || {};
  const contentId = params.content_id || '';
  const screenType = params.screen_type || '';
  const screenMode = params.screen_mode || '';

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-5 bg-gradient-to-br from-stone-50 via-white to-amber-50/40 rounded-2xl border border-stone-200/90 shadow-inner overflow-y-auto select-none">
      {/* 0. Top Elegant Kiosk Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse ring-4 ring-amber-100" />
          <span className="text-[11px] font-black tracking-widest uppercase text-stone-800">
            Aurora Concierge Kiosk
          </span>
          <span className="text-[10px] font-medium text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
            5-Star Service
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-stone-500 bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-200">
            STEP: {activeStep.type}
          </span>
        </div>
      </div>

      {/* 1. MOVE: 2D MINI MAP NAVIGATION */}
      {activeStep.type === 'MOVE' && (
        <Kiosk2DMapPreview activeStep={activeStep} />
      )}

      {/* 2. SHOW: SPECIALIZED SCREENS */}
      {activeStep.type === 'SHOW' && (
        <>
          {/* A. 2D Map Floor Plan */}
          {(screenType === 'MAP' || contentId === 'MAP_LOBBY_FLOOR1' || screenMode === 'MAP_TOUR') && (
            <Kiosk2DMapPreview activeStep={activeStep} />
          )}

          {/* B. Room Service Form or Confirmation */}
          {(contentId === 'UI_SERVICE_FORM' || contentId === 'UI_CONFIRMATION' || screenMode === 'SERVICE_FORM') && (
            <KioskServiceForm activeStep={activeStep} />
          )}

          {/* C. Waiting Staff Emergency Radar */}
          {(contentId === 'UI_WAITING_STAFF' || screenMode === 'CALL_STAFF_WAIT') && (
            <KioskStaffAlert activeStep={activeStep} />
          )}

          {/* D. Summer Promotion Slide */}
          {(contentId === 'PROMO_SUMMER' || screenType === 'SLIDE' || screenMode === 'PROMO_SLIDE') && (
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
                  <span className="text-3xl filter drop-shadow">🇻🇳</span>
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
                  <span className="text-3xl filter drop-shadow">🇺🇸</span>
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

          {/* F. Dining Menu / Gourmet Showcase */}
          {(screenMode === 'DINING_MENU' || contentId === 'UI_CATEGORIES' || contentId === 'UI_RECOMMEND_LIST') && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Utensils className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-stone-900">
                      {params.display_banner || 'Thực Đơn Ẩm Thực Thượng Hạng'}
                    </h4>
                    <p className="text-[10px] text-stone-500">Bếp trưởng 5 sao tuyển chọn hàng ngày</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-amber-500 text-white shadow-sm">
                  AURORA DINING
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                {/* Dish Card 1 */}
                <div className="p-3 rounded-2xl bg-white border border-stone-200 shadow-sm hover:shadow-md hover:border-amber-400 transition-all space-y-1.5 group">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      ⭐ Chef's Signature
                    </span>
                    <span className="text-base">🫖</span>
                  </div>
                  <div className="text-xs font-bold text-stone-900 group-hover:text-amber-700 transition-colors">
                    Set Trà Chiều Hoàng Gia
                  </div>
                  <div className="text-[10px] text-stone-500 leading-tight">
                    Trà thảo mộc Anh Quốc & bánh ngọt Pháp cao cấp tại tầng 3
                  </div>
                  <div className="pt-1 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-amber-600">380.000 ₫</span>
                    <span className="text-[9px] text-stone-400">Phục vụ 14:00 - 18:00</span>
                  </div>
                </div>

                {/* Dish Card 2 */}
                <div className="p-3 rounded-2xl bg-white border border-stone-200 shadow-sm hover:shadow-md hover:border-amber-400 transition-all space-y-1.5 group">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      🔥 Best Seller
                    </span>
                    <span className="text-base">🦞</span>
                  </div>
                  <div className="text-xs font-bold text-stone-900 group-hover:text-amber-700 transition-colors">
                    Buffet Hải Sản Thượng Hạng
                  </div>
                  <div className="text-[10px] text-stone-500 leading-tight">
                    Tôm hùm, cua tuyết, sashimi cá hồi Na Uy tươi sống tại tầng 2
                  </div>
                  <div className="pt-1 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-amber-600">890.000 ₫ / Khách</span>
                    <span className="text-[9px] text-stone-400">Phục vụ 18:00 - 22:00</span>
                  </div>
                </div>
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

            <div className="text-sm font-black text-stone-900">
              ⭐ {params.highlight_item || 'Set Trà Chiều Thảo Mộc & Dịch Vụ Spa Thư Giãn Tầng 3'}
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

      {/* 4. LISTEN MODE: Radiant Laptop Mic Radar & Live Speech Bubble */}
      {activeStep.type === 'LISTEN' && (
        <div className="flex flex-col items-center justify-center py-5 space-y-3 animate-in fade-in duration-300">
          {/* Luminous Pulsing Mic Orb */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping opacity-60" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-amber-400/30 to-orange-400/30 animate-pulse" />
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-400/40 text-xl font-bold">
              🎙️
            </div>
          </div>

          <div className="text-center space-y-1">
            <h4 className="text-sm font-black text-stone-900 flex items-center justify-center gap-1.5">
              <span>Đang Lắng Nghe Qua Micro Máy Tính</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h4>
            <p className="text-xs text-stone-600 max-w-md mx-auto">
              {params.prompt_hint || 'Quý khách vui lòng nói yêu cầu hoặc chạm màn hình để chọn...'}
            </p>
          </div>

          {/* Real-time Laptop Speech Transcript Display */}
          {transcript && transcript.trim() ? (
            <div className="w-full max-w-md p-3.5 rounded-2xl bg-white border-2 border-amber-400 shadow-md text-left animate-in zoom-in-95">
              <span className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5" />
                Nội dung vừa nhận diện từ giọng nói:
              </span>
              <p className="text-sm font-extrabold text-stone-900 mt-1">
                "{transcript}"
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px] text-stone-500 bg-white/80 px-3 py-1.5 rounded-full border border-stone-200">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
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
          <div className="p-4 rounded-2xl bg-white border border-orange-200 shadow-md space-y-2.5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-orange-600 flex items-center gap-1.5 font-extrabold">
                <Send className="w-4 h-4" />
                PHIẾU DỊCH VỤ #{params.room_number ? `REQ-${params.room_number}` : 'REQ-882'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-orange-800 border border-orange-200 font-mono">
                {params.urgency || params.ticket_priority || 'NORMAL'}
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
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold pt-1">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Hệ thống buồng phòng đã tiếp nhận yêu cầu</span>
            </div>
          </div>
        )
      )}

      {/* 6. FEEDBACK: 5-STAR INTERACTIVE (Luminous Champagne Gold) */}
      {activeStep.type === 'FEEDBACK' && (
        <div className="flex flex-col items-center justify-center py-4 space-y-3 animate-in fade-in duration-300">
          <div className="text-center space-y-1">
            <span className="text-2xl">✨</span>
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
                      ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.6)]'
                      : 'text-stone-300 hover:text-amber-200'
                  }`}
                />
              </button>
            ))}
          </div>

          {hasRated ? (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 text-emerald-900 text-xs font-bold text-center animate-in zoom-in-95 shadow-sm max-w-md">
              🎉 {params.thank_you_message || 'Cảm ơn quý khách đã đánh giá! Chúc quý khách một kỳ nghỉ tuyệt vời tại Aurora.'}
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Chạm vào số sao để gửi đánh giá
            </span>
          )}
        </div>
      )}
    </div>
  );
};
