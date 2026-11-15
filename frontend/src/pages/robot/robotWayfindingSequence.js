import { HOTEL_DESTINATIONS } from '../../components/robot/FloorMap';
import { synthesizeSpeech } from '../../services/aiApi';

/**
 * Coordinates multi-stage RT-05 wayfinding audio preloading (Step 1 -> Step 2 -> QR modal)
 * with synchronized voice playback and countdown timers.
 */
export function runMultiStageWayfindingSequence({
  navTargetKey,
  chatRes,
  langCode,
  detectedLang,
  currentChatId,
  activeChatRequestIdRef,
  processingSafetyTimerRef,
  wayfindingStepTimerRef,
  routeGuidanceTimerRef,
  qrStageTimerRef,
  qrCountdownIntervalRef,
  isAutoListen,
  isPinModalOpenRef,
  isVideoCallOpenRef,
  isSpeaking,
  isSpeakingRef,
  language,
  languageRef,
  clearRouteGuidanceTimers,
  handleCloseQrModalOnly,
  setNavigationStep,
  setIsAutoQrModalOpen,
  setQrCountdown,
  setIsProcessing,
  isProcessingRef,
  setAiResponseText,
  setIsStandby,
  lastInteractionTimeRef,
  speak,
  viVoice,
  enVoice,
  startListening,
  stopListening,
  resetTranscript,
  handleStopTalkAndProcess,
}) {
  clearRouteGuidanceTimers();
  isProcessingRef.current = false;
  setIsProcessing(false);
  if (processingSafetyTimerRef.current) {
    clearTimeout(processingSafetyTimerRef.current);
    processingSafetyTimerRef.current = null;
  }

  const destObj = HOTEL_DESTINATIONS[navTargetKey];
  const isEn = langCode === 'en-US' || detectedLang === 'English';
  const cleanStep1 = (destObj.step1Text || '').replace(/^Chặng 1:\s*/i, '').trim();
  const cleanStep2 = (destObj.step2Text || '').replace(/^Chặng 2:\s*/i, '').trim();

  const step2Speech = isEn ? `Step 2, ${cleanStep2}.` : `Chặng 2, ${cleanStep2}.`;
  const qrVoicePrompt = isEn
    ? 'You can scan the QR code on the screen to save directions on your mobile phone.'
    : 'Quý khách có thể quét mã QR trên màn hình để lưu lại chỉ dẫn đường đi trên điện thoại nhé ạ.';

  let preloadedStep2Audio = null;
  let preloadedQrAudio = null;

  // Preload background EdgeTTS ngay khi Chặng 1 bắt đầu (cửa sổ 10 giây)
  // Triệt tiêu 100% rủi ro đổi sang giọng Safari Linh trên iPhone XR do mất gesture sau setTimeout
  if (destObj.isDifferentFloor && cleanStep2) {
    synthesizeSpeech(step2Speech, {
      language: isEn ? 'en-US' : 'vi-VN',
      voice: isEn ? (enVoice || 'en-US-JennyNeural') : (viVoice || 'vi-VN-NamMinhNeural'),
    })
      .then((res) => {
        if (res?.audio_base64 && currentChatId === activeChatRequestIdRef.current) {
          preloadedStep2Audio = res.audio_base64;
        }
      })
      .catch(() => {});
  }

  synthesizeSpeech(qrVoicePrompt, {
    language: isEn ? 'en-US' : 'vi-VN',
    voice: isEn ? (enVoice || 'en-US-JennyNeural') : (viVoice || 'vi-VN-NamMinhNeural'),
  })
    .then((res) => {
      if (res?.audio_base64 && currentChatId === activeChatRequestIdRef.current) {
        preloadedQrAudio = res.audio_base64;
      }
    })
    .catch(() => {});

  const triggerQrStage = () => {
    if (currentChatId !== activeChatRequestIdRef.current) return;
    setIsAutoQrModalOpen(true);
    setQrCountdown(20);

    stopListening();
    resetTranscript();
    setAiResponseText(qrVoicePrompt);

    speak(
      qrVoicePrompt,
      isEn ? 'en-US' : 'vi-VN',
      () => {
        if (isAutoListen && !isPinModalOpenRef.current && !isVideoCallOpenRef.current) {
          setTimeout(() => {
            if (isPinModalOpenRef.current || isVideoCallOpenRef.current || isSpeaking || isSpeakingRef.current) return;
            resetTranscript();
            startListening(languageRef.current || language, {
              onFinal: (finalText) => {
                if (finalText && finalText.trim().length > 0) {
                  setIsStandby(false);
                  lastInteractionTimeRef.current = Date.now();
                  handleStopTalkAndProcess(finalText.trim());
                }
              },
            });
          }, 400);
        }
      },
      () => {
        stopListening();
        resetTranscript();
        setAiResponseText(qrVoicePrompt);
      },
      preloadedQrAudio || null
    );

    let timeLeft = 20;
    qrCountdownIntervalRef.current = setInterval(() => {
      timeLeft -= 1;
      setQrCountdown(timeLeft);
      if (timeLeft <= 0) {
        if (qrCountdownIntervalRef.current) clearInterval(qrCountdownIntervalRef.current);
      }
    }, 1000);

    qrStageTimerRef.current = setTimeout(() => {
      handleCloseQrModalOnly();
    }, 20000);
  };

  // CHẶNG 1: Hiển thị chặng 1 và phát giọng đọc (Ưu tiên audio_base64 đã sinh từ Backend /chat)
  setNavigationStep(1);
  const step1Speech = isEn
    ? `Here are directions to ${destObj.name}. Step 1, ${cleanStep1}.`
    : `Dạ em xin hướng dẫn đường đi tới ${destObj.name}: Chặng 1, ${cleanStep1}.`;

  setAiResponseText(step1Speech);
  speak(
    step1Speech,
    isEn ? 'en-US' : 'vi-VN',
    null,
    () => {
      stopListening();
      resetTranscript();
      setAiResponseText(step1Speech);
    },
    chatRes.audio_base64 || null
  );

  // Mỗi chặng giữ đúng 10 giây (10000ms)
  wayfindingStepTimerRef.current = setTimeout(() => {
    if (currentChatId !== activeChatRequestIdRef.current) return;
    if (destObj.isDifferentFloor) {
      // CHẶNG 2: Chuyển sang Chặng 2 trên bản đồ và phát giọng đọc
      setNavigationStep(2);

      setAiResponseText(step2Speech);
      speak(
        step2Speech,
        isEn ? 'en-US' : 'vi-VN',
        null,
        () => {
          stopListening();
          resetTranscript();
          setAiResponseText(step2Speech);
        },
        preloadedStep2Audio || null
      );

      // Giữ Chặng 2 trong 10 giây (10000ms), sau đó mới mở Modal QR
      routeGuidanceTimerRef.current = setTimeout(() => {
        triggerQrStage();
      }, 10000);
    } else {
      // Cùng tầng Trệt (chỉ 1 chặng): sau 10 giây mở Modal QR ngay
      triggerQrStage();
    }
  }, 10000);
}
