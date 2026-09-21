import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, Square } from 'lucide-react';
import { RobotFace } from '../../../../components/robot/RobotFace';
import { AudioWave } from '../../../../components/robot/AudioWave';
import { useSpeechSynthesis } from '../../../../hooks/useSpeechSynthesis';
import { KioskDisplayPreview } from './KioskDisplayPreview';

export const WorkflowSimulatorModal = ({ workflow, isOpen, onClose }) => {
  if (!isOpen || !workflow) return null;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isExecuting, setIsExecuting] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [execSpeed, setExecSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);

  const { speak, cancel } = useSpeechSynthesis();
  const timerRef = useRef(null);

  const steps = workflow.steps || [];
  const activeStep = isExecuting && currentStepIndex < steps.length ? steps[currentStepIndex] : null;

  useEffect(() => {
    setCurrentStepIndex(0);
    setIsExecuting(true);
    setIsPaused(false);
    setExecutionLogs([`[KHỞI ĐỘNG] Chạy thử kịch bản: "${workflow.name}"`]);
    executeStep(0);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancel();
    };
  }, [workflow.id]);

  const executeStep = (index) => {
    if (index >= steps.length) {
      handleComplete();
      return;
    }

    const step = steps[index];
    setExecutionLogs((prev) => [
      ...prev,
      `[BƯỚC ${index + 1}/${steps.length}] ${step.type}: ${step.title || ''}`,
    ]);

    let stepDurationMs = 3500;
    if (step.type === 'MOVE') stepDurationMs = 4000;
    else if (step.type === 'SHOW') {
      const showTimeout = step.params?.timeout || step.params?.slide_duration_sec || 5;
      stepDurationMs = Math.min(5000, showTimeout * 1000);
    }
    else if (step.type === 'LISTEN') {
      const listenTimeout = step.params?.timeout || step.params?.timeout_sec || 6;
      stepDurationMs = Math.min(5000, listenTimeout * 1000);
    }
    else if (step.type === 'FEEDBACK') stepDurationMs = 5000;
    else if (step.type === 'CREATE_REQUEST') stepDurationMs = 4000;

    stepDurationMs = Math.max(1500, stepDurationMs / execSpeed);

    if (!isMuted) {
      const voiceText =
        step.type === 'GREET'
          ? (step.params?.greeting_text || step.params?.text)
          : step.type === 'SPEAK'
          ? (step.params?.speech_text || step.params?.text)
          : null;

      if (voiceText && voiceText.trim()) {
        speak(voiceText, step.params?.language || 'vi-VN');
      }
    }

    timerRef.current = setTimeout(() => {
      const nextIdx = index + 1;
      if (nextIdx < steps.length) {
        setCurrentStepIndex(nextIdx);
        executeStep(nextIdx);
      } else {
        handleComplete();
      }
    }, stepDurationMs);
  };

  const handleNextStep = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    cancel();
    const nextIdx = currentStepIndex + 1;
    if (nextIdx < steps.length) {
      setCurrentStepIndex(nextIdx);
      executeStep(nextIdx);
    } else {
      handleComplete();
    }
  };

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    cancel();
    setIsExecuting(false);
    setExecutionLogs((prev) => [...prev, '[DỪNG] Đã dừng giả lập kịch bản.']);
  };

  const handleComplete = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    cancel();
    setIsExecuting(false);
    setExecutionLogs((prev) => [...prev, '[HOÀN THÀNH] Đã hoàn tất toàn bộ chu trình!']);
  };

  const getRobotMode = () => {
    if (!isExecuting) return 'welcome';
    if (!activeStep) return 'welcome';
    if (activeStep.type === 'SPEAK') return 'speaking';
    if (activeStep.type === 'LISTEN') return 'listening';
    if (activeStep.type === 'RECOMMEND') return 'processing';
    return 'welcome';
  };

  const speechText =
    activeStep?.type === 'GREET'
      ? (activeStep.params?.greeting_text || activeStep.params?.text)
      : activeStep?.type === 'SPEAK'
      ? (activeStep.params?.speech_text || activeStep.params?.text)
      : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none">
      <div className="max-w-5xl w-full rounded-2xl border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden bg-[#18181B] text-white border-stone-700">
        {/* Header */}
        <div className="px-5 py-3 border-b border-stone-700 flex items-center justify-between bg-[#27272A]">
          <div>
            <h3 className="font-extrabold text-sm text-stone-100 flex items-center gap-2 uppercase tracking-wide">
              <span>🤖</span>
              <span>Giả Lập Thực Thi Robot: {workflow.name}</span>
            </h3>
            <span className="text-[10px] text-stone-400 font-mono">
              UNIT RC-001 • {steps.length} Steps
            </span>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePause}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-700 hover:bg-stone-600 flex items-center gap-1 cursor-pointer"
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-700 hover:bg-stone-600 flex items-center gap-1 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Next</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                isMuted ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'MUTE' : 'TTS'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg text-xs font-bold border border-stone-600 bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer ml-2"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Split-Screen Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
          {/* Left: Step Timeline & Execution Logs */}
          <div className="p-4 border-r border-stone-800 overflow-y-auto flex flex-col space-y-3 bg-[#1E1E24]">
            <h4 className="text-xs font-extrabold text-stone-300 uppercase tracking-wider">
              Tiến Trình Các Bước (Steps Timeline):
            </h4>
            <div className="space-y-1.5 flex-1">
              {steps.map((s, idx) => {
                const isActive = isExecuting && currentStepIndex === idx;
                const isDone = isExecuting && currentStepIndex > idx;
                return (
                  <div
                    key={s.step_id || idx}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                      isActive
                        ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400 text-amber-200 shadow-lg scale-[1.01]'
                        : isDone
                        ? 'bg-stone-800/60 border-stone-700 text-stone-400'
                        : 'bg-stone-800/30 border-stone-800 text-stone-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-full bg-stone-700 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-extrabold uppercase">{s.type}</span>
                      <span className="truncate text-stone-300">{s.title}</span>
                    </div>
                    {isActive && (
                      <span className="text-[10px] font-bold text-amber-400 animate-pulse">
                        Đang chạy...
                      </span>
                    )}
                    {isDone && <span className="text-[10px] font-bold text-emerald-400">✓ Xong</span>}
                  </div>
                );
              })}
            </div>

            {/* Logs Window */}
            <div className="p-3 rounded-xl bg-[#121214] border border-stone-800 font-mono text-[10px] space-y-1 max-h-36 overflow-y-auto text-stone-300">
              {executionLogs.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          </div>

          {/* Right: Live Robot Stage & Kiosk Screen */}
          <div className="flex flex-col overflow-hidden bg-[#121214]">
            {/* Upper Robot Avatar */}
            <div className="p-4 flex flex-col items-center justify-center border-b border-stone-800 bg-[#1A1A1E]">
              {speechText && (
                <div className="mb-2 px-3 py-1.5 rounded-xl bg-white text-gray-900 text-xs font-bold shadow animate-in fade-in">
                  💬 "{speechText}"
                </div>
              )}
              <RobotFace mode={getRobotMode()} compact={true} />
              {(activeStep?.type === 'SPEAK' || activeStep?.type === 'LISTEN') && (
                <div className="mt-1">
                  <AudioWave isActive={isExecuting} />
                </div>
              )}
            </div>

            {/* Lower Kiosk Preview */}
            <KioskDisplayPreview activeStep={activeStep} />
          </div>
        </div>
      </div>
    </div>
  );
};
