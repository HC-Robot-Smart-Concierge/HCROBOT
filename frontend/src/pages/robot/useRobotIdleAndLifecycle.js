import { useCallback, useEffect } from 'react';
import { flushSession } from '../../services/aiApi';
import { fetchActiveAdvertisements } from '../../services/advertisementApi';
import { createKioskSessionId } from './robotVoiceIntentHelpers';

export const STANDBY_IDLE_TIMEOUT_MS = 60000;
export const CONVERSATION_IDLE_TIMEOUT_MS = 30000;

/**
 * Manages active advertisement loading, outside-click dropdown dismissal,
 * responsive mobile/landscape listeners, 30s session / 60s standby timers,
 * and automatic speech muting while Video Call / PIN / request form overlays are open.
 */
export function useRobotIdleAndLifecycle({
  setActiveAds,
  setPreferredQrHostIp,
  isStandby,
  setIsStandby,
  lastInteractionTimeRef,
  currentState,
  setCurrentState,
  activeRoomNumber,
  setActiveRoomNumber,
  setAuthenticatedRoom,
  sessionId,
  setSessionId,
  transcript,
  isSpeaking,
  isSpeakingRef,
  isProcessing,
  isProcessingRef,
  isVideoCallOpen,
  isPinModalOpen,
  isPinModalOpenRef,
  requestPhase,
  isWorkflowRunning,
  isAutoQrModalOpen,
  setIsFoodMenuOpen,
  setIsRoomServiceMenuOpen,
  setIsTaxiModalOpen,
  setTaxiFlowStage,
  setIsFacilitiesModalOpen,
  setIsFeedbackModalOpen,
  setIsAutoQrModalOpen,
  setIsPinModalOpen,
  showQuickMenu,
  setShowQuickMenu,
  showLangMenu,
  setShowLangMenu,
  setShowWorkflowMenu,
  setAiResponseText,
  setIsPhoneLayout,
  isIdlePromo,
  pausePromoForGuest,
  stopSpeaking,
  stopListening,
  resetTranscript,
  clearFollowUpTimer,
  clearRouteGuidanceTimers,
}) {
  useEffect(() => {
    const onIpChanged = (e) => {
      if (e?.detail) setPreferredQrHostIp(e.detail);
    };
    window.addEventListener('aurora-qr-ip-changed', onIpChanged);
    return () => window.removeEventListener('aurora-qr-ip-changed', onIpChanged);
  }, []);

  // Poll active advertisements
  useEffect(() => {
    let isMounted = true;
    const loadActiveAds = async () => {
      try {
        const data = await fetchActiveAdvertisements();
        if (isMounted && Array.isArray(data)) {
          setActiveAds(data);
        }
      } catch (e) {
        console.warn('Failed to load active advertisements for robot:', e);
      }
    };
    loadActiveAds();
    const interval = setInterval(loadActiveAds, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Listen to BroadcastChannel (legacy manual broadcast stub)
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel('hcrobot_workflow_channel');
      bc.onmessage = () => {};
    } catch {
      // BroadcastChannel fallback
    }
    return () => {
      if (bc) bc.close();
    };
  }, []);

  // Close menus on outside click
  useEffect(() => {
    if (!showQuickMenu && !showLangMenu) return;
    const handleOutsideClick = () => {
      setShowQuickMenu(false);
      setShowLangMenu(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [showQuickMenu, showLangMenu]);

  useEffect(() => {
    const phoneMedia = window.matchMedia('(max-width: 767px), (max-height: 600px) and (max-width: 1024px)');
    const updateLayout = (event) => setIsPhoneLayout(event.matches);
    phoneMedia.addEventListener?.('change', updateLayout);
    return () => phoneMedia.removeEventListener?.('change', updateLayout);
  }, []);

  // Auto Lock Screen Orientation to Landscape on Mobile/Kiosk Devices
  useEffect(() => {
    try {
      const lockPromise = window.screen?.orientation?.lock?.('landscape');
      if (lockPromise && typeof lockPromise.catch === 'function') {
        lockPromise.catch(() => {});
      }
    } catch {
      // Ignore orientation lock errors
    }
    return () => {
      try {
        const unlockResult = window.screen?.orientation?.unlock?.();
        if (unlockResult && typeof unlockResult.catch === 'function') {
          unlockResult.catch(() => {});
        }
      } catch {
        // Ignore orientation unlock errors
      }
    };
  }, []);

  const resetStandbyTimer = useCallback(() => {
    lastInteractionTimeRef.current = Date.now();
    if (isStandby) {
      setIsStandby(false);
    }
  }, [isStandby]);

  // Idle monitor (30s conversation auto-exit, 60s standby poster)
  useEffect(() => {
    const checkIdleInterval = setInterval(() => {
      const isUserTalking = Boolean(transcript && transcript.trim().length > 0);
      const isViewingMap = currentState === 'RT-05' || isAutoQrModalOpen;
      const isBusy = Boolean(
        isSpeaking ||
        isSpeakingRef.current ||
        isProcessing ||
        isProcessingRef.current ||
        isUserTalking ||
        isVideoCallOpen ||
        isWorkflowRunning ||
        isViewingMap
      );

      if (isBusy) {
        lastInteractionTimeRef.current = Date.now();
        return;
      }

      const idleDuration = Date.now() - lastInteractionTimeRef.current;

      if (currentState !== 'RT-01' || activeRoomNumber !== null) {
        if (idleDuration >= CONVERSATION_IDLE_TIMEOUT_MS) {
          stopSpeaking();
          stopListening();
          resetTranscript();
          setAiResponseText('');
          setActiveRoomNumber(null);
          setAuthenticatedRoom(null);
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
          setShowWorkflowMenu?.(false);
          flushSession(sessionId).catch(() => {});
          setSessionId(createKioskSessionId());
          setCurrentState('RT-01');
          lastInteractionTimeRef.current = Date.now();
        }
        return;
      }

      if (currentState === 'RT-01' && !isStandby) {
        if (idleDuration >= STANDBY_IDLE_TIMEOUT_MS) {
          setIsStandby(true);
          setActiveRoomNumber(null);
          setAuthenticatedRoom(null);
          flushSession(sessionId).catch(() => {});
          setSessionId(createKioskSessionId());
        }
      }
    }, 1000);

    const handleUserActivity = () => {
      lastInteractionTimeRef.current = Date.now();
      if (isStandby) {
        setIsStandby(false);
      }
    };

    window.addEventListener('click', handleUserActivity, { capture: true, passive: true });
    window.addEventListener('touchstart', handleUserActivity, { capture: true, passive: true });
    window.addEventListener('pointerdown', handleUserActivity, { capture: true, passive: true });
    window.addEventListener('keydown', handleUserActivity, { capture: true, passive: true });

    return () => {
      clearFollowUpTimer();
      clearInterval(checkIdleInterval);
      window.removeEventListener('click', handleUserActivity, { capture: true });
      window.removeEventListener('touchstart', handleUserActivity, { capture: true });
      window.removeEventListener('pointerdown', handleUserActivity, { capture: true });
      window.removeEventListener('keydown', handleUserActivity, { capture: true });
    };
  }, [
    isSpeaking,
    isProcessing,
    transcript,
    isVideoCallOpen,
    isWorkflowRunning,
    activeRoomNumber,
    isStandby,
    currentState,
    sessionId,
    stopSpeaking,
    stopListening,
    resetTranscript,
    clearFollowUpTimer,
    clearRouteGuidanceTimers,
  ]);

  // Voice Wake-up from standby
  useEffect(() => {
    if (transcript && transcript.trim().length > 0) {
      lastInteractionTimeRef.current = Date.now();
      if (isIdlePromo) pausePromoForGuest();
      if (isStandby) {
        setIsStandby(false);
        if (currentState === 'RT-01') {
          setCurrentState('RT-03');
        }
      }
    }
  }, [isStandby, transcript, currentState, isIdlePromo]);

  // Pause speech/mic during modal/video/workflow form interactions
  useEffect(() => {
    if (isVideoCallOpen || isPinModalOpen || requestPhase) {
      stopSpeaking();
      stopListening();
    }
  }, [isVideoCallOpen, isPinModalOpen, requestPhase, stopSpeaking, stopListening]);

  return { resetStandbyTimer };
}
