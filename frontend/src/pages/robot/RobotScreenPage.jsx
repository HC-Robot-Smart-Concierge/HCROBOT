import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../../components/robot/Header';
import { RobotFace } from '../../components/robot/RobotFace';
import { AudioWave } from '../../components/robot/AudioWave';
import { FloorMap } from '../../components/robot/FloorMap';
import { CameraPreview } from '../../components/robot/CameraPreview';

import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { sendChatPrompt, extractIntent, resetSession } from '../../services/aiApi';

import { RefreshCw, Volume2, Sparkles, LogOut } from 'lucide-react';

const anyKeywordMatch = (text, keywords) => keywords.some((k) => text.includes(k));

export const RobotScreenPage = ({ onLogout = () => {} }) => {
  // States: 'RT-01' | 'RT-02' | 'RT-03' | 'RT-04' | 'RT-05'
  const [currentState, setCurrentState] = useState('RT-01');

  const [language, setLanguage] = useState('Tiếng Việt');
  const [aiResponseText, setAiResponseText] = useState('');
  const [detectedIntent, setDetectedIntent] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-Listen Hands-Free State
  const [isAutoListen, setIsAutoListen] = useState(true);
  const silenceTimerRef = useRef(null);
  const wasSpeakingRef = useRef(false);

  // Session Memory & Room Number States
  const [sessionId] = useState(() => 'session_kiosk_' + Math.random().toString(36).substring(2, 9));
  const [activeRoomNumber, setActiveRoomNumber] = useState(null);

  // Robot Kiosk Protected Logout States
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutPassword, setLogoutPassword] = useState('');
  const [logoutError, setLogoutError] = useState('');

  // Hooks
  const { isListening, transcript, startListening, stopListening, resetTranscript, hasSupport } = useSpeechRecognition();
  const { speak, prime, cancel: stopSpeaking, isSpeaking } = useSpeechSynthesis();

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'English' ? 'Tiếng Việt' : 'English'));
  };

  const [guestEmotion, setGuestEmotion] = useState('neutral');

  // Xóa bộ nhớ phiên (Dùng cho nút Khách Mới / Đổi Phòng)
  const handleManualResetSession = async () => {
    stopSpeaking();
    stopListening();
    resetTranscript();
    setActiveRoomNumber(null);
    setAiResponseText('');
    setDetectedIntent(null);
    await resetSession(sessionId);
    setCurrentState('RT-02');
  };

  // Khi người dùng lại gần Camera -> Mở mắt & Chào hỏi chủ động theo thời gian thực
  const handleGuestApproached = () => {
    if (currentState === 'RT-01' || currentState === 'RT-02') {
      setCurrentState('RT-02');
      const hour = new Date().getHours();
      let greeting = "Dạ em chào quý khách! Em là trợ lý Robot Concierge của khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?";
      if (hour >= 5 && hour < 11) {
        greeting = "Dạ em chào buổi sáng quý khách! Chúc quý khách một ngày mới nhiều năng lượng. Quý khách cần em hỗ trợ gì ạ?";
      } else if (hour >= 11 && hour < 18) {
        greeting = "Dạ em chào quý khách! Chúc quý khách một buổi chiều vui vẻ tại Aurora. Quý khách cần em hỗ trợ gì ạ?";
      } else {
        greeting = "Dạ em chào buổi tối quý khách! Chúc quý khách một buổi tối thư thái tại Aurora. Quý khách cần em hỗ trợ gì ạ?";
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

  // Khi người dùng đi xa khỏi Camera -> Nhắm mắt & Reset
  const handleGuestLeft = () => {
    if (!isSpeaking && !isProcessing && currentState === 'RT-02' && !aiResponseText) {
      handleManualResetSession();
      setAiResponseText('');
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

    const lowerQuery = query.toLowerCase().strip ? query.toLowerCase().strip() : query.toLowerCase();
    const isFastPath = [
      'xin chào', 'chào em', 'chào robot', 'chào', 'hi', 'hello',
      'cảm ơn', 'cảm ơn em', 'thank you', 'thanks',
      'hồ bơi', 'wifi', 'mật khẩu wifi', 'giờ trả phòng'
    ].some(k => lowerQuery.includes(k));

    if (!isFastPath) {
      // Phản hồi giọng nói tức thì < 50ms giúp cảm giác không bị chờ đợt
      speak("Dạ, quý khách chờ em một tí nhé...", "vi-VN");
    }

    setCurrentState('RT-04');
    setIsProcessing(true);

    try {
      const needsIntentCheck = anyKeywordMatch(lowerQuery, ["khăn", "nước", "dọn", "phòng", "đồ ăn", "hỏng", "sửa", "bàn", "towel", "clean", "food", "room"]);

      const chatRes = await sendChatPrompt(query, null, "auto", guestEmotion, sessionId, activeRoomNumber);
      let intentRes = { action: 'faq' };

      if (needsIntentCheck) {
        intentRes = await extractIntent(query, sessionId, activeRoomNumber);
      }

      let replyText = chatRes.response || 'Dạ, tôi đã ghi nhận yêu cầu của quý khách.';
      if (intentRes && intentRes.suggested_reply) {
        replyText = intentRes.suggested_reply;
      }

      const detectedLang = chatRes.detected_language || 'Tiếng Việt';
      const langCode = chatRes.lang_code || 'vi-VN';

      const updatedRoom = (intentRes && intentRes.room_number) || chatRes.current_room_number;
      if (updatedRoom) {
        setActiveRoomNumber(updatedRoom);
      }

      setLanguage(detectedLang);
      setDetectedIntent(intentRes);
      setIsProcessing(false);

      if (lowerQuery.includes('hồ bơi') || lowerQuery.includes('pool') || lowerQuery.includes('ở đâu') || lowerQuery.includes('tầng') || lowerQuery.includes('where')) {
        setCurrentState('RT-05');
      }

      // Đồng bộ 100% thời điểm phát tiếng nói và hiển thị chữ lên màn hình (Zero Lag Sync)
      speak(
        replyText, 
        langCode, 
        // onEndCallback: Khi loa phát xong -> Xóa bảng chữ, hiện lại mắt xám nháy & Tự động nghe câu tiếp theo
        () => {
          setAiResponseText('');
          setCurrentState('RT-03');
          if (isAutoListen) {
            setTimeout(() => {
              handleStartTalk();
            }, 300);
          }
        }, 
        // onStartCallback: Khi tiếng cất lên -> Hiện bảng chữ ở trung tâm
        () => {
          setAiResponseText(replyText);
        }
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

  // Tự động gửi AI khi người dùng ngừng nói 650ms (VAD Silence Detection Tốc độ cao)
  useEffect(() => {
    if (currentState === 'RT-03' && transcript.trim().length > 0) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        handleStopTalkAndProcess(transcript);
      }, 650);
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
    <div 
      onClick={() => {
        prime();
        if ((currentState === 'RT-02' || currentState === 'RT-01') && !isSpeaking && !isProcessing) {
          handleStartTalk();
        }
      }}
      className="w-full h-screen bg-aurora-canvas flex flex-col justify-start items-center overflow-hidden font-sans select-none relative cursor-pointer"
    >
      {/* Camera Preview Control góc trên bên trái */}
      <CameraPreview 
        onGuestApproached={handleGuestApproached} 
        onGuestLeft={handleGuestLeft} 
        onEmotionChange={(emotion) => setGuestEmotion(emotion)}
      />

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
          /* Render Robot Display Mode (Khi trả lời -> Chỉ hiện bảng chữ ở trung tâm, không hiện mắt) */
          <div className="w-full h-full flex items-center justify-center relative">
            
            {aiResponseText ? (
              /* Khi Robot phát giọng trả lời -> HIỆN BẢNG CHỮ Ở TRUNG TÂM (KHÔNG HIỆN MẮT) */
              <div className="w-[580px] p-8 bg-white/95 backdrop-blur-xl border border-stone-200/80 rounded-3xl shadow-2xl flex flex-col gap-5 animate-fadeIn transform transition-all duration-300">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3.5">
                  <span className="text-xs font-extrabold tracking-wider uppercase text-emerald-800 flex items-center gap-2">
                    <Volume2 className={`w-4 h-4 text-emerald-600 ${isSpeaking ? 'animate-pulse' : ''}`} />
                    <span>{isSpeaking ? "Robot Đang Phát Giọng Nói..." : "Câu Trả Lời Của Robot"}</span>
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                    {language}
                  </span>
                </div>

                <div className="text-lg font-semibold text-stone-900 leading-relaxed max-h-[260px] overflow-y-auto custom-scrollbar">
                  {aiResponseText}
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 font-medium">
                  <span className="flex items-center gap-2">
                    <AudioWave isActive={isSpeaking} />
                    <span>{isSpeaking ? "Đang phát qua loa..." : "Đã hoàn tất trả lời"}</span>
                  </span>
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Tự động nghe câu tiếp theo</span>
                  </span>
                </div>
              </div>
            ) : (
              /* Khi sẵn sàng nghe / suy nghĩ / nghỉ -> HIỆN MẮT ROBOT Ở TRUNG TÂM */
              <div className="transition-all duration-500 flex flex-col items-center justify-center scale-105">
                <RobotFace 
                  mode={
                    currentState === 'RT-01' ? 'sleeping' :
                    currentState === 'RT-03' ? 'listening' :
                    currentState === 'RT-04' ? 'processing' : 'welcome'
                  } 
                />
              </div>
            )}

          </div>
        )}
      </main>

      {/* 3. Bottom Dev State Switcher (Chỉ là các hình tròn nhỏ màu sắc đại diện cho State, không chữ) */}
      <footer className="absolute bottom-4 bg-stone-900/80 px-3.5 py-2 rounded-full flex items-center gap-3 shadow-2xl backdrop-blur-md border border-stone-800/80 z-40">
        {[
          { id: 'RT-01', name: 'Sleeping', activeColor: 'bg-slate-400 ring-2 ring-slate-300 shadow-[0_0_10px_rgba(203,213,225,0.8)] scale-125', idleColor: 'bg-slate-600/70 hover:bg-slate-500' },
          { id: 'RT-02', name: 'Welcome', activeColor: 'bg-stone-100 ring-2 ring-white shadow-[0_0_10px_rgba(255,255,255,0.9)] scale-125', idleColor: 'bg-stone-500/70 hover:bg-stone-400' },
          { id: 'RT-03', name: 'Listening', activeColor: 'bg-slate-300 ring-2 ring-slate-200 shadow-[0_0_10px_rgba(148,163,184,0.9)] scale-125 animate-pulse', idleColor: 'bg-slate-500/70 hover:bg-slate-400' },
          { id: 'RT-04', name: 'Processing', activeColor: 'bg-sky-400 ring-2 ring-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.9)] scale-125 animate-pulse', idleColor: 'bg-sky-700/70 hover:bg-sky-600' },
          { id: 'RT-05', name: 'Route Guidance', activeColor: 'bg-emerald-400 ring-2 ring-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)] scale-125', idleColor: 'bg-emerald-700/70 hover:bg-emerald-600' },
        ].map((st) => {
          const isActive = currentState === st.id;
          return (
            <button
              key={st.id}
              onClick={() => setCurrentState(st.id)}
              className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${isActive ? st.activeColor : st.idleColor}`}
              title={`${st.id}: ${st.name}`}
            />
          );
        })}
      </footer>

      {/* Nút Đăng Xuất hình tròn màu xám bên góc bên phải dưới cùng */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setLogoutError('');
          setLogoutPassword('');
          setShowLogoutModal(true);
        }}
        title="Đăng xuất Robot"
        className="absolute bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-stone-700/80 hover:bg-stone-600 border border-stone-600/80 text-stone-200 hover:text-white flex items-center justify-center shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
      >
        <LogOut className="w-5 h-5" />
      </button>

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
              <p className="text-xs text-stone-500 font-medium">Ngăn người dùng tự ý thoát khỏi màn hình Kiosk</p>
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
    </div>
  );
};
