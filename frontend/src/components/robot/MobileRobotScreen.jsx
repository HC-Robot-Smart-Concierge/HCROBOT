import React, { useEffect, useState } from 'react';
import { AudioWave } from './AudioWave';
import { RobotFace } from './RobotFace';
import { usePwaInstall } from '../../hooks/usePwaInstall';

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
}) => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [installMessage, setInstallMessage] = useState('');
  const { canInstall, isIos, isStandalone, promptInstall } = usePwaInstall();
  const [statusTitle, statusSubtitle] = getStatusCopy(currentState, isSpeaking, language);
  const isBusy = isProcessing || currentState === 'RT-04' || isSpeaking;

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
        <header className="h-12 shrink-0 flex items-center justify-between gap-3 border-b border-stone-200 px-4 robot-safe-x">
          <div className="flex items-center gap-3 min-w-0">
            <strong className="text-sm tracking-tight">HCROBOT</strong>
            <span className="hidden min-[680px]:inline text-[10px] font-semibold text-stone-500">Aurora Grand Hotel</span>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} title={isOnline ? 'Đã kết nối' : 'Ngoại tuyến'} />
          </div>
          <div className="flex items-center gap-2">
            {activeRoomNumber && <span className="text-[10px] font-bold text-stone-600">Phòng {activeRoomNumber}</span>}
            {!isStandalone && (canInstall || isIos) && (
              <button onClick={handleInstall} className="h-8 px-3 rounded-full bg-white border border-stone-300 text-[10px] font-bold active:scale-95">Cài ứng dụng</button>
            )}
            <button onClick={onToggleLanguage} className="h-8 min-w-10 px-2 rounded-full bg-white border border-stone-300 text-[10px] font-bold active:scale-95">
              {language === 'English' ? 'EN' : 'VI'}
            </button>
            <button onClick={onLogout} className="h-8 px-3 rounded-full bg-stone-900 text-white text-[10px] font-bold active:scale-95">Thoát</button>
          </div>
        </header>

        {installMessage && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 rounded-full bg-stone-900 text-white px-4 py-2 text-[10px] font-semibold shadow-xl">
            {installMessage}
          </div>
        )}

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
              {currentState === 'RT-05' ? (
                <div className="h-full grid grid-cols-[1fr_1.15fr] gap-3">
                  <div className="rounded-2xl bg-white border border-stone-200 p-3 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700">Điểm đến</p>
                      <h2 className="mt-1 text-lg font-black">Hồ bơi · Tầng 4</h2>
                      <p className="mt-2 text-[11px] leading-4 text-stone-600">{aiResponseText || 'Hồ bơi vô cực nằm ở tầng 4. Khăn tắm và nước uống được phục vụ miễn phí.'}</p>
                    </div>
                    <button onClick={onResetToIdle} className="mt-2 h-9 rounded-xl bg-stone-900 text-white text-[10px] font-bold">Hỏi câu khác</button>
                  </div>
                  <ol className="space-y-2">
                    {['Đi thẳng 20m tới thang máy A', 'Đi thang máy lên tầng 4', 'Rẽ phải đến khu hồ bơi'].map((step, index) => (
                      <li key={step} className="min-h-[52px] flex items-center gap-3 rounded-2xl bg-white border border-stone-200 px-3 text-[10px] font-semibold">
                        <span className="w-7 h-7 shrink-0 rounded-full bg-stone-900 text-white flex items-center justify-center">{index + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : aiResponseText ? (
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

            {currentState !== 'RT-05' && (
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
            )}
          </div>
        </main>
      </div>
    </section>
  );
};
