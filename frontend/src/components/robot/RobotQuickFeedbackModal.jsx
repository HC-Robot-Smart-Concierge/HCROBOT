import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Star, X, Check } from 'lucide-react';
import { submitFeedback } from '../../services/aiApi';

const COUNTDOWN_SECONDS = 8;

export function startFeedbackCountdown({ durationSeconds = COUNTDOWN_SECONDS, onTick, onExpire }) {
  const safeSeconds = Math.max(1, Number(durationSeconds) || COUNTDOWN_SECONDS);
  const closeAt = Date.now() + safeSeconds * 1000;
  let stopped = false;
  let lastReported = safeSeconds;
  let intervalId = null;
  let timeoutId = null;

  const cleanup = () => {
    stopped = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const expireOnce = () => {
    if (stopped) return;
    cleanup();
    if (typeof onTick === 'function' && lastReported !== 0) {
      lastReported = 0;
      onTick(0);
    }
    if (typeof onExpire === 'function') onExpire();
  };

  if (typeof onTick === 'function') onTick(safeSeconds);
  timeoutId = setTimeout(expireOnce, safeSeconds * 1000);
  intervalId = setInterval(() => {
    if (stopped) return;
    const remainingMs = closeAt - Date.now();
    if (remainingMs <= 0) {
      expireOnce();
      return;
    }
    const nextSeconds = Math.min(safeSeconds, Math.max(1, Math.ceil(remainingMs / 1000)));
    if (nextSeconds !== lastReported) {
      lastReported = nextSeconds;
      if (typeof onTick === 'function') onTick(nextSeconds);
    }
  }, 200);

  return cleanup;
}

export const RobotQuickFeedbackModal = ({
  isOpen,
  onClose,
  sessionId,
  roomNumber,
  guestName = 'Khách tại Kiosk',
  language = 'Tiếng Việt',
  onCompleted,
}) => {
  const isEn = language === 'English';
  const [rating, setRating] = useState(5);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const countdownCleanupRef = useRef(null);
  const postSubmitTimerRef = useRef(null);
  const submittedRef = useRef(false);

  // Keep latest props/state in refs so parent re-renders (e.g. TTS state changes) never restart the 8s timer.
  const ratingRef = useRef(rating);
  const onCompletedRef = useRef(onCompleted);
  const onCloseRef = useRef(onClose);
  const sessionIdRef = useRef(sessionId);
  const roomNumberRef = useRef(roomNumber);
  const guestNameRef = useRef(guestName);

  ratingRef.current = rating;
  onCompletedRef.current = onCompleted;
  onCloseRef.current = onClose;
  sessionIdRef.current = sessionId;
  roomNumberRef.current = roomNumber;
  guestNameRef.current = guestName;

  const stopTimers = useCallback(() => {
    if (countdownCleanupRef.current) {
      countdownCleanupRef.current();
      countdownCleanupRef.current = null;
    }
    if (postSubmitTimerRef.current) {
      clearTimeout(postSubmitTimerRef.current);
      postSubmitTimerRef.current = null;
    }
  }, []);

  const executeSubmit = useCallback(async (targetRating) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (countdownCleanupRef.current) {
      countdownCleanupRef.current();
      countdownCleanupRef.current = null;
    }
    setIsSubmitting(true);

    try {
      await submitFeedback({
        chat_session_id: sessionIdRef.current || undefined,
        rating: targetRating,
        category: 'Robot Concierge',
        room_number: roomNumberRef.current || undefined,
        guest_name: guestNameRef.current || undefined,
      });
    } catch (err) {
      console.warn('[FeedbackModal] Error submitting feedback:', err);
    } finally {
      setIsSubmitting(false);
      setIsSuccess(true);
      if (postSubmitTimerRef.current) {
        clearTimeout(postSubmitTimerRef.current);
      }
      postSubmitTimerRef.current = setTimeout(() => {
        postSubmitTimerRef.current = null;
        if (onCompletedRef.current) {
          onCompletedRef.current(targetRating);
        } else if (onCloseRef.current) {
          onCloseRef.current();
        }
      }, 1000);
    }
  }, []);

  // Đếm ngược 8 giây cố định mỗi lần mở modal, không bị reset khi parent re-render
  useEffect(() => {
    stopTimers();

    if (!isOpen) {
      setRating(5);
      setCountdown(COUNTDOWN_SECONDS);
      setIsSubmitting(false);
      setIsSuccess(false);
      submittedRef.current = false;
      return undefined;
    }

    submittedRef.current = false;
    setIsSuccess(false);
    setIsSubmitting(false);
    setRating(5);
    ratingRef.current = 5;

    countdownCleanupRef.current = startFeedbackCountdown({
      durationSeconds: COUNTDOWN_SECONDS,
      onTick: setCountdown,
      onExpire: () => {
        if (!submittedRef.current) {
          executeSubmit(ratingRef.current);
        }
      },
    });

    return () => {
      stopTimers();
    };
  }, [isOpen, executeSubmit, stopTimers]);

  const handleSelectStar = (starValue) => {
    setRating(starValue);
    ratingRef.current = starValue;
    executeSubmit(starValue);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-sm bg-stone-900 border border-stone-700/80 rounded-3xl p-6 shadow-2xl text-center space-y-4 text-stone-100">
        {/* Nút Đóng / Bỏ qua */}
        <button
          type="button"
          onClick={() => {
            stopTimers();
            if (onCloseRef.current) onCloseRef.current();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
          title={isEn ? 'Skip feedback' : 'Bỏ qua đánh giá'}
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="py-5 space-y-2.5 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-stone-800 border border-stone-600 flex items-center justify-center mx-auto text-stone-200">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide">
              {isEn ? 'Thank You!' : 'Cảm Ơn Quý Khách!'}
            </h3>
            <p className="text-xs text-stone-400">
              {isEn
                ? `Your ${rating}-star rating has been recorded.`
                : `Đánh giá ${rating} sao của quý khách đã được ghi nhận.`}
            </p>
          </div>
        ) : (
          <>
            {/* Thanh đếm ngược tiến trình */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider">
                <span>{isEn ? 'Quick Survey' : 'Khảo sát nhanh'}</span>
                <span>{isEn ? `Auto-close in ${countdown}s` : `Tự đóng sau ${countdown}s`}</span>
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
                {isEn ? 'Rate Our Service' : 'Chấm Điểm Dịch Vụ'}
              </h3>
              <p className="text-xs text-stone-400">
                {isEn ? 'Tap a star to submit your rating' : 'Chạm vào số sao quý khách muốn đánh giá'}
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
