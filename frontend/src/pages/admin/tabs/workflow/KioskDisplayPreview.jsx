import React, { useState, useEffect } from 'react';
import { Utensils, Bell, Globe, Sparkles, Clock, Star, Send, CheckCircle } from 'lucide-react';
import { KioskServiceForm } from './KioskServiceForm';
import { KioskStaffAlert } from './KioskStaffAlert';
import { KioskPromoSlide } from './KioskPromoSlide';
import { Kiosk2DMapPreview } from './Kiosk2DMapPreview';

export const KioskDisplayPreview = ({ activeStep }) => {
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
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-stone-500 text-xs">
        <span className="text-2xl mb-1">🤖</span>
        <span>Robot đang ở chế độ chờ (Idle Standby).</span>
        <span className="text-[10px] mt-1 text-stone-600">
          Nhấn nút ▶ Chạy thử để bắt đầu chu trình!
        </span>
      </div>
    );
  }

  const params = activeStep.params || {};
  const contentId = params.content_id || '';
  const screenType = params.screen_type || '';
  const screenMode = params.screen_mode || '';

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 bg-[#121214] overflow-y-auto select-none">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
        <span className="text-[10px] font-bold text-stone-400 tracking-wider uppercase flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Màn Hình Kiosk Tương Tác (Guest UI Preview)
        </span>
        <span className="text-[10px] font-mono text-stone-500">
          STEP: {activeStep.type}
        </span>
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
            <div className="space-y-2 animate-in fade-in duration-300">
              <h4 className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Vui lòng chọn ngôn ngữ phục vụ
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('vi')}
                  className={`p-2 rounded-xl border flex items-center justify-center gap-2 cursor-pointer ${
                    selectedLanguage === 'vi'
                      ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                      : 'bg-stone-800 border-stone-700 text-stone-300'
                  }`}
                >
                  <span>🇻🇳</span> <span>Tiếng Việt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('en')}
                  className={`p-2 rounded-xl border flex items-center justify-center gap-2 cursor-pointer ${
                    selectedLanguage === 'en'
                      ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                      : 'bg-stone-800 border-stone-700 text-stone-300'
                  }`}
                >
                  <span>🇺🇸</span> <span>English</span>
                </button>
              </div>
            </div>
          )}

          {/* F. Dining Menu / Recommend list */}
          {(screenMode === 'DINING_MENU' || contentId === 'UI_CATEGORIES' || contentId === 'UI_RECOMMEND_LIST') && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5" />
                  {params.display_banner || 'Thực Đơn Ẩm Thực Thượng Hạng'}
                </h4>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  HOTEL RESTAURANT
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="p-2.5 rounded-xl bg-stone-800/80 border border-stone-700 space-y-1">
                  <div className="text-[11px] font-bold text-stone-200">🫖 Set Trà Chiều Hoàng Gia</div>
                  <div className="text-[9px] text-stone-400">Trà thảo mộc & bánh ngọt Pháp tại tầng 3</div>
                  <div className="text-[10px] font-extrabold text-amber-400">380.000 VNĐ</div>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-800/80 border border-stone-700 space-y-1">
                  <div className="text-[11px] font-bold text-stone-200">🦞 Buffet Hải Sản Tươi Sống</div>
                  <div className="text-[9px] text-stone-400">Tôm hùm, cua hoàng đế, sushi tại tầng 2</div>
                  <div className="text-[10px] font-extrabold text-amber-400">890.000 VNĐ / Khách</div>
                </div>
              </div>
            </div>
          )}

          {/* G. Services Grid Default */}
          {(screenMode === 'SERVICES_GRID' || contentId === 'UI_MAIN_MENU' || (!screenType && !contentId && !screenMode)) && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <h4 className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                {params.display_banner || 'Tiện Ích Nghỉ Dưỡng 5 Sao'}
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                <div className="p-2.5 rounded-xl bg-stone-800 border border-stone-700 hover:border-cyan-400 transition-colors">
                  <div className="text-base mb-1">🛏️</div>
                  <span>Phòng Nghỉ</span>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-800 border border-stone-700 hover:border-cyan-400 transition-colors">
                  <div className="text-base mb-1">💆</div>
                  <span>Spa & Massage</span>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-800 border border-stone-700 hover:border-cyan-400 transition-colors">
                  <div className="text-base mb-1">🏊</div>
                  <span>Hồ Bơi Vô Cực</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. RECOMMEND MODE */}
      {activeStep.type === 'RECOMMEND' && (
        <div className="space-y-2 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Gợi Ý Tiện Ích Thông Minh Từ AI Concierge
            </h4>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-[11px] text-emerald-200">
            Dịch vụ nổi bật dành riêng cho quý khách:{' '}
            <strong className="text-white block mt-1 text-xs">
              ⭐ {params.highlight_item || 'Set Trà Chiều & Buffet Hải Sản Tầng 2'}
            </strong>
          </div>
        </div>
      )}

      {/* 4. LISTEN MODE */}
      {activeStep.type === 'LISTEN' && (
        <div className="flex flex-col items-center justify-center py-4 space-y-2 animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 rounded-full bg-amber-400 text-gray-900 flex items-center justify-center text-sm font-bold">
              🎙️
            </div>
          </div>
          <p className="text-xs font-bold text-amber-200 text-center px-4">
            {params.prompt_hint || 'Quý khách vui lòng chạm màn hình hoặc nói yêu cầu...'}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-stone-400">
            <Clock className="w-3 h-3" />
            <span>Chờ phản hồi trong {params.timeout || params.timeout_sec || 15} giây</span>
          </div>
        </div>
      )}

      {/* 5. CREATE_REQUEST DISPATCH BADGE */}
      {activeStep.type === 'CREATE_REQUEST' && (
        params.service_type === 'CALL_STAFF' || params.urgency === 'HIGH' ? (
          <KioskStaffAlert activeStep={activeStep} />
        ) : (
          <div className="p-3 rounded-xl bg-stone-800/90 border border-orange-500/40 space-y-2 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-orange-400 flex items-center gap-1">
                <Send className="w-3.5 h-3.5" />
                PHIẾU YÊU CẦU DỊCH VỤ #{params.room_number ? `REQ-${params.room_number}` : 'REQ-882'}
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-orange-500/20 text-orange-300 font-mono">
                {params.urgency || params.ticket_priority || 'NORMAL'}
              </span>
            </div>
            <div className="text-[11px] text-stone-300">
              Đã gửi thông báo tới bộ phận: <strong className="text-white">{params.target_department || 'Housekeeping'}</strong>
            </div>
            {params.note && (
              <div className="p-2 rounded-lg bg-stone-950 text-[10px] text-stone-200">
                Chi tiết: <em>"{params.note}"</em>
              </div>
            )}
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
              <CheckCircle className="w-3 h-3" />
              <span>Nhân viên trực đã tiếp nhận qua hệ thống</span>
            </div>
          </div>
        )
      )}

      {/* 6. FEEDBACK: 5-STAR INTERACTIVE */}
      {activeStep.type === 'FEEDBACK' && (
        <div className="flex flex-col items-center justify-center py-2 space-y-2 animate-in fade-in duration-300">
          <h4 className="text-xs font-bold text-cyan-200 text-center px-2">
            {params.question_text || 'Quý khách có hài lòng với sự hỗ trợ của Robot không?'}
          </h4>
          <div className="flex items-center gap-2 py-1">
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
                  className={`w-7 h-7 ${
                    star <= feedbackRating
                      ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                      : 'text-stone-600'
                  }`}
                />
              </button>
            ))}
          </div>
          {hasRated ? (
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-bold text-center animate-in zoom-in-95">
              🎉 {params.thank_you_message || 'Cảm ơn quý khách đã đánh giá! Chúc quý khách kỳ nghỉ vui vẻ.'}
            </div>
          ) : (
            <span className="text-[10px] text-stone-400">Chạm vào sao để đánh giá</span>
          )}
        </div>
      )}
    </div>
  );
};
