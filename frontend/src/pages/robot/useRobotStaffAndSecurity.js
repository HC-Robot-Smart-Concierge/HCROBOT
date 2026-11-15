import { useCallback, useEffect, useRef } from 'react';
import { flushSession } from '../../services/aiApi';
import { createConciergeRequest } from '../../services/conciergeApi';
import { createKioskSessionId } from './robotVoiceIntentHelpers';

/**
 * Manages guest emotion concierge alerts, quick feedback survey prompts,
 * and hidden staff kiosk logout gestures (5-tap, 3s touch-hold, Ctrl+Shift+L, 3x Esc).
 */
export function useRobotStaffAndSecurity({
  language,
  transcript,
  speak,
  stopSpeaking,
  stopListening,
  sessionId,
  setSessionId,
  activeRoomNumber,
  setActiveRoomNumber,
  setAuthenticatedRoom,
  setGuestEmotion,
  lastUnhappyAlertTimeRef,
  isUnhappyAssistanceOpen,
  setIsUnhappyAssistanceOpen,
  isVideoCallOpenRef,
  setVideoCallSessionId,
  setVideoCallTicketCode,
  setIsVideoCallOpen,
  setIsFeedbackModalOpen,
  setIsWaitingFollowUp,
  clearFollowUpTimer,
  followUpTimerRef,
  setAiResponseText,
  setCurrentState,
  logoutPassword,
  setShowLogoutModal,
  setLogoutPassword,
  setLogoutError,
  onLogout,
  handleStartTalkRef,
}) {
  const handleConfirmCallConcierge = useCallback(async () => {
    setIsUnhappyAssistanceOpen(false);
    try {
      const promptText =
        language === 'English'
          ? 'Connecting to Concierge staff now. Please wait a moment.'
          : 'Dạ vâng, đang kết nối tới nhân viên Concierge. Quý khách vui lòng đợi trong giây lát ạ.';
      speak(promptText);
    } catch {}

    // Gọi thẳng Concierge kết nối video trực tiếp, không gửi thông báo
    try {
      const roomLoc = activeRoomNumber ? `Phòng ${activeRoomNumber}` : 'Sảnh Kiosk';
      const req = await createConciergeRequest({
        title: 'Khách yêu cầu hỗ trợ trực tiếp từ Kiosk',
        room_number: activeRoomNumber || 'Main Lobby Kiosk',
        guest_name: activeRoomNumber ? `Guest (Room ${activeRoomNumber})` : 'Khách tại Sảnh',
        description: `Kết nối Live Call trực tiếp từ Kiosk tại ${roomLoc}.`,
        notify: false,
      });
      const canonicalCode = req.ticket_code || req.id || `SUP-${Date.now()}`;
      setVideoCallSessionId(canonicalCode);
      setVideoCallTicketCode(req.ticket_code || canonicalCode);
      setIsVideoCallOpen(true);
    } catch (err) {
      console.warn('Call concierge fallback:', err);
      const fallbackCode = `CCG-${Date.now()}`;
      setVideoCallSessionId(fallbackCode);
      setVideoCallTicketCode(fallbackCode);
      setIsVideoCallOpen(true);
    }
  }, [activeRoomNumber, language, speak]);

  const handleDismissUnhappyAssistance = useCallback(() => {
    setIsUnhappyAssistanceOpen(false);
    try {
      const promptText =
        language === 'English'
          ? 'Thank you. Please feel free to touch the screen anytime if you need help.'
          : 'Dạ vâng, nếu cần thêm bất cứ trợ giúp nào, quý khách cứ chạm vào màn hình nhé.';
      speak(promptText);
    } catch {}
  }, [language, speak]);

  const handleGuestEmotionDetected = useCallback(
    (emotion) => {
      setGuestEmotion(emotion);
      if (emotion === 'unhappy') {
        const now = Date.now();
        if (now - lastUnhappyAlertTimeRef.current > 60000) {
          lastUnhappyAlertTimeRef.current = now;
          if (!isVideoCallOpenRef.current) {
            setIsUnhappyAssistanceOpen(true);
            const prompt =
              language === 'English'
                ? 'I noticed you might need assistance. Would you like me to call our Concierge staff right away?'
                : 'Dạ, tôi thấy quý khách dường như đang gặp bất tiện. Quý khách có cần tôi gọi nhân viên Concierge tới hỗ trợ trực tiếp không ạ?';
            try {
              speak(prompt);
            } catch {}
          }
        }
      }
    },
    [language, speak]
  );

  // Lang nghe phan hoi bang giong noi khi Modal ho tro bieu cam dang mo
  useEffect(() => {
    if (!isUnhappyAssistanceOpen || !transcript) return;
    const lower = transcript.toLowerCase();
    if (/có|gọi|nhân viên|đồng ý|hỗ trợ|yes|call|staff|concierge|help/i.test(lower)) {
      handleConfirmCallConcierge();
    } else if (/không|thôi|được rồi|tự làm|tự xử lý|no|cancel|dismiss/i.test(lower)) {
      handleDismissUnhappyAssistance();
    }
  }, [transcript, isUnhappyAssistanceOpen, handleConfirmCallConcierge, handleDismissUnhappyAssistance]);

  const handleOpenFeedback = useCallback(
    (options = {}) => {
      stopSpeaking();
      stopListening();
      clearFollowUpTimer();
      setIsWaitingFollowUp(false);
      setIsFeedbackModalOpen(true);
      if (options?.speakPrompt) {
        speak('Rora cảm ơn quý khách! Quý khách chấm điểm dịch vụ giúp em nhé.');
      }
    },
    [stopSpeaking, stopListening, clearFollowUpTimer, speak]
  );

  const triggerFollowUpPrompt = useCallback(
    (promptMsg, isEn = false) => {
      clearFollowUpTimer();
      setIsWaitingFollowUp(true);
      setAiResponseText(promptMsg);
      setCurrentState('RT-02');

      speak(promptMsg, isEn ? 'en-US' : 'vi-VN', () => {
        setTimeout(() => {
          handleStartTalkRef.current?.({ silent: true });
        }, 300);

        followUpTimerRef.current = setTimeout(() => {
          setIsWaitingFollowUp(false);
          handleOpenFeedback({ speakPrompt: true });
        }, 8000);
      });
    },
    [clearFollowUpTimer, speak, handleOpenFeedback]
  );

  const handleFeedbackCompleted = useCallback(
    (selectedRating) => {
      setIsFeedbackModalOpen(false);
      if (selectedRating && selectedRating >= 4) {
        speak('Rora cảm ơn quý khách! Chúc quý khách kỳ nghỉ tuyệt vời.');
      } else {
        speak('Rora xin ghi nhận ý kiến để hoàn thiện hơn. Cảm ơn quý khách.');
      }
      flushSession(sessionId).catch(() => {});
      setActiveRoomNumber(null);
      setAuthenticatedRoom(null);
      setSessionId(createKioskSessionId());
      setCurrentState('RT-02');
    },
    [sessionId, speak]
  );

  const handleCloseFeedback = useCallback(() => {
    setIsFeedbackModalOpen(false);
    flushSession(sessionId).catch(() => {});
    setActiveRoomNumber(null);
    setAuthenticatedRoom(null);
    setSessionId(createKioskSessionId());
    setCurrentState('RT-02');
  }, [sessionId]);

  const handleProtectedLogoutSubmit = (e) => {
    if (e) e.preventDefault();
    const validPasswords = ['123456', 'robot123', 'password123', 'admin', 'aurora2026'];
    if (validPasswords.includes(logoutPassword.trim())) {
      setShowLogoutModal(false);
      setLogoutPassword('');
      setLogoutError('');
      onLogout();
    } else {
      setLogoutError('Mật khẩu không chính xác! Vui lòng thử lại.');
    }
  };

  // Kiosk Protected Exit: Secret Multi-Tap (5 chạm) & Long Press (3s) & Hotkey (Ctrl+Shift+L / Esc x3)
  const secretTapCountRef = useRef(0);
  const secretTapTimerRef = useRef(null);
  const secretLongPressTimerRef = useRef(null);

  const handleSecretTrigger = useCallback(() => {
    setLogoutError('');
    setLogoutPassword('');
    setShowLogoutModal(true);
  }, []);

  const handleSecretAreaClick = useCallback(
    (e) => {
      e.stopPropagation();
      secretTapCountRef.current += 1;
      if (secretTapTimerRef.current) clearTimeout(secretTapTimerRef.current);

      if (secretTapCountRef.current >= 5) {
        secretTapCountRef.current = 0;
        handleSecretTrigger();
        return;
      }

      secretTapTimerRef.current = setTimeout(() => {
        secretTapCountRef.current = 0;
      }, 2000);
    },
    [handleSecretTrigger]
  );

  const handleSecretAreaTouchStart = useCallback(() => {
    secretLongPressTimerRef.current = setTimeout(() => {
      handleSecretTrigger();
    }, 3000);
  }, [handleSecretTrigger]);

  const handleSecretAreaTouchEnd = useCallback(() => {
    if (secretLongPressTimerRef.current) {
      clearTimeout(secretLongPressTimerRef.current);
    }
  }, []);

  useEffect(() => {
    let escCount = 0;
    let escTimer = null;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        handleSecretTrigger();
        return;
      }

      if (e.key === 'Escape') {
        escCount += 1;
        if (escTimer) clearTimeout(escTimer);
        if (escCount >= 3) {
          escCount = 0;
          handleSecretTrigger();
        } else {
          escTimer = setTimeout(() => {
            escCount = 0;
          }, 1500);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSecretTrigger]);

  return {
    handleConfirmCallConcierge,
    handleDismissUnhappyAssistance,
    handleGuestEmotionDetected,
    handleOpenFeedback,
    triggerFollowUpPrompt,
    handleFeedbackCompleted,
    handleCloseFeedback,
    handleProtectedLogoutSubmit,
    handleSecretAreaClick,
    handleSecretAreaTouchStart,
    handleSecretAreaTouchEnd,
  };
}
