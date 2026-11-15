import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  AlertCircle,
  Languages,
} from 'lucide-react';

export function MessengerCallStageAndControls({
  toggleMic,
  toggleVideo,
  toggleSpeaker,
  handleEndCall,
  activeSubtitle, callStatus, calleeName, callerName, errorMessage, hasNoCamera, interimText, isAiSpeaking, isMicMuted, isSpeakerMuted, isVideoDisabled, localVideoRef, remoteVideoRef, role, translateMode,
}) {
  return (
    <>
        {/* MAIN VIDEO SCREEN */}
        <div className="relative flex-1 bg-[#121212] flex items-center justify-center overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            webkit-playsinline="true"
            muted={isSpeakerMuted}
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              callStatus === 'connected' ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {callStatus !== 'connected' && callStatus !== 'ended' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-10 bg-[#121212]/95">
              <div className="relative mb-3 sm:mb-5">
                <div className="w-12 h-12 rounded-full border-3 border-stone-700 border-t-emerald-400 animate-spin" />
              </div>

              <h2 className="text-white text-sm sm:text-base font-medium">
                Đang kết nối với nhân viên...
              </h2>

              {errorMessage && (
                <div className="mt-3 flex items-center gap-2 text-xs text-rose-300 bg-rose-950/70 border border-rose-500/50 px-3.5 py-2 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {callStatus === 'ended' && (
            <div className="absolute inset-0 z-30 bg-[#121212]/95 flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300 mb-3 shadow-lg">
                <PhoneOff className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-white text-sm sm:text-base font-semibold">Cuộc gọi đã kết thúc</h3>
            </div>
          )}

          {/* FLOATING CINEMA SUBTITLE BAR (GOOGLE MEET CLOSED CAPTIONS STYLE) */}
          {(activeSubtitle || (interimText && translateMode !== 'bypass')) && (
            <div className="absolute bottom-20 sm:bottom-24 lg:bottom-26 left-3 right-3 sm:left-6 sm:right-6 z-25 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-[#202124]/95 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3 sm:px-6 sm:py-3.5 max-w-2xl text-center shadow-2xl space-y-1.5 pointer-events-auto">
                {interimText && !activeSubtitle && (
                  <p className="text-stone-300 text-xs sm:text-sm italic font-mono animate-pulse">
                    "{interimText}..."
                  </p>
                )}

                {activeSubtitle && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-stone-200 border border-white/10">
                        {activeSubtitle.senderRole === role
                          ? 'Bạn'
                          : (activeSubtitle.senderRole === 'staff' ? calleeName : callerName)}
                      </span>
                      <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        <Languages className="w-3 h-3" />
                        <span>
                          {activeSubtitle.needsTranslation
                            ? `${(activeSubtitle.sourceLang || 'en').toUpperCase()} ➔ ${(activeSubtitle.targetLang || 'vi').toUpperCase()}`
                            : `${(activeSubtitle.sourceLang || 'vi').toUpperCase()} (Gốc)`}
                        </span>
                      </span>
                      {activeSubtitle.needsTranslation && (
                        <span className="text-[10px] font-medium text-emerald-300 flex items-center gap-1 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          <Volume2 className={`w-2.5 h-2.5 ${isAiSpeaking ? 'animate-bounce text-emerald-300' : ''}`} />
                          <span>AI Voice</span>
                        </span>
                      )}
                    </div>

                    {activeSubtitle.needsTranslation && activeSubtitle.originalText !== activeSubtitle.translatedText && (
                      <p className="text-stone-400 text-[11px] sm:text-xs italic leading-tight">
                        "{activeSubtitle.originalText}"
                      </p>
                    )}

                    <p className="text-white text-xs sm:text-sm md:text-base font-semibold leading-relaxed tracking-wide">
                      {activeSubtitle.translatedText || activeSubtitle.originalText}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* PICTURE-IN-PICTURE: LOCAL SELF VIDEO (GOOGLE MEET STYLE) */}
          <div className="absolute bottom-20 sm:bottom-24 right-3 sm:right-4 w-24 h-32 sm:w-28 sm:h-36 lg:w-44 lg:h-56 rounded-2xl overflow-hidden bg-[#202124] border border-white/15 shadow-2xl z-20 transition-all">
            {hasNoCamera ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#202124] to-[#141414] p-2 text-center select-none">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#3c4043] flex items-center justify-center mb-1.5 shadow-inner">
                  <Mic className={`w-5 h-5 ${isMicMuted ? 'text-red-400' : 'text-emerald-400 animate-pulse'}`} />
                </div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-white">
                  {role === 'guest' ? 'Robot Kiosk' : 'Nhân viên'}
                </span>
                <span className="text-[9px] text-stone-400 leading-tight">
                  {isMicMuted ? 'Micro đã tắt' : 'Đang bật Micro'}
                </span>
              </div>
            ) : (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  webkit-playsinline="true"
                  muted
                  className={`w-full h-full object-cover ${isVideoDisabled ? 'hidden' : 'block'}`}
                />
                {isVideoDisabled && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#202124] text-stone-400">
                    <VideoOff className="w-5 h-5 mb-1 text-stone-500" />
                    <span className="text-[10px]">Camera tắt</span>
                  </div>
                )}
              </>
            )}
            <div className="absolute bottom-2 left-2 text-[10px] text-white/90 bg-[#202124]/80 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-full font-medium">
              Bạn
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION CONTROLS BAR (GOOGLE MEET FLOATING DOCK STYLE) */}
        <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-center z-30 shrink-0 robot-safe-x">
          <div className="flex items-center gap-2 sm:gap-3 bg-[#202124]/90 backdrop-blur-md px-3 sm:px-5 py-2 sm:py-2.5 rounded-full border border-white/10 shadow-2xl">
            {/* 1. MUTE MIC BUTTON */}
            <button
              type="button"
              onClick={toggleMic}
              title={isMicMuted ? 'Bật mic' : 'Tắt mic'}
              aria-label={isMicMuted ? 'Bật micro' : 'Tắt micro'}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm ${
                isMicMuted
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                  : 'bg-[#3c4043] hover:bg-[#474a4d] text-white hover:shadow-md'
              }`}
            >
              {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* 2. CAMERA TOGGLE (STAFF ONLY) */}
            {role === 'staff' && (
              <button
                type="button"
                onClick={toggleVideo}
                title={isVideoDisabled ? 'Bật máy ảnh' : 'Tắt máy ảnh'}
                aria-label={isVideoDisabled ? 'Bật camera' : 'Tắt camera'}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm ${
                  isVideoDisabled
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                    : 'bg-[#3c4043] hover:bg-[#474a4d] text-white hover:shadow-md'
                }`}
              >
                {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            {/* 3. SPEAKER / AUDIO TOGGLE */}
            <button
              type="button"
              onClick={toggleSpeaker}
              title={isSpeakerMuted ? 'Bật loa' : 'Tắt loa'}
              aria-label={isSpeakerMuted ? 'Bật loa' : 'Tắt loa'}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm ${
                isSpeakerMuted
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                  : 'bg-[#3c4043] hover:bg-[#474a4d] text-white hover:shadow-md'
              }`}
            >
              {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* DIVIDER */}
            <div className="w-px h-6 bg-white/15 mx-1 hidden sm:block" />

            {/* 4. END CALL BUTTON (GOOGLE MEET RED PILL) */}
            <button
              type="button"
              onClick={() => handleEndCall(true)}
              title="Rời khỏi cuộc gọi"
              aria-label="Rời khỏi cuộc gọi"
              className="px-5 sm:px-6 h-11 sm:h-12 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer active:scale-95"
            >
              <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span className="font-semibold hidden xs:inline sm:inline">Kết thúc</span>
            </button>
          </div>
        </div>
    </>
  );
}
