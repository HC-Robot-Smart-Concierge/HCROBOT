import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RobotFace } from '../../components/robot/RobotFace';
import { AudioWave } from '../../components/robot/AudioWave';
import { FloorMap, HOTEL_DESTINATIONS, getMobileGuestMapUrl } from '../../components/robot/FloorMap';
import { PhoneCall, Sparkles, RefreshCw, Smartphone, QrCode, Clock, Utensils, Star, Building, Navigation, Film, Menu, Globe, Check, Volume2, X, Mic } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CameraPreview } from '../../components/robot/CameraPreview';
import { MobileRobotScreen } from '../../components/robot/MobileRobotScreen';
import { RobotFoodMenuScreen } from '../../components/robot/RobotFoodMenuScreen';
import { useWorkflowRunner } from '../../hooks/useWorkflowRunner';
import { KioskDisplayPreview } from '../admin/tabs/workflow/KioskDisplayPreview';
import { fetchWorkflows } from '../../services/workflowApi';
import { useNotificationWebSocket } from '../../hooks/useNotificationWebSocket';

import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { sendChatPrompt, sendChatStreamSSE, resetSession, flushSession, getVoiceSettings } from '../../services/aiApi';

import { MessengerVideoCallModal } from '../../components/video/MessengerVideoCallModal';
import { RobotQuickFeedbackModal } from '../../components/robot/RobotQuickFeedbackModal';
import { RobotFacilitiesModal } from '../../components/robot/RobotFacilitiesModal';
import { createConciergeRequest } from '../../services/conciergeApi';
import { fetchActiveAdvertisements } from '../../services/advertisementApi';
import { RobotAdPlayer } from '../../components/robot/RobotAdPlayer';

/**
 * FloatingCinemaSubtitle
 * Phụ đề động tinh giản (Floating Subtitle / Cinema Captions) cho Robot Kiosk 5 sao
 * - Dải kính mờ thanh thoát: backdrop-blur-md bg-stone-900/60 border border-stone-700/50 rounded-2xl
 * - Cỡ chữ to rõ 16px - 18px, giới hạn tối đa 2 dòng chữ
 * - Tự động tách câu và chuyển câu mượt mà theo nhịp giọng nói
 */
