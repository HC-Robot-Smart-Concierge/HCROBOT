import { HOTEL_DESTINATIONS } from '../../components/robot/FloorMap';
import { sendChatPrompt } from '../../services/aiApi';
import {
  detectSpokenValidRoom,
  resolveEyeExpressionForQuery,
  resolveSafeNavigationKey,
  resolveStatusQueryTypeFromText,
} from './robotVoiceIntentHelpers';
import {
  dispatchAuthenticatedVoiceService,
  resolvePreVerifiedServiceTickets,
} from './robotAuthenticatedServiceHelper';
import { runMultiStageWayfindingSequence } from './robotWayfindingSequence';

function schedulePostSpeechAutoListen({
  isAutoListen,
  isPinModalOpenRef,
  isVideoCallOpenRef,
  isSpeaking,
  isSpeakingRef,
  languageRef,
  language,
  resetTranscript,
  startListening,
  setIsStandby,
  lastInteractionTimeRef,
  handleStopTalkAndProcess,
}) {
  if (!isAutoListen || isPinModalOpenRef.current || isVideoCallOpenRef.current) return;
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

function resetOtherServiceModals(ctx, activeKey = null) {
  ctx.setIsFoodMenuOpen(activeKey === 'food');
  ctx.setIsRoomServiceMenuOpen(activeKey === 'room_service');
  ctx.setIsMaintenanceMenuOpen(activeKey === 'maintenance');
  ctx.setIsBellmanMenuOpen(activeKey === 'bellman');
  ctx.setIsTaxiModalOpen(activeKey === 'taxi');
  ctx.setIsFacilitiesModalOpen(activeKey === 'facilities');
}

function applyMainResponseIntentRouting(ctx, chatRes) {
  const {
    query,
    lowerQuery,
    fastDestKey,
    isStatusQueryPrompt,
    isOrderIntent,
    spokenRoomDetected,
    effectiveRoomNumber,
    sessionId,
    activeRoomNumber,
    authenticatedRoom,
    setLanguage,
    languageRef,
    stopSpeaking,
    stopListening,
    setVideoCallSessionId,
    setVideoCallTicketCode,
    isVideoCallOpenRef,
    setIsVideoCallOpen,
    setPinModalRoomNumber,
    setPinModalAction,
    setPinModalItems,
    isPinModalOpenRef,
    setIsPinModalOpen,
    isRoomPickerOpenRef,
    isWaitingRoomForStatusQueryRef,
    setIsRoomPickerOpen,
    setActiveRoomNumber,
    updateStatusQueryType,
    handleTriggerTaxiBooking,
    triggerEyeExpression,
    setNavigationDestinationKey,
    setCurrentState,
  } = ctx;

  const replyText = chatRes.response || 'Dạ, tôi đã ghi nhận yêu cầu của quý khách.';
  const detectedLang = chatRes.detected_language || 'Tiếng Việt';
  const langCode = chatRes.lang_code || (detectedLang === 'English' ? 'en-US' : 'vi-VN');

  const updatedRoom =
    detectSpokenValidRoom(chatRes.target_room_number) ||
    detectSpokenValidRoom(chatRes.current_room_number) ||
    spokenRoomDetected;
  const isStatusAction = chatRes.action === 'query_order_status';
  const isAskRoomQuestion =
    chatRes.missing_room_number ||
    /ở phòng bao nhiêu|xin số phòng|cho rora biết mình đang ở phòng|room number so i can check/i.test(replyText);

  if ((isStatusAction || (isAskRoomQuestion && isStatusQueryPrompt)) && !isOrderIntent) {
    ctx.setIsFoodMenuOpen(false);
    ctx.setIsRoomServiceMenuOpen(false);
    ctx.setIsFacilitiesModalOpen(false);
    if (updatedRoom) setActiveRoomNumber(updatedRoom);
    updateStatusQueryType(resolveStatusQueryTypeFromText(lowerQuery, chatRes.status_query_type));
    const isTaxiIntent =
      /taxi|xe|đưa đón|dua don|chuyến xe|cuốc xe/i.test(lowerQuery) ||
      ['book_taxi', 'taxi', 'taxi_booking'].includes(chatRes.action) ||
      ['book_taxi', 'taxi', 'taxi_booking'].includes(chatRes.pending_service_action);
    const shouldAskRoom =
      !isTaxiIntent && (chatRes.missing_room_number || isAskRoomQuestion) && !activeRoomNumber && !updatedRoom;
    isWaitingRoomForStatusQueryRef.current = shouldAskRoom;
    isRoomPickerOpenRef.current = shouldAskRoom;
    setIsRoomPickerOpen(shouldAskRoom);
  } else if (
    updatedRoom &&
    !chatRes.require_room_pin &&
    !['book_taxi', 'taxi', 'taxi_booking'].includes(chatRes.action) &&
    !['book_taxi', 'taxi', 'taxi_booking'].includes(chatRes.pending_service_action)
  ) {
    isWaitingRoomForStatusQueryRef.current = false;
    setActiveRoomNumber(updatedRoom);
  }

  setLanguage(detectedLang);
  languageRef.current = detectedLang;

  if (chatRes.trigger_video_call) {
    stopSpeaking();
    stopListening();
    const canonicalCode = chatRes.ticket_code || chatRes.support_session_id || chatRes.session_id || sessionId;
    setVideoCallSessionId(canonicalCode);
    setVideoCallTicketCode(chatRes.ticket_code || canonicalCode);
    isVideoCallOpenRef.current = true;
    setIsVideoCallOpen(true);
  }

  if (chatRes.require_room_pin) {
    const targetRoom = chatRes.target_room_number || updatedRoom || authenticatedRoom || activeRoomNumber || '';
    const hasAuthRoom = authenticatedRoom && String(authenticatedRoom).trim();
    const isSameRoom = hasAuthRoom && (!targetRoom || String(targetRoom).trim() === String(authenticatedRoom).trim());
    const actionToExecute = chatRes.pending_service_action || chatRes.action || 'room_service';
    const itemsToExecute = chatRes.pending_service_items || query;

    if (isSameRoom) {
      dispatchAuthenticatedVoiceService({ actionToExecute, itemsToExecute, authenticatedRoom, handleTriggerTaxiBooking });
    } else if (['taxi', 'book_taxi', 'taxi_booking'].includes(actionToExecute)) {
      handleTriggerTaxiBooking(targetRoom);
    } else {
      setPinModalRoomNumber(targetRoom);
      setPinModalAction(actionToExecute);
      setPinModalItems(itemsToExecute);
      isPinModalOpenRef.current = true;
      setIsPinModalOpen(true);
    }
  } else if (!isStatusAction) {
    if (chatRes.trigger_menu === 'food_menu' || chatRes.action === 'open_food_menu') {
      if (updatedRoom) setActiveRoomNumber(updatedRoom);
      resetOtherServiceModals(ctx, 'food');
    } else if (
      (chatRes.trigger_menu === 'room_service' ||
        chatRes.action === 'open_room_service_menu' ||
        ['housekeeping', 'laundry'].includes(chatRes.action)) &&
      chatRes.action !== 'show_map' &&
      !chatRes.destination_key
    ) {
      if (updatedRoom) setActiveRoomNumber(updatedRoom);
      resetOtherServiceModals(ctx, 'room_service');
    } else if (chatRes.trigger_menu === 'maintenance' || chatRes.action === 'open_maintenance_menu') {
      if (updatedRoom) setActiveRoomNumber(updatedRoom);
      resetOtherServiceModals(ctx, 'maintenance');
    } else if (chatRes.trigger_menu === 'bellman' || chatRes.action === 'open_bellman_menu') {
      if (updatedRoom) setActiveRoomNumber(updatedRoom);
      resetOtherServiceModals(ctx, 'bellman');
    } else if (
      ['book_taxi', 'taxi', 'taxi_booking'].includes(chatRes.action) ||
      ['book_taxi', 'taxi', 'taxi_booking'].includes(chatRes.pending_service_action)
    ) {
      handleTriggerTaxiBooking(updatedRoom);
    } else if (chatRes.action === 'room_service') {
      if (/đặt món|gọi món|thực đơn|menu|đồ ăn|món ăn|cơm|phở|uống|ăn|pizza/i.test(lowerQuery)) {
        if (updatedRoom) setActiveRoomNumber(updatedRoom);
        resetOtherServiceModals(ctx, 'food');
      }
    } else if (chatRes.action === 'show_facilities' || chatRes.trigger_menu === 'facilities') {
      resetOtherServiceModals(ctx, 'facilities');
    }
  }

  const navTargetKey = resolveSafeNavigationKey({
    chatRes,
    fastDestKey,
    lowerQuery,
    isStatusAction,
    isStatusQueryPrompt,
    isWaitingRoomForStatus: isWaitingRoomForStatusQueryRef.current,
    effectiveRoomNumber,
  });
  const isRouteGuidance = Boolean(navTargetKey);

  if (isRouteGuidance) {
    setNavigationDestinationKey(navTargetKey);
    setCurrentState('RT-05');
  } else {
    setNavigationDestinationKey(null);
    setCurrentState('RT-02');
  }

  const expr = resolveEyeExpressionForQuery(lowerQuery, chatRes.eye_expression);
  if (expr) triggerEyeExpression(expr);

  const isFarewell = ['tạm biệt', 'hẹn gặp lại', 'bye', 'goodbye', 'kết thúc', 'xong rồi', 'hết rồi'].some((k) =>
    lowerQuery.includes(k)
  );

  return { replyText, detectedLang, langCode, navTargetKey, isRouteGuidance, isFarewell };
}

/**
 * Executes a single RAG voice turn after intent classification: dispatches chat request,
 * manages filler animation timer, applies returned modals/menus/navigation/TTS, and handles network fallback.
 */
export async function executeRobotChatTurn(ctx) {
  const {
    query,
    fastDestKey,
    spokenRoomDetected,
    effectiveRoomNumber,
    currentChatId,
    chatSignal,
    guestEmotion,
    sessionId,
    authenticatedRoom,
    language,
    languageRef,
    isAutoListen,
    isSpeaking,
    isSpeakingRef,
    isProcessingRef,
    activeChatRequestIdRef,
    fillerTimerRef,
    processingSafetyTimerRef,
    routeGuidanceTimerRef,
    wayfindingStepTimerRef,
    qrStageTimerRef,
    qrCountdownIntervalRef,
    lastInteractionTimeRef,
    isPinModalOpenRef,
    isVideoCallOpenRef,
    setIsProcessing,
    setAiResponseText,
    setCurrentState,
    setNavigationStep,
    setIsAutoQrModalOpen,
    setQrCountdown,
    setIsStandby,
    triggerEyeExpression,
    clearRouteGuidanceTimers,
    handleCloseQrModalOnly,
    handleCloseDirections,
    handleOpenFeedback,
    handleStartTalk,
    handleStopTalkAndProcess,
    speak,
    viVoice,
    enVoice,
    stopSpeaking,
    startListening,
    stopListening,
    resetTranscript,
  } = ctx;

  let hasReceivedResponse = false;

  if (fillerTimerRef.current) clearTimeout(fillerTimerRef.current);
  if (!fastDestKey) {
    fillerTimerRef.current = setTimeout(() => {
      if (hasReceivedResponse || currentChatId !== activeChatRequestIdRef.current) return;
      triggerEyeExpression('look_around');
    }, 1800);
  }

  try {
    const chatRes = await sendChatPrompt(query, null, 'auto', guestEmotion, sessionId, effectiveRoomNumber, chatSignal);
    if (currentChatId !== activeChatRequestIdRef.current || chatRes?.aborted) {
      if (fillerTimerRef.current) clearTimeout(fillerTimerRef.current);
      return;
    }

    const keepGoing = await resolvePreVerifiedServiceTickets({
      chatRes,
      query,
      spokenRoomDetected,
      authenticatedRoom,
      isCurrentRequest: () => currentChatId === activeChatRequestIdRef.current,
    });
    if (!keepGoing) return;

    hasReceivedResponse = true;
    if (fillerTimerRef.current) {
      clearTimeout(fillerTimerRef.current);
      fillerTimerRef.current = null;
    }

    if (currentChatId !== activeChatRequestIdRef.current) return;

    isProcessingRef.current = false;
    setIsProcessing(false);
    if (processingSafetyTimerRef.current) {
      clearTimeout(processingSafetyTimerRef.current);
      processingSafetyTimerRef.current = null;
    }

    const { replyText, detectedLang, langCode, navTargetKey, isRouteGuidance, isFarewell } =
      applyMainResponseIntentRouting(ctx, chatRes);

    const wordsCount = replyText.split(/\s+/).length;
    const speechSafetyMs = Math.max(wordsCount * 800 + 10000, 25000);
    processingSafetyTimerRef.current = setTimeout(() => {
      if (isProcessingRef.current && currentChatId === activeChatRequestIdRef.current) {
        stopSpeaking();
        isProcessingRef.current = false;
        setIsProcessing(false);
        setAiResponseText('');
        setCurrentState((prev) => (prev === 'RT-04' ? 'RT-02' : prev));
      }
    }, speechSafetyMs);

    stopListening();
    resetTranscript();

    if (isRouteGuidance && navTargetKey && HOTEL_DESTINATIONS[navTargetKey]) {
      runMultiStageWayfindingSequence({
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
      });
      return;
    }

    const hasAudio = Boolean(chatRes.audio_base64 && chatRes.audio_base64.length > 50);

    let hasRenderedText = false;
    const revealSubtitle = () => {
      if (!hasRenderedText && currentChatId === activeChatRequestIdRef.current) {
        hasRenderedText = true;
        stopListening();
        resetTranscript();
        setAiResponseText(replyText);
        setCurrentState((prev) => (prev === 'RT-04' ? 'RT-02' : prev));
      }
    };

    // Nếu backend không có audio (ví dụ timeout/lỗi mạng), hiển thị phụ đề và thoát trạng thái xoay RT-04 ngay lập tức
    if (!hasAudio) {
      revealSubtitle();
      isProcessingRef.current = false;
      setIsProcessing(false);
    }

    // Fallback an toàn: nếu sau 1.5s âm thanh chưa kịp bắn onplay, hiển thị phụ đề để không trễ
    const textSafetyTimer = setTimeout(() => {
      revealSubtitle();
    }, hasAudio ? 1500 : 0);

    speak(
      replyText,
      langCode,
      () => {
        clearTimeout(textSafetyTimer);
        setTimeout(() => {
          if (currentChatId !== activeChatRequestIdRef.current) return;
          lastInteractionTimeRef.current = Date.now();
          if (processingSafetyTimerRef.current) {
            clearTimeout(processingSafetyTimerRef.current);
            processingSafetyTimerRef.current = null;
          }
          isProcessingRef.current = false;
          setIsProcessing(false);

          if (isFarewell) {
            setAiResponseText('');
            setTimeout(() => handleOpenFeedback(), 600);
          } else if (isRouteGuidance && navTargetKey) {
            clearRouteGuidanceTimers();
            routeGuidanceTimerRef.current = setTimeout(() => {
              setIsAutoQrModalOpen(true);
              setQrCountdown(15);
              const qrVoicePrompt =
                langCode === 'en-US' || detectedLang === 'English'
                  ? 'You can scan the QR code on the screen to save directions on your mobile phone.'
                  : 'Quý khách có thể quét mã QR trên màn hình để lưu lại chỉ dẫn đường đi trên điện thoại nhé ạ.';
              stopListening();
              resetTranscript();
              speak(
                qrVoicePrompt,
                langCode === 'en-US' || detectedLang === 'English' ? 'en-US' : 'vi-VN',
                () => schedulePostSpeechAutoListen(ctx),
                () => {
                  stopListening();
                  resetTranscript();
                  setAiResponseText(qrVoicePrompt);
                }
              );

              let timeLeft = 15;
              qrCountdownIntervalRef.current = setInterval(() => {
                timeLeft -= 1;
                setQrCountdown(timeLeft);
                if (timeLeft <= 0 && qrCountdownIntervalRef.current) clearInterval(qrCountdownIntervalRef.current);
              }, 1000);
              qrStageTimerRef.current = setTimeout(() => handleCloseDirections(), 15000);
            }, 5000);

            schedulePostSpeechAutoListen(ctx);
          } else {
            setAiResponseText('');
            setCurrentState('RT-03');
            if (isAutoListen) {
              setTimeout(() => {
                resetTranscript();
                handleStartTalk({ silent: true });
              }, 120);
            }
          }
        }, 250);
      },
      () => {
        clearTimeout(textSafetyTimer);
        revealSubtitle();
      },
      chatRes.audio_base64,
      null,
      { skipRemoteTts: !hasAudio }
    );
  } catch {
    if (fillerTimerRef.current) {
      clearTimeout(fillerTimerRef.current);
      fillerTimerRef.current = null;
    }
    if (currentChatId !== activeChatRequestIdRef.current) return;
    if (processingSafetyTimerRef.current) {
      clearTimeout(processingSafetyTimerRef.current);
      processingSafetyTimerRef.current = null;
    }
    isProcessingRef.current = false;
    setIsProcessing(false);
    const fallbackText = 'Xin lỗi quý khách, không thể kết nối tới AI Server.';
    setCurrentState('RT-02');
    speak(
      fallbackText,
      language,
      () => {
        if (processingSafetyTimerRef.current) clearTimeout(processingSafetyTimerRef.current);
        isProcessingRef.current = false;
        setIsProcessing(false);
        setAiResponseText('');
        setCurrentState('RT-03');
        if (isAutoListen) handleStartTalk();
      },
      () => {
        stopListening();
        resetTranscript();
        setAiResponseText(fallbackText);
      }
    );
  }
}
