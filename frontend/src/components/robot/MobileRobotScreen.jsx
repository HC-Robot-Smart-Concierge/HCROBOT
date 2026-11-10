import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { AudioWave } from './AudioWave';
import { RobotFace } from './RobotFace';
import { FloorMap, HOTEL_DESTINATIONS } from './FloorMap';
import {
  Clock,
  Menu,
  ChevronDown,
  X,
  PhoneCall,
  Map as MapIcon,
  Utensils,
  Globe,
  Mic,
  Building,
  Check,
  ChevronRight,
  ConciergeBell,
  Sparkles,
  LogOut,
  Car,
  UserCheck,
  Wrench,
} from 'lucide-react';

const getRobotMode = (state, isSpeaking = false, isProcessing = false, isListening = false) => {
  if (state === 'RT-01') return 'sleeping';
  if (isProcessing || state === 'RT-04') return 'processing';
  if (isSpeaking) return 'speaking';
  if (isListening || state === 'RT-03') return 'listening';
  return 'welcome';
};

const MobileCinemaSubtitle = ({
  fullText,
  isSpeaking,
  onClose,
  onStartTalk,
  onStopSpeaking,
  onPrime,
  isEn,
}) => {
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

  useEffect(() => {
    setCurrentIndex(0);
  }, [fullText]);

  useEffect(() => {
    if (!isSpeaking || sentences.length <= 1) return;
    const currentSentence = sentences[currentIndex] || '';
    const duration = Math.min(5000, Math.max(2200, currentSentence.length * 60));
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1 < sentences.length ? prev + 1 : prev));
    }, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, isSpeaking, sentences]);

  const activeSentence = sentences[currentIndex] || fullText;

  return (
    <div
      className="relative mt-2.5 max-w-[92vw] sm:max-w-lg px-5 py-2.5 bg-stone-900/85 backdrop-blur-md border border-stone-700/60 rounded-2xl shadow-xl flex items-center justify-center text-center animate-in fade-in zoom-in-95 duration-200 z-20 group"
      role="region"
      aria-label="Phụ đề lời thoại của robot"
    >
      <div className="absolute left-3 flex items-center gap-1.5 opacity-60">
        <span
          className={`w-2 h-2 rounded-full transition-colors ${
            isSpeaking ? 'bg-stone-300 animate-pulse' : 'bg-stone-500'
          }`}
        />
        {sentences.length > 1 && (
          <span className="text-[9px] font-mono text-stone-400">
            {currentIndex + 1}/{sentences.length}
          </span>
        )}
      </div>

      <p
        key={currentIndex}
        className="text-xs sm:text-[13px] font-medium text-stone-100 leading-snug px-8 select-text animate-in fade-in duration-200 line-clamp-2"
      >
        {activeSentence}
      </p>

      {/* Cụm công cụ bên phải subtitle: Nút Micro & Nút Đóng */}
      <div className="absolute right-2.5 flex items-center gap-1.5">
        {onStartTalk && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onStopSpeaking && isSpeaking) onStopSpeaking();
              if (onPrime) onPrime();
              onStartTalk();
            }}
            className="w-6 h-6 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title={isSpeaking ? (isEn ? 'Stop and speak' : 'Dừng & Nói tiếp') : (isEn ? 'Touch or speak' : 'Chạm hoặc nói')}
            aria-label={isEn ? 'Microphone' : 'Micro'}
          >
            <Mic className="w-3 h-3 text-stone-300" />
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-6 h-6 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title={isEn ? 'Hide subtitle' : 'Ẩn phụ đề'}
            aria-label={isEn ? 'Close' : 'Đóng'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export const MobileRobotScreen = ({
  activeRoomNumber,
  guestEmotion = 'neutral',
  aiResponseText,
  spokenSubtitle = '',
  currentState = 'RT-02',
  hasSpeechSupport = true,
  isAutoListen = false,
  isListening = false,
  isProcessing = false,
  isSpeaking = false,
  language = 'Tiếng Việt',
  onLogout,
  onResetSession,
  onResetToIdle,
  onCloseDirections = null,
  onPrime = null,
  onStartTalk,
  onSubmitTalk,
  onStopSpeaking,
  onToggleAutoListen,
  onToggleLanguage,
  speechError,
  transcript,
  volumeLevel = 0,
  workflowTrigger,
  onOpenFacilities,
  onOpenFoodMenu,
  onOpenRoomService,
  onOpenMaintenance = null,
  onOpenMaintenanceStatus = null,
  onOpenOrderStatus,
  onOpenServiceStatus,
  onOpenTaxiBooking = null,
  taxiFlowStage = null,
  onSelectTaxiSelfBooking = null,
  onSelectTaxiConciergeBooking = null,
  onCancelTaxiFlow = null,
  onSubmitTaxiRoomNumber = null,
  navigationDestinationKey = 'infinity_pool',
  onSelectDestination,
  availableWorkflows = [],
  onStartWorkflow,
  onCallStaff,
  onCloseAiResponse,
  eyeExpression = null,
  showQrModalExternal = false,
  qrCountdown = null,
  onCloseQrModal = null,
}) => {
  const isEn = language === 'English';
  const [isMapManualOpen, setIsMapManualOpen] = useState(false);
  const [isUtilitiesMenuOpen, setIsUtilitiesMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [navActiveStep, setNavActiveStep] = useState(1);
  const isBusy = isProcessing || currentState === 'RT-04';

  const handleDismissMap = () => {
    setIsMapManualOpen(false);
    if (onCloseDirections) {
      onCloseDirections();
    } else if (onCloseQrModal) {
      onCloseQrModal();
    } else if (onStartTalk) {
      onStartTalk();
    } else if (onResetToIdle) {
      onResetToIdle();
    }
  };
  const displayText = aiResponseText || spokenSubtitle;
  const isNavigating = currentState === 'RT-05' || isMapManualOpen;

  const currentDestination = HOTEL_DESTINATIONS[navigationDestinationKey] || HOTEL_DESTINATIONS.restroom_ground || {
    name: 'Điểm Đến Khách Sạn',
    floorLevel: 'TẦNG TRỆT',
    time: '2 Phút',
    distance: '50m',
    step1Text: 'Đi theo chỉ dẫn hành lang.',
    step2Text: 'Đến nơi.',
    isDifferentFloor: false,
  };

  // Secret Multi-Tap Gesture (Chạm 5 lần liên tiếp trong 2s để mở đăng xuất chuẩn Kiosk)
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  const handleSecretTap = useCallback((e) => {
    e?.stopPropagation?.();
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      if (typeof onLogout === 'function') {
        onLogout();
      }
      return;
    }

    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 2000);
  }, [onLogout]);


  // Tự động mở khóa audio khi người dùng chạm lần đầu (tuân thủ iOS Audio Gesture Policy)
  const hasPrimedAudioRef = useRef(false);
  useEffect(() => {
    const handleFirstTouch = () => {
      if (hasPrimedAudioRef.current) return;
      hasPrimedAudioRef.current = true;
      if (typeof onPrime === 'function') {
        onPrime();
      }
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('click', handleFirstTouch);
    };

    window.addEventListener('touchstart', handleFirstTouch, { passive: true, once: true });
    window.addEventListener('click', handleFirstTouch, { passive: true, once: true });

    return () => {
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('click', handleFirstTouch);
    };
  }, [onPrime]);


  return (
    <section
      onPointerDown={() => {
        if (typeof onPrime === 'function') onPrime();
      }}
      className="robot-mobile-ui absolute inset-0 z-20 bg-[#F5F2EB] text-stone-950"
    >
      <div className="robot-portrait-guard absolute inset-0 z-50 bg-stone-950 text-white items-center justify-center text-center p-8">
        <div>
          <p className="text-xs font-bold tracking-[0.24em] uppercase text-stone-400">HCROBOT</p>
          <h2 className="mt-3 text-2xl font-black">{isEn ? 'Please rotate your phone' : 'Vui lòng xoay ngang điện thoại'}</h2>
          <p className="mt-2 text-sm text-stone-400">{isEn ? 'The robot display is optimized for landscape mode.' : 'Ứng dụng Robot được thiết kế để sử dụng ở chế độ ngang.'}</p>
        </div>
      </div>

      <div className="robot-landscape-content h-full w-full flex flex-col">
        <header className="h-11 shrink-0 flex items-center justify-between gap-3 border-b border-stone-200/50 px-4 robot-safe-x bg-[#F5F2EB]/95 backdrop-blur-sm relative z-50">
          {/* Top-Left Branding chuẩn Desktop theme xám */}
          <div onClick={handleSecretTap} className="flex items-center gap-2 min-w-0 cursor-default select-none" title="Chạm 5 lần để đăng xuất">
            <strong className="text-xs font-black tracking-widest text-stone-600 uppercase">HCROBOT</strong>
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            <span className="hidden min-[480px]:inline text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Aurora Grand Hotel</span>
          </div>

          <div className="flex items-center gap-2">
            {activeRoomNumber && (
              <span className="h-7 px-2.5 rounded-full bg-stone-200/90 text-stone-800 text-xs font-mono font-bold border border-stone-300 shadow-2xs flex items-center justify-center animate-fadeIn select-none">
                {activeRoomNumber}
              </span>
            )}
            {activeRoomNumber && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onResetSession) onResetSession();
                }}
                title={isEn ? `Exit session for room ${activeRoomNumber}` : `Thoát phiên phòng ${activeRoomNumber}`}
                aria-label={isEn ? "Exit session" : "Thoát phiên"}
                className="h-7 px-2.5 rounded-full border border-stone-700/80 bg-stone-900/90 hover:bg-stone-800 text-stone-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 touch-manipulation animate-fadeIn"
              >
                <LogOut className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                <span className="text-[11px] font-semibold">{isEn ? "Exit" : "Thoát phiên"}</span>
              </button>
            )}

            {/* Nút Ngôn ngữ (VI / EN) chỉ icon */}
            {onToggleLanguage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLangMenuOpen((prev) => !prev);
                  setIsUtilitiesMenuOpen(false);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className={`w-7 h-7 rounded-full border flex items-center justify-center active:scale-95 shadow-sm cursor-pointer transition-all touch-manipulation ${isLangMenuOpen
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white border-stone-700/80'
                  }`}
                title={isEn ? 'Switch Language' : 'Chọn ngôn ngữ'}
                aria-label={isEn ? 'Switch Language' : 'Chọn ngôn ngữ'}
              >
                <Globe className="w-3.5 h-3.5 text-stone-300" />
              </button>
            )}

            {/* Nút Menu Dịch Vụ / Fast Menu */}
            <button
              type="button"
              onClick={() => {
                setIsUtilitiesMenuOpen((prev) => !prev);
                setIsLangMenuOpen(false);
              }}
              className={`w-7 h-7 rounded-full border flex items-center justify-center active:scale-95 shadow-sm cursor-pointer transition-all touch-manipulation ${isUtilitiesMenuOpen || isNavigating
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : 'bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white border-stone-700/80'
                }`}
              title={isEn ? 'Fast Menu' : 'Menu nhanh & Tiện ích'}
              aria-label={isEn ? 'Fast Menu' : 'Menu nhanh & Tiện ích'}
            >
              <Menu className="w-3.5 h-3.5 text-stone-300" />
            </button>
          </div>
        </header>

        {/* Modal Chọn Ngôn Ngữ Cỡ Lớn Chuẩn Kiosk & Touch Display (Tối giản, chỉ icon cờ và tên ngôn ngữ) */}
        {isLangMenuOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none"
            onClick={() => setIsLangMenuOpen(false)}
            onPointerDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={isEn ? 'Language' : 'Ngôn ngữ'}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full max-w-xs sm:max-w-sm bg-stone-900 border border-stone-700/80 rounded-3xl shadow-2xl p-4 sm:p-5 text-stone-100 flex flex-col gap-3.5 animate-in zoom-in-95 duration-150"
            >
              {/* Header Modal */}
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-stone-300" />
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    {isEn ? 'Language' : 'Ngôn ngữ'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLangMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  title={isEn ? 'Close' : 'Đóng'}
                  aria-label={isEn ? 'Close' : 'Đóng'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Thân Modal: Chỉ icon cờ và tên ngôn ngữ, không chữ phụ rườm rà */}
              <div className="flex flex-col gap-2.5">
                {/* 1. Tiếng Việt */}
                <button
                  type="button"
                  onClick={() => {
                    onToggleLanguage('Tiếng Việt');
                    setIsLangMenuOpen(false);
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between active:scale-[0.98] ${!isEn
                      ? 'bg-stone-800/90 border-stone-500 ring-2 ring-stone-400/40 text-white shadow-lg'
                      : 'bg-stone-800/40 border-stone-700/60 hover:bg-stone-800/70 text-stone-300 hover:text-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 32 24" className="w-10 h-7 rounded-md overflow-hidden shadow-xs border border-rose-800/60 shrink-0">
                      <rect width="32" height="24" fill="#DA251D" />
                      <polygon points="16,4 17.8,9.7 23.8,9.7 19,13.2 20.8,19 16,15.5 11.2,19 13,13.2 8.2,9.7 14.2,9.7" fill="#FFFF00" />
                    </svg>
                    <span className="text-base font-bold text-white">Tiếng Việt</span>
                  </div>
                  {!isEn ? (
                    <div className="w-6 h-6 rounded-full bg-stone-200 text-stone-900 flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-stone-700 shrink-0" />
                  )}
                </button>

                {/* 2. English */}
                <button
                  type="button"
                  onClick={() => {
                    onToggleLanguage('English');
                    setIsLangMenuOpen(false);
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between active:scale-[0.98] ${isEn
                      ? 'bg-stone-800/90 border-stone-500 ring-2 ring-stone-400/40 text-white shadow-lg'
                      : 'bg-stone-800/40 border-stone-700/60 hover:bg-stone-800/70 text-stone-300 hover:text-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 32 24" className="w-10 h-7 rounded-md overflow-hidden shadow-xs border border-blue-900/60 shrink-0">
                      <rect width="32" height="24" fill="#012169" />
                      <path d="M0,0 L32,24 M32,0 L0,24" stroke="#FFFFFF" strokeWidth="4" />
                      <path d="M0,0 L32,24 M32,0 L0,24" stroke="#C8102E" strokeWidth="1.6" />
                      <path d="M16,0 V24 M0,12 H32" stroke="#FFFFFF" strokeWidth="6" />
                      <path d="M16,0 V24 M0,12 H32" stroke="#C8102E" strokeWidth="3.6" />
                    </svg>
                    <span className="text-base font-bold text-white">English</span>
                  </div>
                  {isEn ? (
                    <div className="w-6 h-6 rounded-full bg-stone-200 text-stone-900 flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-stone-700 shrink-0" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full-Screen Utilities Menu (Phương án 2: Kiosk Landscape Grid với Mini Robot Face Header - Theme Xám Trắng) */}
        {isUtilitiesMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-[#F5F2EB] backdrop-blur-2xl flex flex-col justify-between p-3.5 sm:p-5 robot-safe-x animate-fadeIn text-[#1A1917] select-none overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={isEn ? 'Utilities Menu' : 'Danh mục tiện ích'}
          >
            {/* Header: Tiêu đề Danh mục + Voice Status + Nút Đóng lớn */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DFD5] shrink-0">
              {/* Bên trái: Tiêu đề Danh mục & Trạng thái Voice */}
              <div className="flex flex-col text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-900 truncate">
                    {isEn ? 'Utilities Menu' : 'Danh mục tiện ích'}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 border border-stone-300 shrink-0">
                    HCROBOT
                  </span>
                </div>
                {/* Trạng thái Voice / Lắng nghe mini (Theme xám nhạt) */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isListening ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-stone-400 animate-pulse shrink-0" />
                      <span className="text-[11px] font-medium text-stone-500 truncate">
                        {isEn ? 'Listening... Please speak' : 'Listening... · Đang lắng nghe...'}
                      </span>
                    </>
                  ) : isSpeaking ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-stone-400 animate-pulse shrink-0" />
                      <span className="text-[11px] font-medium text-stone-500 truncate">
                        {isEn ? 'Robot speaking · Tap to interrupt' : 'Robot đang nói · Chạm để ngắt lời'}
                      </span>
                    </>
                  ) : isBusy ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-stone-400 animate-ping shrink-0" />
                      <span className="text-[11px] font-medium text-stone-500 truncate">
                        {isEn ? 'Processing...' : 'Đang xử lý...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                      <span className="text-[11px] text-stone-500 font-medium truncate">
                        {isEn ? 'Tap card or speak directly with robot' : 'Chạm chọn dịch vụ hoặc nói trực tiếp với robot'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Bên phải: Nút Đóng kích thước lớn chuẩn Touch Kiosk */}
              <button
                type="button"
                onClick={() => {
                  setIsUtilitiesMenuOpen(false);
                }}
                className="h-9 px-4 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white border border-[#1A1917] text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm shrink-0"
                title={isEn ? 'Close menu' : 'Đóng menu'}
                aria-label={isEn ? 'Close' : 'Đóng'}
              >
                <X className="w-4 h-4" />
                <span>{isEn ? 'Close' : 'Đóng'}</span>
              </button>
            </div>

            {/* Thân Menu: Grid 2 Cột x Thẻ To dễ bấm cho Kiosk (Theme Xám Trắng Sáng Rõ) */}
            <div className="flex-1 min-h-0 py-2.5 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 h-full content-start">
                {/* 1. Cơ sở vật chất & Tiện ích 5 sao */}
                {onOpenFacilities && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenFacilities();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Building className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Hotel Facilities & Amenities' : 'Cơ sở vật chất & Tiện ích'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Infinity Pool, Spa, Gym, Sky Bar' : 'Hồ bơi vô cực, Spa, Gym, Sky Bar'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 2. Sơ đồ bản đồ (8 Tầng) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMapManualOpen(true);
                    setIsUtilitiesMenuOpen(false);
                  }}
                  className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                    <MapIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                      {isEn ? 'Floor Map (8 Floors)' : 'Sơ đồ bản đồ (8 Tầng)'}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                      {isEn ? '2D Wayfinding & Floor selector' : 'Chỉ đường 2D & đổi tầng'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>

                {/* 3. Thực đơn chọn món */}
                {onOpenFoodMenu && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenFoodMenu();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Utensils className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'In-Room Dining Menu' : 'Thực đơn chọn món'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Order culinary & drinks to room' : 'Gọi món ăn & đồ uống lên phòng'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 4. Dịch vụ phòng (Room Service: Khăn tắm, gối chăn, massage tại phòng) */}
                {onOpenRoomService && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenRoomService();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <ConciergeBell className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'In-Room Services & Amenities' : 'Dịch vụ phòng (Room Service)'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Towels, extra bedding, in-room spa massage' : 'Thêm khăn tắm, gối chăn, massage tại phòng'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 4a. Báo hỏng & Sửa chữa kỹ thuật (Maintenance Menu) */}
                {onOpenMaintenance && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMaintenance();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Repairs & Maintenance' : 'Báo hỏng & Sửa chữa'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'AC, plumbing, electrical, door locks & facilities' : 'Điều hòa, điện nước, khóa phòng & sự cố'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 4b. Đặt Xe & Taxi Sảnh */}
                {onOpenTaxiBooking && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenTaxiBooking();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Car className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Book Taxi & Lobby Ride' : 'Đặt xe & Gọi taxi'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? '4 - 7 seater cars, hotlines & airport shuttle' : 'Xe 4 - 7 chỗ, hotline & đưa đón sân bay'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 5. Kiểm tra trạng thái món ăn */}
                {onOpenOrderStatus && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenOrderStatus();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Food Order Status' : 'Tiến độ món ăn'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Check kitchen cooking progress' : 'Tra cứu tình trạng chế biến'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 5b. Kiểm tra tiến độ dịch vụ phòng & dọn phòng */}
                {onOpenServiceStatus && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenServiceStatus();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Housekeeping & Service Status' : 'Tiến độ dọn phòng & dịch vụ'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Check room cleaning & amenities progress' : 'Tra cứu dọn phòng, khăn tắm, massage'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 5c. Kiểm tra tiến độ sửa chữa kỹ thuật */}
                {onOpenMaintenanceStatus && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMaintenanceStatus();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Technical Repair Status' : 'Tiến độ sửa chữa'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Check room repair progress' : 'Tra cứu tiến độ xử lý sự cố thiết bị'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 4. Gọi Nhân Viên Trực (Video Call) */}
                {onCallStaff && (
                  <button
                    type="button"
                    onClick={() => {
                      onCallStaff();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Call Staff Support' : 'Gọi nhân viên hỗ trợ'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Direct video call assistance' : 'Kết nối hỗ trợ trực tiếp'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}
              </div>
            </div>

            {/* Footer: Thông tin khách sạn & gợi ý chạm */}
            <div className="pt-2 border-t border-[#E3DFD5] flex items-center justify-between text-[10px] text-stone-600 shrink-0">
              <span className="font-bold text-stone-700">Aurora Grand Hotel · 5-Star Concierge</span>
              <span className="text-stone-600 font-medium">
                {isEn ? 'Tap any card or speak directly to command' : 'Chạm vào thẻ hoặc nói để điều khiển'}
              </span>
            </div>
          </div>
        )}

        {isNavigating ? (
          <main className="flex-1 min-h-0 w-full h-full p-2 bg-[#F5F2EB] select-none relative overflow-hidden flex flex-col">
            {/* Bản đồ Wayfinding toàn màn hình 100% diện tích, to rõ tối đa trên điện thoại xoay ngang */}
            <div className="w-full h-full relative rounded-2xl overflow-hidden border border-[#E3DFD5] shadow-sm bg-white">
              <FloorMap
                destinationKey={navigationDestinationKey}
                onSelectDestination={onSelectDestination}
                onClose={handleDismissMap}
                showQrModalExternal={showQrModalExternal}
                qrCountdown={qrCountdown}
                onCloseQrModal={onCloseQrModal || (() => {})}
                onStepChange={setNavActiveStep}
                defaultZoom={1.0}
                className="w-full h-full rounded-none border-none shadow-none"
              />

              {/* Thanh chỉ dẫn nổi tinh gọn ở đáy màn hình: hiển thị chỉ dẫn tương ứng theo Chặng 1 hoặc Chặng 2 */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 z-30 pointer-events-none flex items-center justify-between gap-2.5">
                <div className="pointer-events-auto flex-1 min-w-0 max-w-xl bg-stone-900/90 text-stone-100 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-stone-700/80 shadow-xl flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                  <span className="text-xs font-semibold text-stone-100 truncate">
                    {currentDestination.isDifferentFloor
                      ? (navActiveStep === 1
                        ? `${currentDestination.step1Text || 'Chặng 1: Đi tới Thang máy A và bấm lên tầng mục tiêu.'}`
                        : `${currentDestination.step2Text || `Chặng 2: Ra khỏi thang máy tới ${currentDestination.name}.`}`)
                      : `${currentDestination.step1Text || `Đi theo hành lang tới ${currentDestination.name}`}`}
                  </span>
                </div>

                {/* Nút Đóng nhanh */}
                <button
                  type="button"
                  onClick={handleDismissMap}
                  className="pointer-events-auto h-8 px-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white border border-stone-700/80 shadow-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5"
                  title={isEn ? 'Close Map' : 'Đóng bản đồ'}
                  aria-label={isEn ? 'Close' : 'Đóng'}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Close' : 'Đóng'}</span>
                </button>
              </div>
            </div>
          </main>
        ) : (
          <main
            onClick={() => {
              if (isSpeaking && onStopSpeaking) {
                onStopSpeaking();
                return;
              }
              if (isListening && transcript && onSubmitTalk) {
                onSubmitTalk();
                return;
              }
              if (!isSpeaking && !isBusy && onStartTalk) {
                if (onPrime) onPrime();
                onStartTalk();
              }
            }}
            className="flex-1 min-h-0 w-full flex flex-col items-center justify-center robot-safe-x robot-safe-bottom cursor-pointer relative px-4 select-none"
          >
            <div className="w-full max-w-lg flex flex-col items-center justify-center py-0.5">
              {/* Khuôn mặt Robot to rõ nổi bật */}
              <div className="w-full flex items-center justify-center transition-transform active:scale-95 duration-200 scale-110 sm:scale-125">
                <RobotFace
                  mode={getRobotMode(currentState, isSpeaking, isProcessing, isListening)}
                  eyeExpression={eyeExpression}
                  isSpeakingActive={isSpeaking}
                  size="mobile"
                />
              </div>

              {/* 1. Khi đang nói hoặc có phụ đề trả lời: Subtitle điện ảnh nổi tinh tế (Tích hợp nút mic bên phải) */}
              {displayText ? (
                <MobileCinemaSubtitle
                  fullText={displayText}
                  isSpeaking={isSpeaking}
                  onClose={onCloseAiResponse}
                  onStartTalk={onStartTalk}
                  onStopSpeaking={onStopSpeaking}
                  onPrime={onPrime}
                  isEn={isEn}
                />
              ) : currentState === 'RT-03' || isListening ? (
                /* 2. Khi đang nghe: Dock âm thanh sóng AudioWave tinh giản tối đa từ ngữ */
                <div className="mt-2.5 flex flex-col items-center gap-1.5 animate-fadeIn">
                  <div
                    onClick={(e) => {
                      if (transcript && onSubmitTalk) {
                        e.stopPropagation();
                        onSubmitTalk();
                      } else if (onStartTalk) {
                        e.stopPropagation();
                        onStartTalk();
                      }
                    }}
                    className="px-4 py-2 bg-stone-900/90 hover:bg-stone-850 backdrop-blur-xl border border-stone-700/80 rounded-2xl shadow-xl flex items-center justify-between gap-3 text-stone-100 w-auto min-w-[200px] max-w-sm cursor-pointer active:scale-[0.99] transition-all touch-manipulation"
                    title={transcript ? (isEn ? 'Tap to send immediately' : 'Chạm để gửi ngay') : (isEn ? 'Tap to restart mic' : 'Chạm để kích hoạt lại Micro')}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <AudioWave isActive={isListening || currentState === "RT-03"} volumeLevel={volumeLevel} />
                      <span className="text-xs font-semibold text-stone-200 truncate">
                        {transcript ? `"${transcript}"` : (isEn ? 'Listening...' : 'Đang lắng nghe...')}
                      </span>
                    </div>

                    {transcript && onSubmitTalk && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubmitTalk();
                        }}
                        className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0 flex items-center gap-1 cursor-pointer"
                        title={isEn ? 'Send question' : 'Gửi câu hỏi'}
                      >
                        <span>{isEn ? 'Send' : 'Gửi'}</span>
                      </button>
                    )}
                  </div>
                  {speechError && (
                    <div className="px-3 py-1 bg-stone-900/90 border border-stone-700 text-stone-300 text-[10px] font-medium rounded-xl">
                      {speechError}
                    </div>
                  )}
                </div>
              ) : isBusy ? (
                /* 3. Khi đang suy nghĩ / xử lý: Dock xám tối giản từ ngữ */
                <div className="mt-2.5 flex items-center gap-2 px-3.5 py-1.5 bg-stone-900/90 backdrop-blur-xl border border-stone-700/80 rounded-full shadow-lg text-stone-200 text-xs font-medium animate-fadeIn">
                  <span className="w-2 h-2 rounded-full bg-stone-300 animate-ping" />
                  <span>{isEn ? 'Processing...' : 'Đang xử lý...'}</span>
                </div>
              ) : (
                /* 4. Trạng thái chờ: Nút chạm nói */
                <div className="mt-2.5 flex items-center justify-center animate-fadeIn">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onPrime) onPrime();
                      if (onStartTalk) onStartTalk();
                    }}
                    className="px-4 py-1.5 bg-stone-900/90 hover:bg-stone-800 backdrop-blur-xl border border-stone-700/80 rounded-full shadow-lg flex items-center gap-2 cursor-pointer active:scale-95 transition-all text-stone-200 hover:text-white group outline-none touch-manipulation"
                    title={isEn ? 'Touch or speak' : 'Chạm hoặc nói'}
                  >
                    <Mic className="w-3.5 h-3.5 text-stone-300 group-hover:text-white" />
                    <span className="text-xs font-semibold">
                      {isEn ? 'Touch or speak' : 'Chạm hoặc nói'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </main>
        )}

        {/* Vùng chạm bí mật góc dưới bên phải cho Mobile (Chạm 5 lần trong 2s để đăng xuất) */}
        <div
          onClick={handleSecretTap}
          className="absolute bottom-0 right-0 w-16 h-16 z-40 select-none opacity-0"
          aria-hidden="true"
        />

      </div>
    </section>
  );
};

