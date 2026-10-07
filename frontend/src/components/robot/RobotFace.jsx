import React from 'react';

export const RobotFace = ({ mode = 'welcome', compact = false }) => {
  const isListening = mode === 'listening';
  const isSpeaking = mode === 'speaking';
  const isProcessing = mode === 'processing';
  const isHappy = mode === 'happy' || mode === 'smile';

  return (
    <div className={`relative flex items-center justify-center transition-all duration-500 select-none ${compact ? 'py-4 px-2 min-h-[116px]' : 'py-12 px-6 min-h-[180px]'}`}>
      {/* Pure Robot Eyes Display Container (MẮT TO CAO FUTURISTIC) */}
      <div className={`relative z-10 flex items-center justify-center transition-all duration-500 ${compact ? 'gap-7' : 'gap-16'}`}>
        {mode === 'sleeping' ? (
          // 1. Sleeping Mode (Mắt dài nhắm ngủ - Nằm ngang mỏng)
          <>
            <div className={`${compact ? 'w-[92px]' : 'w-[140px]'} h-[8px] bg-aurora-primary/60 rounded-full transition-all duration-500 translate-y-3 shadow-sm`} />
            <div className={`${compact ? 'w-[92px]' : 'w-[140px]'} h-[8px] bg-aurora-primary/60 rounded-full transition-all duration-500 translate-y-3 shadow-sm`} />
          </>
        ) : isHappy ? (
          // 2. Happy / Smile Mode (Mắt cười cong trăng khuyết tươi vui, biểu cảm HAPPY_SMILE)
          <>
            <div className={`relative ${compact ? 'w-[98px] h-[48px]' : 'w-[150px] h-[64px]'} flex items-center justify-center transition-all duration-300`}>
              <div className="w-full h-full border-t-[10px] sm:border-t-[14px] border-emerald-500 rounded-t-full shadow-[0_0_25px_rgba(16,185,129,0.7)] translate-y-2" />
            </div>
            <div className={`relative ${compact ? 'w-[98px] h-[48px]' : 'w-[150px] h-[64px]'} flex items-center justify-center transition-all duration-300`}>
              <div className="w-full h-full border-t-[10px] sm:border-t-[14px] border-emerald-500 rounded-t-full shadow-[0_0_25px_rgba(16,185,129,0.7)] translate-y-2" />
            </div>
          </>
        ) : isProcessing ? (
          // 3. Processing Mode (Suy nghĩ -> Mắt màu XANH DƯƠNG NHẠT nhấp nháy)
          <>
            <div className={`${compact ? 'w-[98px]' : 'w-[150px]'} h-[36px] bg-sky-300 rounded-[18px] transition-all duration-300 animate-pulse shadow-[0_0_25px_rgba(125,211,252,0.8)]`} />
            <div className={`${compact ? 'w-[98px]' : 'w-[150px]'} h-[36px] bg-sky-300 rounded-[18px] transition-all duration-300 animate-pulse shadow-[0_0_25px_rgba(125,211,252,0.8)]`} />
          </>
        ) : isListening ? (
          // 4. Listening Mode (Sẵn sàng nghe -> Mắt màu XÁM nhấp nháy / nháy mắt xám)
          <>
            <div className={`${compact ? 'w-[98px] h-[46px]' : 'w-[150px] h-[64px]'} bg-slate-400/90 rounded-[32px] transition-all duration-300 animate-pulse shadow-md`} />
            <div className={`${compact ? 'w-[98px] h-[46px]' : 'w-[150px] h-[64px]'} bg-slate-400/90 rounded-[32px] transition-all duration-300 animate-pulse shadow-md`} />
          </>
        ) : isSpeaking ? (
          // 5. Speaking / Replying Mode (Chuyển màu rực rỡ nếu dùng độc lập)
          <>
            <div className={`${compact ? 'w-[102px] h-[50px]' : 'w-[155px] h-[72px]'} bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 rounded-[36px] transition-all duration-300 shadow-[0_0_40px_rgba(16,185,129,0.95)] animate-pulse`} />
            <div className={`${compact ? 'w-[102px] h-[50px]' : 'w-[155px] h-[72px]'} bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 rounded-[36px] transition-all duration-300 shadow-[0_0_40px_rgba(16,185,129,0.95)] animate-pulse`} />
          </>
        ) : (
          // 6. Normal Welcome Mode (Mắt cao 60px nằm ngang chuẩn, tối giản)
          <>
            <div className={`${compact ? 'w-[98px] h-[44px]' : 'w-[150px] h-[60px]'} bg-aurora-primary rounded-[30px] transition-all duration-500 shadow-xl`} />
            <div className={`${compact ? 'w-[98px] h-[44px]' : 'w-[150px] h-[60px]'} bg-aurora-primary rounded-[30px] transition-all duration-500 shadow-xl`} />
          </>
        )}
      </div>
    </div>
  );
};
