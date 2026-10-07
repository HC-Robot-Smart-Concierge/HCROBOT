import React, { useState, useEffect, useRef } from 'react';
import { RobotFace } from '../../components/robot/RobotFace';
import { AudioWave } from '../../components/robot/AudioWave';
import { FloorMap } from '../../components/robot/FloorMap';
import { CameraPreview } from '../../components/robot/CameraPreview';
import { MobileRobotScreen } from '../../components/robot/MobileRobotScreen';
import { useWorkflowRunner } from '../../hooks/useWorkflowRunner';
import { KioskDisplayPreview } from '../admin/tabs/workflow/KioskDisplayPreview';
import { fetchWorkflows } from '../../services/workflowApi';
import { useNotificationWebSocket } from '../../hooks/useNotificationWebSocket';

import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { sendChatStreamSSE, resetSession, flushSession } from '../../services/aiApi';

import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  LogOut,
  RotateCcw,
  Zap,
  Globe,
  HelpCircle,
  Shield,
  Layers,
} from 'lucide-react';

export const RobotScreenPage = ({ onLogout = () => {} }) => {
  // Trạng thái Robot: 'RT-01' (Sleeping) | 'RT-02' (Welcome) | 'RT-03' (Listening) | 'RT-04' (Processing) | 'RT-05' (Directions)
  const [currentState, setCurrentState] = useState('RT-02');
  const [language, setLanguage] = useState('Tiếng Việt');

  // Subtitle / Lời nói của Robot và Người dùng
  const [spokenSubtitle, setSpokenSubtitle] = useState('');
  const [lastAnswerText, setLastAnswerText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [guestEmotion, setGuestEmotion] = useState('neutral');

  // Auto-listen loop (Tự động mở lại mic sau khi robot nói xong)
  const [isAutoListen, setIsAutoListen] = useState(true);
  const silenceTimerRef = useRef(null);

  // Session Memory & Room Number States
  const [sessionId] = useState(() => 'session_kiosk_' + Math.random().toString(36).substring(2, 9));
  const [activeRoomNumber, setActiveRoomNumber] = useState(null);

  // Kiosk Protected Logout State
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutPassword, setLogoutPassword] = useState('');
  const [logoutError, setLogoutError] = useState('');

  // Mobile / Phone Layout Detection
  const [isPhoneLayout, setIsPhoneLayout] = useState(() => (
    window.matchMedia('(max-width: 767px), (max-height: 600px) and (max-width: 1024px)').matches
  ));

  // Voice Hooks
  const {
    isListening,
    micLive,
    transcript,
    error: speechError,
    volumeLevel,
    hasMicPermission,
    requestMicrophonePermission,
    startListening,
    stopListening,
    resetTranscript,
    hasSupport,
  } = useSpeechRecognition();

  const {
    speak,
    prime,
    cancel: stopSpeaking,
    isSpeaking,
    initStreamSpeech,
    enqueueStreamChunk,
    endStreamSpeech,
  } = useSpeechSynthesis();

  const streamingBufferRef = useRef('');

  // Dừng nói và tắt hoàn toàn audio
  const handleStopSpeaking = () => {
    stopSpeaking();
    streamingBufferRef.current = '';
    setCurrentState('RT-03');
    setTimeout(() => {
      handleStartTalk();
    }, 150);
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'English' ? 'Tiếng Việt' : 'English'));
  };

  // Workflow Native Runner Hook
  const {
    activeWorkflow,
    isWorkflowRunning,
    currentStepIndex,
    activeStep,
    totalSteps,
    startWorkflow,
    stopWorkflow,
    nextStep,
  } = useWorkflowRunner({
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    transcript,
    resetTranscript,
    isListening,
  });

  const [availableWorkflows, setAvailableWorkflows] = useState([]);
  const [showWorkflowMenu, setShowWorkflowMenu] = useState(false);

  useEffect(() => {
    fetchWorkflows()
      .then((res) => {
        if (Array.isArray(res)) setAvailableWorkflows(res);
      })
      .catch(() => {});
  }, []);

  // BroadcastChannel & WebSocket Workflow Listeners
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel('hcrobot_workflow_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'EXECUTE_WORKFLOW' && event.data?.workflow) {
          startWorkflow(event.data.workflow);
        }
      };
    } catch {}
    return () => {
      if (bc) bc.close();
    };
  }, [startWorkflow]);

  useNotificationWebSocket({
    department: 'All',
    onNotificationReceived: (notif) => {
      if (notif?.type === 'WORKFLOW_DISPATCH' && notif?.workflow) {
        startWorkflow(notif.workflow);
      }
    },
    enabled: true,
  });

  // Xóa bộ nhớ phiên (Dùng cho nút Khách Mới / Đổi Khách)
  const handleManualResetSession = async () => {
    stopSpeaking();
    stopListening();
    resetTranscript();
    setActiveRoomNumber(null);
    setSpokenSubtitle('');
    setLastAnswerText('');
    await resetSession(sessionId);
    setCurrentState('RT-02');
  };

  // Khi người dùng lại gần Camera -> Chào hỏi chủ động bằng giọng nói hoặc kích hoạt kịch bản AUTO_DETECT
  const handleGuestApproached = () => {
    // 1. Kiểm tra kịch bản tự động kích hoạt (AUTO_DETECT) đang active
    const autoWf = availableWorkflows.find(
      (wf) => (wf.is_active ?? true) && wf.trigger_type === 'AUTO_DETECT'
    );
    if (autoWf && !isWorkflowRunning) {
      setCurrentState('RT-02');
      startWorkflow(autoWf);
      return;
    }

    // 2. Mặc định: Chào hỏi chủ động của trợ lý Rora
    if (currentState === 'RT-01' || currentState === 'RT-02') {
      setCurrentState('RT-02');
      const hour = new Date().getHours();
      let greeting = 'Dạ em chào quý khách! Em là Rora, trợ lý AI của khách sạn Aurora Grand. Quý khách cần em hỗ trợ gì ạ?';
      if (hour >= 5 && hour < 11) {
        greeting = 'Dạ em chào buổi sáng quý khách! Em là Rora. Chúc quý khách một ngày mới tràn đầy năng lượng tại Aurora Grand Hotel. Quý khách cần em hỗ trợ gì ạ?';
      } else if (hour >= 18) {
        greeting = 'Dạ em chào buổi tối quý khách! Em là Rora. Chúc quý khách một buổi tối thư thái tại Aurora Grand Hotel. Quý khách cần em hỗ trợ gì ạ?';
      }

      setSpokenSubtitle(greeting);
      speak(
        greeting,
        language === 'English' ? 'en-US' : 'vi-VN',
        () => {
          setCurrentState('RT-03');
          if (isAutoListen) {
            setTimeout(() => handleStartTalk(), 300);
          }
        },
        () => {
          setCurrentState('RT-02');
        }
      );
    }
  };

  // Khi người dùng đi xa khỏi Camera -> Đóng gói phiên & chuyển sang ngủ nhẹ (RT-01)
  const handleGuestLeft = async () => {
    if (!isProcessing && !isSpeaking) {
      stopSpeaking();
      stopListening();
      resetTranscript();
      try {
        await flushSession(sessionId);
      } catch (err) {
        console.warn('Auto-flush session on guest left:', err);
      }
      setActiveRoomNumber(null);
      setSpokenSubtitle('');
      setCurrentState('RT-01');
    }
  };

  // Bắt đầu lắng nghe giọng nói (MIC ON, LOA OFF)
  const handleStartTalk = async () => {
    prime();
    stopSpeaking();
    resetTranscript();
    setCurrentState('RT-03');

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    await requestMicrophonePermission();

    startListening(language, {
      onInterim: (interimText) => {
        // Cập nhật transcript trực tiếp
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        // Sau 1300ms người dùng không nói gì thêm -> Tự động chốt câu và gửi tới Llama 3.2 3B
        silenceTimerRef.current = setTimeout(() => {
          if (interimText && interimText.trim().length > 1) {
            handleProcessSpeech(interimText.trim());
          }
        }, 1300);
      },
      onFinal: (finalText) => {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        // onFinal đã xác nhận câu nói -> chốt sau 600ms im lặng
        silenceTimerRef.current = setTimeout(() => {
          if (finalText && finalText.trim().length > 1) {
            handleProcessSpeech(finalText.trim());
          }
        }, 600);
      },
    });
  };

  // Xử lý câu nói của khách qua Llama 3.2 3B và phát âm thanh streaming liên tục
  const handleProcessSpeech = async (userText) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const query = (userText || transcript || '').trim();
    if (!query || query.length < 2 || isProcessing) return;

    // QUAN TRỌNG: TẮT MIC NGAY LẬP TỨC để triệt tiêu tiếng vọng và không nối câu trước vào câu sau!
    stopListening();
    resetTranscript();

    setCurrentState('RT-04'); // Processing state (mắt nhấp nháy xanh)
    setIsProcessing(true);
    setSpokenSubtitle('');
    streamingBufferRef.current = '';

    const langCode = language === 'English' ? 'en-US' : 'vi-VN';

    // Khởi tạo hàng đợi phát âm thanh Streaming TTS liên tục (Continuous Speech Queue)
    initStreamSpeech(
      langCode,
      // onStart: Khi câu đầu tiên bắt đầu phát ra âm thanh
      () => {
        setIsProcessing(false);
        setCurrentState('RT-02'); // mode speaking / welcome
      },
      // onEnd: Khi toàn bộ câu trả lời đã phát xong qua loa
      () => {
        setIsProcessing(false);
        setCurrentState('RT-03');
        if (isAutoListen) {
          setTimeout(() => handleStartTalk(), 400);
        }
      }
    );

    let fullGeneratedText = '';

    try {
      await sendChatStreamSSE(
        query,
        // onToken: Nhận từng token từ Meta Llama 3.2 3B -> Đẩy ngay vào chunker để phát âm thanh lập tức!
        (token, detectedLangCode) => {
          fullGeneratedText += token;
          setSpokenSubtitle((prev) => prev + token);
          streamingBufferRef.current += token;

          const buf = streamingBufferRef.current;
          const targetLang = detectedLangCode || langCode;

          // 1. Tách theo dấu kết thúc câu (. ! ? \n) để phát ngay lập tức
          const sentenceMatch = buf.match(/([.!?\n]+)/);
          if (sentenceMatch) {
            const splitIdx = sentenceMatch.index + sentenceMatch[0].length;
            const sentence = buf.slice(0, splitIdx).trim();
            streamingBufferRef.current = buf.slice(splitIdx);
            if (sentence.length > 2) {
              enqueueStreamChunk(sentence, targetLang);
            }
          } else {
            // 2. Tách theo dấu phẩy / chấm phẩy (,) khi câu đủ dài (>= 7 từ) để phát không phải đợi lâu
            const commaMatch = buf.match(/([,;:—]+)/);
            if (commaMatch) {
              const wordsBeforeComma = buf.slice(0, commaMatch.index).trim().split(/\s+/);
              if (wordsBeforeComma.length >= 7) {
                const splitIdx = commaMatch.index + commaMatch[0].length;
                const clause = buf.slice(0, splitIdx).trim();
                streamingBufferRef.current = buf.slice(splitIdx);
                if (clause.length > 2) {
                  enqueueStreamChunk(clause, targetLang);
                }
              }
            }
          }
        },
        // onDone: Khi mô hình sinh xong toàn bộ text -> Đẩy nốt phần còn lại và chốt queue
        (fullText, detectedLangCode) => {
          setIsProcessing(false);
          const finalFull = fullText || fullGeneratedText;
          if (finalFull) {
            setSpokenSubtitle(finalFull);
            setLastAnswerText(finalFull);
          }

          const targetLang = detectedLangCode || langCode;
          const remaining = (streamingBufferRef.current || '').trim();
          streamingBufferRef.current = '';

          if (remaining.length > 0) {
            enqueueStreamChunk(remaining, targetLang);
          }

          // Báo hiệu stream đã hoàn tất để hàng đợi tự động kết thúc sau câu cuối
          endStreamSpeech();
        },
        // onError: Báo lỗi nếu AI Server gặp sự cố
        (err) => {
          console.error('[Robot Voice] Error with Llama 3.2 3B:', err);
          setIsProcessing(false);
          streamingBufferRef.current = '';
          const fallback = language === 'English'
            ? 'Sorry, unable to connect to AI server. Please try again.'
            : 'Dạ xin lỗi quý khách, hệ thống AI đang bận. Quý khách vui lòng nói lại giúp em ạ.';
          setSpokenSubtitle(fallback);
          speak(fallback, langCode, () => {
            setCurrentState('RT-03');
            if (isAutoListen) setTimeout(() => handleStartTalk(), 300);
          });
        },
        {
          sessionId,
          language: language === 'English' ? 'en' : 'vi',
          emotion: guestEmotion,
          roomNumber: activeRoomNumber,
        }
      );
    } catch (err) {
      console.error('[Robot Voice] Critical exception:', err);
      setIsProcessing(false);
      streamingBufferRef.current = '';
      endStreamSpeech();
      setCurrentState('RT-03');
    }
  };

  // Xác định mode cho RobotFace
  const getRobotFaceMode = () => {
    if (isWorkflowRunning && activeStep?.type === 'GREET') {
      const exp = activeStep.params?.face_expression || 'HAPPY_SMILE';
      if (exp === 'HAPPY_SMILE' || exp === 'WELCOME') return 'happy';
      if (exp === 'LISTENING') return 'listening';
      return 'welcome';
    }
    if (currentState === 'RT-01') return 'sleeping';
    if (isProcessing || currentState === 'RT-04') return 'processing';
    if (isSpeaking) return 'speaking';
    if (isListening || currentState === 'RT-03') return 'listening';
    return 'welcome';
  };

  // Submit Password Đăng xuất
  const handleProtectedLogoutSubmit = (e) => {
    if (e) e.preventDefault();
    const validPasswords = ['123456', 'robot123', 'password123', 'admin', 'aurora2026'];
    if (validPasswords.includes(logoutPassword.trim())) {
      setShowLogoutModal(false);
      setLogoutPassword('');
      setLogoutError('');
      onLogout();
    } else {
      setLogoutError('Mật khẩu không chính xác! Vui lòng thử lại.');
    }
  };

  // Orientation lock
  useEffect(() => {
    try {
      window.screen?.orientation?.lock?.('landscape').catch?.(() => {});
    } catch {}
  }, []);

  return (
    <div className="w-full h-[100dvh] bg-aurora-canvas text-aurora-primary overflow-hidden font-sans select-none relative flex flex-col justify-between items-center">
      {/* Camera Preview Control góc trên bên trái */}
      <CameraPreview
        autoStart={!isPhoneLayout}
        controlsClassName="robot-camera-control"
        onGuestApproached={handleGuestApproached}
        onGuestLeft={handleGuestLeft}
        onEmotionChange={(emotion) => setGuestEmotion(emotion)}
        source={import.meta.env.VITE_CAMERA_SOURCE || 'local'}
        streamUrl={import.meta.env.VITE_PI5_CAMERA_URL || 'http://localhost:8554/stream'}
      />

      {/* Header Bar tối giản, sáng sủa, thanh lịch */}
      <header className="relative z-30 w-full px-8 py-5 flex items-center justify-between shrink-0">
        {/* Left: Tên Khách Sạn & Model Llama 3.2 3B */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold tracking-tight text-aurora-primary">AURORA GRAND CONCIERGE</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Sẵn sàng" />
          </div>
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-white/90 text-[10px] font-mono font-bold text-stone-600 border border-aurora-border shadow-sm">
            Meta Llama 3.2 3B
          </span>
        </div>

        {/* Right: Điều khiển & Ngôn ngữ */}
        <div className="flex items-center gap-2.5">
          {/* Menu Kịch Bản Workflow */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowWorkflowMenu(!showWorkflowMenu)}
              className="px-3.5 py-1.5 rounded-full bg-white/95 hover:bg-stone-50 text-stone-700 border border-aurora-border text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Kịch Bản ({availableWorkflows.length})</span>
            </button>

            {showWorkflowMenu && (
              <div className="absolute top-11 right-0 w-72 rounded-2xl bg-white/98 border border-stone-200 shadow-2xl p-2.5 space-y-1.5 backdrop-blur-xl z-50 text-left animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-black uppercase text-stone-400 px-2 py-1 border-b border-stone-100 flex items-center justify-between">
                  <span>Kịch Bản Tự Động Kiosk</span>
                  <span className="text-stone-600 font-mono">{availableWorkflows.length}</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                  {availableWorkflows.map((wf) => (
                    <button
                      key={wf.id}
                      type="button"
                      onClick={() => {
                        startWorkflow(wf);
                        setShowWorkflowMenu(false);
                      }}
                      className="w-full p-2 rounded-xl text-left text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span className="truncate">{wf.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 font-mono">
                        {wf.steps?.length || 0}s
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Đổi ngôn ngữ Tiếng Việt / Tiếng Anh */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="px-3.5 py-1.5 rounded-full bg-white/95 hover:bg-stone-50 text-aurora-primary border border-aurora-border text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            {language === 'English' ? '🇬🇧 EN' : '🇻🇳 VI'}
          </button>

          {/* Nút Khách mới (Reset phiên) */}
          <button
            type="button"
            onClick={handleManualResetSession}
            className="px-3.5 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 text-xs font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Bắt đầu đón tiếp khách mới"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khách mới</span>
          </button>
        </div>
      </header>

      {/* Floating Active Workflow Banner */}
      {isWorkflowRunning && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-5 py-2 rounded-full bg-white/98 border border-stone-200 shadow-xl backdrop-blur-md flex items-center gap-3 animate-fadeIn">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-xs font-black text-stone-800 tracking-wide uppercase">
            {activeWorkflow?.name}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
            BƯỚC {currentStepIndex + 1}/{totalSteps}: {activeStep?.type}
          </span>
          <button
            type="button"
            onClick={nextStep}
            className="px-2.5 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-bold cursor-pointer transition-colors"
          >
            Tiếp
          </button>
          <button
            type="button"
            onClick={stopWorkflow}
            className="px-2.5 py-1 rounded-full bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold cursor-pointer transition-colors"
          >
            Dừng
          </button>
        </div>
      )}

      {/* Mobile Screen Fallback Component */}
      <MobileRobotScreen
        activeRoomNumber={activeRoomNumber}
        guestEmotion={guestEmotion}
        spokenSubtitle={spokenSubtitle}
        currentState={currentState}
        isListening={isListening}
        isProcessing={isProcessing}
        isSpeaking={isSpeaking}
        language={language}
        transcript={transcript}
        volumeLevel={volumeLevel}
        onStartTalk={handleStartTalk}
        onStopSpeaking={handleStopSpeaking}
        onResetSession={handleManualResetSession}
        onResetToIdle={() => setCurrentState('RT-02')}
        onToggleLanguage={toggleLanguage}
        onLogout={() => {
          setLogoutError('');
          setLogoutPassword('');
          setShowLogoutModal(true);
        }}
      />

      {/* Desktop / Kiosk Screen - TRUNG TÂM CHỈ CÓ MẶT ROBOT VÀ PHỤ ĐỀ NÓI CHUYỆN */}
      <main
        onClick={() => {
          prime();
          // Nếu robot đang nói, bấm màn hình để dừng nói và mở mic (Barge-in)
          if (isSpeaking) {
            handleStopSpeaking();
            return;
          }
          // Nếu đang rảnh rỗi, bấm màn hình để kích hoạt nói chuyện
          if (!isSpeaking && !isProcessing && !isListening) {
            handleStartTalk();
          }
        }}
        className="robot-desktop-ui relative z-10 flex-1 w-full max-w-5xl flex flex-col items-center justify-center px-8 cursor-pointer"
      >
        {/* Trường hợp chạy Workflow Kiosk Display */}
        {isWorkflowRunning && (activeStep?.type === 'SHOW' || activeStep?.type === 'FEEDBACK' || activeStep?.type === 'MOVE' || activeStep?.type === 'LISTEN' || activeStep?.type === 'RECOMMEND' || activeStep?.type === 'CREATE_REQUEST') ? (
          <div className="w-[700px] max-h-[610px] bg-white/98 backdrop-blur-2xl border-2 border-stone-200/90 rounded-3xl shadow-2xl p-5 flex flex-col overflow-hidden animate-fadeIn">
            <KioskDisplayPreview
              activeStep={activeStep}
              transcript={transcript}
              isListening={isListening}
              onNextStep={nextStep}
            />
          </div>
        ) : currentState === 'RT-05' ? (
          /* Route Guidance Floor Map Mode */
          <div className="w-full flex justify-between items-center gap-8 animate-fadeIn">
            <FloorMap
              destination="SWIMMING POOL"
              destinationLevel="LEVEL 4"
              estimatedTime="4 MIN"
              estimatedDistance="APPROX. 120 M"
            />
            <div className="w-[450px] p-6 bg-white/95 rounded-3xl border border-aurora-border shadow-aurora-lg flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-aurora-primary uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Chỉ dẫn vị trí Hồ bơi (Tầng 4)</span>
                </div>
                <div className="p-4 bg-aurora-cardMuted rounded-2xl border border-aurora-border text-sm font-medium leading-relaxed">
                  {spokenSubtitle || "Hồ bơi vô cực nằm ở tầng 4. Khăn tắm và nước khoáng được phục vụ miễn phí!"}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentState('RT-03');
                  handleStartTalk();
                }}
                className="w-full py-4 bg-aurora-primary text-aurora-textInverse rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-lg"
              >
                <Mic className="w-5 h-5 text-emerald-400" />
                <span>NÓI CHUYỆN TIẾP</span>
              </button>
            </div>
          </div>
        ) : (
          /* MAIN STAGE: CHỈ CÓ MẶT ROBOT VÀ PHỤ ĐỀ NÓI CHUYỆN (SÁNG SỦA, TINH TẾ) */
          <div className="flex flex-col items-center justify-center gap-8 w-full max-w-3xl text-center">
            {/* 1. MẶT ROBOT TO, CHÍNH GIỮA MÀN HÌNH */}
            <div className="scale-125 sm:scale-135 py-4 transition-transform duration-500">
              <RobotFace mode={getRobotFaceMode()} />
            </div>

            {/* 2. KHU VỰC PHỤ ĐỀ LỜI NÓI & TRẠNG THÁI NÓI CHUYỆN */}
            <div className="w-full flex flex-col items-center gap-4 animate-fadeIn">
              {/* KHI ROBOT ĐANG NÓI HOẶC VỪA NÓI XONG: HIỆN PHỤ ĐỀ CÂU TRẢ LỜI CỦA ROBOT */}
              {isSpeaking || (spokenSubtitle && !isListening && !isProcessing) ? (
                <div className="w-full max-w-2xl px-8 py-5 bg-white/95 rounded-3xl border border-aurora-border shadow-aurora-lg flex flex-col items-center gap-3.5 animate-fadeIn backdrop-blur-md">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                    <AudioWave isActive={isSpeaking} />
                    <span>{isSpeaking ? 'Rora đang trả lời' : 'Câu trả lời của Rora'}</span>
                  </div>

                  <p className="text-lg sm:text-xl font-bold text-aurora-primary leading-relaxed text-center">
                    {spokenSubtitle}
                  </p>

                  <div className="flex items-center gap-3 pt-1 border-t border-stone-100">
                    {isSpeaking && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStopSpeaking();
                        }}
                        className="px-4 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all cursor-pointer"
                      >
                        ⏹️ Chạm để dừng nói
                      </button>
                    )}
                  </div>
                </div>
              ) : isListening ? (
                /* KHI NGƯỜI DÙNG ĐANG NÓI (ROBOT ĐANG LẮNG NGHE) */
                <div className="flex flex-col items-center gap-3 animate-fadeIn">
                  <div className="px-7 py-3.5 rounded-full bg-white/95 border border-emerald-500/40 shadow-aurora-lg flex items-center gap-3.5 backdrop-blur-md">
                    <AudioWave isActive={true} volumeLevel={volumeLevel} />
                    <span className="text-sm font-bold text-emerald-800">
                      {transcript ? (
                        <span>"{transcript}"</span>
                      ) : (
                        <span>🟢 Đang lắng nghe... Quý khách hãy nói câu hỏi</span>
                      )}
                    </span>

                    {/* Nút Chốt câu sớm khi người dùng nói xong */}
                    {transcript && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProcessSpeech(transcript);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                      >
                        Xong
                      </button>
                    )}
                  </div>

                  {volumeLevel === 0 && !transcript && (
                    <p className="text-xs text-stone-500 font-medium">
                      💡 Hãy nói to rõ vào microphone của quý khách
                    </p>
                  )}
                </div>
              ) : isProcessing ? (
                /* KHI ROBOT ĐANG SUY NGHĨ (PROCESSING VỚI LLAMA 3.2 3B) */
                <div className="px-6 py-3.5 rounded-full bg-white/95 border border-sky-300 shadow-aurora-lg flex items-center gap-3 animate-fadeIn backdrop-blur-md">
                  <span className="w-3 h-3 rounded-full bg-sky-500 animate-ping" />
                  <span className="text-sm font-bold text-sky-800">
                    Rora đang suy nghĩ câu trả lời...
                  </span>
                </div>
              ) : (
                /* TRẠNG THÁI CHỜ / SẴN SÀNG: NÚT NÓI CHUYỆN RÕ RÀNG */
                <div className="flex flex-col items-center gap-3.5 animate-fadeIn">
                  {lastAnswerText && (
                    <div className="max-w-lg px-6 py-2.5 bg-white/80 border border-aurora-border rounded-2xl text-xs text-stone-600 text-center font-medium line-clamp-2 shadow-sm">
                      <span className="font-bold text-aurora-primary">Câu trả lời vừa rồi: </span>
                      <span>{lastAnswerText}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartTalk();
                    }}
                    className="px-8 py-4 rounded-full bg-aurora-primary hover:bg-stone-800 text-aurora-textInverse font-black text-sm tracking-wide shadow-aurora-lg flex items-center gap-3 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Mic className="w-5 h-5 text-emerald-400" />
                    <span>CHẠM ĐỂ NÓI CHUYỆN VỚI RORA</span>
                  </button>

                  <p className="text-xs text-stone-500 font-medium">
                    (Không cần gõ phím · Nhận diện giọng nói và đối thoại tự nhiên)
                  </p>
                </div>
              )}

              {speechError && (
                <div className="px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold max-w-md shadow-sm">
                  ⚠️ {speechError}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer Bar: Dev Dots Switcher & Nút Thoát */}
      <footer className="relative z-30 w-full px-8 py-5 flex items-center justify-between shrink-0">
        {/* Left: State Switcher Dots (RT-01 đến RT-05) */}
        <div className="bg-white/90 px-3.5 py-1.5 rounded-full flex items-center gap-2.5 shadow-sm border border-aurora-border">
          {[
            { id: 'RT-01', name: 'Sleeping', activeColor: 'bg-slate-400 ring-2 ring-slate-300' },
            { id: 'RT-02', name: 'Welcome', activeColor: 'bg-stone-800 ring-2 ring-stone-600' },
            { id: 'RT-03', name: 'Listening', activeColor: 'bg-emerald-500 ring-2 ring-emerald-300 animate-pulse' },
            { id: 'RT-04', name: 'Processing', activeColor: 'bg-sky-500 ring-2 ring-sky-300 animate-pulse' },
            { id: 'RT-05', name: 'Directions', activeColor: 'bg-amber-500 ring-2 ring-amber-300' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setCurrentState(st.id)}
              className={`w-3 h-3 rounded-full transition-all cursor-pointer ${
                currentState === st.id ? st.activeColor : 'bg-stone-300 hover:bg-stone-400'
              }`}
              title={`${st.id}: ${st.name}`}
            />
          ))}
        </div>

        {/* Center: Chế độ Tự Nghe (Auto-Listen toggle) */}
        <button
          type="button"
          onClick={() => setIsAutoListen(!isAutoListen)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
            isAutoListen
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-stone-100 text-stone-600 border-stone-300'
          }`}
        >
          {isAutoListen ? '🟢 Tự động nghe tiếp: Bật' : '⚪ Tự động nghe tiếp: Tắt'}
        </button>

        {/* Right: Nút Đăng Xuất Bảo Mật */}
        <button
          type="button"
          onClick={() => {
            setLogoutError('');
            setLogoutPassword('');
            setShowLogoutModal(true);
          }}
          title="Đăng xuất Robot"
          className="w-10 h-10 rounded-full bg-white hover:bg-stone-100 border border-aurora-border text-stone-700 flex items-center justify-center shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </footer>

      {/* Modal Mật Khẩu Đăng Xuất Robot */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-aurora-border text-aurora-primary rounded-3xl p-7 max-w-md w-full shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowLogoutModal(false)}
              className="absolute top-4 right-4 text-xs font-bold text-stone-400 hover:text-stone-700 transition-colors cursor-pointer px-2 py-1"
            >
              Đóng
            </button>

            <div className="space-y-1 border-b border-stone-100 pb-4">
              <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                <Shield className="w-5 h-5 text-stone-700" />
                <span>Mật Khẩu Đăng Xuất Robot</span>
              </h3>
              <p className="text-xs text-stone-500 font-medium">Bảo vệ màn hình Kiosk khỏi thoát ứng dụng trái phép</p>
            </div>

            {logoutError && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {logoutError}
              </div>
            )}

            <form onSubmit={handleProtectedLogoutSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                  Mật khẩu Bảo vệ
                </label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu (Mặc định: 123456)"
                  value={logoutPassword}
                  onChange={(e) => setLogoutPassword(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs font-bold text-stone-900 outline-none focus:border-stone-600 transition-colors"
                />
                <p className="text-[11px] text-stone-500 font-medium mt-2">
                  Mật khẩu mẫu: <code className="text-stone-800 font-bold">123456</code> hoặc <code className="text-stone-800 font-bold">aurora2026</code>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-aurora-primary hover:bg-stone-800 text-aurora-textInverse font-bold text-xs transition-all shadow-sm cursor-pointer"
                >
                  Xác Nhận Đăng Xuất
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RobotScreenPage;
