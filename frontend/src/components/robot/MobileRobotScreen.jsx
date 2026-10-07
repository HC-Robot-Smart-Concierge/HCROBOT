import React, { useEffect, useState } from 'react';
import { RobotFace } from './RobotFace';
import { AudioWave } from './AudioWave';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { Mic, MicOff, RotateCcw, Volume2, Sparkles } from 'lucide-react';

const getRobotMode = (state, isSpeaking, isProcessing, isListening) => {
  if (state === 'RT-01') return 'sleeping';
  if (isProcessing || state === 'RT-04') return 'processing';
  if (isSpeaking) return 'speaking';
  if (isListening || state === 'RT-03') return 'listening';
  return 'welcome';
};

const getStatusCopy = (state, isSpeaking, isProcessing, isListening, language) => {
  const english = language === 'English';
  if (isSpeaking) {
    return english ? ['Speaking', 'Please listen to Rora'] : ['Đang trả lời', 'Quý khách vui lòng lắng nghe'];
  }
  if (isProcessing || state === 'RT-04') {
    return english ? ['Thinking', 'Generating response with Llama 3.2 3B'] : ['Đang xử lý', 'Rora đang suy nghĩ câu trả lời'];
  }
  if (isListening || state === 'RT-03') {
    return english ? ['Listening', 'Please speak clearly into microphone'] : ['Đang lắng nghe', 'Quý khách hãy nói câu hỏi'];
  }
  if (state === 'RT-01') {
    return english ? ['Sleeping', 'Tap to wake up Rora'] : ['Đang nghỉ ngơi', 'Chạm vào màn hình để bắt đầu'];
  }
  return english ? ['Hello', 'Tap microphone to talk'] : ['Xin chào', 'Chạm vào micro để nói chuyện'];
};

export const MobileRobotScreen = ({
  activeRoomNumber,
  guestEmotion = 'neutral',
  spokenSubtitle = '',
  currentState = 'RT-02',
  isListening = false,
  isProcessing = false,
  isSpeaking = false,
  language = 'Tiếng Việt',
  transcript = '',
  volumeLevel = 0,
  onStartTalk = () => {},
  onStopSpeaking = () => {},
  onResetSession = () => {},
  onResetToIdle = () => {},
  onToggleLanguage = () => {},
  onLogout = () => {},
}) => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [installMessage, setInstallMessage] = useState('');
  const { canInstall, isIos, isStandalone, promptInstall } = usePwaInstall();
  const [statusTitle, statusSubtitle] = getStatusCopy(currentState, isSpeaking, isProcessing, isListening, language);

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
    <section className="robot-mobile-ui absolute inset-0 z-20 bg-[#F5F2EB] text-stone-950 flex flex-col font-sans select-none">
      {/* Cảnh báo xoay ngang */}
      <div className="robot-portrait-guard absolute inset-0 z-50 bg-stone-950 text-white items-center justify-center text-center p-8">
        <div>
          <p className="text-xs font-bold tracking-[0.24em] uppercase text-stone-400">AURORA CONCIERGE</p>
          <h2 className="mt-3 text-2xl font-black">Vui lòng xoay ngang điện thoại</h2>
          <p className="mt-2 text-sm text-stone-400">Màn hình Robot được thiết kế tối ưu cho góc nhìn ngang.</p>
        </div>
      </div>

      <div className="robot-landscape-content h-full w-full flex flex-col justify-between">
        {/* Top Header */}
        <header className="h-12 shrink-0 flex items-center justify-between gap-3 border-b border-stone-200 px-4 bg-white/70 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <strong className="text-xs font-black tracking-tight text-stone-900">AURORA ROBOT</strong>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>

          <div className="flex items-center gap-2">
            {!isStandalone && (canInstall || isIos) && (
              <button onClick={handleInstall} className="h-7 px-2.5 rounded-full bg-white border border-stone-300 text-[10px] font-bold shadow-sm">
                Cài App
              </button>
            )}
            <button
              onClick={onResetSession}
              className="h-7 px-2.5 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-300 text-[10px] font-bold active:scale-95 text-stone-700"
            >
              Khách mới
            </button>
            <button
              onClick={onToggleLanguage}
              className="h-7 min-w-8 px-2 rounded-full bg-white border border-stone-300 text-[10px] font-bold text-stone-800 active:scale-95 shadow-sm"
            >
              {language === 'English' ? 'EN' : 'VI'}
            </button>
            <button
              onClick={onLogout}
              className="h-7 px-2.5 rounded-full bg-stone-900 text-white text-[10px] font-bold active:scale-95"
            >
              Thoát
            </button>
          </div>
        </header>

        {installMessage && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 rounded-full bg-stone-900 text-white px-4 py-2 text-[10px] font-semibold shadow-xl">
            {installMessage}
          </div>
        )}

        {/* Central Workspace: RobotFace & Voice Control */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-2 text-center">
          {/* Big Center Robot Face */}
          <div className="scale-110 sm:scale-120 py-2">
            <RobotFace mode={getRobotMode(currentState, isSpeaking, isProcessing, isListening)} compact />
          </div>

          <div className="mt-2 max-w-md w-full flex flex-col items-center gap-2">
            <h1 className="text-base font-black tracking-tight text-stone-900">{statusTitle}</h1>
            <p className="text-[11px] text-stone-500 font-medium">{statusSubtitle}</p>

            {/* Subtitle / Phụ đề lời nói */}
            {isSpeaking || spokenSubtitle ? (
              <div className="w-full px-4 py-3 bg-white/95 rounded-2xl border border-stone-200 shadow-sm flex flex-col items-center gap-1.5 animate-fadeIn">
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 uppercase">
                  <AudioWave isActive={isSpeaking} />
                  <span>Rora đang nói</span>
                </div>
                <p className="text-xs font-bold text-stone-900 leading-snug line-clamp-3">
                  {spokenSubtitle}
                </p>
                {isSpeaking && (
                  <button
                    onClick={onStopSpeaking}
                    className="text-[10px] font-bold text-stone-500 underline pt-0.5"
                  >
                    Dừng nói
                  </button>
                )}
              </div>
            ) : isListening ? (
              <div className="px-5 py-2.5 rounded-full bg-white/95 border border-emerald-500/40 shadow-sm flex items-center gap-2.5 animate-fadeIn">
                <AudioWave isActive={true} volumeLevel={volumeLevel} />
                <span className="text-xs font-bold text-emerald-800">
                  {transcript ? `"${transcript}"` : 'Đang lắng nghe bạn nói...'}
                </span>
              </div>
            ) : null}
          </div>
        </main>

        {/* Bottom Mic Control Button */}
        <footer className="h-16 shrink-0 flex items-center justify-center px-4 pb-2">
          <button
            onClick={isSpeaking ? onStopSpeaking : onStartTalk}
            disabled={isProcessing}
            className={`px-8 py-3.5 rounded-full text-xs font-black tracking-wide shadow-lg flex items-center gap-2.5 transition-all active:scale-95 disabled:opacity-50 ${
              isListening
                ? 'bg-emerald-600 text-white animate-pulse'
                : isSpeaking
                ? 'bg-amber-600 text-white'
                : 'bg-stone-950 text-white hover:bg-stone-800'
            }`}
          >
            <Mic className="w-4 h-4 text-emerald-400" />
            <span>{isListening ? 'ĐANG LẮNG NGHE...' : isSpeaking ? 'CHẠM ĐỂ DỪNG NÓI' : 'CHẠM ĐỂ NÓI CHUYỆN'}</span>
          </button>
        </footer>
      </div>
    </section>
  );
};
