import { useState, useEffect, useRef } from 'react';

/**
 * Custom Hook điều phối chu trình Workflow trực tiếp trên màn hình Robot
 */
export function useWorkflowRunner({ speak, stopSpeaking }) {
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const timerRef = useRef(null);

  const steps = activeWorkflow?.steps || [];
  const activeStep = isWorkflowRunning && currentStepIndex < steps.length ? steps[currentStepIndex] : null;

  const startWorkflow = (wf) => {
    if (!wf || !wf.steps || wf.steps.length === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (stopSpeaking) stopSpeaking();

    setActiveWorkflow(wf);
    setCurrentStepIndex(0);
    setIsWorkflowRunning(true);
  };

  const stopWorkflow = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (stopSpeaking) stopSpeaking();
    setIsWorkflowRunning(false);
    setActiveWorkflow(null);
    setCurrentStepIndex(0);
  };

  const nextStep = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (stopSpeaking) stopSpeaking();

    const nextIdx = currentStepIndex + 1;
    if (nextIdx < steps.length) {
      setCurrentStepIndex(nextIdx);
    } else {
      stopWorkflow();
    }
  };

  useEffect(() => {
    if (!isWorkflowRunning || !activeStep) return;

    let durationMs = 4500;
    if (activeStep.type === 'MOVE') durationMs = 5000;
    else if (activeStep.type === 'SHOW') {
      const showTimeout = activeStep.params?.timeout || activeStep.params?.slide_duration_sec || 6;
      durationMs = Math.min(8000, showTimeout * 1000);
    } else if (activeStep.type === 'LISTEN') {
      const listenTimeout = activeStep.params?.timeout || activeStep.params?.timeout_sec || 6;
      durationMs = Math.min(8000, listenTimeout * 1000);
    } else if (activeStep.type === 'FEEDBACK') durationMs = 6000;
    else if (activeStep.type === 'CREATE_REQUEST') durationMs = 4000;

    const voiceText =
      activeStep.type === 'GREET'
        ? (activeStep.params?.greeting_text || activeStep.params?.text)
        : activeStep.type === 'SPEAK'
        ? (activeStep.params?.speech_text || activeStep.params?.text)
        : null;

    if (voiceText && voiceText.trim() && speak) {
      speak(voiceText, activeStep.params?.language || 'vi-VN');
    }

    timerRef.current = setTimeout(() => {
      const nextIdx = currentStepIndex + 1;
      if (nextIdx < steps.length) {
        setCurrentStepIndex(nextIdx);
      } else {
        stopWorkflow();
      }
    }, durationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isWorkflowRunning, currentStepIndex, activeWorkflow?.id]);

  return {
    activeWorkflow,
    isWorkflowRunning,
    currentStepIndex,
    activeStep,
    totalSteps: steps.length,
    startWorkflow,
    stopWorkflow,
    nextStep,
  };
}
