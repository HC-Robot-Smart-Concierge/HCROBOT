import { useCallback, useEffect } from 'react';
import {
  isSelfBookingVoiceIntent,
  isConciergeVoiceIntent,
  isDismissVoiceIntent,
} from '../../components/robot/RobotTaxiModal';
import { extractSpokenRoomNumber, isValidHotelRoom } from '../../utils/roomHelper';

/**
 * Manages the multi-step taxi booking voice flow (asking_room -> PIN verify -> choosing_option)
 * and modal microphone re-enablement hooks.
 */
export function useRobotTaxiFlow({
  language,
  speak,
  stopSpeaking,
  stopListening,
  resetTranscript,
  transcript,
  isSpeaking,
  isListening,
  isPinModalOpen,
  isVideoCallOpen,
  isSpeakingRef,
  isPinModalOpenRef,
  isVideoCallOpenRef,
  isTaxiModalOpen,
  isTaxiModalOpenRef,
  setIsTaxiModalOpen,
  taxiFlowStage,
  taxiFlowStageRef,
  setTaxiFlowStage,
  hasSpokenTaxiPromptRef,
  taxiModalInitialMode,
  setTaxiModalInitialMode,
  taxiVoiceInput,
  setTaxiVoiceInput,
  authenticatedRoom,
  activeRoomNumber,
  setPinModalRoomNumber,
  setPinModalAction,
  setPinModalItems,
  setIsPinModalOpen,
  setIsRoomPickerOpen,
  isRoomPickerOpenRef,
  setIsFoodMenuOpen,
  setIsRoomServiceMenuOpen,
  setIsMaintenanceMenuOpen,
  setIsBellmanMenuOpen,
  setAiResponseText,
  setCurrentState,
  handleStartTalkRef,
}) {
  // Dam bao sau khi Robot gioi thieu 2 phuong an dat xe, hoi so phong, hoac khi dang mo Modal Dat Xe ma Robot khong noi thi tu dong bat lang nghe
  useEffect(() => {
    if (taxiFlowStage === 'asking_room' || taxiFlowStage === 'choosing_option') {
      if (isSpeaking) {
        hasSpokenTaxiPromptRef.current = true;
      } else if (hasSpokenTaxiPromptRef.current && !isListening && !isPinModalOpen && !isTaxiModalOpen) {
        const timer = setTimeout(() => {
          if (
            (taxiFlowStageRef.current === 'asking_room' || taxiFlowStageRef.current === 'choosing_option') &&
            !isSpeakingRef.current &&
            !isPinModalOpenRef.current &&
            !isTaxiModalOpenRef.current
          ) {
            hasSpokenTaxiPromptRef.current = false;
            handleStartTalkRef.current?.({ silent: true });
          }
        }, 200);
        return () => clearTimeout(timer);
      }
    } else {
      hasSpokenTaxiPromptRef.current = false;
    }
  }, [isSpeaking, taxiFlowStage, isListening, isPinModalOpen, isTaxiModalOpen]);

  // Dam bao khi Modal Dat Xe (RobotTaxiModal) dang mo va Robot da noi xong thi micro luon tu dong bat
  useEffect(() => {
    if (!isTaxiModalOpen || isSpeaking || isListening || isPinModalOpen || isVideoCallOpen) return;
    const timer = setTimeout(() => {
      if (
        isTaxiModalOpenRef.current &&
        !isSpeakingRef.current &&
        !isPinModalOpenRef.current &&
        !isVideoCallOpenRef.current
      ) {
        handleStartTalkRef.current?.({ silent: true });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isTaxiModalOpen, isSpeaking, isListening, isPinModalOpen, isVideoCallOpen]);

  useEffect(() => {
    if (transcript && taxiVoiceInput) {
      setTaxiVoiceInput('');
    }
  }, [transcript, taxiVoiceInput]);

  const handleCloseTaxiModal = useCallback(() => {
    isTaxiModalOpenRef.current = false;
    setIsTaxiModalOpen(false);
    setTaxiFlowStage(null);
    setTaxiVoiceInput('');
    stopSpeaking();
    resetTranscript();
    setAiResponseText('');
    setCurrentState('RT-02');
    setTimeout(() => {
      if (!isPinModalOpenRef.current && !isVideoCallOpenRef.current && !isTaxiModalOpenRef.current) {
        handleStartTalkRef.current?.({ silent: true });
      }
    }, 150);
  }, [setTaxiFlowStage, stopSpeaking, resetTranscript]);

  const handleSelectTaxiSelfBooking = useCallback(() => {
    setTaxiFlowStage(null);
    setTaxiVoiceInput('');
    stopListening();
    resetTranscript();
    setTaxiModalInitialMode('self_booking');
    setIsTaxiModalOpen(true);
    isTaxiModalOpenRef.current = true;
    setIsFoodMenuOpen(false);
    setIsRoomServiceMenuOpen(false);
    const msg = 'Dạ, đây là danh bạ hotline các hãng taxi uy tín tại Đà Nẵng ạ.';
    setAiResponseText('');
    speak(msg, 'vi-VN', () => {
      setTimeout(() => handleStartTalkRef.current?.({ silent: true }), 120);
    });
  }, [speak, setTaxiFlowStage, stopListening, resetTranscript]);

  const handleSelectTaxiConciergeBooking = useCallback(() => {
    setTaxiFlowStage(null);
    setTaxiVoiceInput('');
    stopListening();
    resetTranscript();
    setAiResponseText('');
    setTaxiModalInitialMode('concierge_booking');
    setIsTaxiModalOpen(true);
    isTaxiModalOpenRef.current = true;
    setIsFoodMenuOpen(false);
    setIsRoomServiceMenuOpen(false);
  }, [setTaxiFlowStage, stopListening, resetTranscript]);

  const handleCancelTaxiFlow = useCallback(() => {
    setTaxiFlowStage(null);
    setTaxiVoiceInput('');
    stopListening();
    resetTranscript();
    const cancelMsg = 'Dạ em đã hủy yêu cầu đặt xe. Quý khách cần em hỗ trợ gì thêm không ạ?';
    setAiResponseText(cancelMsg);
    speak(cancelMsg, 'vi-VN', () => {
      setTimeout(() => handleStartTalkRef.current?.({ silent: true }), 120);
    });
  }, [speak, setTaxiFlowStage, stopListening, resetTranscript]);

  // Xử lý khi nhận được số phòng hợp lệ cho luồng đặt xe taxi (chỉ lưu phiên phòng sau khi nhập đúng mã PIN)
  const handleTaxiRoomProvided = useCallback(
    (rawRoom) => {
      const cleanRoom = String(rawRoom || '').trim();
      if (cleanRoom && isValidHotelRoom(cleanRoom)) {
        setTaxiFlowStage(null);
        setPinModalRoomNumber(cleanRoom);
        setPinModalAction('book_taxi');
        setPinModalItems('Yêu cầu đặt xe Taxi');
        setIsPinModalOpen(true);
        isPinModalOpenRef.current = true;
        const isEn = language === 'English';
        const msg = isEn
          ? `Room ${cleanRoom}. Please enter your 4-digit PIN on the screen to verify.`
          : `Dạ phòng ${cleanRoom}. Quý khách vui lòng nhập mã PIN xác thực trên màn hình ạ.`;
        setAiResponseText('');
        setCurrentState('RT-02');
        speak(msg, isEn ? 'en-US' : 'vi-VN');
      } else if (cleanRoom) {
        const isEn = language === 'English';
        const msg = isEn
          ? 'Hotel rooms are from 301 to 310, and 401 to 410. Which room are you staying in?'
          : 'Dạ khách sạn hiện chỉ có các phòng từ 301 đến 310 và 401 đến 410. Quý khách vui lòng nói lại số phòng của mình ạ.';
        setAiResponseText(msg);
        speak(msg, isEn ? 'en-US' : 'vi-VN', () => {
          setTimeout(() => handleStartTalkRef.current?.({ silent: true }), 120);
        });
      }
    },
    [language, speak, setTaxiFlowStage]
  );

  // Kích hoạt luồng đặt xe taxi: kiểm tra session phòng, nếu chưa có thì hỏi số phòng qua giọng nói
  const handleTriggerTaxiBooking = useCallback(
    (specifiedRoom = null) => {
      const requested = typeof specifiedRoom === 'string' ? specifiedRoom.trim() : '';
      const currentRoom = requested || authenticatedRoom;
      if (authenticatedRoom) {
        if (!requested || requested === String(authenticatedRoom)) {
          setIsFoodMenuOpen(false);
          setIsRoomServiceMenuOpen(false);
          setIsMaintenanceMenuOpen(false);
          setIsBellmanMenuOpen(false);
          setIsTaxiModalOpen(false);
          isTaxiModalOpenRef.current = false;
          hasSpokenTaxiPromptRef.current = false;
          setTaxiFlowStage('choosing_option');
          const isEn = language === 'English';
          const msg = isEn
            ? `Room ${authenticatedRoom} is confirmed. I have 2 options: Option 1 is to call our partner taxi hotlines directly; Option 2 is to have Concierge arrange a taxi for you. Which option would you like?`
            : `Dạ phòng ${authenticatedRoom} đã được xác thực thành công. Em có 2 lựa chọn: Lựa chọn 1 là quý khách tự gọi xe theo danh bạ hotline các hãng taxi; Lựa chọn 2 là nhờ Concierge đặt xe giùm. Quý khách muốn chọn phương án nào ạ?`;
          setAiResponseText(msg);
          setCurrentState('RT-02');
          speak(msg, isEn ? 'en-US' : 'vi-VN', () => {
            setTimeout(() => handleStartTalkRef.current?.({ silent: true }), 120);
          });
          return;
        }
      }

      if (!currentRoom) {
        setIsRoomPickerOpen(false);
        isRoomPickerOpenRef.current = false;
        setIsPinModalOpen(false);
        isPinModalOpenRef.current = false;
        setIsTaxiModalOpen(false);
        isTaxiModalOpenRef.current = false;
        hasSpokenTaxiPromptRef.current = false;
        setTaxiFlowStage('asking_room');
        const isEn = language === 'English';
        const msg = isEn
          ? 'To assist with taxi booking, which room are you staying in?'
          : 'Dạ để hỗ trợ đặt xe taxi, quý khách đang ở phòng bao nhiêu ạ?';
        setAiResponseText(msg);
        setCurrentState('RT-02');
        speak(msg, isEn ? 'en-US' : 'vi-VN', () => {
          setTimeout(() => handleStartTalkRef.current?.({ silent: true }), 120);
        });
        return;
      }

      setPinModalRoomNumber(currentRoom);
      setPinModalAction('book_taxi');
      setPinModalItems('Yêu cầu đặt xe Taxi');
      setIsPinModalOpen(true);
      isPinModalOpenRef.current = true;
      const isEn = language === 'English';
      const msg = isEn
        ? `To assist with taxi booking for room ${currentRoom}, please enter your PIN on the screen.`
        : `Dạ để hỗ trợ đặt xe taxi cho phòng ${currentRoom}, quý khách vui lòng nhập mã PIN xác thực trên màn hình ạ.`;
      setAiResponseText('');
      setCurrentState('RT-02');
      speak(msg, isEn ? 'en-US' : 'vi-VN');
    },
    [authenticatedRoom, activeRoomNumber, language, speak, setTaxiFlowStage]
  );

  /**
   * Handles active taxi modal or taxi voice stage turns before reaching the AI backend.
   * Returns true if the turn was fully consumed by the taxi flow.
   */
  const consumeTaxiVoiceTurn = (query) => {
    if (isTaxiModalOpen || isTaxiModalOpenRef.current) {
      resetTranscript();
      if (isDismissVoiceIntent(query)) {
        handleCloseTaxiModal();
        return true;
      }
      setTaxiVoiceInput(query);
      return true;
    }

    const currentTaxiStage = taxiFlowStageRef.current || taxiFlowStage;

    if (currentTaxiStage === 'asking_room') {
      stopListening();
      resetTranscript();
      const lowerQuery = query.toLowerCase().trim();
      if (isDismissVoiceIntent(lowerQuery) || /^(hủy|thôi|dừng|quay lại|cancel|close)/i.test(lowerQuery)) {
        handleCancelTaxiFlow();
        return true;
      }

      const detectedRoom = extractSpokenRoomNumber(query);
      if (detectedRoom) {
        handleTaxiRoomProvided(detectedRoom);
      } else {
        const isEn = language === 'English';
        const msg = isEn
          ? "I didn't catch your room number. Could you please say your room number again, for example room 301?"
          : 'Dạ em chưa nghe rõ số phòng. Quý khách vui lòng nói lại số phòng, ví dụ như phòng 301 ạ?';
        setAiResponseText(msg);
        speak(msg, isEn ? 'en-US' : 'vi-VN', () => {
          setTimeout(() => handleStartTalkRef.current?.({ silent: true }), 120);
        });
      }
      return true;
    }

    if (currentTaxiStage === 'choosing_option') {
      stopListening();
      resetTranscript();
      const lowerQuery = query.toLowerCase().trim();
      if (isSelfBookingVoiceIntent(lowerQuery)) {
        handleSelectTaxiSelfBooking();
        return true;
      }
      if (isConciergeVoiceIntent(lowerQuery)) {
        handleSelectTaxiConciergeBooking();
        return true;
      }
      if (isDismissVoiceIntent(lowerQuery) || /^(hủy|thôi|dừng|quay lại|cancel|close)/i.test(lowerQuery)) {
        handleCancelTaxiFlow();
        return true;
      }
      const retryMsg =
        'Dạ em có 2 lựa chọn: Lựa chọn 1 là danh bạ hotline tự gọi; Lựa chọn 2 là nhờ Concierge đặt xe giùm. Quý khách muốn chọn phương án nào ạ?';
      setAiResponseText(retryMsg);
      speak(retryMsg, 'vi-VN', () => {
        setTimeout(() => handleStartTalkRef.current?.({ silent: true }), 120);
      });
      return true;
    }

    return false;
  };

  return {
    taxiModalInitialMode,
    handleCloseTaxiModal,
    handleSelectTaxiSelfBooking,
    handleSelectTaxiConciergeBooking,
    handleCancelTaxiFlow,
    handleTaxiRoomProvided,
    handleTriggerTaxiBooking,
    consumeTaxiVoiceTurn,
  };
}
