import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RobotFace } from '../../components/robot/RobotFace';
import { FloorMap } from '../../components/robot/FloorMap';
import { CameraPreview } from '../../components/robot/CameraPreview';
import { MobileRobotScreen } from '../../components/robot/MobileRobotScreen';
import { RobotFoodMenuScreen } from '../../components/robot/RobotFoodMenuScreen';
import { useWorkflowRunner } from '../../hooks/useWorkflowRunner';
import { KioskDisplayPreview } from '../admin/tabs/workflow/KioskDisplayPreview';
import { fetchWorkflows } from '../../services/workflowApi';
import { useNotificationWebSocket } from '../../hooks/useNotificationWebSocket';

import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { sendChatPrompt, resetSession, flushSession } from '../../services/aiApi';

import { MessengerVideoCallModal } from '../../components/video/MessengerVideoCallModal';
import { RobotQuickFeedbackModal } from '../../components/robot/RobotQuickFeedbackModal';
import { createConciergeRequest } from '../../services/conciergeApi';

export const RobotScreenPage = ({ onLogout = () => { } }) => {
  // States: 'RT-01' | 'RT-02' | 'RT-03' | 'RT-04' | 'RT-05'
  const [currentState, setCurrentState] = useState('RT-01');

  const [language, setLanguage] = useState('Tiếng Việt');
  const [aiResponseText, setAiResponseText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFoodMenuOpen, setIsFoodMenuOpen] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'food_menu' || params.get('view') === 'food_menu';
    } catch {
      return false;
    }
  });

  // Auto-Listen Hands-Free State
  const [isAutoListen, setIsAutoListen] = useState(true);
  const silenceTimerRef = useRef(null);
  const wasSpeakingRef = useRef(false);

  // Standby Poster Mode (Tự động chiếu poster Dave Drinks khi rảnh)
  const [isStandby, setIsStandby] = useState(false);
  const standbyTimerRef = useRef(null);
  const STANDBY_IDLE_TIMEOUT_MS = 25000; // 25 giây rảnh tự động vào Standby

  // Session Memory & Room Number States
  const [sessionId] = useState(() => 'session_kiosk_' + Math.random().toString(36).substring(2, 9));
  const [activeRoomNumber, setActiveRoomNumber] = useState(null);

  // Robot Kiosk Protected Logout States
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutPassword, setLogoutPassword] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [isPhoneLayout, setIsPhoneLayout] = useState(() => (
    window.matchMedia('(max-width: 767px), (max-height: 600px) and (max-width: 1024px)').matches
  ));

  // Video Call WebRTC & Cloudinary Recording States
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [videoCallSessionId, setVideoCallSessionId] = useState(null);
  const [videoCallTicketCode, setVideoCallTicketCode] = useState(null);

  // Quick Feedback Survey State
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Available Workflows State (for AUTO_DETECT and manual triggers)
  const [availableWorkflows, setAvailableWorkflows] = useState([]);

  // Hooks
  const { isListening, transcript, error: speechError, startListening, stopListening, resetTranscript, hasSupport } = useSpeechRecognition();
  const { speak, prime, cancel: stopSpeaking, isSpeaking } = useSpeechSynthesis();

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'English' ? 'Tiếng Việt' : 'English'));
  };

  const [guestEmotion, setGuestEmotion] = useState('neutral');

  // Load available workflows for AUTO_DETECT trigger & manual launcher
  useEffect(() => {
    fetchWorkflows()
      .then((data) => {
        if (Array.isArray(data)) setAvailableWorkflows(data);
      })
      .catch((err) => console.warn('Could not load workflows:', err));
  }, []);

  // Workflow Native Runner Hook (tích hợp Micro & Loa máy tính)
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

  const [showQuickMenu, setShowQuickMenu] = useState(false);

  // Listen to BroadcastChannel for zero-latency local dispatch
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel('hcrobot_workflow_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'EXECUTE_WORKFLOW' && event.data?.workflow) {
          startWorkflow(event.data.workflow);
        }
      };
    } catch {
      // BroadcastChannel fallback
    }
    return () => {
      if (bc) bc.close();
    };
  }, [startWorkflow]);

  // Listen to WebSocket Hub for remote LAN dispatch
  useNotificationWebSocket({
    department: 'All',
    onNotificationReceived: (notif) => {
      if (notif?.type === 'WORKFLOW_DISPATCH' && notif?.workflow) {
        startWorkflow(notif.workflow);
      }
    },
    enabled: true,
  });

  // Close menus on outside click
  useEffect(() => {
    if (!showQuickMenu) return;
    const handleOutsideClick = () => {
      setShowQuickMenu(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [showQuickMenu]);

  // Mở Khảo sát đánh giá dịch vụ nhanh (Feedback Survey)
  const handleOpenFeedback = useCallback(() => {
    stopSpeaking();
    stopListening();
    setIsFeedbackModalOpen(true);
    speak('Rora cảm ơn quý khách! Quý khách chấm điểm dịch vụ giúp em nhé.');
  }, [stopSpeaking, stopListening, speak]);

  const handleFeedbackCompleted = useCallback((selectedRating) => {
    setIsFeedbackModalOpen(false);
    if (selectedRating && selectedRating >= 4) {
      speak('Rora cảm ơn quý khách! Chúc quý khách kỳ nghỉ tuyệt vời.');
    } else {
      speak('Rora xin ghi nhận ý kiến để hoàn thiện hơn. Cảm ơn quý khách.');
    }
    flushSession(sessionId).catch(() => {});
    setCurrentState('RT-02');
  }, [sessionId, speak]);

  // Xóa bộ nhớ phiên (Dùng cho nút Khách Mới / Đổi Phòng)
  const handleManualResetSession = async () => {
    stopSpeaking();
    stopListening();
    resetTranscript();
    setActiveRoomNumber(null);
    setAiResponseText('');
    await resetSession(sessionId);
    setCurrentState('RT-02');
  };

  const handleStopSpeaking = () => {
    stopSpeaking();
    setAiResponseText('');
    setCurrentState('RT-03');
  };

  // Tự động chuyển sang Poster Standby khi rảnh rỗi không có người tương tác
  const resetStandbyTimer = () => {
    if (standbyTimerRef.current) clearTimeout(standbyTimerRef.current);
    if (isStandby) setIsStandby(false);

    // Chỉ đếm ngược khi ở trạng thái RT-02 hoặc RT-01 và không đang bận
    if (!isSpeaking && !isProcessing && !isListening && !isWorkflowRunning && !isFoodMenuOpen && !showLogoutModal) {
      standbyTimerRef.current = setTimeout(() => {
        setIsStandby(true);
      }, STANDBY_IDLE_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    resetStandbyTimer();
    const handleUserActivity = () => resetStandbyTimer();

    window.addEventListener('click', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);

    return () => {
      if (standbyTimerRef.current) clearTimeout(standbyTimerRef.current);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [currentState, isSpeaking, isProcessing, isListening, isWorkflowRunning, isFoodMenuOpen, showLogoutModal, isStandby]);

  // Khi người dùng lại gần Camera -> Tắt Standby, kiểm tra kịch bản AUTO_DETECT hoặc Chào hỏi chủ động theo thời gian thực
  const handleGuestApproached = () => {
    setIsStandby(false);
    resetStandbyTimer();

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
      let greeting = "Dạ em chào quý khách! Em là Rora, trợ lý Robot Concierge của khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?";
      if (hour >= 5 && hour < 11) {
        greeting = "Dạ em chào buổi sáng quý khách! Em là Rora. Chúc quý khách một ngày mới tràn đầy năng lượng tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?";
      } else if (hour >= 11 && hour < 18) {
        greeting = "Dạ em chào quý khách! Em là Rora. Chúc quý khách một buổi chiều thật vui vẻ tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?";
      } else {
        greeting = "Dạ em chào buổi tối quý khách! Em là Rora. Chúc quý khách một buổi tối thư thái tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?";
      }

      speak(
        greeting,
        'vi-VN',
        () => {
          setCurrentState('RT-03');
          if (isAutoListen) {
            handleStartTalk();
          }
        },
        () => {
          setAiResponseText(greeting);
        }
      );
    }
  };

  // Khi người dùng đi xa khỏi Camera -> Đóng gói lưu DB, dọn dẹp âm thanh & chuyển sang ngủ nhẹ (RT-01)
  const handleGuestLeft = async () => {
    if (!isProcessing) {
      stopSpeaking();
      stopListening();
      resetTranscript();
      try {
        await flushSession(sessionId);
      } catch (err) {
        console.warn('Auto-flush session on guest left:', err);
      }
      setActiveRoomNumber(null);
      setAiResponseText('');
      resetSession(sessionId);
      setCurrentState('RT-01');
    }
  };

  // 1. Khi kích hoạt lắng nghe (Bấm nút hoặc Tự động)
  const handleStartTalk = () => {
    prime();
    stopSpeaking();
    resetTranscript();
    setAiResponseText('');
    setCurrentState('RT-03');
    startListening(language);
  };

  // 2. Gửi tới Ollama RAG Backend
  const handleStopTalkAndProcess = async (userText) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    stopListening();
    const query = userText || transcript;

    if (!query || query.trim().length === 0) {
      setCurrentState('RT-02');
      return;
    }

    const lowerQuery = query.toLowerCase();

    setCurrentState('RT-04');
    setIsProcessing(true);

    try {
      // Gọi Chat AI - Backend đã tự động xử lý Intent & Ticket trong nền ngầm không gây nghẽn
      const chatRes = await sendChatPrompt(query, null, "auto", guestEmotion, sessionId, activeRoomNumber);

      let replyText = chatRes.response || 'Dạ, tôi đã ghi nhận yêu cầu của quý khách.';
      const detectedLang = chatRes.detected_language || 'Tiếng Việt';
      const langCode = chatRes.lang_code || 'vi-VN';

      const updatedRoom = chatRes.current_room_number;
      if (updatedRoom) {
        setActiveRoomNumber(updatedRoom);
      }

      setLanguage(detectedLang);
      setIsProcessing(false);
      // Hiển thị câu trả lời lên màn hình ngay lập tức (Zero Latency Visual Feedback)
      setAiResponseText(replyText);

      // TỰ ĐỘNG MỞ VIDEO CALL NẾU NHẬN DIỆN Ý ĐỊNH GỌI CHO NHÂN VIÊN
      if (chatRes.trigger_video_call) {
        const vSession = chatRes.support_session_id || chatRes.session_id || sessionId;
        setVideoCallSessionId(vSession);
        setVideoCallTicketCode(chatRes.ticket_code || 'CCG-CALL');
        setIsVideoCallOpen(true);
      }

      if (lowerQuery.includes('hồ bơi') || lowerQuery.includes('pool') || lowerQuery.includes('ở đâu') || lowerQuery.includes('tầng') || lowerQuery.includes('where')) {
        setCurrentState('RT-05');
      }

      if (lowerQuery.includes('đặt món') || lowerQuery.includes('chọn món') || lowerQuery.includes('thực đơn') || lowerQuery.includes('menu') || lowerQuery.includes('gọi món') || lowerQuery.includes('room service') || lowerQuery.includes('đồ ăn')) {
        setIsFoodMenuOpen(true);
      }

      const isFarewell = ['tạm biệt', 'hẹn gặp lại', 'bye', 'goodbye', 'kết thúc', 'xong rồi', 'hết rồi'].some(k => lowerQuery.includes(k));

      // Đồng bộ 100% thời điểm phát tiếng nói và hiển thị chữ lên màn hình (Zero Lag Sync)
      speak(
        replyText,
        langCode,
        // onEndCallback: Khi loa phát xong -> Xóa bảng chữ, hiện lại mắt xám nháy & Tự động nghe câu tiếp theo
        () => {
          setAiResponseText('');
          if (isFarewell) {
            setTimeout(() => {
              handleOpenFeedback();
            }, 600);
          } else {
            setCurrentState('RT-03');
            if (isAutoListen) {
              setTimeout(() => {
                handleStartTalk();
              }, 300);
            }
          }
        },
        // onStartCallback: Khi tiếng cất lên -> Hiện bảng chữ ở trung tâm
        () => {
          setAiResponseText(replyText);
        },
        chatRes.audio_base64
      );

    } catch (error) {
      setIsProcessing(false);
      const fallbackText = 'Xin lỗi quý khách, không thể kết nối tới AI Server.';
      setCurrentState('RT-02');
      speak(
        fallbackText,
        language,
        () => {
          setAiResponseText('');
          setCurrentState('RT-03');
          if (isAutoListen) handleStartTalk();
        },
        () => {
          setAiResponseText(fallbackText);
        }
      );
    }
  };

  // Tự động gửi AI khi người dùng ngừng nói 900ms (VAD Silence Detection tự nhiên, không cướp lời)
  useEffect(() => {
    if (currentState === 'RT-03' && transcript.trim().length > 0) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        handleStopTalkAndProcess(transcript);
      }, 900);
    }
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [transcript, currentState]);

  // Tự động bật nghe câu hỏi tiếp theo sau khi Robot nói xong (TTS completed)
  useEffect(() => {
    if (wasSpeakingRef.current && !isSpeaking && isAutoListen && !isProcessing) {
      const timer = setTimeout(() => {
        if (currentState === 'RT-02' || currentState === 'RT-05') {
          handleStartTalk();
        }
      }, 800);
      return () => clearTimeout(timer);
    }
    wasSpeakingRef.current = isSpeaking;
  }, [isSpeaking, isAutoListen, isProcessing, currentState]);

  // Xử lý an toàn khi Micro dừng hẳn (chờ thêm 600ms tránh ngắt quãng tạm thời)
  useEffect(() => {
    if (!isListening && currentState === 'RT-03' && transcript.trim().length > 0) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        handleStopTalkAndProcess(transcript);
      }, 600);
    }
  }, [isListening]);

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

  // Kiosk Protected Exit: Secret Multi-Tap (5 chạm) & Long Press (3s) & Hotkey (Ctrl+Shift+L / Esc x3)
  const secretTapCountRef = useRef(0);
  const secretTapTimerRef = useRef(null);
  const secretLongPressTimerRef = useRef(null);

  const handleSecretTrigger = useCallback(() => {
    setLogoutError('');
    setLogoutPassword('');
    setShowLogoutModal(true);
  }, []);

  const handleSecretAreaClick = useCallback((e) => {
    e.stopPropagation();
    secretTapCountRef.current += 1;
    if (secretTapTimerRef.current) clearTimeout(secretTapTimerRef.current);

    if (secretTapCountRef.current >= 5) {
      secretTapCountRef.current = 0;
      handleSecretTrigger();
      return;
    }

    secretTapTimerRef.current = setTimeout(() => {
      secretTapCountRef.current = 0;
    }, 2000);
  }, [handleSecretTrigger]);

  const handleSecretAreaTouchStart = useCallback(() => {
    secretLongPressTimerRef.current = setTimeout(() => {
      handleSecretTrigger();
    }, 3000);
  }, [handleSecretTrigger]);

  const handleSecretAreaTouchEnd = useCallback(() => {
    if (secretLongPressTimerRef.current) {
      clearTimeout(secretLongPressTimerRef.current);
    }
  }, []);

  // Keyboard Secret Shortcut: Ctrl + Shift + L hoặc 3 lần Esc
  useEffect(() => {
    let escCount = 0;
    let escTimer = null;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        handleSecretTrigger();
        return;
      }

      if (e.key === 'Escape') {
        escCount += 1;
        if (escTimer) clearTimeout(escTimer);
        if (escCount >= 3) {
          escCount = 0;
          handleSecretTrigger();
        } else {
          escTimer = setTimeout(() => {
            escCount = 0;
          }, 1500);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSecretTrigger]);

  const resetToIdle = () => {
    stopSpeaking();
    stopListening();
    resetTranscript();
    setCurrentState('RT-02');
  };

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
        lockPromise.catch(() => { });
      }
    } catch {
      // Ignore orientation lock errors
    }
    return () => {
      try {
        const unlockResult = window.screen?.orientation?.unlock?.();
        if (unlockResult && typeof unlockResult.catch === 'function') {
          unlockResult.catch(() => { });
        }
      } catch {
        // Ignore orientation unlock errors
      }
    };
  }, []);

  if (isFoodMenuOpen) {
    return (
      <RobotFoodMenuScreen
        activeRoomNumber={activeRoomNumber || '304'}
        onClose={() => setIsFoodMenuOpen(false)}
      />
    );
  }

  // Determine Robot Face mode (supports happy/smile emotion during workflows)
  const robotFaceMode = isWorkflowRunning && (activeStep?.params?.emotion === 'happy' || activeStep?.params?.emotion === 'smile')
    ? 'happy'
    : isSpeaking
    ? 'speaking'
    : (isWorkflowRunning && activeStep?.type === 'LISTEN')
    ? 'listening'
    : (isWorkflowRunning && activeStep?.type === 'GREET')
    ? 'welcome'
    : currentState === 'RT-01'
    ? 'sleeping'
    : currentState === 'RT-03'
    ? 'listening'
    : currentState === 'RT-04'
    ? 'processing'
    : 'welcome';

  return (
    <div className="w-full h-[100dvh] bg-aurora-canvas overflow-hidden font-sans select-none relative">
      {/* Màn hình Poster Standby Tự động (Quảng cáo Dave Drinks khi rảnh) */}
      {isStandby && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsStandby(false);
            resetStandbyTimer();
          }}
          className="fixed inset-0 z-50 bg-[#0F0E0E] flex items-center justify-center cursor-pointer select-none animate-fadeIn"
          title="Chạm vào màn hình để bắt đầu"
        >
          <div className="relative h-full max-h-screen flex items-center justify-center p-2 sm:p-4">
            <img
              src="/images/robot/standby-poster.jpg"
              alt="Dave Drinks Lemonade Promotion"
              className="h-full max-h-[96vh] w-auto max-w-[100vw] object-contain rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
            />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-stone-900/85 backdrop-blur-md border border-white/20 text-white text-xs font-semibold flex items-center gap-2 shadow-2xl animate-pulse">
              <span>Chạm vào màn hình để bắt đầu</span>
            </div>
          </div>
        </div>
      )}

      {/* Camera AI (Chạy ngầm 100% nhận diện khách/cảm xúc, không hiển thị trên màn hình robot) */}
      <CameraPreview
        autoStart={!isPhoneLayout}
        controlsClassName="robot-camera-control"
        onGuestApproached={handleGuestApproached}
        onGuestLeft={handleGuestLeft}
        onEmotionChange={(emotion) => setGuestEmotion(emotion)}
        source={import.meta.env.VITE_CAMERA_SOURCE || 'local'}
        streamUrl={import.meta.env.VITE_PI5_CAMERA_URL || 'http://localhost:8554/stream'}
        defaultMinimized={true}
        visible={false}
      />

      {/* Mobile Screen Component */}
      <MobileRobotScreen
        activeRoomNumber={activeRoomNumber}
        guestEmotion={guestEmotion}
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
        onStartTalk={handleStartTalk}
        onSubmitTalk={() => handleStopTalkAndProcess(transcript)}
        onStopSpeaking={handleStopSpeaking}
        onToggleAutoListen={() => setIsAutoListen((value) => !value)}
        onToggleLanguage={toggleLanguage}
        speechError={speechError}
        transcript={transcript}
        workflowTrigger={
          availableWorkflows.length > 0 ? (
            <div className="relative">
              <select
                aria-label="Kích hoạt kịch bản mẫu"
                onChange={(e) => {
                  const wf = availableWorkflows.find((w) => String(w.id) === e.target.value);
                  if (wf) startWorkflow(wf);
                  e.target.value = '';
                }}
                defaultValue=""
                className="h-8 px-2 rounded-full bg-white border border-stone-300 text-[10px] font-bold text-stone-700 outline-none cursor-pointer"
              >
                <option value="" disabled>Kịch bản</option>
                {availableWorkflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>{wf.name}</option>
                ))}
              </select>
            </div>
          ) : null
        }
        onOpenFoodMenu={() => setIsFoodMenuOpen(true)}
      />

      <div
        onClick={() => {
          prime();
          if (isSpeaking) {
            stopSpeaking();
            handleStartTalk();
            return;
          }
          if ((currentState === 'RT-02' || currentState === 'RT-01') && !isSpeaking && !isProcessing) {
            handleStartTalk();
          }
        }}
        className="robot-desktop-ui w-full h-full flex-col justify-start items-center relative cursor-pointer"
      >

        {/* Top-Left Branding & Secret Multi-Tap Zone (Nhân viên: Gõ 5 lần liên tiếp để mở Đăng xuất) */}
        <div
          onClick={handleSecretAreaClick}
          className="absolute top-5 left-6 z-40 flex items-center gap-2.5 cursor-default select-none"
          title=""
        >
          <strong className="text-xs font-black tracking-widest text-stone-400/90 uppercase">HCROBOT</strong>
          <span className="w-1.5 h-1.5 rounded-full bg-stone-600" />
          <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Aurora Grand Hotel</span>
        </div>

        {/* Top-Right Controls: Nút Kịch Bản + Hoàn Tất & Đánh Giá + Menu Dịch Vụ */}
        <div className="absolute top-5 right-5 z-40 flex items-center gap-2.5">
          {/* Quick Workflow Trigger for Testing / Simulation */}
          {availableWorkflows.length > 0 && !isWorkflowRunning && (
            <div className="relative">
              <select
                aria-label="Chọn kịch bản tự động"
                onChange={(e) => {
                  const wf = availableWorkflows.find((w) => String(w.id) === e.target.value);
                  if (wf) startWorkflow(wf);
                  e.target.value = '';
                }}
                defaultValue=""
                className="h-9 px-3 rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-200 border border-stone-700/80 text-xs font-bold tracking-wide outline-none cursor-pointer shadow-lg backdrop-blur-md"
              >
                <option value="" disabled>Kịch bản</option>
                {availableWorkflows.map((wf) => (
                  <option key={wf.id} value={wf.id} className="bg-stone-900 text-stone-200">{wf.name}</option>
                ))}
              </select>
            </div>
          )}

          {currentState !== 'RT-01' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenFeedback();
              }}
              className="h-9 px-4 rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-200 border border-stone-700/80 text-xs font-bold tracking-wide flex items-center shadow-lg backdrop-blur-md cursor-pointer transition-all active:scale-95"
              title="Hoàn tất phiên hội thoại và đánh giá dịch vụ"
            >
              <span>Hoàn tất / Đánh giá</span>
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowQuickMenu((prev) => !prev);
              }}
              className="h-9 px-4 rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-200 border border-stone-700/80 text-xs font-bold tracking-wide flex items-center shadow-lg backdrop-blur-md cursor-pointer transition-all active:scale-95"
              title="Dịch vụ và tiện ích"
            >
              <span>Dịch vụ</span>
            </button>

            {showQuickMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-11 right-0 w-60 rounded-2xl bg-stone-900/95 border border-stone-700 shadow-2xl p-2 space-y-1 backdrop-blur-xl z-50 text-left animate-in fade-in zoom-in-95"
              >
                <div className="text-[10px] font-bold uppercase text-stone-400 px-3 py-1.5 border-b border-stone-800">
                  Menu Dịch vụ
                </div>

                {/* 1. Gọi Nhân Viên */}
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setShowQuickMenu(false);
                    try {
                      const req = await createConciergeRequest({
                        title: 'Yêu cầu gọi video trực tiếp từ Khách tại Kiosk',
                        room_number: activeRoomNumber || 'Main Lobby Kiosk',
                        guest_name: 'Khách tại Sảnh',
                        description: 'Khách bấm gọi hỗ trợ trực tiếp từ màn hình Robot Concierge',
                      });
                      setVideoCallSessionId(req.id || `SUP-${Date.now()}`);
                      setVideoCallTicketCode(req.ticket_code || 'CCG-CALL');
                      setIsVideoCallOpen(true);
                    } catch (err) {
                      setVideoCallSessionId(`SUP-${Date.now()}`);
                      setIsVideoCallOpen(true);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800 transition-all cursor-pointer flex flex-col"
                >
                  <span className="text-xs font-bold text-stone-200">Gọi nhân viên</span>
                  <span className="text-[10px] text-stone-400">Kết nối cuộc gọi hỗ trợ trực tiếp</span>
                </button>

                {/* 2. Thực Đơn Món Ăn */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuickMenu(false);
                    setIsFoodMenuOpen(true);
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800 transition-all cursor-pointer flex flex-col"
                >
                  <span className="text-xs font-bold text-stone-200">Thực đơn món ăn</span>
                  <span className="text-[10px] text-stone-400">Xem danh mục và chọn món</span>
                </button>

                {/* 3. Khảo Sát Đánh Giá */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuickMenu(false);
                    handleOpenFeedback();
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800 transition-all cursor-pointer flex flex-col"
                >
                  <span className="text-xs font-bold text-stone-200">Đánh giá dịch vụ</span>
                  <span className="text-[10px] text-stone-400">Khảo sát mức độ hài lòng</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Aurora Workflow Floating Status Banner */}
        {isWorkflowRunning && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 px-5 py-2 rounded-full bg-stone-900/90 border border-stone-700 shadow-xl backdrop-blur-md flex items-center gap-3 animate-fadeIn text-stone-200">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-300 animate-pulse" />
            <span className="text-xs font-bold text-stone-200 tracking-wide uppercase">
              {activeWorkflow?.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-stone-800 text-stone-300 border border-stone-700">
              BƯỚC {currentStepIndex + 1}/{totalSteps}: {activeStep?.type}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nextStep();
              }}
              className="px-2.5 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-bold cursor-pointer transition-colors"
            >
              Tiếp
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                stopWorkflow();
              }}
              className="px-2.5 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-[10px] font-bold cursor-pointer transition-colors"
            >
              Dừng
            </button>
          </div>
        )}

        {/* 2. Main Body Container */}
        <main className="w-full flex-1 px-16 py-[54px] flex items-center justify-center gap-16 overflow-hidden">

          {/* Render Workflow Kiosk Interface trực tiếp tại trung tâm màn hình robot */}
          {isWorkflowRunning && (activeStep?.type === 'SHOW' || activeStep?.type === 'FEEDBACK' || activeStep?.type === 'MOVE' || activeStep?.type === 'LISTEN' || activeStep?.type === 'RECOMMEND' || activeStep?.type === 'CREATE_REQUEST') ? (
            <div className="w-[700px] max-h-[610px] bg-white/98 backdrop-blur-2xl border-2 border-stone-200/90 rounded-3xl shadow-2xl p-4 sm:p-5 flex flex-col overflow-hidden animate-fadeIn">
              <KioskDisplayPreview
                activeStep={activeStep}
                transcript={transcript}
                isListening={isListening}
                onNextStep={nextStep}
              />
            </div>
          ) : currentState === 'RT-05' ? (
            <div className="w-full flex justify-between items-center gap-8 animate-fadeIn">
              {/* Left: 2D Floor Map */}
              <FloorMap
                destination="SWIMMING POOL"
                destinationLevel="LEVEL 4"
                estimatedTime="4 MIN"
                estimatedDistance="APPROX. 120 M"
              />

              {/* Right: AI Answer & Step Instructions */}
              <div className="w-[450px] h-[558px] flex flex-col justify-between items-start gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-700 tracking-wider uppercase">
                    <span>Phản hồi thông tin</span>
                  </div>

                  {/* AI Text Response */}
                  <div className="p-4 bg-stone-100 rounded-2xl border border-stone-200 shadow-sm text-sm font-medium text-stone-800 leading-relaxed max-h-[160px] overflow-y-auto">
                    {aiResponseText || "Hồ bơi vô cực nằm ở tầng 4. Khăn tắm và nước uống được phục vụ miễn phí!"}
                  </div>
                </div>

                {/* Step checklist */}
                <div className="w-full flex flex-col gap-2.5">
                  <div className="p-3.5 bg-stone-100 rounded-xl border border-stone-200 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-stone-800 text-white flex items-center justify-center font-bold text-xs">1</div>
                    <span className="text-xs font-semibold text-stone-700">Đi thẳng 20m tới Cụm Thang Máy A</span>
                  </div>
                  <div className="p-3.5 bg-stone-100 rounded-xl border border-stone-200 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-stone-800 text-white flex items-center justify-center font-bold text-xs">2</div>
                    <span className="text-xs font-semibold text-stone-700">Đi Thang Máy A lên Tầng 4 (Wellness)</span>
                  </div>
                  <div className="p-3.5 bg-stone-100 rounded-xl border border-stone-200 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-stone-800 text-white flex items-center justify-center font-bold text-xs">3</div>
                    <span className="text-xs font-semibold text-stone-700">Rẽ phải theo hành lang đến Hồ Bơi</span>
                  </div>
                </div>

                {/* Reset Action */}
                <button
                  onClick={resetToIdle}
                  className="w-full py-3.5 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer shadow-lg"
                >
                  <span>Hỏi câu hỏi mới</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center relative scale-95 transition-transform duration-500">
              {/* Khuôn mặt Robot */}
              <div className="cursor-pointer">
                <RobotFace
                  mode={robotFaceMode}
                  isSpeakingActive={isSpeaking}
                />
              </div>

              {/* 1. Khi đang nói (Speaking) hoặc có câu trả lời: Hiển thị Subtitle Card trang nhã bên dưới RobotFace */}
              {(aiResponseText || (isWorkflowRunning && (activeStep?.type === 'GREET' || activeStep?.type === 'SPEAK') && (activeStep.params?.speech_text || activeStep.params?.greeting_text || activeStep.params?.text))) && (
                <div className="mt-6 w-[580px] max-w-[90vw] p-5 bg-stone-900/90 backdrop-blur-xl border border-stone-700 rounded-3xl shadow-2xl flex flex-col gap-3 animate-fadeIn text-stone-100">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                    <span className="text-xs font-bold tracking-wider uppercase text-stone-400 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-stone-300 animate-pulse' : 'bg-stone-600'}`} />
                      <span>{isSpeaking ? "Robot đang trả lời..." : "Câu trả lời của robot"}</span>
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 uppercase">
                      {language}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-stone-200 leading-relaxed max-h-[140px] overflow-y-auto custom-scrollbar">
                    {aiResponseText || (activeStep?.params?.speech_text || activeStep?.params?.greeting_text || activeStep?.params?.text)}
                  </div>

                  <div className="pt-2.5 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400 font-medium">
                    <span className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-stone-300 animate-pulse' : 'bg-stone-600'}`} />
                      <span>{isSpeaking ? "Đang phát qua loa..." : "Đã hoàn tất trả lời"}</span>
                    </span>
                    <span className="text-xs text-stone-400 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                      <span>Tự động nghe câu tiếp theo</span>
                    </span>
                  </div>
                </div>
              )}

              {/* 2. Khi đang nghe (Listening) và có Transcript: Hiển thị những gì Robot đang nhận được */}
              {currentState === 'RT-03' && !aiResponseText && transcript && (
                <div className="mt-6 px-6 py-3 bg-stone-900/85 backdrop-blur-md border border-stone-700 rounded-full shadow-lg flex items-center gap-3 animate-fadeIn">
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-300 animate-pulse" />
                  <span className="text-xs font-semibold text-stone-200">Đang nghe: "{transcript}"</span>
                </div>
              )}

              {/* 3. Khi đang xử lý (Processing): Hiển thị text trạng thái */}
              {currentState === 'RT-04' && !aiResponseText && (
                <div className="mt-4 text-xs font-bold text-stone-400 tracking-wider uppercase animate-pulse">
                  Đang tìm câu trả lời phù hợp...
                </div>
              )}

            </div>
          )}
        </main>

        {/* 3. Bottom Dev State Switcher (Chỉ là các hình tròn nhỏ màu xám/trung tính đại diện cho State, không chữ) */}
        <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-stone-900/80 px-3.5 py-2 rounded-full flex items-center gap-3 shadow-2xl backdrop-blur-md border border-stone-800/80 z-40 opacity-20 hover:opacity-100 transition-opacity duration-300">
          {[
            { id: 'RT-01', name: 'Sleeping', activeColor: 'bg-stone-300 ring-2 ring-stone-200 scale-125', idleColor: 'bg-stone-700 hover:bg-stone-600' },
            { id: 'RT-02', name: 'Welcome', activeColor: 'bg-stone-100 ring-2 ring-white scale-125', idleColor: 'bg-stone-700 hover:bg-stone-600' },
            { id: 'RT-03', name: 'Listening', activeColor: 'bg-stone-400 ring-2 ring-stone-300 scale-125 animate-pulse', idleColor: 'bg-stone-700 hover:bg-stone-600' },
            { id: 'RT-04', name: 'Processing', activeColor: 'bg-stone-300 ring-2 ring-stone-200 scale-125 animate-pulse', idleColor: 'bg-stone-700 hover:bg-stone-600' },
            { id: 'RT-05', name: 'Route Guidance', activeColor: 'bg-stone-200 ring-2 ring-stone-100 scale-125', idleColor: 'bg-stone-700 hover:bg-stone-600' },
          ].map((st) => {
            const isActive = currentState === st.id;
            return (
              <button
                key={st.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentState(st.id);
                }}
                className={`w-3 h-3 rounded-full transition-all cursor-pointer ${isActive ? st.activeColor : st.idleColor}`}
                title={`${st.id}: ${st.name}`}
              />
            );
          })}

          <div className="w-[1px] h-3.5 bg-stone-700 mx-0.5" />

          {/* Nút Standby Poster Dev Quick Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsStandby((prev) => !prev);
            }}
            className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider transition-all cursor-pointer ${isStandby
              ? 'bg-stone-200 text-stone-900 shadow-sm'
              : 'bg-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            title="Bật/Tắt Chế độ Standby Poster Quảng Cáo"
          >
            POSTER
          </button>
        </footer>

        {/* Vùng chạm bí mật góc dưới bên phải dành riêng cho nhân viên (Vô hình hoàn toàn với khách hàng)
            Nhân viên: Chạm 5 lần liên tiếp hoặc Giữ 3 giây để mở Mật khẩu Đăng xuất.
            Hoặc bấm tổ hợp phím Ctrl + Shift + L (hoặc phím Esc 3 lần). */}
        <div
          onClick={handleSecretAreaClick}
          onTouchStart={handleSecretAreaTouchStart}
          onTouchEnd={handleSecretAreaTouchEnd}
          className="absolute bottom-0 right-0 w-16 h-16 z-40 cursor-default select-none opacity-0"
          title=""
          aria-hidden="true"
        />
      </div>

      {/* Modal Bảo Mật Nhập Mật Khẩu Đăng Xuất Robot (Phong cách Trang Chủ - Màu xám / Kem, Không Icon / Emoji) */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-[#E3DFD5] text-[#1A1917] rounded-3xl p-7 max-w-md w-full shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowLogoutModal(false)}
              className="absolute top-4 right-4 text-xs font-bold text-stone-400 hover:text-stone-700 transition-colors cursor-pointer px-2 py-1"
            >
              Đóng
            </button>

            <div className="space-y-1 border-b border-[#E3DFD5] pb-4">
              <h3 className="text-base font-black text-[#1A1917] tracking-tight">Mật Khẩu Đăng Xuất Robot</h3>
              <p className="text-xs text-stone-500 font-medium">Ngăn người dùng tự ý thoát khỏi màn hình</p>
            </div>

            {logoutError && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {logoutError}
              </div>
            )}

            <form onSubmit={handleProtectedLogoutSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                  Mật khẩu Bảo vệ (Password)
                </label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu (Mặc định: 123456)"
                  value={logoutPassword}
                  onChange={(e) => setLogoutPassword(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-bold text-stone-900 outline-none focus:border-stone-600 transition-colors"
                />
                <p className="text-[11px] text-stone-500 font-medium mt-2">
                  Mật khẩu mẫu: <code className="text-stone-800 font-bold">123456</code> hoặc <code className="text-stone-800 font-bold">robot123</code>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-[#FAF8F5] hover:bg-[#E5E1D8] text-stone-700 border border-[#E0DCD3] font-bold text-xs transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-[#E5E1D8] hover:bg-[#DCD7CB] text-stone-900 border border-[#CFCABF] font-bold text-xs transition-all shadow-sm cursor-pointer"
                >
                  Xác Nhận Đăng Xuất
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MESSENGER VIDEO CALL MODAL & CLOUDINARY RECORDING */}
      <MessengerVideoCallModal
        isOpen={isVideoCallOpen}
        sessionId={videoCallSessionId || sessionId}
        role="guest"
        callerName="Khách tại Kiosk"
        calleeName="Tổng Đài Viên Concierge"
        roomNumber={activeRoomNumber || 'Main Lobby Kiosk'}
        ticketCode={videoCallTicketCode}
        onClose={() => {
          setIsVideoCallOpen(false);
          setVideoCallSessionId(null);
          setVideoCallTicketCode(null);
          setCurrentState('RT-02');
        }}
        onCallEnded={(recordRes) => {
          console.log('[RobotScreen] Call ended:', recordRes);
          setIsVideoCallOpen(false);
          setVideoCallSessionId(null);
          setVideoCallTicketCode(null);
          setCurrentState('RT-02');
        }}
      />

      {/* QUICK FEEDBACK SURVEY MODAL */}
      <RobotQuickFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        sessionId={sessionId}
        roomNumber={activeRoomNumber || 'Main Lobby Kiosk'}
        guestName="Khách tại Kiosk"
        onCompleted={handleFeedbackCompleted}
      />
    </div>
  );
};
