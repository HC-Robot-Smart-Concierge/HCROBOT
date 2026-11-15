import { useEffect } from 'react';
import { OUTCOME, getChoiceTimeoutSec } from '../../../../utils/workflowFlow';
import {
  GAZEBO_LOBBY_WAYPOINTS,
  resolveMoveTarget,
  validateWorkflowStepZone,
} from './workflowSimulatorUtils';

/**
 * Executes the active workflow step whenever simulation state, step index, or run counter advances.
 */
export function useWorkflowStepExecution({
  isPlaying,
  isPaused,
  activeStep,
  showingIdlePromo,
  simGuestPresent,
  currentStepIndex,
  stepRun,
  selectedWorkflowId,
  requestPhase,
  timerRef,
  animFrameRef,
  zonesRef,
  endpointsRef,
  isMutedRef,
  speakRef,
  robotPoseRef,
  simSpeedRef,
  setIsPlaying,
  setIsPaused,
  setZoneAlert,
  setStepProgress,
  setVisitedSteps,
  onNotify,
  handleStepFinish,
  handleNavigateToGoal,
}) {
  // Thuc thi buoc hien tai (Chi trigger khi chuyen buoc hoac bam Play/Pause)
  useEffect(() => {
    if (!isPlaying || isPaused || !activeStep || (showingIdlePromo && simGuestPresent)) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    // Kiem tra an toan Vung chuc nang truoc khi thuc thi buoc
    const stepValidation = validateWorkflowStepZone(
      activeStep,
      zonesRef.current,
      endpointsRef.current
    );
    if (!stepValidation.valid) {
      setIsPlaying(false);
      setIsPaused(false);
      setZoneAlert({ type: 'error', message: stepValidation.error });
      onNotify(stepValidation.error, 'error');
      return;
    }
    if (stepValidation.warning) {
      onNotify(stepValidation.warning, 'info');
    }

    setStepProgress(0);
    setVisitedSteps((prev) =>
      prev.has(currentStepIndex) ? prev : new Set(prev).add(currentStepIndex)
    );
    if (requestPhase) return;
    const stepType = activeStep.type;
    const params = activeStep.params || {};

    // Phat giong noi TTS neu buoc co loi thoai hoac buoc SHOW co thuyet minh
    if (
      !isMutedRef.current &&
      (stepType === 'GREET' ||
        stepType === 'SPEAK' ||
        (stepType === 'CHOICE' && Boolean(params.prompt)) ||
        (stepType === 'SHOW' && Boolean(params.speech_text || params.text)))
    ) {
      const voiceText =
        stepType === 'GREET'
          ? params.greeting_text || params.text || 'Xin chao quy khach'
          : stepType === 'CHOICE'
          ? params.prompt
          : params.speech_text || params.text || '';
      const voiceSpeed = parseFloat(params.speed || params.voice_speed) || 1.0;
      const lang = params.language || 'vi-VN';

      if (voiceText.trim() && speakRef.current) {
        speakRef.current(voiceText, lang, null, null, null, voiceSpeed);
      }
    }

    // XU LY DI CHUYEN NE TUONG (MOVE)
    if (stepType === 'MOVE') {
      const { x: targetX, y: targetY } = resolveMoveTarget(activeStep, endpointsRef.current);
      const wpName = params.waypoint_name || params.target_value || 'Điểm đến';

      let startOverride = null;
      if (params.from_waypoint && params.from_waypoint !== 'CURRENT') {
        const fromWp =
          endpointsRef.current.find(
            (e) =>
              e.id === params.from_waypoint ||
              e.key === params.from_waypoint ||
              e.name === params.from_waypoint
          ) || GAZEBO_LOBBY_WAYPOINTS[params.from_waypoint];
        if (fromWp) {
          startOverride = { x: fromWp.x, y: fromWp.y, yaw: robotPoseRef.current.yaw };
        }
      }

      // THUC THI PHAT THANH / QUANG BA SONG SONG KHI DANG DI CHUYEN (Concurrent Broadcast)
      const broadcastText = (params.broadcast_speech || params.speech_text || '').trim();
      if (broadcastText && !isMutedRef.current && speakRef.current) {
        const lang = params.language || 'vi-VN';
        const voiceSpeed = parseFloat(params.speed || params.voice_speed) || 1.0;
        speakRef.current(broadcastText, lang, null, null, null, voiceSpeed);
      }

      handleNavigateToGoal(targetX, targetY, wpName, true, startOverride);
    } else {
      // CAC BUOC TUONG TAC (GREET, COMMUNICATE, SPEAK, SHOW, LISTEN, RECOMMEND, CREATE_REQUEST, FEEDBACK)
      let waitDurationSec = 3.5;
      if (stepType === 'COMMUNICATE') {
        const textContent = params.initial_prompt || params.speech_text || params.text || '';
        const len = textContent.trim().length;
        const silenceSec = parseInt(params.silence_timeout_sec || params.timeout) || 30;
        waitDurationSec = Math.max(4.0, Math.min(silenceSec, Math.ceil(len * 0.085) + 3));
      } else if (stepType === 'GREET' || stepType === 'SPEAK') {
        const textContent =
          stepType === 'GREET'
            ? params.greeting_text || params.text || 'Xin chào quý khách'
            : params.text || params.speech_text || '';
        const len = textContent.trim().length;
        waitDurationSec = Math.max(3.5, Math.min(10.0, Math.ceil(len * 0.085)));
      } else if (stepType === 'SHOW') {
        waitDurationSec = parseInt(params.timeout || params.slide_duration_sec) || 4;
      } else if (stepType === 'LISTEN') {
        waitDurationSec = parseInt(params.timeout || params.timeout_sec) || 4;
      } else if (stepType === 'RECOMMEND') {
        waitDurationSec = 3.5;
      } else if (stepType === 'CREATE_REQUEST') {
        waitDurationSec = 3;
      } else if (stepType === 'FEEDBACK') {
        waitDurationSec = 3.5;
      } else if (stepType === 'CHOICE') {
        // Cho khach chon tren khung lua chon; het gio thi theo nhanh het gio
        waitDurationSec = getChoiceTimeoutSec(activeStep);
      }

      const currentSpeed = simSpeedRef.current || 1.0;
      const totalMs = (waitDurationSec * 1000) / currentSpeed;
      const startTime = performance.now();

      const animateProgress = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / totalMs);
        setStepProgress(Math.round(progress * 100));

        if (progress < 1.0) {
          animFrameRef.current = requestAnimationFrame(animateProgress);
        }
      };

      animFrameRef.current = requestAnimationFrame(animateProgress);
      timerRef.current = setTimeout(
        () => handleStepFinish(stepType === 'CHOICE' ? { type: OUTCOME.TIMEOUT } : undefined),
        totalMs
      );
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    isPlaying,
    isPaused,
    currentStepIndex,
    stepRun,
    selectedWorkflowId,
    handleStepFinish,
    handleNavigateToGoal,
    simGuestPresent,
    showingIdlePromo,
  ]);
}
