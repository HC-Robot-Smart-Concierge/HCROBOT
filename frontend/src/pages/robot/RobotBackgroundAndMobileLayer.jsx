import React from 'react';
import { RobotAdPlayer } from '../../components/robot/RobotAdPlayer';
import { CameraPreview } from '../../components/robot/CameraPreview';
import { MobileRobotScreen } from '../../components/robot/MobileRobotScreen';
import { createConciergeRequest } from '../../services/conciergeApi';

/**
 * Renders fullscreen idle advertisement player, ambient CameraPreview emotion/presence detector,
 * and responsive MobileRobotScreen layout.
 */
export const RobotBackgroundAndMobileLayer = ({
  isStandby,
  setIsStandby,
  isWorkflowRunning,
  guestPresent,
  resetStandbyTimer,
  activeAds,
  pushedAd,
  handleGuestApproached,
  handleGuestLeft,
  handleGuestEmotionDetected,
  language,
  toggleLanguage,
  currentState,
  activeEyeExpression,
  aiResponseText,
  setAiResponseText,
  transcript,
  isListening,
  isSpeaking,
  isProcessing,
  speechError,
  volumeLevel,
  guestEmotion,
  isAutoListen,
  setIsAutoListen,
  prime,
  speak,
  stopSpeaking,
  handleStartTalk,
  handleStopSpeaking,
  handleStopTalkAndProcess,
  resetToIdle,
  availableWorkflows,
  startWorkflow,
  setShowLogoutModal,
  setLogoutPassword,
  setLogoutError,
  activeRoomNumber,
  handleManualResetSession,
  navigationDestinationKey,
  setNavigationDestinationKey,
  clearRouteGuidanceTimers,
  handleCloseDirections,
  isAutoQrModalOpen,
  qrCountdown,
  handleCloseQrModalOnly,
  taxiFlowStage,
  handleSelectTaxiSelfBooking,
  handleSelectTaxiConciergeBooking,
  handleCancelTaxiFlow,
  handleTaxiRoomProvided,
  handleRoomPickerSelect,
  handleTriggerTaxiBooking,
  updateStatusQueryType,
  isRoomPickerOpenRef,
  isPinModalOpenRef,
  setPinModalRoomNumber,
  setPinModalAction,
  setPinModalItems,
  setIsPinModalOpen,
  setIsFoodMenuOpen,
  setIsRoomServiceMenuOpen,
  setIsMaintenanceMenuOpen,
  setIsBellmanMenuOpen,
  setIsTaxiModalOpen,
  setIsFacilitiesModalOpen,
  setVideoCallSessionId,
  setVideoCallTicketCode,
  setIsVideoCallOpen,
  activeChatRequestIdRef,
  chatAbortControllerRef,
}) => (
  <>
  <RobotAdPlayer
    isOpen={isStandby && !isWorkflowRunning && !guestPresent}
    onClose={() => {
      setIsStandby(false);
      resetStandbyTimer();
    }}
    ads={activeAds}
    pushedAd={pushedAd}
    onUserInteract={() => {
      setIsStandby(false);
      resetStandbyTimer();
    }}
  />

  {/* Camera AI (Chạy ngầm nhận diện khách/cảm xúc và stream WebRTC về Admin) */}
  <CameraPreview
    autoStart={false}
    externalStream={kioskCameraStream}
    controlsClassName="robot-camera-control"
    onGuestApproached={handleGuestApproached}
    onGuestLeft={handleGuestLeft}
    onEmotionChange={handleGuestEmotionDetected}
    source="local"
    defaultMinimized={true}
    visible={false}
  />

  <MobileRobotScreen
    isKioskCameraActive={isKioskCameraActive}
    onStartKioskCamera={startKioskCamera}
    kioskCameraStream={kioskCameraStream}
    activeRoomNumber={activeRoomNumber}
    guestEmotion={guestEmotion}
    eyeExpression={activeEyeExpression}
    aiResponseText={aiResponseText}
    currentState={currentState}
    hasSpeechSupport={hasSupport}
    isAutoListen={isAutoListen}
    isListening={isListening}
    isProcessing={isProcessing}
    isSpeaking={isSpeaking}
    language={language}
    onLogout={() => {
      setLogoutError('');
      setLogoutPassword('');
      setShowLogoutModal(true);
    }}
    onResetSession={handleManualResetSession}
    onResetToIdle={resetToIdle}
    onPrime={prime}
    onStartTalk={handleStartTalk}
    onSubmitTalk={() => handleStopTalkAndProcess(transcript || '')}
    onStopSpeaking={handleStopSpeaking}
    onToggleAutoListen={() => setIsAutoListen((value) => !value)}
    onToggleLanguage={toggleLanguage}
    speechError={speechError}
    transcript={transcript}
    volumeLevel={volumeLevel}
    workflowTrigger={null}
    availableWorkflows={availableWorkflows}
    onStartWorkflow={startWorkflow}
    onOpenFacilities={() => {
      activeChatRequestIdRef.current += 1;
      if (chatAbortControllerRef.current) {
        try { chatAbortControllerRef.current.abort(); } catch (e) { }
        chatAbortControllerRef.current = null;
      }
      clearRouteGuidanceTimers();
      stopSpeaking();
      setIsFacilitiesModalOpen(true);
      speak('Dạ đây là toàn bộ cơ sở vật chất và tiện ích 5 sao của khách sạn ạ.');
    }}
    onOpenOrderStatus={() => {
      updateStatusQueryType('food');
      if (activeRoomNumber) {
        handleRoomPickerSelect(activeRoomNumber);
      } else {
        setPinModalRoomNumber('');
        setPinModalAction('query_order_status');
        setPinModalItems('Kiểm tra trạng thái món ăn');
        isPinModalOpenRef.current = true;
        setIsPinModalOpen(true);
      }
    }}
    onOpenServiceStatus={() => {
      updateStatusQueryType('service');
      if (activeRoomNumber) {
        handleRoomPickerSelect(activeRoomNumber);
      } else {
        setPinModalRoomNumber('');
        setPinModalAction('query_service_status');
        setPinModalItems('Kiểm tra tiến độ dọn phòng và dịch vụ');
        isPinModalOpenRef.current = true;
        setIsPinModalOpen(true);
      }
    }}
    onOpenMaintenanceStatus={() => {
      updateStatusQueryType('maintenance');
      if (activeRoomNumber) {
        handleRoomPickerSelect(activeRoomNumber);
      } else {
        setPinModalRoomNumber('');
        setPinModalAction('query_maintenance_status');
        setPinModalItems('Kiểm tra tiến độ sửa chữa kỹ thuật');
        isPinModalOpenRef.current = true;
        setIsPinModalOpen(true);
      }
    }}
    onOpenFoodMenu={() => {
      activeChatRequestIdRef.current += 1;
      if (chatAbortControllerRef.current) {
        try { chatAbortControllerRef.current.abort(); } catch (e) { }
        chatAbortControllerRef.current = null;
      }
      clearRouteGuidanceTimers();
      stopSpeaking();
      setIsFoodMenuOpen(true);
      setIsRoomServiceMenuOpen(false);
      setIsMaintenanceMenuOpen(false);
      setIsBellmanMenuOpen(false);
      setIsTaxiModalOpen(false);
      setIsFacilitiesModalOpen(false);
    }}
    onOpenRoomService={() => {
      activeChatRequestIdRef.current += 1;
      if (chatAbortControllerRef.current) {
        try { chatAbortControllerRef.current.abort(); } catch (e) { }
        chatAbortControllerRef.current = null;
      }
      clearRouteGuidanceTimers();
      stopSpeaking();
      setIsRoomServiceMenuOpen(true);
      setIsFoodMenuOpen(false);
      setIsMaintenanceMenuOpen(false);
      setIsBellmanMenuOpen(false);
      setIsTaxiModalOpen(false);
      setIsFacilitiesModalOpen(false);
    }}
    onOpenBellman={() => {
      activeChatRequestIdRef.current += 1;
      if (chatAbortControllerRef.current) {
        try { chatAbortControllerRef.current.abort(); } catch (e) { }
        chatAbortControllerRef.current = null;
      }
      clearRouteGuidanceTimers();
      stopSpeaking();
      setIsBellmanMenuOpen(true);
      setIsMaintenanceMenuOpen(false);
      setIsFoodMenuOpen(false);
      setIsRoomServiceMenuOpen(false);
      setIsTaxiModalOpen(false);
      setIsFacilitiesModalOpen(false);
    }}
    onOpenMaintenance={() => {
      activeChatRequestIdRef.current += 1;
      if (chatAbortControllerRef.current) {
        try { chatAbortControllerRef.current.abort(); } catch (e) { }
        chatAbortControllerRef.current = null;
      }
      clearRouteGuidanceTimers();
      stopSpeaking();
      setIsMaintenanceMenuOpen(true);
      setIsFoodMenuOpen(false);
      setIsRoomServiceMenuOpen(false);
      setIsTaxiModalOpen(false);
      setIsFacilitiesModalOpen(false);
    }}
    onOpenTaxiBooking={() => {
      activeChatRequestIdRef.current += 1;
      if (chatAbortControllerRef.current) {
        try { chatAbortControllerRef.current.abort(); } catch (e) { }
        chatAbortControllerRef.current = null;
      }
      clearRouteGuidanceTimers();
      stopSpeaking();
      handleTriggerTaxiBooking();
    }}
    taxiFlowStage={taxiFlowStage}
    onSelectTaxiSelfBooking={handleSelectTaxiSelfBooking}
    onSelectTaxiConciergeBooking={handleSelectTaxiConciergeBooking}
    onCancelTaxiFlow={handleCancelTaxiFlow}
    onSubmitTaxiRoomNumber={handleTaxiRoomProvided}
    onCloseAiResponse={() => setAiResponseText('')}
    navigationDestinationKey={navigationDestinationKey}
    onSelectDestination={setNavigationDestinationKey}
    showQrModalExternal={isAutoQrModalOpen}
    qrCountdown={qrCountdown}
    onCloseQrModal={handleCloseQrModalOnly}
    onCloseDirections={handleCloseDirections}
    onCallStaff={async () => {
      try {
        const req = await createConciergeRequest({
          title: 'Yêu cầu gọi video trực tiếp từ Khách tại Kiosk',
          room_number: activeRoomNumber || 'Main Lobby Kiosk',
          guest_name: 'Khách tại Sảnh',
          description: 'Khách bấm gọi hỗ trợ trực tiếp từ màn hình Robot Concierge',
        });
        const canonicalCode = req.ticket_code || req.id || `SUP-${Date.now()}`;
        setVideoCallSessionId(canonicalCode);
        setVideoCallTicketCode(req.ticket_code || canonicalCode);
        setIsVideoCallOpen(true);
      } catch (err) {
        const fallbackCode = `CCG-${Date.now()}`;
        setVideoCallSessionId(fallbackCode);
        setVideoCallTicketCode(fallbackCode);
        setIsVideoCallOpen(true);
      }
    }}
  />
  </>
);
