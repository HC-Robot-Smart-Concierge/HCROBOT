import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getMobileGuestMapUrl } from '../../components/robot/FloorMap';
import { useKioskStreamBroadcaster } from '../../hooks/useKioskStreamBroadcaster';
import { guestRequestPhase } from '../../utils/workflowGuestRequest';
import { useWorkflowRunner } from '../../hooks/useWorkflowRunner';
import { fetchWorkflows } from '../../services/workflowApi';
import { useNotificationWebSocket } from '../../hooks/useNotificationWebSocket';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { getVoiceSettings } from '../../services/aiApi';
import { createConciergeEmotionAlert } from '../../services/conciergeApi';
import { createMaintenanceRequest } from '../../services/operationsApi';
import { useRobotBattery } from '../../hooks/useRobotBattery';
import { useLowBatteryGuard } from '../../hooks/useLowBatteryGuard';
import { LOW_BATTERY_GUEST_NOTICE, describeBatteryStatus, findChargeRoutine } from '../../utils/batteryPolicy';
import { createKioskSessionId } from './robotVoiceIntentHelpers';
import { useRobotIdleAndLifecycle } from './useRobotIdleAndLifecycle';
import { useRobotStaffAndSecurity } from './useRobotStaffAndSecurity';
import { useRobotTaxiFlow } from './useRobotTaxiFlow';
import { useRobotPinAndRoomHandlers } from './useRobotPinAndRoomHandlers';
import { useRobotVoiceConversation } from './useRobotVoiceConversation';
import { RobotServiceMenuGates } from './RobotServiceMenuGates';
import { RobotBackgroundAndMobileLayer } from './RobotBackgroundAndMobileLayer';
import { RobotDesktopTopControls } from './RobotDesktopTopControls';
import { RobotDesktopMainBody } from './RobotDesktopMainBody';
import { RobotOverlayModals } from './RobotOverlayModals';

// Preserve concierge emotion alert reference for dashboard integration verification.
void createConciergeEmotionAlert;

