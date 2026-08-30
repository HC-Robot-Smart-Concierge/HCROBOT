import React from 'react';

export const RobotFace = ({ mode = 'welcome' }) => {
  const isListening = mode === 'listening';
  const isSpeaking = mode === 'speaking';
  const isProcessing = mode === 'processing';

  return (
    <div className="relative py-12 px-6 flex items-center justify-center min-h-[180px] transition-all duration-500 select-none">
      {/* Pure Robot Eyes Display Container (MẮT TO CAO FUTURISTIC) */}
      <div className="relative z-10 flex gap-16 items-center justify-center transition-all duration-500">
        {mode === 'sleeping' ? (
          // 1. Sleeping Mode (Mắt dài nhắm ngủ - Nằm ngang mỏng)
          <>
            <div className="w-[140px] h-[8px] bg-aurora-primary/60 rounded-full transition-all duration-500 translate-y-3 shadow-sm" />
            <div className="w-[140px] h-[8px] bg-aurora-primary/60 rounded-full transition-all duration-500 translate-y-3 shadow-sm" />
          </>
        ) : isProcessing ? (
          // 2. Processing Mode (Suy nghĩ -> Mắt màu XANH DƯƠNG NHẠT nhấp nháy)
          <>
            <div className="w-[150px] h-[36px] bg-sky-300 rounded-[18px] transition-all duration-300 animate-pulse shadow-[0_0_25px_rgba(125,211,252,0.8)]" />
            <div className="w-[150px] h-[36px] bg-sky-300 rounded-[18px] transition-all duration-300 animate-pulse shadow-[0_0_25px_rgba(125,211,252,0.8)]" />
          </>
        ) : isListening ? (
          // 3. Listening Mode (Sẵn sàng nghe -> Mắt màu XÁM nhấp nháy / nháy mắt xám)
          <>
            <div className="w-[150px] h-[64px] bg-slate-400/90 rounded-[32px] transition-all duration-300 animate-pulse shadow-md" />
            <div className="w-[150px] h-[64px] bg-slate-400/90 rounded-[32px] transition-all duration-300 animate-pulse shadow-md" />
          </>
        ) : isSpeaking ? (
          // 4. Speaking / Replying Mode (Chuyển màu rực rỡ nếu dùng độc lập)
          <>
            <div className="w-[155px] h-[72px] bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 rounded-[36px] transition-all duration-300 shadow-[0_0_40px_rgba(16,185,129,0.95)] animate-pulse" />
            <div className="w-[155px] h-[72px] bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 rounded-[36px] transition-all duration-300 shadow-[0_0_40px_rgba(16,185,129,0.95)] animate-pulse" />
          </>
        ) : (
          // 5. Normal Welcome Mode (Mắt cao 60px nằm ngang chuẩn, tối giản)
          <>
            <div className="w-[150px] h-[60px] bg-aurora-primary rounded-[30px] transition-all duration-500 shadow-xl" />
            <div className="w-[150px] h-[60px] bg-aurora-primary rounded-[30px] transition-all duration-500 shadow-xl" />
          </>
        )}
      </div>
    </div>
  );
};
