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

  const [silenceRemaining, setSilenceRemaining] = useState(30);
  const silenceIntervalRef = useRef(null);

  const steps = activeWorkflow?.steps || [];
  const activeStep = isWorkflowRunning && currentStepIndex < steps.length ? steps[currentStepIndex] : null;

  const cleanupTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (speechEndDebounceRef.current) clearTimeout(speechEndDebounceRef.current);
    if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current);
  };

  const startWorkflow = (wf) => {
    if (!wf || !wf.steps || wf.steps.length === 0) return;
    cleanupTimers();
    if (stopSpeaking) stopSpeaking();
    if (stopListening) stopListening();

    setActiveWorkflow(wf);
    setCurrentStepIndex(0);
    setIsWorkflowRunning(true);
  };

  const stopWorkflow = () => {
    cleanupTimers();
    if (stopSpeaking) stopSpeaking();
    if (stopListening) stopListening();
    setIsWorkflowRunning(false);
    setActiveWorkflow(null);
    setCurrentStepIndex(0);
    setSilenceRemaining(30);
  };

  const nextStep = () => {
    cleanupTimers();
    if (stopSpeaking) stopSpeaking();
    if (stopListening) stopListening();

    const nextIdx = currentStepIndex + 1;
    if (nextIdx < steps.length) {
      setCurrentStepIndex(nextIdx);
    } else {
      stopWorkflow();
    }
  };

  // Tự động nhận diện khi người dùng nói xong trong bước LISTEN (kế thừa) hoặc phát hiện từ khóa tạm biệt trong COMMUNICATE
  useEffect(() => {
    if (!isWorkflowRunning || !activeStep || !transcript || !transcript.trim()) return;

    const lowerTranscript = transcript.toLowerCase();

    // Trong bước COMMUNICATE: Khách nói -> Reset Silence Timer về 30s
    if (activeStep.type === 'COMMUNICATE') {
      const timeoutSec = activeStep.params?.silence_timeout_sec || activeStep.params?.timeout || 30;
      setSilenceRemaining(timeoutSec);

      // Nếu khách nói lời chào tạm biệt / kết thúc -> chuyển bước tiếp theo ngay
      const farewellKeywords = ['tạm biệt', 'tam biet', 'cảm ơn', 'cam on', 'xong rồi', 'xong roi', 'hết rồi', 'het roi', 'không cần nữa', 'khong can nua', 'bye', 'thank you', 'thanks'];
      const hasFarewell = farewellKeywords.some((kw) => lowerTranscript.includes(kw));

      if (hasFarewell) {
        if (speechEndDebounceRef.current) clearTimeout(speechEndDebounceRef.current);
        speechEndDebounceRef.current = setTimeout(() => {
          nextStep();
        }, 1500);
      }
    } else if (activeStep.type === 'LISTEN') {
      // Trong bước LISTEN cũ: ngưng nói 2.2s -> chuyển bước
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

    cleanupTimers();

    let durationMs = 5000;
    const isCommunicate = activeStep.type === 'COMMUNICATE';

    if (isCommunicate) {
      const silenceTimeoutSec = activeStep.params?.silence_timeout_sec || activeStep.params?.timeout || 30;
      setSilenceRemaining(silenceTimeoutSec);

      // Kích hoạt Micro thu âm trực tiếp
      if (resetTranscript) resetTranscript();
      if (startListening) {
        startListening(activeStep.params?.language || 'vi-VN');
      }

      // Khởi động đếm ngược im lặng mỗi 1 giây
      let currentSilence = silenceTimeoutSec;
      silenceIntervalRef.current = setInterval(() => {
        currentSilence -= 1;
        setSilenceRemaining(Math.max(0, currentSilence));

        // Hết 30s không có tín hiệu nói -> Tự động chuyển bước kế tiếp
        if (currentSilence <= 0) {
          clearInterval(silenceIntervalRef.current);
          nextStep();
        }
      }, 1000);

      // Không dùng timer tĩnh durationMs vì bước COMMUNICATE được điều khiển bởi Silence Timeout
      durationMs = null;
    } else if (activeStep.type === 'MOVE') {
      const moveTimeout = activeStep.params?.timeout || activeStep.params?.timeout_sec || 6;
      durationMs = Math.max(4000, moveTimeout * 1000);
    } else if (activeStep.type === 'SHOW') {
      const showTimeout = activeStep.params?.timeout || activeStep.params?.slide_duration_sec || 10;
      durationMs = Math.max(3000, showTimeout * 1000);
    } else if (activeStep.type === 'LISTEN') {
      const listenTimeout = activeStep.params?.timeout || activeStep.params?.timeout_sec || 15;
      durationMs = Math.max(5000, listenTimeout * 1000);

      // Kích hoạt Micro máy tính
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

    // Xử lý phát giọng nói qua Loa máy tính cho GREET, SPEAK & COMMUNICATE
    const voiceText =
      activeStep.type === 'COMMUNICATE'
        ? (activeStep.params?.initial_prompt || activeStep.params?.speech_text || activeStep.params?.text)
        : activeStep.type === 'GREET'
        ? (activeStep.params?.greeting_text || activeStep.params?.text)
        : activeStep.type === 'SPEAK'
        ? (activeStep.params?.speech_text || activeStep.params?.text)
        : null;

    const voiceSpeed = parseFloat(activeStep.params?.voice_speed) || 1.0;

    if (voiceText && voiceText.trim() && speak) {
      speak(voiceText, activeStep.params?.language || 'vi-VN', null, null, null, voiceSpeed);
    }

    if (durationMs !== null) {
      timerRef.current = setTimeout(() => {
        const nextIdx = currentStepIndex + 1;
        if (nextIdx < steps.length) {
          setCurrentStepIndex(nextIdx);
        } else {
          stopWorkflow();
        }
      }, durationMs);
    }

    return () => {
      cleanupTimers();
      if ((activeStep?.type === 'LISTEN' || activeStep?.type === 'COMMUNICATE') && stopListening) {
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
    silenceRemaining,
    startWorkflow,
    stopWorkflow,
    nextStep,
  };
}
