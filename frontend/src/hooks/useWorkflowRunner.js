import { useState, useEffect, useRef } from 'react';

/**
 * Custom Hook điều phối chu trình Workflow trực tiếp trên màn hình Robot
 * Tích hợp Micro & Loa trực tiếp trên máy tính qua Web Speech API
 */
export function useWorkflowRunner({
  speak,
  stopSpeaking,
  startListening,
  stopListening,
  transcript = '',
  resetTranscript = () => {},
  isListening = false,
}) {
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const timerRef = useRef(null);
  const speechEndDebounceRef = useRef(null);

  const steps = activeWorkflow?.steps || [];
  const activeStep = isWorkflowRunning && currentStepIndex < steps.length ? steps[currentStepIndex] : null;

  const startWorkflow = (wf) => {
    if (!wf || !wf.steps || wf.steps.length === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (speechEndDebounceRef.current) clearTimeout(speechEndDebounceRef.current);
    if (stopSpeaking) stopSpeaking();
    if (stopListening) stopListening();

    setActiveWorkflow(wf);
    setCurrentStepIndex(0);
    setIsWorkflowRunning(true);
  };

  const stopWorkflow = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (speechEndDebounceRef.current) clearTimeout(speechEndDebounceRef.current);
    if (stopSpeaking) stopSpeaking();
    if (stopListening) stopListening();
    setIsWorkflowRunning(false);
    setActiveWorkflow(null);
    setCurrentStepIndex(0);
  };

  const nextStep = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (speechEndDebounceRef.current) clearTimeout(speechEndDebounceRef.current);
    if (stopSpeaking) stopSpeaking();
    if (stopListening) stopListening();

    const nextIdx = currentStepIndex + 1;
    if (nextIdx < steps.length) {
      setCurrentStepIndex(nextIdx);
    } else {
      stopWorkflow();
    }
  };

  // Tự động nhận diện khi người dùng nói xong trong bước LISTEN -> tự động chuyển bước sau 2 giây ngưng nói
  useEffect(() => {
    if (isWorkflowRunning && activeStep?.type === 'LISTEN' && transcript && transcript.trim()) {
      if (speechEndDebounceRef.current) clearTimeout(speechEndDebounceRef.current);
      speechEndDebounceRef.current = setTimeout(() => {
        nextStep();
      }, 2200);
    }
    return () => {
      if (speechEndDebounceRef.current) clearTimeout(speechEndDebounceRef.current);
    };
  }, [transcript, isWorkflowRunning, activeStep?.type]);

  // Điều phối chu trình từng bước
  useEffect(() => {
    if (!isWorkflowRunning || !activeStep) return;

    let durationMs = 5000;
    if (activeStep.type === 'MOVE') {
      const moveTimeout = activeStep.params?.timeout || activeStep.params?.timeout_sec || 6;
      durationMs = Math.max(4000, moveTimeout * 1000);
    } else if (activeStep.type === 'SHOW') {
      const showTimeout = activeStep.params?.timeout || activeStep.params?.slide_duration_sec || 10;
      durationMs = Math.max(3000, showTimeout * 1000);
    } else if (activeStep.type === 'LISTEN') {
      const listenTimeout = activeStep.params?.timeout || activeStep.params?.timeout_sec || 15;
      durationMs = Math.max(5000, listenTimeout * 1000);

      // Kích hoạt Micro máy tính thật sự qua Web Speech API
      if (stopSpeaking) stopSpeaking();
      if (resetTranscript) resetTranscript();
      if (startListening) {
        startListening(activeStep.params?.language || 'vi-VN');
      }
    } else if (activeStep.type === 'FEEDBACK') {
      durationMs = 7000;
    } else if (activeStep.type === 'CREATE_REQUEST') {
      durationMs = 4500;
    } else if (activeStep.type === 'RECOMMEND') {
      durationMs = 6000;
    }

    // Xử lý phát giọng nói qua Loa máy tính cho GREET & SPEAK
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
      if (activeStep?.type === 'LISTEN' && stopListening) {
        stopListening();
      }
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
