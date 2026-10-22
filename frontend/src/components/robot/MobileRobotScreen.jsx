import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { AudioWave } from './AudioWave';
import { RobotFace } from './RobotFace';
import { FloorMap, HOTEL_DESTINATIONS } from './FloorMap';
import {
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
} from 'lucide-react';

const getRobotMode = (state, isSpeaking = false, isProcessing = false, isListening = false) => {
  if (state === 'RT-01') return 'sleeping';
  if (isSpeaking) return 'speaking';
  if (isProcessing || state === 'RT-04') return 'processing';
  if (isListening || state === 'RT-03') return 'listening';
  return 'welcome';
};

const MobileCinemaSubtitle = ({ fullText, isSpeaking, onClose, isEn = false }) => {
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
      onClick={(e) => e.stopPropagation()}
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
        onClick={(e) => {
          e.stopPropagation();
          if (sentences.length > 1) {
            setCurrentIndex((prev) => (prev + 1) % sentences.length);
          }
        }}
        className={`text-xs sm:text-[13px] font-medium text-stone-100 leading-snug px-6 select-text animate-in fade-in duration-200 line-clamp-3 ${sentences.length > 1 ? 'cursor-pointer' : ''}`}
        title={sentences.length > 1 ? (isEn ? 'Tap to see next sentence' : 'Chạm để xem câu tiếp theo') : ''}
      >
        {activeSentence}
      </p>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2.5 w-4 h-4 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-all cursor-pointer"
          title={isEn ? "Hide subtitle" : "Ẩn phụ đề"}
        >
          <X className="w-3 h-3" />
        </button>
      )}
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
  const isBusy = isProcessing || currentState === 'RT-04';
  const displayText = aiResponseText || spokenSubtitle;
  const isNavigating = currentState === 'RT-05' || isMapManualOpen;

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

  // Tự động bật mic khi vào màn hình robot mobile
  useEffect(() => {
    let timer = null;
    if (typeof onStartTalk === 'function' && !isListening && !isSpeaking && !isBusy) {
      timer = setTimeout(() => {
        onStartTalk();
      }, 600);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);


  return (
    <section className="robot-mobile-ui absolute inset-0 z-20 bg-[#F5F2EB] text-stone-950">
      <div className="robot-portrait-guard absolute inset-0 z-50 bg-stone-950 text-white items-center justify-center text-center p-8">
        <div>
          <p className="text-xs font-bold tracking-[0.24em] uppercase text-stone-400">HCROBOT</p>
          <h2 className="mt-3 text-2xl font-black">{isEn ? 'Please rotate your phone' : 'Vui lòng xoay ngang điện thoại'}</h2>
          <p className="mt-2 text-sm text-stone-400">{isEn ? 'The robot display is optimized for landscape mode.' : 'Ứng dụng Robot được thiết kế để sử dụng ở chế độ ngang.'}</p>
        </div>
      </div>

      <div className="robot-landscape-content h-full w-full flex flex-col">
        <header className="h-11 shrink-0 flex items-center justify-between gap-3 border-b border-stone-200/50 px-4 robot-safe-x bg-[#F5F2EB]/95 backdrop-blur-sm relative z-30">
          {/* Top-Left Branding chuẩn Desktop theme xám */}
          <div onClick={handleSecretTap} className="flex items-center gap-2 min-w-0 cursor-default select-none" title="Chạm 5 lần để đăng xuất">
            <strong className="text-xs font-black tracking-widest text-stone-600 uppercase">HCROBOT</strong>
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            <span className="hidden min-[480px]:inline text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Aurora Grand Hotel</span>
          </div>

          <div className="flex items-center gap-2">
            {activeRoomNumber && (
              <span className="text-[10px] font-mono font-bold text-stone-600 bg-stone-200/80 px-2 py-0.5 rounded-full border border-stone-300">
                {isEn ? `Rm.${activeRoomNumber}` : `P.${activeRoomNumber}`}
              </span>
            )}

            {/* Nút Ngôn ngữ (VI / EN) chuẩn Desktop có Dropdown */}
            {onToggleLanguage && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsLangMenuOpen((prev) => !prev);
                    setIsUtilitiesMenuOpen(false);
                  }}
                  className={`h-7 px-2.5 rounded-full border text-[10px] font-mono font-bold flex items-center gap-1 active:scale-95 shadow-sm cursor-pointer transition-all ${
                    isLangMenuOpen
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white border-stone-700/80'
                  }`}
                  title={isEn ? 'Switch Language' : 'Chọn ngôn ngữ'}
                >
                  <Globe className="w-3 h-3 text-stone-400" />
                  <span>{isEn ? 'EN' : 'VI'}</span>
                  <ChevronDown className={`w-2.5 h-2.5 text-stone-400 transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu Chọn Ngôn Ngữ */}
                {isLangMenuOpen && (
                  <div className="absolute top-9 right-0 z-50 w-44 rounded-2xl bg-stone-900/95 border border-stone-700/80 shadow-2xl p-1.5 backdrop-blur-xl animate-fadeIn space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2.5 py-1 border-b border-stone-800 flex items-center justify-between">
                      <span>{isEn ? 'Language' : 'Ngôn ngữ'}</span>
                      <span className="text-[9px] text-stone-500 font-mono">LANG</span>
                    </div>

                    {/* Tiếng Việt */}
                    <button
                      type="button"
                      onClick={() => {
                        onToggleLanguage('Tiếng Việt');
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        !isEn
                          ? 'bg-stone-800 text-stone-100 border border-stone-600'
                          : 'text-stone-300 hover:bg-stone-800/60 hover:text-stone-100'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm">🇻🇳</span>
                        <span>Tiếng Việt</span>
                      </span>
                      {!isEn && <Check className="w-3.5 h-3.5 text-stone-200" />}
                    </button>

                    {/* English */}
                    <button
                      type="button"
                      onClick={() => {
                        onToggleLanguage('English');
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isEn
                          ? 'bg-stone-800 text-stone-100 border border-stone-600'
                          : 'text-stone-300 hover:bg-stone-800/60 hover:text-stone-100'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm">🇬🇧</span>
                        <span>English</span>
                      </span>
                      {isEn && <Check className="w-3.5 h-3.5 text-stone-200" />}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Nút Menu Dịch Vụ / Tiện ích chuẩn theme xám */}
            <button
              type="button"
              onClick={() => {
                setIsUtilitiesMenuOpen((prev) => !prev);
                setIsLangMenuOpen(false);
              }}
              className={`h-7 px-2.5 rounded-full border text-[10px] font-bold flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer transition-all ${
                isUtilitiesMenuOpen || isNavigating
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : 'bg-stone-900/90 hover:bg-stone-800 text-stone-200 border-stone-700/80'
              }`}
              title={isEn ? 'Utilities Menu' : 'Menu Dịch vụ và Tiện ích'}
            >
              <Menu className="w-3 h-3 text-stone-300" />
              <span>{isEn ? 'Utilities' : 'Tiện ích'}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isUtilitiesMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </header>

        {/* Overlay trong suốt khi mở Menu Ngôn Ngữ (Click outside to close - không làm tối màn hình) */}
        {isLangMenuOpen && (
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsLangMenuOpen(false)}
          />
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
                        {isEn ? 'Robot speaking...' : 'Robot đang trả lời...'}
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
          <main className="flex-1 min-h-0 w-full h-full relative overflow-hidden bg-white">
            <FloorMap
              destinationKey={navigationDestinationKey}
              onSelectDestination={onSelectDestination}
              onClose={() => {
                setIsMapManualOpen(false);
                onResetToIdle();
              }}
              showQrModalExternal={false}
              qrCountdown={null}
              onCloseQrModal={onCloseQrModal}
              defaultZoom={1.65}
              className="w-full h-full rounded-none border-none shadow-none"
            />

            {/* Subtitle nổi trên bản đồ khi AI đang nói hoặc vừa nói xong */}
            {displayText && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-40 max-w-[94vw] sm:max-w-lg pointer-events-auto">
                <MobileCinemaSubtitle
                  fullText={displayText}
                  isSpeaking={isSpeaking}
                  onClose={onCloseAiResponse}
                  isEn={isEn}
                />
              </div>
            )}
          </main>
        ) : (
          <main
            onClick={() => {
              if (isSpeaking || isBusy) {
                // Tuyệt đối không ngắt lời AI khi robot đang trả lời hoặc đang xử lý
                return;
              }
              if (isListening && transcript && onSubmitTalk) {
                onSubmitTalk();
                return;
              }
              if (displayText && !isSpeaking) {
                // Khi robot đã nói xong hoàn toàn và phụ đề đang hiển thị: Chạm để hỏi câu tiếp theo
                if (onCloseAiResponse) onCloseAiResponse();
                if (onStartTalk) onStartTalk();
                return;
              }
              if (!isSpeaking && !isBusy && onStartTalk) {
                if (currentState === 'RT-01' || currentState === 'RT-02') {
                  onStartTalk();
                }
              }
            }}
            className="flex-1 min-h-0 w-full flex flex-col items-center justify-center robot-safe-x robot-safe-bottom cursor-pointer relative px-4 select-none"
          >
            <div className="w-full max-w-lg flex flex-col items-center justify-center py-0.5">
              {/* Khuôn mặt Robot */}
              <div className="w-full flex items-center justify-center transition-transform active:scale-95 duration-200">
                <RobotFace
                  mode={getRobotMode(currentState, isSpeaking, isProcessing, isListening)}
                  eyeExpression={eyeExpression}
                  isSpeakingActive={isSpeaking}
                  size="mobile"
                />
              </div>

              {/* 1. Khi đang nói hoặc có phụ đề trả lời: Subtitle điện ảnh nổi tinh tế */}
              {displayText ? (
                <div className="flex flex-col items-center gap-1.5 animate-fadeIn">
                  <MobileCinemaSubtitle
                    fullText={displayText}
                    isSpeaking={isSpeaking}
                    onClose={onCloseAiResponse}
                    isEn={isEn}
                  />
                  {!isSpeaking && !isListening && (
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onCloseAiResponse) onCloseAiResponse();
                          if (onStartTalk) onStartTalk();
                        }}
                        className="px-3 py-1 bg-stone-900/80 hover:bg-stone-800 text-stone-200 hover:text-white text-[11px] font-medium rounded-full border border-stone-700/60 backdrop-blur-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md"
                      >
                        <Mic className="w-3 h-3 text-stone-300" />
                        <span>{isEn ? 'Tap to ask next question' : 'Chạm để hỏi tiếp · Speak again'}</span>
                      </button>
                      {navigationDestinationKey && HOTEL_DESTINATIONS[navigationDestinationKey] && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMapManualOpen(true);
                          }}
                          className="px-3 py-1 bg-stone-900/90 hover:bg-stone-800 text-stone-200 hover:text-white text-[11px] font-bold rounded-full border border-stone-700/60 backdrop-blur-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md"
                        >
                          <MapIcon className="w-3 h-3 text-stone-400" />
                          <span>{isEn ? `View Map (${HOTEL_DESTINATIONS[navigationDestinationKey]?.floorLevel})` : `Xem sơ đồ (${HOTEL_DESTINATIONS[navigationDestinationKey]?.floorLevel})`}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : currentState === 'RT-03' || isListening ? (
                /* 2. Khi đang nghe: Dock âm thanh sóng AudioWave chuẩn Desktop */
                <div className="mt-2.5 flex flex-col items-center gap-1.5 animate-fadeIn">
                  <div
                    onClick={(e) => {
                      if (transcript && onSubmitTalk) {
                        e.stopPropagation();
                        onSubmitTalk();
                      }
                    }}
                    className={`px-5 py-2 sm:px-6 sm:py-2.5 bg-stone-900/90 backdrop-blur-xl border border-stone-700/80 rounded-2xl shadow-xl flex items-center justify-between gap-3 text-stone-100 w-full max-w-sm sm:max-w-md ${transcript ? 'cursor-pointer active:scale-[0.99]' : ''}`}
                    title={transcript ? (isEn ? 'Tap to send immediately' : 'Chạm để gửi ngay') : ''}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <AudioWave isActive={isListening} volumeLevel={volumeLevel} />
                      <div className="flex flex-col text-left min-w-0">
                        <span className="text-xs font-bold text-stone-200 line-clamp-1">
                          {transcript ? `"${transcript}"` : (isEn ? 'Listening... Please speak' : 'Listening... · Đang lắng nghe...')}
                        </span>
                        <span className="text-[10px] text-stone-400 font-medium flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="truncate">{isEn ? 'Auto-detect VI · EN · Bilingual' : 'Auto-detect VI · EN · Tự động nhận diện'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  {speechError && (
                    <div className="px-3 py-1 bg-stone-900/90 border border-stone-700 text-stone-300 text-[10px] font-medium rounded-xl">
                      {speechError}
                    </div>
                  )}
                </div>
              ) : isBusy ? (
                /* 3. Khi đang suy nghĩ / xử lý: Dock xám tối giản */
                <div className="mt-2.5 flex items-center gap-2.5 px-4 py-2 bg-stone-900/90 backdrop-blur-xl border border-stone-700/80 rounded-full shadow-lg text-stone-200 text-xs font-medium animate-fadeIn">
                  <span className="w-2 h-2 rounded-full bg-stone-300 animate-ping" />
                  <span>{isEn ? 'Processing your question...' : 'Đang xử lý câu hỏi... · Processing...'}</span>
                </div>
              ) : (
                /* 4. Trạng thái chờ: Nút chạm nói thanh lịch chuẩn Desktop */
                <div className="mt-2.5 flex flex-col items-center gap-1.5 animate-fadeIn">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onStartTalk) onStartTalk();
                    }}
                    className="px-4 py-2 bg-stone-900/85 hover:bg-stone-800 backdrop-blur-xl border border-stone-700/80 rounded-full shadow-lg flex items-center gap-2.5 cursor-pointer active:scale-95 transition-all text-stone-300 hover:text-stone-100 group"
                    title={isEn ? 'Touch or speak to begin' : 'Chạm hoặc nói chuyện để bắt đầu'}
                  >
                    <span className="w-2 h-2 rounded-full bg-stone-300 animate-pulse group-hover:scale-125 transition-transform" />
                    <div className="flex items-center gap-1.5 text-stone-200 group-hover:text-white transition-colors">
                      <Mic className="w-3.5 h-3.5 text-stone-300 group-hover:text-white" />
                      <span className="text-xs font-semibold tracking-wide">
                        {isEn ? 'Touch or Speak to begin' : 'Touch or Speak · Chạm hoặc Nói'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-stone-400 bg-stone-800/90 px-1.5 py-0.5 rounded-full border border-stone-700/60 font-mono">
                      <Globe className="w-2.5 h-2.5 text-stone-400" />
                      <span>VI · EN</span>
                    </div>
                  </div>
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

