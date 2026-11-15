import React from 'react';
import {
  Sparkles,
  Clock,
  Star,
  Send,
  CheckCircle,
  ChevronRight,
  Volume2,
  Bot,
  Mic,
} from 'lucide-react';
import { KioskStaffAlert } from './KioskStaffAlert';

export const KioskInteractionViews = ({
  activeStep,
  params,
  transcript = '',
  silenceRemaining = 30,
  onNextStep = () => {},
  feedbackRating,
  setFeedbackRating,
  hasRated,
  setHasRated,
}) => {
  return (
    <>
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

      {/* 5b. CREATE_REQUEST DISPATCH BADGE */}
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
    </>
  );
};
