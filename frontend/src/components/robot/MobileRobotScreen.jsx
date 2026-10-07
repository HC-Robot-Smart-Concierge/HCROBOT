import React, { useEffect, useState } from 'react';
import { AudioWave } from './AudioWave';
import { RobotFace } from './RobotFace';
import { FloorMap, HOTEL_DESTINATIONS } from './FloorMap';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { Sparkles, ChevronDown, X, PhoneCall } from 'lucide-react';

const getRobotMode = (state) => {
  if (state === 'RT-01') return 'sleeping';
  if (state === 'RT-03') return 'listening';
  if (state === 'RT-04') return 'processing';
  return 'welcome';
};

const getStatusCopy = (state, isSpeaking, language) => {
  const english = language === 'English';
  if (isSpeaking) return english ? ['Speaking', 'Please listen to the answer'] : ['Đang trả lời', 'Quý khách vui lòng lắng nghe'];
  if (state === 'RT-03') return english ? ['Listening', 'Please speak clearly'] : ['Đang lắng nghe', 'Quý khách hãy nói yêu cầu'];
  if (state === 'RT-04') return english ? ['Processing', 'Finding the best answer'] : ['Đang xử lý', 'Đang tìm câu trả lời phù hợp'];
  if (state === 'RT-05') return english ? ['Directions', 'Your route is ready'] : ['Chỉ đường', 'Lộ trình đã sẵn sàng'];
  return english ? ['Hello', 'Tap Talk to begin'] : ['Xin chào', 'Chạm Nói để bắt đầu'];
};

