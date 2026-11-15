import React, { useState, useEffect } from 'react';
import {
  Bell,
  Globe,
  Sparkles,
  Bed,
  Coffee,
  Waves,
  Check,
  Bot,
} from 'lucide-react';
import { KioskServiceForm } from './KioskServiceForm';
import { KioskPromoSlide } from './KioskPromoSlide';
import { Kiosk2DMapPreview } from './Kiosk2DMapPreview';
import { KioskMediaPromo } from './KioskMediaPromo';
import { KioskWayfindingQR } from './KioskWayfindingQR';
import { KioskDiningMenu } from './KioskDiningMenu';
import { KioskChoicePrompt } from './KioskChoicePrompt';
import { KioskInteractionViews } from './KioskInteractionViews';

export const KioskDisplayPreview = ({
  activeStep,
  transcript = '',
  isListening = false,
  silenceRemaining = 30,
  onNextStep = () => {},
  choiceRemaining = null,
  onChooseOption = () => {},
  onCancelChoice = () => {},
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

      {/* 0. CHOICE: KHÁCH CHỌN NHÁNH TIẾP THEO */}
      {activeStep.type === 'CHOICE' && (
        <KioskChoicePrompt
          step={activeStep}
          remainingSec={choiceRemaining}
          transcript={isListening ? transcript : ''}
          onChoose={onChooseOption}
          onCancel={onCancelChoice}
        />
      )}

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

      <KioskInteractionViews
        activeStep={activeStep}
        params={params}
        transcript={transcript}
        silenceRemaining={silenceRemaining}
        onNextStep={onNextStep}
        feedbackRating={feedbackRating}
        setFeedbackRating={setFeedbackRating}
        hasRated={hasRated}
        setHasRated={setHasRated}
      />
    </div>
  );
};
