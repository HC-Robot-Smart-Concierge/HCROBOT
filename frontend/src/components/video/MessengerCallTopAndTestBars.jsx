import React from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Loader2,
  Maximize2,
  Minimize2,
  AlertCircle,
  Languages,
  Sparkles,
} from 'lucide-react';
import { formatTime } from './messengerVideoCallUtils';

export function MessengerCallTopAndTestBars({
  micLangBadgeLabel,
  primeAudioContext,
  processAudioQueue,
  cycleInputLangMode,
  handleToggleTranslateMode,
  toggleMic,
  toggleFullscreen,
  handleSimulateGuestSpeech,
  handleSimulateStaffSpeech,
  callStatus, calleeName, callerName, inputLangMode, isAiSpeaking, isAudioBlocked, isFullscreen, isMicMuted, isTestTranslating, recordingDuration, role, roomNumber, setIsAudioBlocked, setShowTestPanel, setSttStatusMessage, setTestCustomText, showTestPanel, sttStatusMessage, testCustomText, translateMode, ttsStatus,
}) {
  return (
    <>
        {/* TOP BAR (GOOGLE MEET MINIMALIST HEADER) */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-gradient-to-b from-[#141413]/90 via-[#141413]/50 to-transparent robot-safe-x">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="text-white text-xs sm:text-sm font-semibold tracking-wide truncate max-w-[120px] sm:max-w-[180px] md:max-w-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{role === 'guest' ? (calleeName || 'Nhân viên hỗ trợ') : (callerName || 'Khách hàng')}</span>
              {roomNumber && (
                <span className="hidden sm:inline-block text-[11px] text-stone-300 bg-white/10 px-2 py-0.5 rounded-full font-normal">
                  Phòng {roomNumber}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {callStatus === 'connected' && (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="flex items-center bg-[#202124]/90 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-lg">
                  {/* 1. NÚT THÔNG DỊCH AI (EN ⇄ VI) */}
                  <button
                    type="button"
                    onClick={() => handleToggleTranslateMode('auto')}
                    className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                      translateMode === 'auto'
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/60 shadow-sm'
                        : 'text-stone-300 hover:text-white hover:bg-white/10'
                    }`}
                    title="Bật chế độ Thông dịch AI: Khách nói tiếng Anh ➔ Dịch tiếng Việt (phát âm Hoài My); Nhân viên nói tiếng Việt ➔ Dịch tiếng Anh (phát âm Jenny); Tự động giữ nguyên nếu cùng ngôn ngữ"
                  >
                    <Languages className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                    <span>EN ⇄ VI</span>
                  </button>

                  {/* 2. NÚT THUẦN VIỆT (KHÔNG DỊCH) */}
                  <button
                    type="button"
                    onClick={() => handleToggleTranslateMode('bypass')}
                    className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                      translateMode === 'bypass'
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 shadow-sm'
                        : 'text-stone-300 hover:text-white hover:bg-white/10'
                    }`}
                    title="Bật chế độ Thuần Việt: Cả 2 bên nói tiếng Việt trực tiếp, không dịch, không phát âm AI"
                  >
                    <span>Thuần Việt</span>
                  </button>

                  {/* 3. NÚT CHỌN NGÔN NGỮ ĐẦU VÀO MICRO (AUTO EN/VI | EN | VI) */}
                  {translateMode === 'auto' && (
                    <button
                      type="button"
                      onClick={cycleInputLangMode}
                      className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold text-sky-300 hover:bg-white/10 transition-all cursor-pointer"
                      title="Chuyển chế độ nhận diện ngôn ngữ đầu vào của Micro: Đa ngữ tự động (AUTO EN/VI) / Cố định EN / Cố định VI"
                    >
                      <span>Nghe: {inputLangMode === 'auto' ? 'Đa ngữ' : inputLangMode.toUpperCase()}</span>
                    </button>
                  )}

                  {/* 4. NÚT TEST NHANH GIỌNG ĐỌC AI & PHỤ ĐỀ */}
                  <button
                    type="button"
                    onClick={() => setShowTestPanel(!showTestPanel)}
                    className={`hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                      showTestPanel
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-md'
                        : 'text-stone-300 hover:text-white hover:bg-white/10'
                    }`}
                    title="Mở bảng công cụ Thử nghiệm Nhanh: 1-click test giọng đọc Edge TTS & phiên dịch tức thì"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>🧪 Thử AI</span>
                  </button>
                </div>

                {isAiSpeaking && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/50 animate-pulse font-medium">
                    <Volume2 className="w-3 h-3 text-emerald-400" />
                    <span className="hidden sm:inline">AI Đang nói</span>
                  </span>
                )}

                {ttsStatus?.status === 'generating' && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-full border border-amber-500/50 animate-pulse font-medium">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    <span className="hidden sm:inline">Đang tạo giọng...</span>
                  </span>
                )}

                {ttsStatus?.status === 'failed' && (
                  <span
                    className="flex items-center gap-1 text-[10px] text-rose-300 bg-rose-950/80 px-2.5 py-1 rounded-full border border-rose-500/50 font-medium"
                    title={ttsStatus.message}
                  >
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                    <span className="hidden sm:inline">{ttsStatus.code || 'Lỗi TTS'}</span>
                  </span>
                )}
              </div>
            )}

            {/* LIVE STT LISTENING BADGE / 1-CLICK TOGGLE MIC */}
            {callStatus === 'connected' && (
              <button
                type="button"
                onClick={toggleMic}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-mono font-medium border cursor-pointer transition-all active:scale-95 ${
                  isMicMuted
                    ? 'bg-red-950/80 text-red-300 border-red-500/70 shadow-sm animate-pulse'
                    : 'bg-[#202124]/90 hover:bg-white/10 border-white/10 text-stone-200'
                }`}
                title={
                  isMicMuted
                    ? 'Micro đang TẮT - Nhấn để BẬT lại micro'
                    : `Micro đang BẬT (${micLangBadgeLabel}) - Nhấn để TẮT tạm thời`
                }
              >
                {isMicMuted ? (
                  <>
                    <MicOff className="w-2.5 h-2.5 text-red-400" />
                    <span className="font-bold text-red-300">Mic: TẮT</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                    <span className="hidden sm:inline">Mic:</span>
                    <span className="text-emerald-300 font-semibold">
                      {micLangBadgeLabel}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* CALL DURATION BADGE */}
            {callStatus === 'connected' && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono font-medium bg-[#202124]/90 border border-white/10 text-stone-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>
                  {role === 'staff'
                    ? `REC ${formatTime(recordingDuration)}`
                    : formatTime(recordingDuration)}
                </span>
              </div>
            )}

            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-full bg-[#202124]/90 hover:bg-white/10 text-stone-300 border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>

        {/* STT Status Warning Notification */}
        {sttStatusMessage && (
          <div className="absolute top-14 left-3 right-3 sm:left-4 sm:right-4 z-25 bg-[#202124]/95 border border-amber-500/50 text-amber-200 text-xs px-3.5 py-2 rounded-2xl flex items-center justify-between shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{sttStatusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSttStatusMessage('')}
              className="text-amber-400 hover:text-amber-200 ml-2 px-1 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* AUTOPLAY RESCUE BUTTON */}
        {isAudioBlocked && (
          <div className="absolute top-14 left-3 right-3 sm:left-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-35 animate-bounce">
            <button
              type="button"
              onClick={() => {
                primeAudioContext();
                setIsAudioBlocked(false);
                processAudioQueue();
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs sm:text-sm shadow-2xl border border-amber-300 cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-stone-950" />
              <span>Nhấn để bật tiếng loa phiên dịch (Autoplay Unlock)</span>
            </button>
          </div>
        )}

        {/* INTERACTIVE LIVE TRANSLATION & TTS TEST BAR */}
        {callStatus === 'connected' && showTestPanel && (
          <div className="absolute top-14 sm:top-16 left-3 right-3 sm:left-6 sm:right-6 z-30 bg-[#202124]/95 backdrop-blur-md border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Bảng Thử Nghiệm Nhanh Phiên Dịch AI & Giọng Đọc TTS Loa Kiosk</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTestPanel(false)}
                className="text-[11px] text-stone-400 hover:text-stone-200 px-2 py-0.5 rounded-full hover:bg-white/10 cursor-pointer"
              >
                ✕ Đóng
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2.5">
              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateGuestSpeech("Where is the swimming pool?")}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#3c4043] hover:bg-[#474a4d] text-stone-200 border border-white/10 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>Khách: "Where is the swimming pool?"</span>
              </button>

              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateStaffSpeech("Bể bơi nằm ở tầng 3 thưa quý khách")}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#3c4043] hover:bg-[#474a4d] text-stone-200 border border-white/10 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>Staff: "Bể bơi nằm ở tầng 3 thưa quý khách"</span>
              </button>

              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateGuestSpeech("Cho tôi hỏi nhà hàng mở cửa lúc mấy giờ?")}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#3c4043] hover:bg-[#474a4d] text-stone-200 border border-white/10 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>Khách: "Nhà hàng mở cửa lúc mấy giờ?"</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testCustomText}
                onChange={(e) => setTestCustomText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && testCustomText.trim()) {
                    handleSimulateGuestSpeech(testCustomText.trim());
                  }
                }}
                placeholder="Nhập câu bất kỳ để test thông dịch & giọng đọc Edge Neural..."
                className="flex-1 bg-[#141414] border border-white/15 rounded-full px-4 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                disabled={!testCustomText.trim() || isTestTranslating}
                onClick={() => handleSimulateGuestSpeech(testCustomText.trim())}
                className="px-3.5 py-1.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
              >
                <span>Khách nói</span>
              </button>
              <button
                type="button"
                disabled={!testCustomText.trim() || isTestTranslating}
                onClick={() => handleSimulateStaffSpeech(testCustomText.trim())}
                className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
              >
                <span>Staff nói</span>
              </button>
            </div>
          </div>
        )}
    </>
  );
}
