import { useCallback } from 'react';
import { resetSession } from '../../services/aiApi';
import { createKioskSessionId } from './robotVoiceIntentHelpers';

/**
 * Handles Room Picker selections, Room PIN verification outcomes,
 * session reset/idle reset, and direction/QR dismissal callbacks.
 */
export function useRobotPinAndRoomHandlers({
  language,
  prime,
  speak,
  stopSpeaking,
  stopListening,
  resetTranscript,
  sessionId,
  setSessionId,
  setActiveRoomNumber,
  setAuthenticatedRoom,
  setAiResponseText,
  setCurrentState,
  setNavigationDestinationKey,
  setNavigationStep,
  setIsAutoQrModalOpen,
  setQrCountdown,
  setIsPinModalOpen,
  isPinModalOpenRef,
  pinModalRoomNumber,
  pinModalAction,
  setIsFoodMenuOpen,
  setIsRoomServiceMenuOpen,
  setIsTaxiModalOpen,
  isTaxiModalOpenRef,
  setTaxiFlowStage,
  hasSpokenTaxiPromptRef,
  setIsFacilitiesModalOpen,
  setIsFeedbackModalOpen,
  setIsRoomPickerOpen,
  isRoomPickerOpenRef,
  isWaitingRoomForStatusQueryRef,
  statusQueryType,
  statusQueryTypeRef,
  updateStatusQueryType,
  setShowQuickMenu,
  setShowLangMenu,
  setIsProcessing,
  isProcessingRef,
  activeChatRequestIdRef,
  chatAbortControllerRef,
  fillerTimerRef,
  processingSafetyTimerRef,
  clearRouteGuidanceTimers,
  clearFollowUpTimer,
  setIsWaitingFollowUp,
  lastInteractionTimeRef,
  handleStartTalkRef,
  handleStopTalkAndProcessRef,
}) {
  // Xử lý khi khách chọn số phòng từ bảng RoomPickerModal để kiểm tra đơn món hoặc dịch vụ
  const handleRoomPickerSelect = (roomNum) => {
    try {
      if (prime) prime();
    } catch {}
    isWaitingRoomForStatusQueryRef.current = false;
    isRoomPickerOpenRef.current = false;
    setIsRoomPickerOpen(false);
    stopSpeaking();
    if (roomNum) {
      setActiveRoomNumber(roomNum);
    }
    const currentQType = statusQueryTypeRef.current || statusQueryType;
    let promptText;
    if (currentQType === 'service') {
      promptText = `Kiểm tra tiến độ dọn phòng và dịch vụ phòng ${roomNum}`;
    } else if (currentQType === 'maintenance') {
      promptText = `Kiểm tra tiến độ sửa chữa kỹ thuật phòng ${roomNum}`;
    } else if (currentQType === 'taxi') {
      promptText = `Kiểm tra trạng thái đặt taxi phòng ${roomNum}`;
    } else if (currentQType === 'bellman') {
      promptText = `Kiểm tra tiến độ yêu cầu hành lý phòng ${roomNum}`;
    } else if (currentQType === 'food') {
      promptText = `Kiểm tra tình trạng món ăn phòng ${roomNum}`;
    } else {
      promptText = `Kiểm tra tiến độ đơn hàng và dịch vụ phòng ${roomNum}`;
    }
    handleStopTalkAndProcessRef.current?.(promptText, { force: true });
  };

  // Callback khi khách hàng xác thực mã PIN phòng hoặc thẻ NFC thành công tại Kiosk
  const handlePinVerifiedSuccess = useCallback(
    (result, selectedRoom) => {
      const verifiedRoom = result?.room_number || selectedRoom || pinModalRoomNumber;
      if (verifiedRoom) {
        setActiveRoomNumber(verifiedRoom);
        setAuthenticatedRoom(verifiedRoom);
      }
      setIsPinModalOpen(false);
      isPinModalOpenRef.current = false;

      if (['book_taxi', 'taxi', 'taxi_booking'].includes(pinModalAction)) {
        setIsFoodMenuOpen(false);
        setIsRoomServiceMenuOpen(false);
        setIsTaxiModalOpen(false);
        isTaxiModalOpenRef.current = false;
        hasSpokenTaxiPromptRef.current = false;
        setTaxiFlowStage('choosing_option');
        const isEn = language === 'English';
        const taxiPrompt = isEn
          ? `Room ${verifiedRoom} confirmed. I have 2 options: Option 1 is to call our partner taxi hotlines directly; Option 2 is to have Concierge arrange a taxi for you. Which option would you like?`
          : `Dạ phòng ${verifiedRoom} đã được xác thực thành công. Em có 2 lựa chọn: Lựa chọn 1 là quý khách tự gọi xe theo danh bạ hotline các hãng taxi; Lựa chọn 2 là nhờ Concierge đặt xe giùm. Quý khách muốn chọn phương án nào ạ?`;
        setAiResponseText(taxiPrompt);
        setCurrentState('RT-02');
        speak(taxiPrompt, isEn ? 'en-US' : 'vi-VN', () => {
          setTimeout(() => handleStartTalkRef.current?.({ silent: true }), 120);
        });
        return;
      }

      if (
        pinModalAction === 'query_order_status' ||
        pinModalAction === 'query_service_status' ||
        pinModalAction === 'query_taxi_status' ||
        pinModalAction === 'query_maintenance_status'
      ) {
        const qType =
          pinModalAction === 'query_service_status'
            ? 'service'
            : pinModalAction === 'query_taxi_status'
            ? 'taxi'
            : pinModalAction === 'query_maintenance_status'
            ? 'maintenance'
            : 'food';
        updateStatusQueryType(qType);
        handleRoomPickerSelect(verifiedRoom);
        return;
      }

      const isEn = language === 'English';
      const bellMsg =
        pinModalAction === 'bellman' && result?.ticket_code
          ? isEn
            ? result.duplicate
              ? `Your room already has an open Bellman request #${result.ticket_code}. No new ticket was created.`
              : `Your luggage request #${result.ticket_code} has been sent to the Bell team.`
            : result.message
          : null;
      const baseMsg =
        bellMsg ||
        (result?.merged
          ? isEn
            ? `The additional issue was added to your open repair request #${result.ticket_code} for the same equipment. No new ticket was created.`
            : `Đã bổ sung sự cố vào phiếu sửa chữa #${result.ticket_code} đang mở cho cùng thiết bị. Không tạo thêm phiếu mới.`
          : result?.duplicate
          ? isEn
            ? `This issue already has an open request #${result.ticket_code} for your room. Please track that request; no new ticket was created.`
            : `Sự cố này của phòng đã có phiếu #${result.ticket_code} đang chờ hoặc đang xử lý. Quý khách vui lòng theo dõi phiếu hiện có; hệ thống không tạo phiếu mới.`
          : result?.message || (isEn ? 'Room verified successfully!' : 'Xác thực phòng thành công!'));
      const finalMsg = isEn
        ? `${baseMsg} Do you need any further assistance?`
        : `${baseMsg} Quý khách có cần Rora hỗ trợ thêm gì nữa không ạ?`;
      setAiResponseText(finalMsg);
      setCurrentState('RT-02');
      speak(finalMsg, isEn ? 'en-US' : 'vi-VN', () => {
        setTimeout(() => {
          handleStartTalkRef.current?.({ silent: true });
        }, 300);
      });
    },
    [language, speak, pinModalRoomNumber, pinModalAction, updateStatusQueryType, setTaxiFlowStage]
  );

  const handlePinNotCheckedIn = useCallback(
    (info) => {
      const notCheckedInMsg =
        info?.message ||
        `Dạ phòng ${info?.roomNumber || ''} hiện chưa làm thủ tục nhận phòng. Quý khách vui lòng qua quầy Lễ tân để check-in rồi mới được đặt món nhé ạ.`;
      setAiResponseText(notCheckedInMsg);
      setNavigationDestinationKey(info?.destination_key || 'front_desk');
      setCurrentState('RT-05');
      speak(notCheckedInMsg, language === 'English' ? 'en-US' : 'vi-VN');
    },
    [language, speak]
  );

  const handleForgotPinFallback = useCallback(
    (info) => {
      isPinModalOpenRef.current = false;
      setIsPinModalOpen(false);
      setIsFoodMenuOpen(false);
      setIsRoomServiceMenuOpen(false);
      const msg =
        language === 'English'
          ? 'For your room security, the robot cannot provide or reset room PINs. Please visit the Front Desk reception in the lobby for assistance.'
          : 'Dạ vì lý do an toàn và bảo mật thông tin phòng, Robot không thể cấp lại mã PIN phòng. Quý khách vui lòng đến quầy Lễ tân tại sảnh chính để được nhân viên hỗ trợ nhé ạ.';
      setAiResponseText(msg);
      setNavigationDestinationKey(info?.destination_key || 'front_desk');
      setCurrentState('RT-05');
      speak(msg, language === 'English' ? 'en-US' : 'vi-VN');
    },
    [language, speak]
  );

  const handleManualResetSession = async () => {
    activeChatRequestIdRef.current += 1;
    if (chatAbortControllerRef.current) {
      try { chatAbortControllerRef.current.abort(); } catch {}
      chatAbortControllerRef.current = null;
    }
    if (fillerTimerRef.current) clearTimeout(fillerTimerRef.current);
    if (processingSafetyTimerRef.current) clearTimeout(processingSafetyTimerRef.current);
    isProcessingRef.current = false;
    setIsProcessing(false);
    clearRouteGuidanceTimers();
    setIsFoodMenuOpen(false);
    setIsRoomServiceMenuOpen(false);
    setIsTaxiModalOpen(false);
    setTaxiFlowStage(null);
    setIsFacilitiesModalOpen(false);
    setIsFeedbackModalOpen(false);
    setIsAutoQrModalOpen(false);
    setIsPinModalOpen(false);
    isPinModalOpenRef.current = false;
    setShowQuickMenu(false);
    setShowLangMenu(false);
    stopSpeaking();
    stopListening();
    resetTranscript();
    setActiveRoomNumber(null);
    setAuthenticatedRoom(null);
    setAiResponseText('');
    await resetSession(sessionId);
    setSessionId(createKioskSessionId());
    setCurrentState('RT-02');
    lastInteractionTimeRef.current = Date.now();
  };

  const handleCloseDirections = useCallback(() => {
    clearRouteGuidanceTimers();
    setNavigationDestinationKey(null);
    setNavigationStep(1);
    setIsAutoQrModalOpen(false);
    setQrCountdown(null);
    setCurrentState('RT-02');
    lastInteractionTimeRef.current = Date.now();
  }, [clearRouteGuidanceTimers]);

  const handleCloseQrModalOnly = useCallback(() => {
    setIsAutoQrModalOpen(false);
    setQrCountdown(null);
  }, []);

  const resetToIdle = () => {
    activeChatRequestIdRef.current += 1;
    if (chatAbortControllerRef.current) {
      try { chatAbortControllerRef.current.abort(); } catch {}
      chatAbortControllerRef.current = null;
    }
    if (fillerTimerRef.current) clearTimeout(fillerTimerRef.current);
    if (processingSafetyTimerRef.current) clearTimeout(processingSafetyTimerRef.current);
    clearFollowUpTimer();
    setIsWaitingFollowUp(false);
    isProcessingRef.current = false;
    setIsProcessing(false);
    clearRouteGuidanceTimers();
    setNavigationDestinationKey(null);
    setIsFacilitiesModalOpen(false);
    stopSpeaking();
    stopListening();
    resetTranscript();
    setAiResponseText('');
    setCurrentState('RT-02');
    lastInteractionTimeRef.current = Date.now();
  };

  return {
    handleRoomPickerSelect,
    handlePinVerifiedSuccess,
    handlePinNotCheckedIn,
    handleForgotPinFallback,
    handleManualResetSession,
    handleCloseDirections,
    handleCloseQrModalOnly,
    resetToIdle,
  };
}
