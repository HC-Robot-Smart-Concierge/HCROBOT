import React, { useState, useEffect } from 'react';
import { Header } from '../../components/robot/Header';
import { RobotFace } from '../../components/robot/RobotFace';
import { AudioWave } from '../../components/robot/AudioWave';
import { FloorMap } from '../../components/robot/FloorMap';
import { CameraPreview } from '../../components/robot/CameraPreview';

import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { sendChatPrompt, extractIntent } from '../../services/aiApi';

import { Mic, MicOff, RefreshCw, Volume2, Sparkles, Lock, ShieldAlert, KeyRound, X, CheckCircle2 } from 'lucide-react';

export const RobotScreenPage = ({ onLogout = () => {} }) => {
  // States: 'RT-01' | 'RT-02' | 'RT-03' | 'RT-04' | 'RT-05'
  const [currentState, setCurrentState] = useState('RT-01');

  const [language, setLanguage] = useState('Tiếng Việt');
  const [aiResponseText, setAiResponseText] = useState('');
  const [detectedIntent, setDetectedIntent] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Robot Kiosk Protected Logout States
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutPassword, setLogoutPassword] = useState('');
  const [logoutError, setLogoutError] = useState('');

  // Hooks
  const { isListening, transcript, startListening, stopListening, resetTranscript, hasSupport } = useSpeechRecognition();
  const { speak, cancel: stopSpeaking, isSpeaking } = useSpeechSynthesis();

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'English' ? 'Tiếng Việt' : 'English'));
  };

  const [guestEmotion, setGuestEmotion] = useState('neutral');

  // Khi Camera phát hiện người lại gần (YOLO / Vision Sensor) -> Robot MỞ MẮT mỉm cười (im lặng chờ khách nói)
  const handleGuestApproached = () => {
    if (currentState === 'RT-01') {
      setCurrentState('RT-02'); // Mở mắt, hiển thị "Tôi có thể giúp gì?"
    }
  };

  // Khi người dùng đi xa khỏi Camera -> Robot nhắm mắt ngủ nghỉ (Chỉ khi Robot không đang bận nói/xử lý)
  const handleGuestLeft = () => {
    if (!isSpeaking && currentState === 'RT-02') {
      setCurrentState('RT-01');
    }
  };

  // 1. Khi ấn nút PRESS TO TALK -> Bật Micro thật
  const handleStartTalk = () => {
    stopSpeaking();
    resetTranscript();
    setAiResponseText('');
    setCurrentState('RT-03');
    startListening(language);
  };

  // 2. Khi dừng nói -> Tự động gửi tới Ollama RAG Backend kèm Cảm xúckhuôn mặt (guestEmotion)
  const handleStopTalkAndProcess = async (userText) => {
    stopListening();
    const query = userText || transcript;
    
    if (!query || query.trim().length === 0) {
      setCurrentState('RT-02');
      return;
    }

    setCurrentState('RT-04');
    setIsProcessing(true);

    try {
      // Gọi song song Ollama RAG Chat & Intent Extraction (Chế độ tự động phát hiện ngôn ngữ & cảm xúc)
      const [chatRes, intentRes] = await Promise.all([
        sendChatPrompt(query, null, "auto", guestEmotion),
        extractIntent(query)
      ]);

      const replyText = chatRes.response || 'Dạ, tôi đã ghi nhận yêu cầu của ông chủ.';
      const detectedLang = chatRes.detected_language || 'Tiếng Việt';
      const langCode = chatRes.lang_code || 'vi-VN';

      // Tự động đồng bộ ngôn ngữ được nhận dạng lên Header
      setLanguage(detectedLang);
      setAiResponseText(replyText);
      setDetectedIntent(intentRes);
      setIsProcessing(false);

      // Kiểm tra nếu nội dung liên quan tới di chuyển / vị trí -> Mở bản đồ RT-05
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('hồ bơi') || lowerQuery.includes('pool') || lowerQuery.includes('ở đâu') || lowerQuery.includes('tầng') || lowerQuery.includes('where')) {
        setCurrentState('RT-05');
      } else {
        setCurrentState('RT-02');
      }

      // Phát giọng nói AI qua Loa (TTS) bằng mã giọng đọc tự động (langCode)
      speak(replyText, langCode);

    } catch (error) {
      setIsProcessing(false);
      const fallbackText = 'Xin lỗi ông chủ, không thể kết nối tới Ollama AI Server.';
      setAiResponseText(fallbackText);
      setCurrentState('RT-02');
      speak(fallbackText, language);
    }
  };




  // Tự động xử lý khi Micro dừng lắng nghe
  useEffect(() => {
    if (!isListening && currentState === 'RT-03' && transcript.length > 0) {
      handleStopTalkAndProcess(transcript);
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

  const resetToIdle = () => {
    stopSpeaking();
    stopListening();
    resetTranscript();
    setCurrentState('RT-02');
  };

  return (
    <div className="w-full h-screen bg-aurora-canvas flex flex-col justify-start items-center overflow-hidden font-sans select-none relative">
      {/* Nút Khóa / Đăng xuất Robot Bảo Mật */}
      <button
        onClick={() => {
          setLogoutPassword('');
          setLogoutError('');
          setShowLogoutModal(true);
        }}
        className="absolute top-4 right-4 z-40 px-4 py-2 rounded-full bg-slate-900/90 text-white border border-slate-700/80 shadow-xl hover:bg-black transition-all flex items-center gap-2 text-xs font-bold cursor-pointer backdrop-blur-md"
      >
        <Lock className="w-3.5 h-3.5 text-amber-400" />
        <span>Đăng Xuất Robot</span>
      </button>

      {/* Camera Preview góc trên bên trái */}
      <CameraPreview 
        onGuestApproached={handleGuestApproached} 
        onGuestLeft={handleGuestLeft} 
        onEmotionChange={(emotion) => setGuestEmotion(emotion)}
      />

      {/* 1. Header */}
      <Header currentLanguage={language} onLanguageToggle={toggleLanguage} />

      {/* 2. Main Body Container */}
      <main className="w-full flex-1 px-16 py-[54px] flex items-center justify-center gap-16 overflow-hidden">
        
        {/* Render RT-05: Multi-floor Indoor Route Guidance */}
        {currentState === 'RT-05' ? (
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
                <div className="flex items-center gap-2 text-xs font-bold text-aurora-primary tracking-wider uppercase">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>OLLAMA RAG RESPONSE</span>
                </div>
                
                {/* AI Text Response */}
                <div className="p-4 bg-aurora-surface rounded-2xl border border-aurora-border shadow-sm text-sm font-medium text-aurora-primary leading-relaxed max-h-[160px] overflow-y-auto">
                  {aiResponseText || "Hồ bơi vô cực nằm ở tầng 4. Khăn tắm và nước uống được phục vụ miễn phí!"}
                </div>
              </div>

              {/* Step checklist */}
              <div className="w-full flex flex-col gap-2.5">
                <div className="p-3.5 bg-aurora-surface rounded-xl border border-aurora-border flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-aurora-inverse text-aurora-textInverse flex items-center justify-center font-bold text-xs">1</div>
                  <span className="text-xs font-semibold">Đi thẳng 20m tới Cụm Thang Máy A</span>
                </div>
                <div className="p-3.5 bg-aurora-surface rounded-xl border border-aurora-border flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-aurora-inverse text-aurora-textInverse flex items-center justify-center font-bold text-xs">2</div>
                  <span className="text-xs font-semibold">Đi Thang Máy A lên Tầng 4 (Wellness)</span>
                </div>
                <div className="p-3.5 bg-aurora-surface rounded-xl border border-aurora-border flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-aurora-inverse text-aurora-textInverse flex items-center justify-center font-bold text-xs">3</div>
                  <span className="text-xs font-semibold">Rẽ phải theo hành lang đến Hồ Bơi</span>
                </div>
              </div>

              {/* Reset Action */}
              <button 
                onClick={resetToIdle}
                className="w-full py-4 bg-aurora-inverse text-aurora-textInverse rounded-2xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer shadow-lg"
              >
                <RefreshCw className="w-5 h-5" />
                <span>HỎI CÂU HỎI MỚI</span>
              </button>
            </div>
          </div>
        ) : (
          /* Render RT-01, RT-02, RT-03, RT-04 Layout (Robot Face + Message) */
          <>
            {/* Left Column: Robot Face Avatar */}
            <RobotFace 
              mode={
                currentState === 'RT-01' ? 'sleeping' :
                currentState === 'RT-03' ? 'listening' :
                currentState === 'RT-04' ? 'processing' : 'welcome'
              } 
            />

            {/* Right Column: Dynamic Detection Message & Controls */}
            <div className="w-[590px] h-[480px] flex flex-col justify-center items-start gap-4 text-aurora-primary">
              <div className="w-full flex items-center justify-between">
                <span className="text-sm font-semibold tracking-wider opacity-80 uppercase flex items-center gap-2">
                  <span>AURORA GRAND CONCIERGE</span>
                  {isSpeaking && <Volume2 className="w-4 h-4 text-emerald-600 animate-pulse" />}
                </span>

                {/* Huy Hiệu Đồng Cảm Khi Khách Giận / Không Hài Lòng */}
                {(guestEmotion === 'annoyed' || guestEmotion === 'angry') && (
                  <span className="px-3 py-1 bg-rose-100 border border-rose-300 rounded-full text-rose-800 font-extrabold text-[11px] flex items-center gap-1.5 shadow-sm animate-pulse">
                    <span>😠 KHÁCH HÀNG GIẬN • AI DỰNG THÁI ĐỘ XOA DỊU</span>
                  </span>
                )}
                {guestEmotion === 'happy' && (
                  <span className="px-3 py-1 bg-emerald-100 border border-emerald-300 rounded-full text-emerald-800 font-extrabold text-[11px] flex items-center gap-1.5 shadow-sm">
                    <span>😊 KHÁCH HÀNG VUI VẺ</span>
                  </span>
                )}
              </div>


              {/* Dynamic Headlines */}
              <h2 className="text-5xl font-bold leading-none tracking-tight">
                {currentState === 'RT-01' && "Xin chào ông chủ!"}
                {currentState === 'RT-02' && (language === 'English' ? "How may I help?" : "Tôi có thể giúp gì?")}
                {currentState === 'RT-03' && "Tôi đang lắng nghe…"}
                {currentState === 'RT-04' && "Đang suy luận RAG…"}
              </h2>

              {/* Dynamic Descriptions */}
              <p className="text-xl font-normal leading-relaxed text-aurora-primary opacity-90 max-w-[570px]">
                {currentState === 'RT-01' && "Chào mừng đến với Aurora Grand Hotel. Tôi là HCRobot trợ lý khách sạn thông minh."}
                {currentState === 'RT-02' && "Nhấn nút Micro và nói tự nhiên. Bạn có thể hỏi vị trí, dịch vụ hoặc quy định khách sạn."}
                {currentState === 'RT-03' && "Hãy nói vào Micro. Tôi đang nhận dạng giọng nói của bạn..."}
                {currentState === 'RT-04' && "Đang truy vấn dữ liệu tri thức ChromaDB và sinh câu trả lời bằng Ollama LLM..."}
              </p>

              {/* Live AI Response Text Display */}
              {aiResponseText && currentState === 'RT-02' && (
                <div className="w-[520px] p-4 bg-emerald-100/80 border border-emerald-300 rounded-2xl text-emerald-950 font-medium text-base shadow-sm">
                  <strong className="block text-xs text-emerald-800 font-bold uppercase mb-1">Robot trả lời:</strong>
                  {aiResponseText}
                </div>
              )}

              {/* Status / Transcript Boxes */}
              {currentState === 'RT-02' && (
                <>
                  <div className="w-[520px] h-14 px-5 bg-aurora-surface rounded-2xl flex items-center gap-4 shadow-sm">
                    <AudioWave isActive={isSpeaking} />
                    <span className="text-sm font-semibold">
                      {isSpeaking ? "Robot đang phát giọng nói qua loa…" : "Sẵn sàng nhận giọng nói từ Micro thật."}
                    </span>
                  </div>

                  {/* Primary Press to Talk Button with Real Mic */}
                  <button 
                    onClick={handleStartTalk}
                    className="w-[520px] h-[86px] px-6 bg-aurora-inverse text-aurora-textInverse rounded-2xl flex items-center justify-center gap-4 hover:bg-black active:scale-[0.98] transition-all cursor-pointer shadow-xl group"
                  >
                    <div className="w-12 h-12 rounded-full bg-aurora-surface/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Mic className="w-7 h-7 text-aurora-textInverse" />
                    </div>
                    <span className="text-xl font-semibold tracking-wider uppercase">NHẤN ĐỂ NÓI (MIC THẬT)</span>
                  </button>
                </>
              )}

              {currentState === 'RT-03' && (
                <div className="w-[520px] flex flex-col gap-3">
                  <div className="w-[520px] h-20 px-5 bg-aurora-surface rounded-2xl flex items-center gap-4 shadow-inner border-2 border-emerald-500">
                    <AudioWave isActive={true} />
                    <span className="text-lg font-semibold italic text-emerald-900">
                      “{transcript || "Đang chờ bạn nói..."}”
                    </span>
                  </div>

                  <button
                    onClick={() => handleStopTalkAndProcess(transcript)}
                    className="w-[520px] py-3 bg-emerald-600 text-white font-bold rounded-xl shadow hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MicOff className="w-5 h-5" />
                    <span>HOÀN TẤT NÓI & GỬI AI</span>
                  </button>
                </div>
              )}

              {currentState === 'RT-04' && (
                <div className="w-[520px] h-20 px-5 bg-aurora-surface rounded-2xl flex items-center justify-center gap-4 shadow-sm border border-aurora-border">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-aurora-primary rounded-full animate-ping" />
                    <div className="w-3 h-3 bg-aurora-primary rounded-full animate-ping [animation-delay:0.2s]" />
                    <div className="w-3 h-3 bg-aurora-primary rounded-full animate-ping [animation-delay:0.4s]" />
                  </div>
                  <span className="text-base font-bold tracking-wider">ĐANG XỬ LÝ AI OLLAMA & RAG • VUI LÒNG CHỜ</span>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* 3. Bottom Dev State Switcher */}
      <footer className="absolute bottom-3 bg-aurora-inverse/90 text-aurora-textInverse px-4 py-2 rounded-full text-xs flex items-center gap-3 shadow-2xl backdrop-blur-md">
        <span className="font-bold text-aurora-border">DEV SIMULATOR:</span>
        {['RT-01', 'RT-02', 'RT-03', 'RT-04', 'RT-05'].map((st) => (
          <button
            key={st}
            onClick={() => setCurrentState(st)}
            className={`px-3 py-1 rounded-full font-semibold transition-all ${
              currentState === st 
                ? 'bg-aurora-canvas text-aurora-inverse scale-105' 
                : 'hover:bg-white/20 text-aurora-border'
            }`}
          >
            {st}
          </button>
        ))}
      </footer>

      {/* Modal Bảo Mật Nhập Mật Khẩu Đăng Xuất Robot */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-stone-900 border border-stone-700 text-white rounded-3xl p-7 max-w-md w-full shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowLogoutModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-stone-800 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                <Lock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Mật Khẩu Đăng Xuất Robot</h3>
                <p className="text-[11px] text-stone-400">Ngăn người dùng tự ý thoát khỏi màn hình Kiosk</p>
              </div>
            </div>

            {logoutError && (
              <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-bold flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{logoutError}</span>
              </div>
            )}

            <form onSubmit={handleProtectedLogoutSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5 uppercase tracking-wider">
                  Mật khẩu Bảo vệ (Password)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    placeholder="Nhập mật khẩu (Mặc định: 123456)"
                    value={logoutPassword}
                    onChange={(e) => setLogoutPassword(e.target.value)}
                    autoFocus
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-stone-950 border border-stone-700 text-sm font-medium text-white outline-none focus:border-amber-400 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-stone-400 mt-2">
                  🔑 Mật khẩu mẫu: <code className="text-amber-300 font-bold">123456</code> hoặc <code className="text-amber-300 font-bold">robot123</code>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-extrabold text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác Nhận Đăng Xuất</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