export const MobileRobotScreen = ({
  activeRoomNumber,
  guestEmotion = 'neutral',
  aiResponseText,
  currentState,
  hasSpeechSupport,
  isAutoListen,
  isListening,
  isProcessing,
  isSpeaking,
  language,
  onLogout,
  onResetSession,
  onResetToIdle,
  onStartTalk,
  onSubmitTalk,
  onToggleAutoListen,
  onToggleLanguage,
  speechError,
  transcript,
  workflowTrigger,
  onOpenFoodMenu,
  navigationDestinationKey = 'infinity_pool',
  onSelectDestination,
  availableWorkflows = [],
  onStartWorkflow,
  onCallStaff,
}) => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [installMessage, setInstallMessage] = useState('');
  const [isMapManualOpen, setIsMapManualOpen] = useState(false);
  const [isUtilitiesMenuOpen, setIsUtilitiesMenuOpen] = useState(false);
  const [showWorkflowsSubmenu, setShowWorkflowsSubmenu] = useState(false);
  const { canInstall, isIos, isStandalone, promptInstall } = usePwaInstall();
  const [statusTitle, statusSubtitle] = getStatusCopy(currentState, isSpeaking, language);
  const isBusy = isProcessing || currentState === 'RT-04';
  const isNavigating = currentState === 'RT-05' || isMapManualOpen;
  const currentDestination = HOTEL_DESTINATIONS[navigationDestinationKey] || HOTEL_DESTINATIONS.infinity_pool;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (canInstall) {
      const accepted = await promptInstall();
      setInstallMessage(accepted ? 'Đã gửi yêu cầu cài ứng dụng.' : 'Có thể cài lại từ menu trình duyệt.');
    } else if (isIos) {
      setInstallMessage('Safari: Chia sẻ → Thêm vào Màn hình chính.');
    }
  };

  return (
    <section className="robot-mobile-ui absolute inset-0 z-20 bg-[#F5F2EB] text-stone-950">
      <div className="robot-portrait-guard absolute inset-0 z-50 bg-stone-950 text-white items-center justify-center text-center p-8">
        <div>
          <p className="text-xs font-bold tracking-[0.24em] uppercase text-stone-400">HCROBOT</p>
          <h2 className="mt-3 text-2xl font-black">Vui lòng xoay ngang điện thoại</h2>
          <p className="mt-2 text-sm text-stone-400">Ứng dụng Robot được thiết kế để sử dụng ở chế độ ngang.</p>
        </div>
      </div>

      <div className="robot-landscape-content h-full w-full flex flex-col">
        <header className="h-12 shrink-0 flex items-center justify-between gap-3 border-b border-stone-200 px-4 robot-safe-x bg-white/80 backdrop-blur-md relative z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <strong className="text-sm font-black tracking-tight text-stone-900">HCROBOT</strong>
            <span className="hidden min-[680px]:inline text-[10px] font-semibold text-stone-500">Aurora Grand</span>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-sm' : 'bg-red-500'}`} title={isOnline ? 'Đã kết nối' : 'Ngoại tuyến'} />
          </div>

          <div className="flex items-center gap-2">
            {activeRoomNumber && (
              <span className="text-[10px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                P.{activeRoomNumber}
              </span>
            )}

            {guestEmotion && (
              <span 
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
                  guestEmotion === 'happy'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : guestEmotion === 'unhappy'
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-stone-100 text-stone-700 border-stone-300'
                }`}
                title="Cảm xúc khuôn mặt"
              >
                <span>{guestEmotion === 'happy' ? '😊' : guestEmotion === 'unhappy' ? '😠' : '😐'}</span>
              </span>
            )}

            <button 
              onClick={onToggleLanguage} 
              className="h-8 min-w-9 px-2 rounded-full bg-white hover:bg-stone-50 border border-stone-300 text-[10px] font-bold active:scale-95 shadow-xs cursor-pointer"
            >
              {language === 'English' ? 'EN' : 'VI'}
            </button>

            {/* Nút Sổ Tiện Ích */}
            <button
              type="button"
              onClick={() => setIsUtilitiesMenuOpen((prev) => !prev)}
              className={`h-8 px-3 rounded-full border text-[10px] font-black flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer transition-all ${
                isUtilitiesMenuOpen || isNavigating
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : 'bg-white hover:bg-stone-50 border-stone-300 text-stone-900'
              }`}
              title="Danh sách tiện ích & chức năng"
            >
              <span>⚡</span>
              <span>Tiện ích</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isUtilitiesMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </header>

        {/* Nền mờ khi mở Menu Tiện Ích (Click outside to close) */}
        {isUtilitiesMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
            onClick={() => {
              setIsUtilitiesMenuOpen(false);
              setShowWorkflowsSubmenu(false);
            }}
          />
        )}

        {/* Dropdown Menu Sổ Xuống Tiện Ích */}
        {isUtilitiesMenuOpen && (
          <div className="absolute top-13 right-4 z-50 w-72 sm:w-80 rounded-2xl bg-white/98 border border-stone-200 shadow-2xl p-2.5 backdrop-blur-xl text-stone-900 space-y-1 animate-fadeIn">
            <div className="flex items-center justify-between px-2 py-1 border-b border-stone-100 pb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Danh mục tiện ích Kiosk</span>
              <button
                type="button"
                onClick={() => setIsUtilitiesMenuOpen(false)}
                className="w-5 h-5 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 1. Sơ đồ bản đồ (8 Tầng) */}
            <button
              type="button"
              onClick={() => {
                setIsMapManualOpen(true);
                setIsUtilitiesMenuOpen(false);
              }}
              className="w-full p-2 rounded-xl text-left text-xs font-bold hover:bg-emerald-50 text-stone-800 hover:text-emerald-900 border border-transparent hover:border-emerald-200 transition-all cursor-pointer flex items-center gap-2.5"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm shrink-0">
                🗺️
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold truncate">Sơ đồ bản đồ (8 Tầng)</p>
                <p className="text-[10px] text-stone-500 font-normal truncate">Chỉ đường 2D Canva & đổi tầng</p>
              </div>
            </button>

            {/* 2. Thực đơn chọn món */}
            {onOpenFoodMenu && (
              <button
                type="button"
                onClick={() => {
                  onOpenFoodMenu();
                  setIsUtilitiesMenuOpen(false);
                }}
                className="w-full p-2 rounded-xl text-left text-xs font-bold hover:bg-amber-50 text-stone-800 hover:text-amber-900 border border-transparent hover:border-amber-200 transition-all cursor-pointer flex items-center gap-2.5"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm shrink-0">
                  🍽️
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold truncate">Thực đơn chọn món</p>
                  <p className="text-[10px] text-stone-500 font-normal truncate">Gọi món ăn & đồ uống lên phòng</p>
                </div>
              </button>
            )}

            {/* 3. Gọi Nhân Viên Trực (Video Call) */}
            {onCallStaff && (
              <button
                type="button"
                onClick={() => {
                  onCallStaff();
                  setIsUtilitiesMenuOpen(false);
                }}
                className="w-full p-2 rounded-xl text-left text-xs font-bold hover:bg-cyan-50 text-stone-800 hover:text-cyan-900 border border-transparent hover:border-cyan-200 transition-all cursor-pointer flex items-center gap-2.5"
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center text-sm shrink-0">
                  📞
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold truncate">Gọi nhân viên hỗ trợ</p>
                  <p className="text-[10px] text-stone-500 font-normal truncate">Kết nối hỗ trợ trực tiếp</p>
                </div>
              </button>
            )}

            {/* 4. Kịch Bản Demo (Workflows) */}
            {availableWorkflows && availableWorkflows.length > 0 && (
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowWorkflowsSubmenu(!showWorkflowsSubmenu)}
                  className="w-full p-2 rounded-xl text-left text-xs font-bold hover:bg-stone-100 text-stone-800 border border-transparent hover:border-stone-200 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-sm shrink-0">
                      ⚡
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold truncate">Kịch bản tự động ({availableWorkflows.length})</p>
                      <p className="text-[10px] text-stone-500 font-normal truncate">Chào đón, chỉ đường mẫu...</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${showWorkflowsSubmenu ? 'rotate-180' : ''}`} />
                </button>

                {showWorkflowsSubmenu && (
                  <div className="mt-1 pl-9 pr-1 max-h-36 overflow-y-auto space-y-1 no-scrollbar">
                    {availableWorkflows.map((wf) => (
                      <button
                        key={wf.id}
                        type="button"
                        onClick={() => {
                          if (onStartWorkflow) onStartWorkflow(wf);
                          setIsUtilitiesMenuOpen(false);
                          setShowWorkflowsSubmenu(false);
                        }}
                        className="w-full p-1.5 rounded-lg text-left text-[11px] font-semibold text-stone-700 hover:bg-purple-50 hover:text-purple-900 border border-transparent hover:border-purple-200 transition-all cursor-pointer flex items-center justify-between"
                      >
                        <span className="truncate">{wf.name}</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-stone-100 text-stone-500 font-mono">
                          {wf.steps?.length || 0}s
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. Cài ứng dụng (PWA) nếu khả dụng */}
            {!isStandalone && (canInstall || isIos) && (
              <button
                type="button"
                onClick={() => {
                  handleInstall();
                  setIsUtilitiesMenuOpen(false);
                }}
                className="w-full p-2 rounded-xl text-left text-xs font-bold hover:bg-stone-100 text-stone-800 transition-all cursor-pointer flex items-center gap-2.5"
              >
                <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center text-sm shrink-0">
                  📲
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold truncate">Cài ứng dụng (PWA)</p>
                  <p className="text-[10px] text-stone-500 font-normal truncate">Thêm vào Màn hình chính</p>
                </div>
              </button>
            )}

            {/* 6. Thoát Kiosk */}
            <div className="pt-1 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsUtilitiesMenuOpen(false);
                  onLogout();
                }}
                className="w-full p-2 rounded-xl text-left text-xs font-bold hover:bg-rose-50 text-rose-700 transition-all cursor-pointer flex items-center gap-2.5"
              >
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-sm shrink-0">
                  🚪
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold truncate">Thoát tài khoản</p>
                  <p className="text-[10px] text-rose-500 font-normal truncate">Đăng xuất màn hình Kiosk</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {installMessage && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 rounded-full bg-stone-900 text-white px-4 py-2 text-[10px] font-semibold shadow-xl">
            {installMessage}
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
              defaultZoom={1.65}
              className="w-full h-full rounded-none border-none shadow-none"
            />
          </main>
        ) : (
          <main className="flex-1 min-h-0 grid grid-cols-[42%_58%] robot-safe-x robot-safe-bottom">
            <div className="relative min-w-0 flex flex-col items-center justify-center border-r border-stone-200 px-4">
              <button
                onClick={onStartTalk}
                disabled={isBusy || !hasSpeechSupport}
                className="w-full flex-1 min-h-0 flex items-center justify-center active:scale-[0.98] disabled:opacity-70 transition-transform"
                aria-label="Bắt đầu trò chuyện với Robot"
              >
                <RobotFace mode={getRobotMode(currentState)} compact />
              </button>
              <div className="shrink-0 text-center pb-3">
                <h1 className="text-xl font-black tracking-tight">{statusTitle}</h1>
                <p className="mt-0.5 text-[10px] font-medium text-stone-500">{statusSubtitle}</p>
              </div>
            </div>

            <div className="min-w-0 min-h-0 flex flex-col px-4 py-3">
              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                {aiResponseText ? (
                  <div className="h-full rounded-2xl bg-white border border-stone-200 p-4 flex flex-col">
                    <div className="flex items-center justify-between gap-3 pb-2 border-b border-stone-100">
                      <span className="text-[9px] font-extrabold tracking-[0.16em] uppercase text-emerald-800">Robot đang trả lời</span>
                      <span className="text-[9px] font-bold text-stone-500">{language}</span>
                    </div>
                    <p className="flex-1 min-h-0 overflow-y-auto py-3 text-sm leading-6 font-semibold">{aiResponseText}</p>
                    <div className="flex items-center gap-2"><AudioWave isActive={isSpeaking} /><span className="text-[9px] font-semibold text-stone-500">Đang phát qua loa</span></div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center">
                    {isListening && transcript ? (
                      <div className="rounded-2xl bg-white border border-stone-200 p-4">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-stone-500">Đã nghe được</p>
                        <p className="mt-2 text-sm leading-5 font-semibold line-clamp-4">{transcript}</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-stone-300 p-4 text-center">
                        <p className="text-sm font-bold">Tôi có thể hỗ trợ dịch vụ phòng, chỉ đường và thông tin khách sạn.</p>
                        <p className="mt-1 text-[10px] text-stone-500">Bấm Nói rồi đặt câu hỏi bằng tiếng Việt hoặc tiếng Anh.</p>
                      </div>
                    )}
                    {!hasSpeechSupport && (
                      <p className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[10px] font-semibold text-amber-900">Trình duyệt chưa hỗ trợ nhận giọng nói. Nên dùng Chrome trên Android.</p>
                    )}
                    {speechError && hasSpeechSupport && <p className="mt-2 text-[10px] font-semibold text-red-700">Không thể dùng microphone: {speechError}</p>}
                  </div>
                )}
              </div>

              <div className="shrink-0 pt-3 flex items-center justify-between gap-3">
                <button onClick={onResetSession} className="h-11 min-w-20 px-3 rounded-xl bg-white border border-stone-300 text-[10px] font-bold active:scale-95">Khách mới</button>
                <button
                  onClick={isListening ? onSubmitTalk : onStartTalk}
                  disabled={isBusy || !hasSpeechSupport}
                  className={`h-12 min-w-28 px-6 rounded-2xl border-4 border-white shadow-lg text-xs font-black tracking-wider active:scale-95 disabled:opacity-50 ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-stone-950 text-white'}`}
                >
                  {isListening ? 'GỬI' : isBusy ? 'ĐỢI' : 'NÓI'}
                </button>
                <button onClick={onToggleAutoListen} className="h-11 min-w-20 px-3 rounded-xl bg-white border border-stone-300 text-[10px] font-bold active:scale-95">Tự nghe: {isAutoListen ? 'Bật' : 'Tắt'}</button>
              </div>
            </div>
          </main>
        )}
      </div>
    </section>
  );
};
