import { useState, useEffect, useRef } from 'react';
import {
  OUTCOME,
  getChoiceTimeoutSec,
  isCancelSpeech,
  matchChoiceFromSpeech,
  resolveNextStepIndex,
} from '../utils/workflowFlow';

/**
 * Custom Hook điều phối chu trình Workflow trực tiếp trên màn hình Robot
 * Tích hợp Micro & Loa trực tiếp trên máy tính qua Web Speech API
 * Bước kế tiếp được chọn bởi resolveNextStepIndex, giống bộ chạy trong Studio.
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
  // Tăng mỗi lần vào bước, để bước nhảy về chính nó vẫn chạy lại
  const [stepRun, setStepRun] = useState(0);
  const timerRef = useRef(null);
  const speechEndDebounceRef = useRef(null);

  const [silenceRemaining, setSilenceRemaining] = useState(30);
  const [choiceRemaining, setChoiceRemaining] = useState(null);
  const silenceIntervalRef = useRef(null);

  const steps = activeWorkflow?.steps || [];
  const activeStep = isWorkflowRunning && currentStepIndex < steps.length ? steps[currentStepIndex] : null;

  const flowRef = useRef({ steps, index: currentStepIndex });
  flowRef.current = { steps, index: currentStepIndex };

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
    setStepRun((n) => n + 1);
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
    setChoiceRemaining(null);
  };

  const finishStep = (outcome = { type: OUTCOME.DONE }) => {
    cleanupTimers();
    if (stopSpeaking) stopSpeaking();
    if (stopListening) stopListening();

    const { steps: list, index } = flowRef.current;
    const nextIdx = resolveNextStepIndex(list, index, outcome);
    if (nextIdx >= 0) {
      setCurrentStepIndex(nextIdx);
      setStepRun((n) => n + 1);
    } else {
      stopWorkflow();
    }
  };

  const nextStep = () => finishStep({ type: OUTCOME.DONE });
  const chooseOption = (optionId) => finishStep({ type: OUTCOME.CHOSEN, optionId });
  const cancelChoice = () => finishStep({ type: OUTCOME.CANCEL });

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
    } else if (activeStep.type === 'CHOICE') {
      // Khách nói tên lựa chọn -> rẽ nhánh; nói hủy -> nhánh hủy
      const optionId = matchChoiceFromSpeech(activeStep, transcript);
      const outcome = optionId
        ? { type: OUTCOME.CHOSEN, optionId }
        : isCancelSpeech(transcript)
        ? { type: OUTCOME.CANCEL }
        : null;
      if (outcome) {
        if (speechEndDebounceRef.current) clearTimeout(speechEndDebounceRef.current);
        speechEndDebounceRef.current = setTimeout(() => finishStep(outcome), 900);
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
    const isChoice = activeStep.type === 'CHOICE';
    setChoiceRemaining(null);

    if (isCommunicate || isChoice) {
      const timeoutSec = isChoice
        ? getChoiceTimeoutSec(activeStep)
        : activeStep.params?.silence_timeout_sec || activeStep.params?.timeout || 30;
      if (isChoice) setChoiceRemaining(timeoutSec);
      else setSilenceRemaining(timeoutSec);

      // Kích hoạt Micro thu âm trực tiếp
      if (resetTranscript) resetTranscript();
      if (startListening) {
        startListening(activeStep.params?.language || 'vi-VN');
      }

      // Đếm ngược mỗi 1 giây; hết giờ -> COMMUNICATE sang bước kế, CHOICE theo nhánh hết giờ
      let remaining = timeoutSec;
      silenceIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (isChoice) setChoiceRemaining(Math.max(0, remaining));
        else setSilenceRemaining(Math.max(0, remaining));

        if (remaining <= 0) {
          clearInterval(silenceIntervalRef.current);
          finishStep({ type: isChoice ? OUTCOME.TIMEOUT : OUTCOME.DONE });
        }
      }, 1000);

      // Không dùng timer tĩnh durationMs vì các bước này được điều khiển bởi đếm ngược
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

    // Xử lý phát giọng nói qua Loa máy tính, cùng quy tắc với Studio:
    // GREET, SPEAK, COMMUNICATE, CHOICE, SHOW có thuyết minh và MOVE có lời phát khi di chuyển
    const voiceText =
      activeStep.type === 'COMMUNICATE'
        ? (activeStep.params?.initial_prompt || activeStep.params?.speech_text || activeStep.params?.text)
        : activeStep.type === 'GREET'
        ? (activeStep.params?.greeting_text || activeStep.params?.text)
        : activeStep.type === 'SPEAK' || activeStep.type === 'SHOW'
        ? (activeStep.params?.speech_text || activeStep.params?.text)
        : activeStep.type === 'MOVE'
        ? (activeStep.params?.broadcast_speech || activeStep.params?.speech_text)
        : isChoice
        ? activeStep.params?.prompt
        : null;

    const voiceSpeed = parseFloat(activeStep.params?.voice_speed) || 1.0;

    if (voiceText && voiceText.trim() && speak) {
      speak(voiceText, activeStep.params?.language || 'vi-VN', null, null, null, voiceSpeed);
    }

    if (durationMs !== null) {
      timerRef.current = setTimeout(() => finishStep({ type: OUTCOME.DONE }), durationMs);
    }

    return () => {
      cleanupTimers();
      if ((activeStep?.type === 'LISTEN' || activeStep?.type === 'COMMUNICATE' || activeStep?.type === 'CHOICE') && stopListening) {
        stopListening();
      }
    };
  }, [isWorkflowRunning, currentStepIndex, activeWorkflow?.id, stepRun]);

  return {
    activeWorkflow,
    isWorkflowRunning,
    currentStepIndex,
    activeStep,
    totalSteps: steps.length,
    silenceRemaining,
    choiceRemaining,
    startWorkflow,
    stopWorkflow,
    nextStep,
    chooseOption,
    cancelChoice,
  };
}
