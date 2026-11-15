import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AudioWave } from './AudioWave';
import { RobotFace } from './RobotFace';
import { HOTEL_DESTINATIONS } from './FloorMap';
import { Menu, Globe, Mic, LogOut, Camera } from 'lucide-react';
import { getRobotMode, MobileCinemaSubtitle } from './MobileCinemaSubtitle';
import {
  MobileRobotLanguageModal,
  MobileRobotMapView,
} from './MobileRobotLanguageAndMap';
import { MobileRobotUtilitiesMenu } from './MobileRobotUtilitiesMenu';

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
  onOpenBellman = null,
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
  isKioskCameraActive = true,
  onStartKioskCamera = null,
  kioskCameraStream = null,
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

            {/* Chi bao / Nut bat Camera Kiosk tren Mobile neu chua cap quyen */}
            {!isKioskCameraActive && onStartKioskCamera && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartKioskCamera();
                }}
                className="h-7 px-2.5 rounded-full border border-amber-600/60 bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 animate-pulse"
                title={isEn ? "Tap to enable Kiosk Camera" : "Chạm để bật Camera Kiosk"}
              >
                <Camera className="w-3.5 h-3.5 text-amber-800" />
                <span className="text-[11px] font-bold">{isEn ? "Camera Off" : "Bật Camera AI"}</span>
              </button>
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

        {/* Banner nhac nho bat Camera Kiosk AI neu chua duoc cap quyen tren Mobile */}
        {!isKioskCameraActive && onStartKioskCamera && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onStartKioskCamera();
            }}
            className="mx-3 my-1 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-900 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition-all shadow-xs shrink-0 select-none"
          >
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-800 shrink-0 animate-pulse" />
              <span className="font-semibold text-stone-900 text-[11px] sm:text-xs">
                {isEn ? 'Tap here to enable Kiosk Camera AI' : 'Chạm vào đây để cấp quyền Camera AI Kiosk'}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-600 text-white uppercase shadow-2xs">
              {isEn ? 'Allow' : 'Bật ngay'}
            </span>
          </div>
        )}

        {/* Modal Chọn Ngôn Ngữ Cỡ Lớn Chuẩn Kiosk & Touch Display (Theme Xám Sáng Tinh Tế) */}

        <MobileRobotLanguageModal
          isLangMenuOpen={isLangMenuOpen}
          setIsLangMenuOpen={setIsLangMenuOpen}
          isEn={isEn}
          onToggleLanguage={onToggleLanguage}
        />

        <MobileRobotUtilitiesMenu
          isUtilitiesMenuOpen={isUtilitiesMenuOpen}
          setIsUtilitiesMenuOpen={setIsUtilitiesMenuOpen}
          isEn={isEn}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          isListening={isListening}
          isBusy={isBusy}
          setIsMapManualOpen={setIsMapManualOpen}
          onOpenFacilities={onOpenFacilities}
          onOpenFoodMenu={onOpenFoodMenu}
          onOpenRoomService={onOpenRoomService}
          onOpenBellman={onOpenBellman}
          onOpenMaintenance={onOpenMaintenance}
          onOpenTaxiBooking={onOpenTaxiBooking}
          onOpenOrderStatus={onOpenOrderStatus}
          onOpenServiceStatus={onOpenServiceStatus}
          onOpenMaintenanceStatus={onOpenMaintenanceStatus}
          onCallStaff={onCallStaff}
        />

        {isNavigating ? (
          <MobileRobotMapView
            navigationDestinationKey={navigationDestinationKey}
            onSelectDestination={onSelectDestination}
            navActiveStep={navActiveStep}
            setNavActiveStep={setNavActiveStep}
            showQrModalExternal={showQrModalExternal}
            qrCountdown={qrCountdown}
            onCloseQrModal={onCloseQrModal}
            handleDismissMap={handleDismissMap}
            currentDestination={currentDestination}
            isEn={isEn}
          />
        ) : (
          <main
            onClick={() => {
              if (typeof onStartKioskCamera === 'function' && !isKioskCameraActive) {
                onStartKioskCamera();
              }
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

        {/* Video stream chay ngam de duy tri sensor camera WebKit tren iOS Safari (Khach khong nhin thay hinh anh) */}
        {kioskCameraStream && (
          <video
            ref={(el) => {
              if (el && el.srcObject !== kioskCameraStream) {
                el.srcObject = kioskCameraStream;
                el.muted = true;
                el.playsInline = true;
                el.play().catch(() => {});
              }
            }}
            autoPlay
            playsInline
            muted
            aria-hidden="true"
            className="hidden pointer-events-none"
          />
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

