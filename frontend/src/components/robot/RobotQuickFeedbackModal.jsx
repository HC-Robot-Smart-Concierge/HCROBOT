import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Star, X, Check } from 'lucide-react';
import { submitFeedback } from '../../services/aiApi';

const COUNTDOWN_SECONDS = 8;

export const RobotQuickFeedbackModal = ({
  isOpen,
  onClose,
  sessionId,
  roomNumber,
  guestName = 'Khách tại Kiosk',
  onCompleted,
}) => {
  const [rating, setRating] = useState(5);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const countdownTimerRef = useRef(null);
  const submittedRef = useRef(false);

  const executeSubmit = useCallback(
    async (targetRating) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setIsSubmitting(true);

      try {
        await submitFeedback({
          chat_session_id: sessionId || undefined,
          rating: targetRating,
          category: 'Robot Concierge',
          room_number: roomNumber || undefined,
          guest_name: guestName || undefined,
        });
      } catch (err) {
        console.warn('[FeedbackModal] Error submitting feedback:', err);
      } finally {
        setIsSubmitting(false);
        setIsSuccess(true);
        setTimeout(() => {
          if (onCompleted) onCompleted(targetRating);
          if (onClose) onClose();
        }, 1000);
      }
    },
    [sessionId, roomNumber, guestName, onCompleted, onClose]
  );

  // Đếm ngược 8 giây tự động đóng nếu khách không chạm
  useEffect(() => {
    if (!isOpen) {
      setRating(5);
      setCountdown(COUNTDOWN_SECONDS);
      setIsSubmitting(false);
      setIsSuccess(false);
      submittedRef.current = false;
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }

    setCountdown(COUNTDOWN_SECONDS);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          if (!submittedRef.current) {
            executeSubmit(rating);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isOpen, rating, executeSubmit]);

  const handleSelectStar = (starValue) => {
    setRating(starValue);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    executeSubmit(starValue);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-sm bg-stone-900 border border-stone-700/80 rounded-3xl p-6 shadow-2xl text-center space-y-4 text-stone-100">
        {/* Nút Đóng / Bỏ qua */}
        <button
          type="button"
          onClick={() => {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            if (onClose) onClose();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
          title="Bỏ qua đánh giá"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="py-5 space-y-2.5 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-stone-800 border border-stone-600 flex items-center justify-center mx-auto text-stone-200">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide">
              Cảm Ơn Quý Khách!
            </h3>
            <p className="text-xs text-stone-400">
              Đánh giá {rating} sao của quý khách đã được ghi nhận.
            </p>
          </div>
        ) : (
          <>
            {/* Thanh đếm ngược tiến trình */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider">
                <span>Khảo sát nhanh</span>
                <span>Tự đóng sau {countdown}s</span>
              </div>
              <div className="w-full h-1 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-stone-300 transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` }}
                />
              </div>
            </div>

            {/* Tiêu đề ngắn gọn */}
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white tracking-tight">
                Chấm Điểm Dịch Vụ
              </h3>
              <p className="text-xs text-stone-400">
                Chạm vào số sao quý khách muốn đánh giá
              </p>
            </div>

            {/* 5 Ngôi sao lớn chạm 1 lần là gửi ngay */}
            <div className="flex justify-center items-center gap-1.5 py-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSelectStar(star)}
                  className="p-1.5 transition-transform hover:scale-120 active:scale-90 cursor-pointer rounded-xl hover:bg-stone-800/60 disabled:cursor-not-allowed"
                  title={`${star} sao`}
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= rating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-stone-600 hover:text-stone-500'
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="text-xs font-mono font-semibold text-stone-300">
              {rating} / 5 Sao
            </div>
          </>
        )}
      </div>
    </div>
  );
};