export const RobotScreenPage = ({ onLogout = () => { } }) => {
  const [currentState, setCurrentState] = useState(() => {
    try {
      const isMobile = window.matchMedia('(max-width: 767px), (max-height: 600px) and (max-width: 1024px)').matches;
      return isMobile ? 'RT-02' : 'RT-01';
    } catch {
      return 'RT-01';
    }
  });
  const [navigationDestinationKey, setNavigationDestinationKey] = useState('infinity_pool');
  const [preferredQrHostIp, setPreferredQrHostIp] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('aurora_qr_network_ip') : null;
    } catch {
      return null;
    }
  });
  const qrMapUrl = useMemo(() => getMobileGuestMapUrl(navigationDestinationKey, preferredQrHostIp), [navigationDestinationKey, preferredQrHostIp]);

  const [language, setLanguage] = useState('Tiếng Việt');
  const languageRef = useRef('Tiếng Việt');
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const [aiResponseText, setAiResponseText] = useState('');
  const [lastUserPrompt, setLastUserPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFoodMenuOpen, setIsFoodMenuOpen] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'food_menu' || params.get('view') === 'food_menu';
    } catch {
      return false;
    }
  });
  const [isRoomServiceMenuOpen, setIsRoomServiceMenuOpen] = useState(false);
  const [isMaintenanceMenuOpen, setIsMaintenanceMenuOpen] = useState(false);
  const [isBellmanMenuOpen, setIsBellmanMenuOpen] = useState(false);
  const [isTaxiModalOpen, setIsTaxiModalOpen] = useState(false);
  const isTaxiModalOpenRef = useRef(false);
  useEffect(() => { isTaxiModalOpenRef.current = isTaxiModalOpen; }, [isTaxiModalOpen]);

  const [taxiFlowStage, setTaxiFlowStageState] = useState(null);
  const taxiFlowStageRef = useRef(null);
  const setTaxiFlowStage = useCallback((stage) => {
    taxiFlowStageRef.current = stage;
    setTaxiFlowStageState(stage);
  }, []);
  const handleStartTalkRef = useRef(null);
  const handleStopTalkAndProcessRef = useRef(null);
  const hasSpokenTaxiPromptRef = useRef(false);
  const [taxiModalInitialMode, setTaxiModalInitialMode] = useState('self_booking');
  const [taxiVoiceInput, setTaxiVoiceInput] = useState('');
  const [isAutoListen, setIsAutoListen] = useState(true);

  const silenceTimerRef = useRef(null);
  const routeGuidanceTimerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const processingSafetyTimerRef = useRef(null);
  const activeChatRequestIdRef = useRef(0);
  const chatAbortControllerRef = useRef(null);
  const fillerTimerRef = useRef(null);
  const [navigationStep, setNavigationStep] = useState(1);
  const wayfindingStepTimerRef = useRef(null);
  const [isAutoQrModalOpen, setIsAutoQrModalOpen] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(null);
  const qrStageTimerRef = useRef(null);
  const qrCountdownIntervalRef = useRef(null);

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const isPinModalOpenRef = useRef(false);
  useEffect(() => { isPinModalOpenRef.current = isPinModalOpen; }, [isPinModalOpen]);
  const [pinModalRoomNumber, setPinModalRoomNumber] = useState('');
  const [pinModalAction, setPinModalAction] = useState('room_service');
  const [pinModalItems, setPinModalItems] = useState('');

  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);
  const [statusQueryType, setStatusQueryType] = useState('general');
  const statusQueryTypeRef = useRef('general');
  const isRoomPickerOpenRef = useRef(false);
  const isWaitingRoomForStatusQueryRef = useRef(false);
  const updateStatusQueryType = useCallback((type) => {
    statusQueryTypeRef.current = type || 'general';
    setStatusQueryType(type || 'general');
  }, []);
  useEffect(() => { isRoomPickerOpenRef.current = isRoomPickerOpen; }, [isRoomPickerOpen]);

  const clearRouteGuidanceTimers = useCallback(() => {
    if (wayfindingStepTimerRef.current) { clearTimeout(wayfindingStepTimerRef.current); wayfindingStepTimerRef.current = null; }
    if (routeGuidanceTimerRef.current) { clearTimeout(routeGuidanceTimerRef.current); routeGuidanceTimerRef.current = null; }
    if (qrStageTimerRef.current) { clearTimeout(qrStageTimerRef.current); qrStageTimerRef.current = null; }
    if (qrCountdownIntervalRef.current) { clearInterval(qrCountdownIntervalRef.current); qrCountdownIntervalRef.current = null; }
    setIsAutoQrModalOpen(false);
    setQrCountdown(null);
  }, []);

  const [isStandby, setIsStandby] = useState(false);
  const lastInteractionTimeRef = useRef(Date.now());
  const [activeAds, setActiveAds] = useState([]);
  const [pushedAd, setPushedAd] = useState(null);
  const [sessionId, setSessionId] = useState(createKioskSessionId);
  const [activeRoomNumber, setActiveRoomNumber] = useState(null);
  const [authenticatedRoom, setAuthenticatedRoom] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutPassword, setLogoutPassword] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [, setIsPhoneLayout] = useState(() => (
    window.matchMedia('(max-width: 767px), (max-height: 600px) and (max-width: 1024px)').matches
  ));

  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const isVideoCallOpenRef = useRef(false);
  useEffect(() => { isVideoCallOpenRef.current = isVideoCallOpen; }, [isVideoCallOpen]);
  const [videoCallSessionId, setVideoCallSessionId] = useState(null);
  const [videoCallTicketCode, setVideoCallTicketCode] = useState(null);
  useKioskStreamBroadcaster({ enabled: true, isPaused: isVideoCallOpen });

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isWaitingFollowUp, setIsWaitingFollowUp] = useState(false);
  const followUpTimerRef = useRef(null);
  const clearFollowUpTimer = useCallback(() => {
    if (followUpTimerRef.current) { clearTimeout(followUpTimerRef.current); followUpTimerRef.current = null; }
  }, []);

  const [isFacilitiesModalOpen, setIsFacilitiesModalOpen] = useState(false);
  const [activeEyeExpression, setActiveEyeExpression] = useState(null);
  const eyeExpressionTimeoutRef = useRef(null);
  const triggerEyeExpression = useCallback((expr, duration = 3800) => {
    if (!expr || expr === 'none') return;
    if (eyeExpressionTimeoutRef.current) clearTimeout(eyeExpressionTimeoutRef.current);
    setActiveEyeExpression(expr);
    eyeExpressionTimeoutRef.current = setTimeout(() => setActiveEyeExpression(null), duration);
  }, []);

  const [guestPresent, setGuestPresent] = useState(false);
  const pausedPromo = useRef(null);
  const [availableWorkflows, setAvailableWorkflows] = useState([]);
  const [, setShowWorkflowMenu] = useState(false);
  const [guestEmotion, setGuestEmotion] = useState('neutral');
  const lastUnhappyAlertTimeRef = useRef(0);
  const [isUnhappyAssistanceOpen, setIsUnhappyAssistanceOpen] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const {
    speak,
    prime,
    cancel: stopSpeaking,
    isSpeaking,
    updateSpeechRate,
    viVoice,
    enVoice,
    updateVoiceSettings,
  } = useSpeechSynthesis();
  const isSpeakingRef = useRef(false);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  const { isListening, transcript, error: speechError, startListening, stopListening, resetTranscript, volumeLevel } = useSpeechRecognition({
    isSpeaking: Boolean(isSpeaking),
  });

  const toggleLanguage = useCallback((targetLang) => {
    if (typeof targetLang === 'string' && (targetLang === 'English' || targetLang === 'Tiếng Việt')) {
      languageRef.current = targetLang;
      setLanguage(targetLang);
      return;
    }
    const nextLang = languageRef.current === 'English' ? 'Tiếng Việt' : 'English';
    languageRef.current = nextLang;
    setLanguage(nextLang);
  }, []);

  useEffect(() => {
    fetchWorkflows().then((data) => { if (Array.isArray(data)) setAvailableWorkflows(data); }).catch((err) => console.warn('Could not load workflows:', err));
  }, []);

  useEffect(() => {
    getVoiceSettings()
      .then((data) => {
        if (data) {
          if (updateVoiceSettings) {
            updateVoiceSettings(data);
          } else if (data.speech_rate) {
            updateSpeechRate(data.speech_rate);
          }
        }
      })
      .catch((err) => console.warn('Could not fetch voice settings:', err));
  }, [updateVoiceSettings, updateSpeechRate]);

  const {
    activeWorkflow, isWorkflowRunning, currentStepIndex, activeStep, totalSteps,
    choiceRemaining, startWorkflow, stopWorkflow, nextStep, chooseOption, cancelChoice,
  } = useWorkflowRunner({ speak, stopSpeaking, startListening, stopListening, transcript, resetTranscript, isListening });

  const batteryPercent = useRobotBattery();
  const requestPhase = guestRequestPhase(activeWorkflow?.id, activeStep);
  const chargeRoutine = useMemo(() => findChargeRoutine(availableWorkflows), [availableWorkflows]);
  const isChargeRoutineRunning = isWorkflowRunning && activeWorkflow?.id === chargeRoutine.id;
  const isIdlePromo = false;
  const isServingGuest = (isWorkflowRunning && !isChargeRoutineRunning) || currentState !== 'RT-01' || isVideoCallOpen;
  const batteryGuard = useLowBatteryGuard({
    percent: batteryPercent, routine: chargeRoutine, isRoutineRunning: isChargeRoutineRunning, isServingGuest,
    startRoutine: (routine) => { pausedPromo.current = null; setIsStandby(false); startWorkflow(routine); },
    interruptGuest: () => { stopWorkflow(); stopSpeaking(); stopListening(); setAiResponseText(''); setCurrentState('RT-01'); },
    onChargeNeeded: (percent) => {
      const shownPercent = Number.isFinite(Number(percent)) ? `${Math.round(Number(percent))}%` : 'không rõ';
      createMaintenanceRequest({
        title: 'Robot cần cắm sạc', category: 'robot_battery', location: 'Trạm Sạc Robot Sảnh',
        description: `Pin ước tính còn ${shownPercent}. Robot đang chờ ở trạm sạc. Nhờ nhân viên cắm sạc cả pin động cơ và pin Pi 5, sạc xong thì cập nhật lại % pin trong Robot Control.`,
        source: 'Robot Kiosk',
      }).catch(() => { });
    },
  });
  const batteryStatusText = describeBatteryStatus({
    mode: batteryGuard.mode, percent: batteryPercent, isRoutineRunning: isChargeRoutineRunning,
    isWaitingForCharge: batteryGuard.isWaitingForCharge, english: language === 'English',
  });

  useNotificationWebSocket({
    department: 'All',
    onNotificationReceived: (event) => {
      if (event && event.type === 'ADVERTISEMENT_PUSH' && event.advertisement && !isServingGuest && !guestPresent && batteryGuard.canStartGuestSession) {
        setPushedAd(event.advertisement);
        setIsStandby(true);
      }
    },
    onWorkflowDispatch: (event) => {
      if (!batteryGuard.canStartGuestSession && event?.workflow?.id !== chargeRoutine.id) return;
      if (Array.isArray(event?.workflow?.steps) && event.workflow.steps.length > 0) {
        if (event.workflow.id === 'wf-06-idle-promo') return;
        setIsStandby(false);
        startWorkflow(event.workflow);
      }
    },
  });

  const pausePromoForGuest = () => {
    if (!isIdlePromo) return;
    pausedPromo.current = { workflow: activeWorkflow, index: currentStepIndex };
    stopWorkflow(); setIsStandby(false); lastInteractionTimeRef.current = Date.now(); setCurrentState('RT-02');
  };

  useEffect(() => {
    if (guestPresent || currentState !== 'RT-01' || isWorkflowRunning || !batteryGuard.canStartGuestSession ||
      isProcessing || isSpeaking || isVideoCallOpen || isPinModalOpen || isTaxiModalOpen ||
      isFoodMenuOpen || isRoomServiceMenuOpen || isMaintenanceMenuOpen || isBellmanMenuOpen || isFeedbackModalOpen || activeRoomNumber) return;
    const checkpoint = pausedPromo.current;
    if (!checkpoint) return;
    pausedPromo.current = null;
    setIsStandby(false);
    startWorkflow(checkpoint.workflow, checkpoint.index ?? 0);
  }, [guestPresent, currentState, isStandby, isWorkflowRunning, batteryGuard.canStartGuestSession,
    isProcessing, isSpeaking, isVideoCallOpen, isPinModalOpen, isTaxiModalOpen, isFoodMenuOpen,
    isRoomServiceMenuOpen, isMaintenanceMenuOpen, isBellmanMenuOpen, isFeedbackModalOpen, activeRoomNumber]);

  const lowBatteryNoticeAtRef = useRef(0);
  const announceLowBattery = () => {
    if (Date.now() - lowBatteryNoticeAtRef.current < 30000) return;
    lowBatteryNoticeAtRef.current = Date.now();
    const isEn = languageRef.current === 'English';
    speak(isEn ? LOW_BATTERY_GUEST_NOTICE.en : LOW_BATTERY_GUEST_NOTICE.vi, isEn ? 'en-US' : 'vi-VN');
  };

  const sharedSpeech = {
    language, setLanguage, languageRef, prime, speak, stopSpeaking, isSpeaking, isSpeakingRef,
    viVoice, enVoice,
    isListening, transcript, speechError, startListening, stopListening, resetTranscript, volumeLevel,
  };
  const sharedRoomUi = {
    sessionId, setSessionId, activeRoomNumber, setActiveRoomNumber, authenticatedRoom, setAuthenticatedRoom,
    isFoodMenuOpen, setIsFoodMenuOpen, isRoomServiceMenuOpen, setIsRoomServiceMenuOpen,
    isMaintenanceMenuOpen, setIsMaintenanceMenuOpen, isBellmanMenuOpen, setIsBellmanMenuOpen,
    isTaxiModalOpen, isTaxiModalOpenRef, setIsTaxiModalOpen, isFacilitiesModalOpen, setIsFacilitiesModalOpen,
    isFeedbackModalOpen, setIsFeedbackModalOpen, isPinModalOpen, isPinModalOpenRef, setIsPinModalOpen,
    pinModalRoomNumber, setPinModalRoomNumber, pinModalAction, setPinModalAction, pinModalItems, setPinModalItems,
    isRoomPickerOpen, isRoomPickerOpenRef, setIsRoomPickerOpen, isWaitingRoomForStatusQueryRef,
    statusQueryType, statusQueryTypeRef, updateStatusQueryType,
    isVideoCallOpen, isVideoCallOpenRef, setIsVideoCallOpen, videoCallSessionId, setVideoCallSessionId,
    videoCallTicketCode, setVideoCallTicketCode, showQuickMenu, setShowQuickMenu, showLangMenu, setShowLangMenu,
    isAutoQrModalOpen, setIsAutoQrModalOpen, qrCountdown, setQrCountdown,
    navigationDestinationKey, setNavigationDestinationKey, navigationStep, setNavigationStep,
  };
  const sharedTimersAndFlags = {
    currentState, setCurrentState, aiResponseText, setAiResponseText, setLastUserPrompt,
    isProcessing, setIsProcessing, isProcessingRef, isStandby, setIsStandby, isAutoListen, setIsAutoListen,
    lastInteractionTimeRef, silenceTimerRef, routeGuidanceTimerRef, processingSafetyTimerRef,
    activeChatRequestIdRef, chatAbortControllerRef, fillerTimerRef, wayfindingStepTimerRef,
    qrStageTimerRef, qrCountdownIntervalRef, followUpTimerRef, isWaitingFollowUp, setIsWaitingFollowUp,
    clearFollowUpTimer, clearRouteGuidanceTimers, handleStartTalkRef, handleStopTalkAndProcessRef,
  };

  const { resetStandbyTimer } = useRobotIdleAndLifecycle({
    ...sharedSpeech, ...sharedRoomUi, ...sharedTimersAndFlags,
    setActiveAds, setPreferredQrHostIp, setTaxiFlowStage, requestPhase,
    isWorkflowRunning, setShowWorkflowMenu, setIsPhoneLayout, isIdlePromo, pausePromoForGuest,
  });

  const staffSecurity = useRobotStaffAndSecurity({
    ...sharedSpeech, ...sharedRoomUi, ...sharedTimersAndFlags,
    setGuestEmotion, lastUnhappyAlertTimeRef, isUnhappyAssistanceOpen, setIsUnhappyAssistanceOpen,
    logoutPassword, setShowLogoutModal, setLogoutPassword, setLogoutError, onLogout,
  });

  const taxiHandlers = useRobotTaxiFlow({
    ...sharedSpeech, ...sharedRoomUi, ...sharedTimersAndFlags,
    taxiFlowStage, taxiFlowStageRef, setTaxiFlowStage, hasSpokenTaxiPromptRef,
    taxiModalInitialMode, setTaxiModalInitialMode, taxiVoiceInput, setTaxiVoiceInput,
  });

  const pinRoomHandlers = useRobotPinAndRoomHandlers({
    ...sharedSpeech, ...sharedRoomUi, ...sharedTimersAndFlags,
    setTaxiFlowStage, hasSpokenTaxiPromptRef,
  });

  const voiceHandlers = useRobotVoiceConversation({
    ...sharedSpeech, ...sharedRoomUi, ...sharedTimersAndFlags, ...staffSecurity, ...taxiHandlers, ...pinRoomHandlers,
    guestEmotion, guestPresent, setGuestPresent, isIdlePromo, pausePromoForGuest, isWorkflowRunning,
    stopWorkflow, requestPhase, batteryGuard, announceLowBattery, resetStandbyTimer, triggerEyeExpression,
  });

  if (isFoodMenuOpen || isMaintenanceMenuOpen || isBellmanMenuOpen || isRoomServiceMenuOpen) {
    return (
      <RobotServiceMenuGates
        {...sharedRoomUi} language={language}
        triggerFollowUpPrompt={staffSecurity.triggerFollowUpPrompt} handlePinNotCheckedIn={pinRoomHandlers.handlePinNotCheckedIn}
      />
    );
  }

  const robotFaceMode = isWorkflowRunning && (activeStep?.params?.emotion === 'happy' || activeStep?.params?.emotion === 'smile')
    ? 'happy' : isSpeaking ? 'speaking'
      : (isWorkflowRunning && (activeStep?.type === 'LISTEN' || activeStep?.type === 'COMMUNICATE')) ? 'listening'
        : (isWorkflowRunning && activeStep?.type === 'GREET') ? 'welcome'
          : currentState === 'RT-01' ? 'sleeping' : currentState === 'RT-03' ? 'listening' : currentState === 'RT-04' ? 'processing' : 'welcome';

  return (
    <div className="w-full h-[100dvh] bg-aurora-canvas overflow-hidden font-sans select-none relative">
      <RobotBackgroundAndMobileLayer
        {...sharedSpeech} {...sharedRoomUi} {...sharedTimersAndFlags}
        {...taxiHandlers} {...pinRoomHandlers} {...voiceHandlers}
        resetStandbyTimer={resetStandbyTimer} activeAds={activeAds} pushedAd={pushedAd}
        guestPresent={guestPresent} isWorkflowRunning={isWorkflowRunning}
        handleGuestEmotionDetected={staffSecurity.handleGuestEmotionDetected}
        toggleLanguage={toggleLanguage} activeEyeExpression={activeEyeExpression}
        guestEmotion={guestEmotion} availableWorkflows={availableWorkflows} startWorkflow={startWorkflow}
        setShowLogoutModal={setShowLogoutModal} setLogoutPassword={setLogoutPassword} setLogoutError={setLogoutError}
        taxiFlowStage={taxiFlowStage}
      />

      <div
        onClick={() => {
          prime();
          if (isSpeaking || isSpeakingRef.current) return;
          if ((currentState === 'RT-02' || currentState === 'RT-01') && !isSpeaking && !isSpeakingRef.current && !isProcessing) {
            voiceHandlers.handleStartTalk();
          }
        }}
        className="robot-desktop-ui w-full h-full flex-col justify-start items-center relative cursor-pointer"
      >
        <RobotDesktopTopControls
          {...sharedRoomUi} language={language} setLanguage={setLanguage} speak={speak}
          handleSecretAreaClick={staffSecurity.handleSecretAreaClick}
          handleManualResetSession={pinRoomHandlers.handleManualResetSession}
          handleTriggerTaxiBooking={taxiHandlers.handleTriggerTaxiBooking}
          handleOpenFeedback={staffSecurity.handleOpenFeedback} setIsStandby={setIsStandby}
        />

        <RobotDesktopMainBody
          {...sharedSpeech} {...sharedRoomUi} {...sharedTimersAndFlags}
          requestPhase={requestPhase} isWorkflowRunning={isWorkflowRunning} activeWorkflow={activeWorkflow}
          activeStep={activeStep} choiceRemaining={choiceRemaining} chooseOption={chooseOption} cancelChoice={cancelChoice}
          handleCloseDirections={pinRoomHandlers.handleCloseDirections}
          handleCloseQrModalOnly={pinRoomHandlers.handleCloseQrModalOnly}
          qrMapUrl={qrMapUrl} handleStartTalk={voiceHandlers.handleStartTalk}
          handleStopSpeaking={voiceHandlers.handleStopSpeaking} robotFaceMode={robotFaceMode}
          activeEyeExpression={activeEyeExpression} handleOpenFeedback={staffSecurity.handleOpenFeedback}
          lastUserPrompt={lastUserPrompt} batteryStatusText={batteryStatusText}
          currentStepIndex={currentStepIndex} totalSteps={totalSteps} nextStep={nextStep} stopWorkflow={stopWorkflow}
        />

        <div
          onClick={staffSecurity.handleSecretAreaClick}
          onTouchStart={staffSecurity.handleSecretAreaTouchStart}
          onTouchEnd={staffSecurity.handleSecretAreaTouchEnd}
          className="absolute bottom-0 right-0 w-16 h-16 z-40 cursor-default select-none opacity-0"
          title="" aria-hidden="true"
        />
      </div>

      <RobotOverlayModals
        {...sharedRoomUi} {...sharedTimersAndFlags} {...staffSecurity}
        {...pinRoomHandlers} language={language} speak={speak}
        showLogoutModal={showLogoutModal} setShowLogoutModal={setShowLogoutModal}
        logoutPassword={logoutPassword} setLogoutPassword={setLogoutPassword} logoutError={logoutError}
        requestPhase={requestPhase} activeWorkflow={activeWorkflow} stopWorkflow={stopWorkflow}
        handleStartTalk={voiceHandlers.handleStartTalk}
        taxiModalInitialMode={taxiHandlers.taxiModalInitialMode} taxiVoiceInput={taxiVoiceInput}
        handleCloseTaxiModal={taxiHandlers.handleCloseTaxiModal} isUnhappyAssistanceOpen={isUnhappyAssistanceOpen}
      />
    </div>
  );
};