const FloatingCinemaSubtitle = ({ fullText, isSpeaking, onClose }) => {
  const sentences = useMemo(() => {
    if (!fullText) return [];
    const raw = String(fullText).trim();
    const split = raw
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return split.length > 0 ? split : [raw];
  }, [fullText]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset về câu đầu tiên khi đoạn text mới được nhận
  useEffect(() => {
    setCurrentIndex(0);
  }, [fullText]);

  // Chuyển câu mượt mà theo nhịp nói khi robot đang phát âm thanh
  useEffect(() => {
    if (!isSpeaking || sentences.length <= 1) return;

    const currentSentence = sentences[currentIndex] || '';
    const duration = Math.min(6000, Math.max(2500, currentSentence.length * 65));

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1 < sentences.length ? prev + 1 : prev));
    }, duration);

    return () => clearTimeout(timer);
  }, [currentIndex, isSpeaking, sentences]);

  const activeSentence = sentences[currentIndex] || fullText;

  return (
    <div
      className="relative mt-4 sm:mt-5 w-[640px] max-w-[92vw] px-6 py-3.5 bg-stone-900/60 backdrop-blur-md border border-stone-700/50 rounded-2xl shadow-xl flex items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300 z-20 group"
      role="region"
      aria-label="Phụ đề lời thoại của robot"
    >
      {/* Chỉ báo phát âm thanh mini & số câu */}
      <div className="absolute left-3.5 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
        <span
          className={`w-2 h-2 rounded-full transition-colors ${
            isSpeaking ? 'bg-stone-300 animate-pulse' : 'bg-stone-500'
          }`}
          title={isSpeaking ? 'Đang phát qua loa' : 'Đã phát xong'}
        />
        {sentences.length > 1 && (
          <span className="text-[10px] font-mono text-stone-400">
            {currentIndex + 1}/{sentences.length}
          </span>
        )}
      </div>

      {/* Dòng chữ phụ đề điện ảnh: Cỡ chữ 16px - 18px, giới hạn tối đa 2 dòng chữ */}
      <p
        key={currentIndex}
        className="text-base sm:text-[17px] font-medium text-stone-100 leading-snug sm:leading-relaxed tracking-wide px-7 select-text animate-in fade-in slide-in-from-bottom-1 duration-300 line-clamp-2"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {activeSentence}
      </p>

      {/* Nút đóng phụ đề tinh giản */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 w-5 h-5 rounded-full hover:bg-stone-800/80 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Ẩn phụ đề"
          aria-label="Ẩn phụ đề"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export const RobotScreenPage = ({ onLogout = () => { } }) => {
  // States: 'RT-01' | 'RT-02' | 'RT-03' | 'RT-04' | 'RT-05'
  const [currentState, setCurrentState] = useState('RT-01');
  const [navigationDestinationKey, setNavigationDestinationKey] = useState('infinity_pool');

  // Giữ mã QR URL cố định để không bị giật ma trận khi đồng hồ 8s đếm ngược re-render
  const qrMapUrl = useMemo(() => {
    return getMobileGuestMapUrl(navigationDestinationKey);
  }, [navigationDestinationKey]);

  const [language, setLanguage] = useState('Tiếng Việt');
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

  // Auto-Listen Hands-Free State
  const [isAutoListen, setIsAutoListen] = useState(true);
  const silenceTimerRef = useRef(null);
  const wasSpeakingRef = useRef(false);
  const routeGuidanceTimerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const processingSafetyTimerRef = useRef(null);
  const activeChatRequestIdRef = useRef(0);
  const chatAbortControllerRef = useRef(null);

  // Auto QR Modal 8s Countdown States & Refs for Route Guidance
  const [isAutoQrModalOpen, setIsAutoQrModalOpen] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(null);
  const qrStageTimerRef = useRef(null);
  const qrCountdownIntervalRef = useRef(null);

  // Helper dọn dẹp sạch sẽ tất cả timer của luồng chỉ đường & QR
  const clearRouteGuidanceTimers = useCallback(() => {
    if (routeGuidanceTimerRef.current) {
      clearTimeout(routeGuidanceTimerRef.current);
      routeGuidanceTimerRef.current = null;
    }
    if (qrStageTimerRef.current) {
      clearTimeout(qrStageTimerRef.current);
      qrStageTimerRef.current = null;
    }
    if (qrCountdownIntervalRef.current) {
      clearInterval(qrCountdownIntervalRef.current);
      qrCountdownIntervalRef.current = null;
    }
    setIsAutoQrModalOpen(false);
    setQrCountdown(null);
  }, []);

  // Standby Poster Mode (Tự động chiếu quảng cáo khi rảnh rỗi không tương tác)
  const [isStandby, setIsStandby] = useState(false);
  const STANDBY_IDLE_TIMEOUT_MS = 60000; // 60 giây rảnh rỗi ở trạng thái RT-01 mới tự động bật Standby
  const CONVERSATION_IDLE_TIMEOUT_MS = 45000; // 45 giây im lặng trong phiên hội thoại sẽ tự động kết thúc phiên về RT-01
  const lastInteractionTimeRef = useRef(Date.now());

  // Active Advertisements state (Lưu trữ và đồng bộ với Cloudinary & Admin)
  const [activeAds, setActiveAds] = useState([]);
  const [pushedAd, setPushedAd] = useState(null);

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

  // Lắng nghe lệnh đẩy quảng cáo từ Admin qua WebSocket
  useNotificationWebSocket({
    department: 'All',
    onNotificationReceived: (event) => {
      if (event && event.type === 'ADVERTISEMENT_PUSH' && event.advertisement) {
        setPushedAd(event.advertisement);
        setIsStandby(true);
      }
    },
  });

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

  // 5-Star Hotel Facilities Directory Modal State
  const [isFacilitiesModalOpen, setIsFacilitiesModalOpen] = useState(false);

  // Dynamic Robot Eye Expression State (look_up, look_left, look_right, look_around)
  const [activeEyeExpression, setActiveEyeExpression] = useState(null);
  const eyeExpressionTimeoutRef = useRef(null);

  const triggerEyeExpression = useCallback((expr, duration = 3800) => {
    if (!expr || expr === 'none') return;
    if (eyeExpressionTimeoutRef.current) {
      clearTimeout(eyeExpressionTimeoutRef.current);
    }
    setActiveEyeExpression(expr);
    eyeExpressionTimeoutRef.current = setTimeout(() => {
      setActiveEyeExpression(null);
    }, duration);
  }, []);

  // Available Workflows State (for AUTO_DETECT and manual triggers)
  const [availableWorkflows, setAvailableWorkflows] = useState([]);
  const [showWorkflowMenu, setShowWorkflowMenu] = useState(false);

  // Hooks
  const { isListening, transcript, error: speechError, startListening, stopListening, resetTranscript, hasSupport, volumeLevel } = useSpeechRecognition();
  const { speak, prime, cancel: stopSpeaking, isSpeaking, speechRate, updateSpeechRate } = useSpeechSynthesis();

  // Đồng bộ thời gian thực trạng thái phát âm thanh để chống stale closure
  const isSpeakingRef = useRef(false);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const toggleLanguage = useCallback((targetLang) => {
    if (typeof targetLang === 'string' && (targetLang === 'English' || targetLang === 'Tiếng Việt')) {
      setLanguage(targetLang);
      return;
    }
    setLanguage((prev) => (prev === 'English' ? 'Tiếng Việt' : 'English'));
  }, []);

  // Tự động khởi động lại SpeechRecognition với ngôn ngữ mới khi language thay đổi
  useEffect(() => {
    if (isListening && currentState === 'RT-03') {
      startListening(language, {
        onFinal: (finalText) => {
          if (finalText && finalText.trim().length > 0) {
            setIsStandby(false);
            lastInteractionTimeRef.current = Date.now();
            handleStopTalkAndProcess(finalText.trim());
          }
        },
      });
    }
  }, [language]);

  const [guestEmotion, setGuestEmotion] = useState('neutral');

  // Load available workflows for AUTO_DETECT trigger & manual launcher
  useEffect(() => {
    fetchWorkflows()
      .then((data) => {
        if (Array.isArray(data)) setAvailableWorkflows(data);
      })
      .catch((err) => console.warn('Could not load workflows:', err));
  }, []);

  // Sync global robot voice settings from Backend (fetch once on mount)
  useEffect(() => {
    getVoiceSettings()
      .then((data) => {
        if (data?.speech_rate) {
          updateSpeechRate(data.speech_rate);
        }
      })
      .catch((err) => console.warn('Could not fetch voice settings:', err));
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
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Listen to BroadcastChannel (đã tắt tự động chạy kịch bản để ưu tiên giao tiếp trực tiếp)
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel('hcrobot_workflow_channel');
      bc.onmessage = (_event) => {
        // Đã tắt tự động trigger kịch bản để tập trung giao tiếp bình thường
      };
    } catch {
      // BroadcastChannel fallback
    }
    return () => {
      if (bc) bc.close();
    };
  }, []);

  // Listen to WebSocket Hub (đã tắt tự động chạy kịch bản từ xa)
  useNotificationWebSocket({
    department: 'All',
    onNotificationReceived: (_notif) => {
      // Đã tắt tự động trigger kịch bản để tập trung giao tiếp bình thường
    },
    enabled: true,
  });

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
    flushSession(sessionId).catch(() => { });
    setCurrentState('RT-02');
  }, [sessionId, speak]);

  // Xóa bộ nhớ phiên (Dùng cho nút Khách Mới / Đổi Phòng)
  const handleManualResetSession = async () => {
    activeChatRequestIdRef.current += 1;
    if (chatAbortControllerRef.current) {
      try { chatAbortControllerRef.current.abort(); } catch (e) {}
      chatAbortControllerRef.current = null;
    }
    if (processingSafetyTimerRef.current) clearTimeout(processingSafetyTimerRef.current);
    isProcessingRef.current = false;
    setIsProcessing(false);
    clearRouteGuidanceTimers();
    stopSpeaking();
    stopListening();
    resetTranscript();
    setActiveRoomNumber(null);
    setAiResponseText('');
    await resetSession(sessionId);
    setCurrentState('RT-02');
  };

  const handleStopSpeaking = () => {
    activeChatRequestIdRef.current += 1;
    if (chatAbortControllerRef.current) {
      try { chatAbortControllerRef.current.abort(); } catch (e) {}
      chatAbortControllerRef.current = null;
    }
    clearRouteGuidanceTimers();
    stopSpeaking();
    setAiResponseText('');
    setCurrentState('RT-03');
  };

  // Tự động chuyển sang Poster Standby khi rảnh rỗi không có người tương tác
  const resetStandbyTimer = useCallback(() => {
    lastInteractionTimeRef.current = Date.now();
    if (isStandby) {
      setIsStandby(false);
    }
  }, [isStandby]);

  // Bộ giám sát thời gian rảnh rỗi độc lập: kiểm tra mỗi 1 giây
  useEffect(() => {
    const checkIdleInterval = setInterval(() => {
      // 1. Kiểm tra trạng thái đang bận giao tiếp hoặc tương tác:
      // - Đang phát âm thanh qua loa (isSpeaking)
      // - AI đang xử lý suy luận (isProcessing)
      // - Micro đang chủ động lắng nghe (isListening)
      // - Khách đang nói vào micro (transcript có nội dung)
      // - Câu trả lời AI đang hiển thị trên màn hình (aiResponseText)
      // - Kịch bản workflow đang diễn ra (isWorkflowRunning)
      // - Các modal / popup đang mở (thực đơn, tiện ích, gọi video, feedback, menu nhanh, ngôn ngữ, qr...)
      const isUserTalking = Boolean(transcript && transcript.trim().length > 0);
      const hasAiResponse = Boolean(aiResponseText && aiResponseText.trim().length > 0);
      const isModalOpen = (
        isFoodMenuOpen ||
        isFacilitiesModalOpen ||
        isVideoCallOpen ||
        isFeedbackModalOpen ||
        showLogoutModal ||
        showQuickMenu ||
        showLangMenu ||
        isAutoQrModalOpen
      );

      const isBusy = (
        isSpeaking ||
        isProcessing ||
        isListening ||
        isUserTalking ||
        hasAiResponse ||
        isWorkflowRunning ||
        isModalOpen
      );

      if (isBusy) {
        lastInteractionTimeRef.current = Date.now();
        return;
      }

      const idleDuration = Date.now() - lastInteractionTimeRef.current;

      // 2. Nếu đang trong phiên hội thoại (RT-02, RT-03, RT-04, RT-05) nhưng khách im lặng quá lâu:
      if (currentState !== 'RT-01') {
        if (idleDuration >= CONVERSATION_IDLE_TIMEOUT_MS) {
          // Tự động kết thúc phiên hội thoại một cách lịch sự về chế độ ngủ nhẹ RT-01
          stopSpeaking();
          stopListening();
          resetTranscript();
          setAiResponseText('');
          setCurrentState('RT-01');
          lastInteractionTimeRef.current = Date.now();
        }
        return; // Tuyệt đối KHÔNG tự ý bật quảng cáo khi chưa về trạng thái RT-01
      }

      // 3. Khi robot đã ở trạng thái ngủ nhẹ RT-01 và rảnh rỗi hoàn toàn
      if (currentState === 'RT-01' && !isStandby) {
        if (idleDuration >= STANDBY_IDLE_TIMEOUT_MS) {
          setIsStandby(true);
        }
      }
    }, 1000);

    const handleUserActivity = () => {
      lastInteractionTimeRef.current = Date.now();
      if (isStandby) {
        setIsStandby(false);
      }
    };

    window.addEventListener('click', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    window.addEventListener('pointerdown', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity);

    return () => {
      clearInterval(checkIdleInterval);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('pointerdown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [
    isSpeaking,
    isProcessing,
    isListening,
    transcript,
    aiResponseText,
    isWorkflowRunning,
    isFoodMenuOpen,
    isFacilitiesModalOpen,
    isVideoCallOpen,
    isFeedbackModalOpen,
    showLogoutModal,
    showQuickMenu,
    showLangMenu,
    isAutoQrModalOpen,
    isStandby,
    currentState,
    stopSpeaking,
    stopListening,
    resetTranscript,
  ]);

  // Voice Wake-up: Tự động tắt quảng cáo ngay lập tức và giữ phiên khi khách cất lời gọi robot
  useEffect(() => {
    if (transcript && transcript.trim().length > 0) {
      lastInteractionTimeRef.current = Date.now();
      if (isStandby) {
        setIsStandby(false);
        if (currentState === 'RT-01') {
          setCurrentState('RT-03');
        }
      }
    }
  }, [isStandby, transcript, currentState]);

  // Dừng nhận diện giọng nói nền và giọng đọc AI khi đang mở Video Call trực tiếp
  useEffect(() => {
    if (isVideoCallOpen) {
      stopSpeaking();
      stopListening();
    }
  }, [isVideoCallOpen, stopSpeaking, stopListening]);

  // Tự động gửi AI khi người dùng ngừng nói 900ms (VAD Silence Detection tự nhiên, phản hồi siêu tốc như commit b5499898)
  useEffect(() => {
    if (
      !isVideoCallOpen &&
      isListening &&
      !isSpeaking &&
      !isSpeakingRef.current &&
      !isProcessingRef.current &&
      !isProcessing &&
      (currentState === 'RT-03' || currentState === 'RT-05') &&
      transcript &&
      transcript.trim().length > 0
    ) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const textToProcess = transcript.trim();
        resetTranscript();
        handleStopTalkAndProcess(textToProcess);
      }, 900);
    }
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [transcript, currentState, isListening, isSpeaking, isProcessing, isVideoCallOpen]);

  // Khi người dùng lại gần Camera -> Tắt Standby, chuyển về trạng thái sẵn sàng giao tiếp trực tiếp
  const handleGuestApproached = () => {
    setIsStandby(false);
    resetStandbyTimer();

    // Dừng kịch bản ngay lập tức nếu đang có kịch bản chạy
    if (isWorkflowRunning) {
      stopWorkflow();
    }

    if (currentState === 'RT-01') {
      setCurrentState('RT-02');
      if (isAutoListen) {
        setTimeout(() => {
          handleStartTalk();
        }, 500);
      }
    }
  };

  // Khi người dùng đi xa khỏi Camera -> Đóng gói lưu DB, dọn dẹp âm thanh & chuyển sang ngủ nhẹ (RT-01)
  const handleGuestLeft = async () => {
    // Tuyệt đối KHÔNG ngắt khi robot đang nói, đang xử lý câu trả lời, hoặc đang hiển thị nội dung
    if (
      isSpeaking ||
      isSpeakingRef.current ||
      isProcessing ||
      isProcessingRef.current ||
      Boolean(aiResponseText) ||
      currentState === 'RT-05' ||
      isWorkflowRunning
    ) {
      return;
    }

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
    setLastUserPrompt('');
    resetSession(sessionId);
    setCurrentState('RT-01');
  };

  // 1. Khi kích hoạt lắng nghe (Bấm nút hoặc Tự động)
  const handleStartTalk = () => {
    if (isVideoCallOpen) return;
    lastInteractionTimeRef.current = Date.now();
    if (isStandby) setIsStandby(false);
    activeChatRequestIdRef.current += 1;
    if (chatAbortControllerRef.current) {
      try { chatAbortControllerRef.current.abort(); } catch (e) {}
      chatAbortControllerRef.current = null;
    }
    clearRouteGuidanceTimers();
    if (processingSafetyTimerRef.current) clearTimeout(processingSafetyTimerRef.current);
    isProcessingRef.current = false;
    setIsProcessing(false);
    prime();
    stopSpeaking();
    resetTranscript();
    setAiResponseText('');
    setCurrentState('RT-03');
    startListening(language, {
      onFinal: (finalText) => {
        if (finalText && finalText.trim().length > 0) {
          setIsStandby(false);
          lastInteractionTimeRef.current = Date.now();
          handleStopTalkAndProcess(finalText.trim());
        }
      },
    });
  };

  // Tự động bật mic khi mở màn hình robot (khi vừa vào)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isVideoCallOpen && !isListening && !isSpeaking && !isProcessing && currentState !== 'RT-05' && !isStandby) {
        handleStartTalk();
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [isVideoCallOpen]);

  // 2. Gửi tới Ollama RAG Backend
  const handleStopTalkAndProcess = async (userText) => {
    lastInteractionTimeRef.current = Date.now();
    if (isStandby) setIsStandby(false);
    if (isProcessingRef.current || isSpeakingRef.current || isSpeaking) return;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const query = (userText || transcript || '').trim();

    if (!query || query.length === 0) {
      if (currentState !== 'RT-05') {
        setCurrentState('RT-02');
      }
      return;
    }

    setLastUserPrompt(query);

    const currentChatId = ++activeChatRequestIdRef.current;
    if (chatAbortControllerRef.current) {
      try { chatAbortControllerRef.current.abort(); } catch (e) {}
      chatAbortControllerRef.current = null;
    }
    chatAbortControllerRef.current = new AbortController();
    const chatSignal = chatAbortControllerRef.current.signal;

    clearRouteGuidanceTimers();
    stopSpeaking();

    isProcessingRef.current = true;
    setIsProcessing(true);

    // Safety timeout: tự động giải phóng sau 14 giây nếu AI hoặc âm thanh bị treo
    if (processingSafetyTimerRef.current) clearTimeout(processingSafetyTimerRef.current);
    processingSafetyTimerRef.current = setTimeout(() => {
      if (isProcessingRef.current) {
        console.warn('[SafetyTimeout] Auto-unlocking stuck isProcessing state');
        activeChatRequestIdRef.current += 1;
        if (chatAbortControllerRef.current) {
          try { chatAbortControllerRef.current.abort(); } catch (e) {}
          chatAbortControllerRef.current = null;
        }
        clearRouteGuidanceTimers();
        stopSpeaking();
        isProcessingRef.current = false;
        setIsProcessing(false);
        if (!isSpeaking) {
          setCurrentState((prev) => (prev === 'RT-04' ? 'RT-02' : prev));
        }
      }
    }, 14000);

    stopListening();
    resetTranscript();

    const lowerQuery = query.toLowerCase();

    // Xử lý đóng bản đồ chỉ đường RT-05 / Modal QR bằng giọng nói khi khách nói "ok tôi đã nhớ" / "cảm ơn"
    if (currentState === 'RT-05' || isAutoQrModalOpen) {
      const isDismissDirectionsPhrase = [
        'đã nhớ', 'nhớ rồi', 'tôi nhớ', 'ok tôi', 'hiểu rồi', 'tôi hiểu',
        'cảm ơn', 'cảm ơn em', 'cảm ơn robot', 'thank', 'thanks', 'xong rồi',
        'được rồi', 'biết rồi', 'ok rora', 'ok robot', 'ok em', 'dạ rồi', 'đóng'
      ].some((k) => lowerQuery.includes(k));

      if (isDismissDirectionsPhrase) {
        clearRouteGuidanceTimers();
        const ackText = language === 'English'
          ? 'You are welcome! Have a wonderful experience at Aurora Grand Hotel.'
          : 'Dạ vâng, chúc quý khách đi đường thuận tiện và có trải nghiệm tuyệt vời ạ!';

        speak(
          ackText,
          language === 'English' ? 'en-US' : 'vi-VN',
          () => {
            isProcessingRef.current = false;
            setIsProcessing(false);
            resetToIdle();
          },
          () => {
            setAiResponseText(ackText);
          }
        );
        return;
      }
    }

    // Mở menu thực đơn nếu khách yêu cầu đặt món
    if (lowerQuery.includes('đặt món') || lowerQuery.includes('chọn món') || lowerQuery.includes('thực đơn') || lowerQuery.includes('menu') || lowerQuery.includes('gọi món') || lowerQuery.includes('room service') || lowerQuery.includes('đồ ăn')) {
      setIsFoodMenuOpen(true);
    }

    // Mở danh mục cơ sở vật chất nếu khách hỏi tiện ích / dịch vụ khách sạn
    if (lowerQuery.includes('cơ sở vật chất') || lowerQuery.includes('tiện ích') || lowerQuery.includes('khách sạn có gì') || lowerQuery.includes('dịch vụ gì')) {
      setIsFacilitiesModalOpen(true);
    }

    setCurrentState('RT-04');

    try {
      // Gửi toàn bộ truy vấn tới RAG Backend duy nhất (Single Source of Truth)
      const chatRes = await sendChatPrompt(query, null, "auto", guestEmotion, sessionId, activeRoomNumber, chatSignal);

      // Nếu người dùng đã kích hoạt câu nói mới, ngắt lời hoặc timeout xảy ra -> Hủy bỏ câu cũ
      if (currentChatId !== activeChatRequestIdRef.current || chatRes?.aborted) {
        return;
      }

      const replyText = chatRes.response || 'Dạ, tôi đã ghi nhận yêu cầu của quý khách.';
      const detectedLang = chatRes.detected_language || 'Tiếng Việt';
      const langCode = chatRes.lang_code || (detectedLang === 'English' ? 'en-US' : 'vi-VN');
      const currentLang = langCode;

      const updatedRoom = chatRes.current_room_number;
      if (updatedRoom) {
        setActiveRoomNumber(updatedRoom);
      }

      setLanguage(detectedLang);

      // Tự động mở video call nếu nhận diện ý định gọi nhân viên
      if (chatRes.trigger_video_call) {
        const canonicalCode = chatRes.ticket_code || chatRes.support_session_id || chatRes.session_id || sessionId;
        setVideoCallSessionId(canonicalCode);
        setVideoCallTicketCode(chatRes.ticket_code || canonicalCode);
        setIsVideoCallOpen(true);
      }

      // ĐỒNG BỘ BẢN ĐỒ KHI RAG BACKEND PHÁT HIỆN YÊU CẦU CHỈ ĐƯỜNG (destination_key)
      const navTargetKey = chatRes.destination_key;
      const isRouteGuidance = Boolean(navTargetKey);

      if (isRouteGuidance) {
        setNavigationDestinationKey(navTargetKey);
        setCurrentState('RT-05');
      }

      // Cử động mắt sinh động theo kịch bản Admin thiết lập hoặc nhận diện từ khóa tự nhiên
      if (chatRes.eye_expression && chatRes.eye_expression !== 'none') {
        triggerEyeExpression(chatRes.eye_expression);
      } else {
        if (['nhìn lên', 'ngước lên', 'đánh mắt lên', 'trên trần', 'đèn trần', 'tầng trên', 'thời tiết hôm nay', 'bầu trời', 'look up'].some(k => lowerQuery.includes(k))) {
          triggerEyeExpression('look_up');
        } else if (['bên trái', 'phía trái', 'liếc trái', 'rẽ trái', 'quầy bên trái', 'look left'].some(k => lowerQuery.includes(k))) {
          triggerEyeExpression('look_left');
        } else if (['bên phải', 'phía phải', 'liếc phải', 'rẽ phải', 'quầy bên phải', 'look right'].some(k => lowerQuery.includes(k))) {
          triggerEyeExpression('look_right');
        } else if (['nhìn quanh', 'đảo mắt', 'xung quanh', 'ngắm nhìn', 'tham quan', 'khách sạn có gì', 'look around'].some(k => lowerQuery.includes(k))) {
          triggerEyeExpression('look_around');
        }
      }

      const isFarewell = ['tạm biệt', 'hẹn gặp lại', 'bye', 'goodbye', 'kết thúc', 'xong rồi', 'hết rồi'].some(k => lowerQuery.includes(k));

      // 1. Hủy bỏ timer an toàn 14s cũ vì AI Backend đã phản hồi xong
      if (processingSafetyTimerRef.current) {
        clearTimeout(processingSafetyTimerRef.current);
        processingSafetyTimerRef.current = null;
      }

      // 2. Thiết lập Safety Timer động theo độ dài câu nói thực tế
      // Tối thiểu 25 giây hoặc 800ms/từ để ngăn chặn câu dài bị timer cắt cụt giữa chừng
      const wordsCount = replyText.split(/\s+/).length;
      const speechSafetyMs = Math.max(wordsCount * 800 + 10000, 25000);
      processingSafetyTimerRef.current = setTimeout(() => {
        if (isProcessingRef.current && currentChatId === activeChatRequestIdRef.current) {
          console.warn('[SafetyTimeout] Auto-unlocking stuck speech state after dynamic speech timeout');
          stopSpeaking();
          isProcessingRef.current = false;
          setIsProcessing(false);
          setAiResponseText('');
          setCurrentState((prev) => (prev === 'RT-04' ? 'RT-02' : prev));
        }
      }, speechSafetyMs);

      // 3. Phát giọng đọc duy nhất từ RAG Backend
      speak(
        replyText,
        langCode,
        () => {
          lastInteractionTimeRef.current = Date.now();
          if (processingSafetyTimerRef.current) {
            clearTimeout(processingSafetyTimerRef.current);
            processingSafetyTimerRef.current = null;
          }
          isProcessingRef.current = false;
          setIsProcessing(false);

          if (isFarewell) {
            setAiResponseText('');
            setTimeout(() => {
              handleOpenFeedback();
            }, 600);
          } else if (isRouteGuidance || currentState === 'RT-05') {
            // Request chỉ đường chính: Giữ nguyên 16 giây để khách quan sát sơ đồ lộ trình
            clearRouteGuidanceTimers();
            routeGuidanceTimerRef.current = setTimeout(() => {
              // Kết thúc 16s xem lộ trình chính -> Kích hoạt giai đoạn QR Code 15 giây ở cuối
              setIsAutoQrModalOpen(true);
              setQrCountdown(15);

              const qrVoicePrompt = (langCode === 'en-US' || detectedLang === 'English')
                ? 'You can scan the QR code on the screen to save directions on your mobile phone.'
                : 'Quý khách có thể quét mã QR trên màn hình để lưu lại chỉ dẫn đường đi trên điện thoại nhé ạ.';

              speak(
                qrVoicePrompt,
                (langCode === 'en-US' || detectedLang === 'English') ? 'en-US' : 'vi-VN',
                null,
                () => {
                  stopListening();
                  resetTranscript();
                  setAiResponseText(qrVoicePrompt);
                }
              );

              // Đếm ngược 15 giây
              let timeLeft = 15;
              qrCountdownIntervalRef.current = setInterval(() => {
                timeLeft -= 1;
                setQrCountdown(timeLeft);
                if (timeLeft <= 0) {
                  if (qrCountdownIntervalRef.current) clearInterval(qrCountdownIntervalRef.current);
                }
              }, 1000);

              // Hết đúng 15 giây -> Tự động đóng QR và đóng luôn bản đồ chỉ đường (resetToIdle)
              qrStageTimerRef.current = setTimeout(() => {
                clearRouteGuidanceTimers();
                resetToIdle();
              }, 15000);
            }, 16000);

            if (isAutoListen) {
              setTimeout(() => {
                resetTranscript();
                handleStartTalk();
              }, 400);
            }
          } else {
            setAiResponseText('');
            setCurrentState('RT-03');
            if (isAutoListen) {
              setTimeout(() => {
                resetTranscript();
                handleStartTalk();
              }, 300);
            }
          }
        },
        () => {
          stopListening();
          resetTranscript();
          setAiResponseText(replyText);
        },
        chatRes.audio_base64
      );

    } catch (error) {
      if (currentChatId !== activeChatRequestIdRef.current) {
        return;
      }
      if (processingSafetyTimerRef.current) {
        clearTimeout(processingSafetyTimerRef.current);
        processingSafetyTimerRef.current = null;
      }
      isProcessingRef.current = false;
      setIsProcessing(false);
      const fallbackText = 'Xin lỗi quý khách, không thể kết nối tới AI Server.';
      setCurrentState('RT-02');
      speak(
        fallbackText,
        language,
        () => {
          if (processingSafetyTimerRef.current) clearTimeout(processingSafetyTimerRef.current);
          isProcessingRef.current = false;
          setIsProcessing(false);
          setAiResponseText('');
          setCurrentState('RT-03');
          if (isAutoListen) handleStartTalk();
        },
        () => {
          stopListening();
          resetTranscript();
          setAiResponseText(fallbackText);
        }
      );
    }
  };

  // Tự động gửi AI khi người dùng ngừng nói 900ms (VAD Silence Detection tự nhiên, không cướp lời)
  useEffect(() => {
    if (
      isListening &&
      !isSpeaking &&
      !isProcessingRef.current &&
      !isProcessing &&
      (currentState === 'RT-03' || currentState === 'RT-05') &&
      transcript.trim().length > 0
    ) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const textToProcess = transcript.trim();
        resetTranscript();
        handleStopTalkAndProcess(textToProcess);
      }, 900);
    }
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [transcript, currentState, isListening, isSpeaking, isProcessing]);

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
    if (processingSafetyTimerRef.current) clearTimeout(processingSafetyTimerRef.current);
    isProcessingRef.current = false;
    setIsProcessing(false);
    clearRouteGuidanceTimers();
    setIsFacilitiesModalOpen(false);
    stopSpeaking();
    stopListening();
    resetTranscript();
    setAiResponseText('');
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
        activeRoomNumber={activeRoomNumber || ''}
        onClose={() => setIsFoodMenuOpen(false)}
      />
    );
  }

  // Determine Robot Face mode (supports happy/smile emotion during workflows)
  const robotFaceMode = isWorkflowRunning && (activeStep?.params?.emotion === 'happy' || activeStep?.params?.emotion === 'smile')
    ? 'happy'
    : isSpeaking
      ? 'speaking'
      : (isWorkflowRunning && (activeStep?.type === 'LISTEN' || activeStep?.type === 'COMMUNICATE'))
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
      {/* Màn hình Trình chiếu Quảng cáo Cloudinary (Khi rảnh rỗi hoặc nhận lệnh push từ Admin) */}
      <RobotAdPlayer
        isOpen={isStandby}
        onClose={() => {
          setIsStandby(false);
          resetStandbyTimer();
        }}
        ads={activeAds}
        pushedAd={pushedAd}
        onUserInteract={() => {
          setIsStandby(false);
          resetStandbyTimer();
        }}
      />

      {/* Camera AI (Chạy ngầm 100% nhận diện khách/cảm xúc; tự động nhường camera khi mở Video Call) */}
      <CameraPreview
        autoStart={!isPhoneLayout && !isVideoCallOpen}
        controlsClassName="robot-camera-control"
        onGuestApproached={handleGuestApproached}
        onGuestLeft={handleGuestLeft}
        onEmotionChange={(emotion) => setGuestEmotion(emotion)}
        source={import.meta.env.VITE_CAMERA_SOURCE || 'local'}
        streamUrl={import.meta.env.VITE_PI5_CAMERA_URL || 'http://localhost:8554/stream'}
        defaultMinimized={true}
        visible={false}
      />

      <MobileRobotScreen
        activeRoomNumber={activeRoomNumber}
        guestEmotion={guestEmotion}
        eyeExpression={activeEyeExpression}
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
        volumeLevel={volumeLevel}
        workflowTrigger={null}
        availableWorkflows={availableWorkflows}
        onStartWorkflow={startWorkflow}
        onOpenFacilities={() => {
          activeChatRequestIdRef.current += 1;
          if (chatAbortControllerRef.current) {
            try { chatAbortControllerRef.current.abort(); } catch (e) {}
            chatAbortControllerRef.current = null;
          }
          clearRouteGuidanceTimers();
          stopSpeaking();
          setIsFacilitiesModalOpen(true);
          speak('Dạ đây là toàn bộ cơ sở vật chất và tiện ích 5 sao của khách sạn ạ.');
        }}
        onOpenFoodMenu={() => {
          activeChatRequestIdRef.current += 1;
          if (chatAbortControllerRef.current) {
            try { chatAbortControllerRef.current.abort(); } catch (e) {}
            chatAbortControllerRef.current = null;
          }
          clearRouteGuidanceTimers();
          stopSpeaking();
          setIsFoodMenuOpen(true);
        }}
        onCloseAiResponse={() => setAiResponseText('')}
        navigationDestinationKey={navigationDestinationKey}
        onSelectDestination={setNavigationDestinationKey}
        showQrModalExternal={isAutoQrModalOpen}
        qrCountdown={qrCountdown}
        onCloseQrModal={() => {
          clearRouteGuidanceTimers();
          resetToIdle();
        }}
        onCallStaff={async () => {
          try {
            const req = await createConciergeRequest({
              title: 'Yêu cầu gọi video trực tiếp từ Khách tại Kiosk',
              room_number: activeRoomNumber || 'Main Lobby Kiosk',
              guest_name: 'Khách tại Sảnh',
              description: 'Khách bấm gọi hỗ trợ trực tiếp từ màn hình Robot Concierge',
            });
            const canonicalCode = req.ticket_code || req.id || `SUP-${Date.now()}`;
            setVideoCallSessionId(canonicalCode);
            setVideoCallTicketCode(req.ticket_code || canonicalCode);
            setIsVideoCallOpen(true);
          } catch (err) {
            const fallbackCode = `CCG-${Date.now()}`;
            setVideoCallSessionId(fallbackCode);
            setVideoCallTicketCode(fallbackCode);
            setIsVideoCallOpen(true);
          }
        }}
      />

      <div
        onClick={() => {
          prime();
          if (isSpeaking || isSpeakingRef.current) {
            // Không dập tắt giọng đọc robot khi chạm vào khoảng trống màn hình
            return;
          }
          if ((currentState === 'RT-02' || currentState === 'RT-01') && !isSpeaking && !isSpeakingRef.current && !isProcessing) {
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

        {/* Top-Right Controls: Nút Ngôn ngữ Địa Cầu & Nút Icon Menu Dịch Vụ */}
        <div className="absolute top-5 right-5 z-40 flex items-center gap-2">
          {/* 1. Nút Icon Địa Cầu Chuyển Ngôn Ngữ (Tiếng Việt & English) */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowLangMenu((prev) => !prev);
                setShowQuickMenu(false);
              }}
              className="w-9 h-9 rounded-full bg-stone-900/85 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/80 flex items-center justify-center shadow-lg backdrop-blur-md cursor-pointer transition-all active:scale-95"
              title="Ngôn ngữ / Language"
              aria-label="Chọn ngôn ngữ"
            >
              <Globe className="w-4 h-4 text-stone-300" />
            </button>

            {showLangMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-11 right-0 w-44 rounded-2xl bg-stone-900/95 border border-stone-700/80 shadow-2xl p-1.5 backdrop-blur-xl z-50 text-left animate-in fade-in zoom-in-95 space-y-1"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2.5 py-1 border-b border-stone-800 flex items-center justify-between">
                  <span>Ngôn ngữ</span>
                  <span className="text-[9px] text-stone-500 font-mono">LANG</span>
                </div>

                {/* Tiếng Việt */}
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('Tiếng Việt');
                    setShowLangMenu(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    language === 'Tiếng Việt'
                      ? 'bg-stone-800 text-stone-100 border border-stone-600'
                      : 'text-stone-300 hover:bg-stone-800/60 hover:text-stone-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">🇻🇳</span>
                    <span>Tiếng Việt</span>
                  </span>
                  {language === 'Tiếng Việt' && <Check className="w-3.5 h-3.5 text-stone-200" />}
                </button>

                {/* English */}
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('English');
                    setShowLangMenu(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    language === 'English'
                      ? 'bg-stone-800 text-stone-100 border border-stone-600'
                      : 'text-stone-300 hover:bg-stone-800/60 hover:text-stone-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">🇬🇧</span>
                    <span>English</span>
                  </span>
                  {language === 'English' && <Check className="w-3.5 h-3.5 text-stone-200" />}
                </button>
              </div>
            )}
          </div>

          {/* 2. Nút Icon Menu Dịch Vụ */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowQuickMenu((prev) => !prev);
                setShowLangMenu(false);
              }}
              className="w-9 h-9 rounded-full bg-stone-900/85 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/80 flex items-center justify-center shadow-lg backdrop-blur-md cursor-pointer transition-all active:scale-95"
              title="Menu Dịch vụ và Tiện ích"
              aria-label="Menu dịch vụ"
            >
              <Menu className="w-4 h-4 text-stone-300" />
            </button>

            {showQuickMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-11 right-0 w-80 rounded-2xl bg-stone-900/95 border border-stone-700/80 shadow-2xl p-2.5 space-y-1.5 backdrop-blur-xl z-50 text-left animate-in fade-in zoom-in-95"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-3 py-1 border-b border-stone-800 flex items-center justify-between">
                  <span>Menu Dịch vụ</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                </div>


                {/* 2. Cơ Sở Vật Chất & Tiện Ích 5 Sao */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuickMenu(false);
                    setIsFacilitiesModalOpen(true);
                    speak('Dạ đây là toàn bộ cơ sở vật chất và tiện ích 5 sao của khách sạn ạ.');
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
                >
                  <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
                    <Building className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Cơ sở vật chất & Tiện ích</p>
                    <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Hồ bơi vô cực, Spa, Gym, Sky Bar, Bãi xe</p>
                  </div>
                </button>

                {/* 3. Thực Đơn Món Ăn & Đặt Nhà Hàng */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuickMenu(false);
                    setIsFoodMenuOpen(true);
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
                >
                  <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
                    <Utensils className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Thực đơn món ăn</p>
                    <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Danh mục món ăn & đặt ẩm thực tại phòng</p>
                  </div>
                </button>

                {/* 4. Video & Poster Quảng Cáo Ưu Đãi */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuickMenu(false);
                    setIsStandby(true);
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
                >
                  <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
                    <Film className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Video & Poster ưu đãi</p>
                    <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Chiếu poster & clip quảng bá dịch vụ</p>
                  </div>
                </button>

                {/* 5. Gọi Lễ Tân / Nhân Viên Trực Tiếp */}
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
                      const canonicalCode = req.ticket_code || req.id || `SUP-${Date.now()}`;
                      setVideoCallSessionId(canonicalCode);
                      setVideoCallTicketCode(req.ticket_code || canonicalCode);
                      setIsVideoCallOpen(true);
                    } catch (err) {
                      const fallbackCode = `CCG-${Date.now()}`;
                      setVideoCallSessionId(fallbackCode);
                      setVideoCallTicketCode(fallbackCode);
                      setIsVideoCallOpen(true);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
                >
                  <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
                    <PhoneCall className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Gọi lễ tân trực tiếp</p>
                    <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Kết nối cuộc gọi video hỗ trợ tức thì</p>
                  </div>
                </button>

                {/* 6. Hoàn tất / Đánh Giá Dịch Vụ */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuickMenu(false);
                    handleOpenFeedback();
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
                >
                  <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
                    <Star className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Hoàn tất / Đánh giá</p>
                    <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Kết thúc phiên & khảo sát hài lòng 5 sao</p>
                  </div>
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
          {isWorkflowRunning && (activeStep?.type === 'SHOW' || activeStep?.type === 'FEEDBACK' || activeStep?.type === 'MOVE' || activeStep?.type === 'LISTEN' || activeStep?.type === 'COMMUNICATE' || activeStep?.type === 'RECOMMEND' || activeStep?.type === 'CREATE_REQUEST') ? (
            <div className="w-[700px] max-h-[610px] bg-white/98 backdrop-blur-2xl border-2 border-stone-200/90 rounded-3xl shadow-2xl p-4 sm:p-5 flex flex-col overflow-hidden animate-fadeIn">
              <KioskDisplayPreview
                activeStep={activeStep}
                transcript={transcript}
                isListening={isListening}
                silenceRemaining={30}
                onNextStep={() => {}}
              />
            </div>
          ) : currentState === 'RT-05' ? (
            <div className="w-full flex justify-between items-center gap-8 animate-fadeIn">
              {/* Left: 2D Floor Map with Google Maps style indoor wayfinding */}
              <FloorMap
                destinationKey={navigationDestinationKey}
                onSelectDestination={setNavigationDestinationKey}
                onClose={resetToIdle}
                showQrModalExternal={isAutoQrModalOpen}
                qrCountdown={qrCountdown}
                onCloseQrModal={() => {
                  clearRouteGuidanceTimers();
                  resetToIdle();
                }}
              />

              {/* Right: AI Answer & Step Instructions */}
              <div className="w-[430px] h-[558px] flex flex-col justify-between items-start gap-4 shrink-0">
                <div className="w-full flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-700 tracking-wider uppercase">
                      Lộ trình di chuyển
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-200 text-zinc-700 border border-zinc-300 uppercase">
                      {HOTEL_DESTINATIONS[navigationDestinationKey]?.floorLevel || 'TẦNG 5'}
                    </span>
                  </div>

                  {/* AI Text Response */}
                  <div className="p-4 bg-white/95 rounded-2xl border border-zinc-200 shadow-sm text-sm font-medium text-zinc-800 leading-relaxed max-h-[140px] overflow-y-auto custom-scrollbar">
                    {aiResponseText || `Lộ trình dẫn tới ${HOTEL_DESTINATIONS[navigationDestinationKey]?.name || 'điểm đến'}. Quý khách vui lòng theo dõi sơ đồ bên trái.`}
                  </div>
                </div>

                {/* Step checklist */}
                <div className="w-full flex flex-col gap-2.5">
                  <div className="p-3.5 bg-white rounded-xl border border-zinc-200 flex items-center gap-3 shadow-sm">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 text-white flex items-center justify-center font-bold text-xs shrink-0">1</div>
                    <span className="text-xs font-semibold text-zinc-800">
                      {HOTEL_DESTINATIONS[navigationDestinationKey]?.step1Text || 'Đi thẳng tới Thang máy A ở sảnh'}
                    </span>
                  </div>

                  {HOTEL_DESTINATIONS[navigationDestinationKey]?.isDifferentFloor ? (
                    <>
                      <div className="p-3.5 bg-white rounded-xl border border-zinc-200 flex items-center gap-3 shadow-sm">
                        <div className="w-7 h-7 rounded-full bg-zinc-800 text-white flex items-center justify-center font-bold text-xs shrink-0">2</div>
                        <span className="text-xs font-semibold text-zinc-800">
                          {HOTEL_DESTINATIONS[navigationDestinationKey]?.step2Text || `Ra khỏi thang máy, rẽ theo biển báo tới ${HOTEL_DESTINATIONS[navigationDestinationKey]?.name}`}
                        </span>
                      </div>
                      <div className="p-3.5 bg-zinc-100 rounded-xl border border-zinc-300 flex items-center gap-3 shadow-sm">
                        <div className="w-7 h-7 rounded-full bg-zinc-800 text-white flex items-center justify-center font-bold text-xs shrink-0">3</div>
                        <span className="text-xs font-bold text-zinc-900">
                          Đến nơi: {HOTEL_DESTINATIONS[navigationDestinationKey]?.name} ({HOTEL_DESTINATIONS[navigationDestinationKey]?.floorLevel})
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="p-3.5 bg-zinc-100 rounded-xl border border-zinc-300 flex items-center gap-3 shadow-sm">
                      <div className="w-7 h-7 rounded-full bg-zinc-800 text-white flex items-center justify-center font-bold text-xs shrink-0">2</div>
                      <span className="text-xs font-bold text-zinc-900">
                        Đến nơi: {HOTEL_DESTINATIONS[navigationDestinationKey]?.name} (Tầng Trệt)
                      </span>
                    </div>
                  )}
                </div>

                {/* Mobile QR Handoff Card (Quét QR mang theo bản đồ trên điện thoại) */}
                <div
                  onClick={() => setIsAutoQrModalOpen(true)}
                  className={`w-full p-3 bg-zinc-850 hover:bg-zinc-800 rounded-2xl border transition-all duration-300 flex items-center gap-3.5 shadow-md cursor-pointer ${isAutoQrModalOpen
                    ? 'border-zinc-400 ring-2 ring-zinc-400/40 shadow-zinc-500/20'
                    : 'border-zinc-700 hover:border-zinc-500'
                    }`}
                >
                  <div className="p-1.5 bg-white rounded-xl shrink-0 shadow-sm flex items-center justify-center border border-zinc-200">
                    <QRCodeSVG
                      value={qrMapUrl}
                      size={82}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-zinc-100 font-bold text-xs uppercase tracking-wide">
                        Quét mã QR lưu chỉ dẫn
                      </span>
                      {qrCountdown !== null && qrCountdown >= 0 && (
                        <span className="text-[10px] font-mono font-semibold text-zinc-300 bg-zinc-700/80 px-2 py-0.5 rounded border border-zinc-600">
                          {qrCountdown}s
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-300 font-normal leading-tight mt-1">
                      Quý khách có thể quét mã QR trên màn hình để ghi nhớ 2 chặng chỉ dẫn trên điện thoại nhé ạ.
                    </p>
                  </div>
                </div>

                {/* Reset Action */}
                <div className="w-full flex flex-col gap-2">
                  <button
                    onClick={resetToIdle}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 active:scale-[0.99] transition-all cursor-pointer shadow-lg"
                  >
                    <span>TÔI ĐÃ NHỚ ĐƯỜNG · ĐÓNG BẢN ĐỒ</span>
                  </button>
                  <p className="text-[11px] text-center text-stone-500 font-medium">
                    Bạn có thể nói <strong>"Ok tôi đã nhớ"</strong> hoặc <strong>"Cảm ơn"</strong> để tự động đóng bản đồ.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center relative scale-95 transition-transform duration-500">
              {/* Khuôn mặt Robot */}
              <div className="cursor-pointer">
                <RobotFace
                  mode={robotFaceMode}
                  eyeExpression={activeEyeExpression}
                  isSpeakingActive={isSpeaking}
                />
              </div>

              {/* 1. Khi đang nói (Speaking) hoặc có câu trả lời: Phụ đề động tinh giản (Floating Cinema Captions) */}
              {(aiResponseText || (isWorkflowRunning && (activeStep?.type === 'GREET' || activeStep?.type === 'SPEAK') && (activeStep.params?.speech_text || activeStep.params?.greeting_text || activeStep.params?.text))) && (
                <FloatingCinemaSubtitle
                  fullText={aiResponseText || (activeStep?.params?.speech_text || activeStep?.params?.greeting_text || activeStep?.params?.text)}
                  isSpeaking={isSpeaking}
                  onClose={() => setAiResponseText('')}
                />
              )}

              {/* 2. Khi đang nghe (Listening): Hiển thị AudioWave và trạng thái thu âm thực tế */}
              {currentState === 'RT-03' && !aiResponseText && (
                <div className="mt-6 flex flex-col items-center gap-3 animate-fadeIn">
                  <div className="px-6 py-3.5 bg-stone-900/90 backdrop-blur-xl border border-stone-700/80 rounded-2xl shadow-2xl flex items-center gap-4 text-stone-100 max-w-[620px]">
                    <AudioWave isActive={isListening} volumeLevel={volumeLevel} />
                    <div className="flex flex-col text-left min-w-[240px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Khách nói:</span>
                      </div>
                      <span className="text-sm font-bold text-stone-100">
                        {transcript ? `"${transcript}"` : (volumeLevel > 5 ? 'Đang nhận diện giọng nói...' : 'Listening... · Đang lắng nghe...')}
                      </span>
                      <span className="text-[10px] text-stone-400 font-medium flex items-center gap-1.5 mt-0.5">
                        <Globe className="w-3 h-3 text-stone-400" />
                        <span>Auto-detect VI · EN · Tự động nhận diện</span>
                      </span>
                    </div>
                  </div>
                  {speechError && (
                    <div className="px-4 py-2 bg-red-950/80 border border-red-700/80 rounded-xl text-red-200 text-xs font-medium max-w-md text-center shadow-lg">
                      {speechError}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Khi ở trạng thái chờ (RT-01 hoặc RT-02): Dùng Icon làm chỉ thị tương tác quốc tế */}
              {(currentState === 'RT-01' || currentState === 'RT-02') && !aiResponseText && !isSpeaking && (
                <div className="mt-6 flex flex-col items-center gap-2 animate-fadeIn">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartTalk();
                    }}
                    className="px-5 py-2.5 bg-stone-900/85 hover:bg-stone-800 backdrop-blur-xl border border-stone-700/80 hover:border-stone-500 rounded-full shadow-2xl flex items-center gap-3.5 cursor-pointer transition-all active:scale-95 group text-stone-300 hover:text-stone-100"
                    title="Chạm hoặc nói chuyện để bắt đầu / Touch or speak to begin"
                    aria-label="Bắt đầu giao tiếp"
                  >
                    {/* Chấm trạng thái xám sáng theo chuẩn theme hệ thống */}
                    <span className="w-2 h-2 rounded-full bg-stone-300 animate-pulse group-hover:scale-125 transition-transform" />

                    {/* Icon Micro & Chỉ thị tương tác */}
                    <div className="flex items-center gap-2 text-stone-200 group-hover:text-white transition-colors">
                      <Mic className="w-4 h-4 text-stone-300 group-hover:text-white" />
                      <span className="text-xs font-semibold tracking-wide">Touch or Speak · Chạm hoặc Nói</span>
                    </div>

                    {/* Biểu tượng đa ngôn ngữ quốc tế */}
                    <div className="flex items-center gap-1 text-[10px] text-stone-400 bg-stone-800/90 px-2 py-0.5 rounded-full border border-stone-700/60 font-mono">
                      <Globe className="w-3 h-3 text-stone-400" />
                      <span>VI · EN</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Khi đang xử lý (Processing): Hiển thị rõ câu người dùng đã nói & hiệu ứng đang suy nghĩ */}
              {currentState === 'RT-04' && !aiResponseText && (
                <div className="mt-5 px-6 py-3.5 bg-stone-900/85 backdrop-blur-md border border-stone-700/60 rounded-2xl flex flex-col items-center gap-2 shadow-xl animate-fadeIn max-w-[600px]">
                  {lastUserPrompt ? (
                    <div className="flex items-center gap-2 text-stone-200 text-sm font-semibold text-center">
                      <span className="text-stone-400 text-xs uppercase tracking-wider font-bold shrink-0">Khách hỏi:</span>
                      <span className="italic text-stone-100">"{lastUserPrompt}"</span>
                    </div>
                  ) : null}
                  <div className="text-xs font-semibold text-stone-400 tracking-wide flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-stone-400 animate-ping" />
                    <span>Rora đang suy nghĩ...</span>
                  </div>
                </div>
              )}

            </div>
          )}
        </main>

        {/* 3. Bottom Dev State Switcher (Chỉ là các hình tròn nhỏ màu xám/trung tính đại diện cho State, không chữ) */}
        <footer className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-stone-900/80 px-3.5 py-2 rounded-full flex items-center gap-3 shadow-2xl backdrop-blur-md border border-stone-800/80 z-10 transition-all duration-300 ${
          aiResponseText || isSpeaking ? 'opacity-0 pointer-events-none' : 'opacity-20 hover:opacity-100'
        }`}>
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
        sessionId={videoCallTicketCode || videoCallSessionId || sessionId}
        role="guest"
        callerName="Khách hàng"
        calleeName="Nhân viên hỗ trợ"
        roomNumber=""
        ticketCode={videoCallTicketCode}
        guestLanguage="Tiếng Việt"
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

      {/* 5-STAR HOTEL FACILITIES MODAL */}
      <RobotFacilitiesModal
        isOpen={isFacilitiesModalOpen}
        onClose={() => setIsFacilitiesModalOpen(false)}
        onNavigateToDestination={(destKey) => {
          setIsFacilitiesModalOpen(false);
          setNavigationDestinationKey(destKey);
          setCurrentState('RT-05');
          setIsAutoQrModalOpen(true);
          setQrCountdown(15);
          const destName = HOTEL_DESTINATIONS[destKey]?.name || 'tiện ích';
          speak(`Dạ đây là lộ trình tới ${destName}. Quý khách quét mã QR trên màn hình để mang theo trên điện thoại nhé ạ.`);
        }}
        onOpenFoodMenu={() => {
          setIsFacilitiesModalOpen(false);
          setIsFoodMenuOpen(true);
        }}
        onSpeak={(text) => speak(text)}
      />
    </div>
  );
};
