import { useEffect } from 'react';
import { detectDestinationPoi } from '../../components/robot/FloorMap';
import { flushSession, resetSession } from '../../services/aiApi';
import { playEarcon } from '../../utils/audioFeedback';
import { BATTERY_MODE } from '../../utils/batteryPolicy';
import { getSemanticSilenceDebounce } from '../../hooks/useSpeechRecognition';
import {
  classifyStatusOrOrderIntent,
  createKioskSessionId,
  detectSpokenValidRoom,
  isEnglishQueryText,
  tryHandleQuickVoiceDirectives,
} from './robotVoiceIntentHelpers';
import { executeRobotChatTurn } from './robotMainResponseExecutor';

/**
 * Orchestrates robot kiosk voice interactions: guest approach/departure,
 * barge-in, VAD silence debounce, AI RAG chat turn execution, and multi-stage RT-05 wayfinding.
 */
export function useRobotVoiceConversation(params) {
  const {
    currentState,
    setCurrentState,
    language,
    setLanguage,
    languageRef,
    aiResponseText,
    setAiResponseText,
    setLastUserPrompt,
    isProcessing,
    setIsProcessing,
    isProcessingRef,
    isSpeaking,
    isSpeakingRef,
    isListening,
    transcript,
    volumeLevel,
    prime,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    resetTranscript,
    sessionId,
    setSessionId,
    activeRoomNumber,
    setActiveRoomNumber,
    authenticatedRoom,
    setAuthenticatedRoom,
    guestPresent,
    setGuestPresent,
    isStandby,
    setIsStandby,
    isAutoListen,
    isIdlePromo,
    pausePromoForGuest,
    isWorkflowRunning,
    stopWorkflow,
    requestPhase,
    batteryGuard,
    announceLowBattery,
    isVideoCallOpen,
    isVideoCallOpenRef,
    isPinModalOpen,
    isPinModalOpenRef,
    isRoomPickerOpenRef,
    isWaitingRoomForStatusQueryRef,
    setIsRoomPickerOpen,
    isAutoQrModalOpen,
    setIsAutoQrModalOpen,
    setQrCountdown,
    setNavigationDestinationKey,
    setIsWaitingFollowUp,
    clearFollowUpTimer,
    clearRouteGuidanceTimers,
    resetStandbyTimer,
    handleOpenFeedback,
    consumeTaxiVoiceTurn,
    silenceTimerRef,
    processingSafetyTimerRef,
    activeChatRequestIdRef,
    chatAbortControllerRef,
    fillerTimerRef,
    lastInteractionTimeRef,
    handleStartTalkRef,
    handleStopTalkAndProcessRef,
  } = params;

  const abortPendingChatRequest = () => {
    activeChatRequestIdRef.current += 1;
    if (chatAbortControllerRef.current) {
      try { chatAbortControllerRef.current.abort(); } catch {}
      chatAbortControllerRef.current = null;
    }
  };

  const listenForNextUserUtterance = (listenLang) => {
    startListening(listenLang, {
      onFinal: (finalText) => {
        if (finalText && finalText.trim().length > 0) {
          setIsStandby(false);
          lastInteractionTimeRef.current = Date.now();
          handleStopTalkAndProcessRef.current?.(finalText.trim());
        }
      },
    });
  };

  const handleGuestApproached = () => {
    setGuestPresent(true);
    if (!batteryGuard.canStartGuestSession) {
      announceLowBattery();
      return;
    }
    setIsStandby(false);
    resetStandbyTimer();

    if (isIdlePromo) pausePromoForGuest();
    else if (isWorkflowRunning) return;

    if (currentState === 'RT-01') {
      setCurrentState('RT-02');
      if (isAutoListen) {
        setTimeout(() => {
          handleStartTalk();
        }, 500);
      }
    }
  };

  const handleGuestApproachedByTouch = () => {
    if (!batteryGuard.canStartGuestSession) {
      announceLowBattery();
      return;
    }
    pausePromoForGuest();
    handleStartTalk();
  };

  const handleGuestLeft = async () => {
    setGuestPresent(false);
    if (requestPhase) {
      stopWorkflow();
      stopListening();
      resetTranscript();
      setActiveRoomNumber(null);
      setAuthenticatedRoom(null);
      setAiResponseText('');
      setLastUserPrompt('');
      flushSession(sessionId).catch(() => {});
      setSessionId(createKioskSessionId());
      setCurrentState('RT-01');
      return;
    }
    if (
      isSpeaking ||
      isSpeakingRef.current ||
      isProcessing ||
      isProcessingRef.current ||
      Boolean(aiResponseText) ||
      currentState === 'RT-05' ||
      isWorkflowRunning
    ) {
      return;
    }

    stopSpeaking();
    stopListening();
    resetTranscript();
    try {
      await flushSession(sessionId);
    } catch (err) {
      console.warn('Auto-flush session on guest left:', err);
    }
    setActiveRoomNumber(null);
    setAuthenticatedRoom(null);
    setAiResponseText('');
    setLastUserPrompt('');
    resetSession(sessionId);
    setCurrentState('RT-01');
  };

  // 1. Khi kích hoạt lắng nghe (Bấm nút hoặc Tự động rảnh tay)
  const handleStartTalk = (options = {}) => {
    try { if (prime) prime(); } catch (e) {}
    const isSilent = Boolean(options?.silent);
    if (requestPhase || isVideoCallOpenRef.current || isPinModalOpenRef.current) return;
    if (batteryGuard.mode === BATTERY_MODE.CRITICAL || (!batteryGuard.canStartGuestSession && currentState === 'RT-01')) {
      if (!isSilent) announceLowBattery();
      return;
    }
    lastInteractionTimeRef.current = Date.now();
    if (isStandby) setIsStandby(false);
    abortPendingChatRequest();
    if (fillerTimerRef.current) clearTimeout(fillerTimerRef.current);
    clearRouteGuidanceTimers();
    if (processingSafetyTimerRef.current) clearTimeout(processingSafetyTimerRef.current);
    isProcessingRef.current = false;
    setIsProcessing(false);
    stopSpeaking();
    resetTranscript();
    setAiResponseText('');
    if (!isSilent) {
      playEarcon('start_listening');
    }
    setCurrentState('RT-03');
    listenForNextUserUtterance(languageRef.current || language);
  };
  handleStartTalkRef.current = handleStartTalk;

  const handleStopSpeaking = () => {
    abortPendingChatRequest();
    if (fillerTimerRef.current) clearTimeout(fillerTimerRef.current);
    if (processingSafetyTimerRef.current) clearTimeout(processingSafetyTimerRef.current);
    clearRouteGuidanceTimers();
    stopSpeaking();
    playEarcon('barge_in');
    isProcessingRef.current = false;
    setIsProcessing(false);
    setAiResponseText('');
    setCurrentState('RT-03');
    setTimeout(() => {
      handleStartTalk();
    }, 60);
  };

  // Tự động khởi động lại SpeechRecognition với ngôn ngữ mới khi language thay đổi
  useEffect(() => {
    if (isListening && currentState === 'RT-03') {
      listenForNextUserUtterance(language);
    }
  }, [language]);

  // Tự động bật mic khi mở màn hình robot (khi vừa vào)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isVideoCallOpen && !isPinModalOpen && !isListening && !isSpeaking && !isProcessing && currentState !== 'RT-05' && !isStandby) {
        handleStartTalkRef.current?.();
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [isVideoCallOpen]);

  // Tự động gửi AI khi người dùng ngừng nói đủ lâu (VAD Silence Detection tự nhiên: 1800ms)
  useEffect(() => {
    if (
      !isVideoCallOpen &&
      !isPinModalOpen &&
      isListening &&
      !isSpeaking &&
      !isSpeakingRef.current &&
      !isProcessingRef.current &&
      !isProcessing &&
      (currentState === 'RT-03' || currentState === 'RT-05') &&
      transcript &&
      transcript.trim().length > 0
    ) {
      if (volumeLevel >= 6) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        return;
      }

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const dynamicDebounceMs = getSemanticSilenceDebounce(transcript, true);
      silenceTimerRef.current = setTimeout(() => {
        const textToProcess = transcript.trim();
        resetTranscript();
        handleStopTalkAndProcess(textToProcess);
      }, dynamicDebounceMs);
    }
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [transcript, currentState, isListening, isSpeaking, isProcessing, isVideoCallOpen, volumeLevel]);

  // 2. Gửi tới Ollama RAG Backend
  const handleStopTalkAndProcess = async (userText, options = {}) => {
    const force = Boolean(options?.force);
    clearFollowUpTimer();
    setIsWaitingFollowUp(false);
    lastInteractionTimeRef.current = Date.now();
    if (isStandby) setIsStandby(false);

    if (force) {
      abortPendingChatRequest();
      stopSpeaking();
      isSpeakingRef.current = false;
      isProcessingRef.current = false;
      setIsProcessing(false);
    } else if (isProcessingRef.current || isSpeakingRef.current || isSpeaking) {
      return;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const query = (userText || transcript || '').trim();
    if (isRoomPickerOpenRef.current || isWaitingRoomForStatusQueryRef.current) {
      isRoomPickerOpenRef.current = false;
      isWaitingRoomForStatusQueryRef.current = false;
      setIsRoomPickerOpen(false);
    }

    if (!query || query.length === 0) {
      if (currentState !== 'RT-05') setCurrentState('RT-02');
      return;
    }

    if (consumeTaxiVoiceTurn(query)) {
      isProcessingRef.current = false;
      setIsProcessing(false);
      return;
    }

    setLastUserPrompt(query);
    playEarcon('chime');

    const currentChatId = ++activeChatRequestIdRef.current;
    if (chatAbortControllerRef.current) {
      try { chatAbortControllerRef.current.abort(); } catch {}
      chatAbortControllerRef.current = null;
    }
    chatAbortControllerRef.current = new AbortController();
    const chatSignal = chatAbortControllerRef.current.signal;

    clearRouteGuidanceTimers();
    clearFollowUpTimer();
    setIsWaitingFollowUp(false);
    stopSpeaking();

    isProcessingRef.current = true;
    setIsProcessing(true);

    if (processingSafetyTimerRef.current) clearTimeout(processingSafetyTimerRef.current);
    processingSafetyTimerRef.current = setTimeout(() => {
      if (isProcessingRef.current) {
        console.warn('[SafetyTimeout] Auto-unlocking stuck isProcessing state after 35s');
        abortPendingChatRequest();
        clearRouteGuidanceTimers();
        stopSpeaking();
        isProcessingRef.current = false;
        setIsProcessing(false);
        if (!isSpeaking) {
          setCurrentState((prev) => (prev === 'RT-04' ? 'RT-02' : prev));
        }
      }
    }, 35000);

    stopListening();
    resetTranscript();
    const lowerQuery = query.toLowerCase();

    if (
      tryHandleQuickVoiceDirectives({
        lowerQuery,
        currentState,
        isAutoQrModalOpen,
        language,
        clearRouteGuidanceTimers,
        setIsAutoQrModalOpen,
        setQrCountdown,
        setNavigationDestinationKey,
        setCurrentState,
        stopSpeaking,
        stopListening,
        resetTranscript,
        isProcessingRef,
        setIsProcessing,
        setAiResponseText,
        speak,
        onRestartTalk: () => handleStartTalk(),
        onOpenFeedback: handleOpenFeedback,
      })
    ) {
      return;
    }

    const { isStatusQueryPrompt, isOrderIntent } = classifyStatusOrOrderIntent(lowerQuery);
    const spokenRoomDetected = detectSpokenValidRoom(query);
    const effectiveRoomNumber =
      spokenRoomDetected || detectSpokenValidRoom(authenticatedRoom) || detectSpokenValidRoom(activeRoomNumber);

    const isAnsweringRoomForStatus = isWaitingRoomForStatusQueryRef.current || isRoomPickerOpenRef.current;
    const fastDestKey =
      isStatusQueryPrompt || isAnsweringRoomForStatus ? null : detectDestinationPoi(query, activeRoomNumber);
    if (fastDestKey) {
      setNavigationDestinationKey(fastDestKey);
      setCurrentState('RT-05');
    } else {
      setCurrentState('RT-04');
    }

    isEnglishQueryText(language, query);

    await executeRobotChatTurn({
      ...params,
      query,
      lowerQuery,
      fastDestKey,
      isStatusQueryPrompt,
      isOrderIntent,
      spokenRoomDetected,
      effectiveRoomNumber,
      currentChatId,
      chatSignal,
      handleStartTalk,
      handleStopTalkAndProcess,
    });
  };
  handleStopTalkAndProcessRef.current = handleStopTalkAndProcess;

  return {
    handleGuestApproached,
    handleGuestApproachedByTouch,
    handleGuestLeft,
    handleStartTalk,
    handleStopSpeaking,
    handleStopTalkAndProcess,
  };
}
