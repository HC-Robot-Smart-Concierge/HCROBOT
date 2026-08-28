import React from 'react';

export const RobotFace = ({ mode = 'welcome' }) => {
  const isListening = mode === 'listening';
  const isProcessing = mode === 'processing';

  return (
    <div className="w-[480px] h-[480px] relative bg-aurora-inverse rounded-[36px] overflow-hidden outline outline-[1.5px] outline-aurora-border shrink-0 transition-all duration-500 shadow-2xl flex items-center justify-center">
      {/* Listening Pulse Rings (RT-03) */}
      {isListening && (
        <>
          <div className="w-[432px] h-[432px] absolute rounded-full border-[3px] border-aurora-textInverse opacity-80 animate-ping [animation-duration:3s]" />
          <div className="w-[394px] h-[394px] absolute rounded-full border-[3px] border-aurora-textInverse opacity-60 animate-pulse" />
        </>
      )}

      {/* Processing Orbit Rings (RT-04) */}
      {isProcessing && (
        <>
          <div className="w-[432px] h-[432px] absolute rounded-full border-[2px] border-aurora-border opacity-65 animate-spin-slow" />
          <div className="w-[394px] h-[394px] absolute rounded-full border-[2px] border-aurora-border opacity-65 animate-spin-slow [animation-direction:reverse]" />
        </>
      )}

      {/* Face Halo */}
      <div className="w-[360px] h-[360px] absolute bg-aurora-surface rounded-full opacity-45 shadow-inner" />

      {/* Face Disc */}
      <div className="w-[310px] h-[310px] absolute bg-aurora-surface rounded-full shadow-lg flex items-center justify-center" />

      {/* Friendly Eyes */}
      {mode === 'sleeping' || mode === 'idle' ? (
        // Sleeping Closed Eyes (Curved Lines)
        <div className="absolute top-[198px] flex gap-[62px]">
          <div className="w-[44px] h-[8px] bg-aurora-primary/70 rounded-full transition-all duration-500" />
          <div className="w-[44px] h-[8px] bg-aurora-primary/70 rounded-full transition-all duration-500" />
        </div>
      ) : isProcessing ? (
        // Closed/Thinking Eyes (Lines)
        <div className="absolute top-[198px] flex gap-[62px]">
          <div className="w-[48px] h-[10px] bg-aurora-primary rounded-full transition-all duration-300" />
          <div className="w-[48px] h-[10px] bg-aurora-primary rounded-full transition-all duration-300" />
        </div>
      ) : (
        // Open Friendly Oval Eyes (Mở mắt khi có người lại gần)
        <div className="absolute top-[172px] flex gap-[72px]">
          <div className="w-[38px] h-[52px] bg-aurora-primary rounded-full transition-all duration-500 animate-pulse-subtle scale-100" />
          <div className="w-[38px] h-[52px] bg-aurora-primary rounded-full transition-all duration-500 animate-pulse-subtle scale-100" />
        </div>
      )}


      {/* Welcoming Smile Curve */}
      <div className="w-[112px] h-[64px] absolute top-[245px] overflow-hidden">
        <div className="w-[92px] h-[25.5px] relative left-[10px] top-[14px] outline outline-[12px] outline-aurora-border rounded-b-full" />
      </div>
    </div>
  );
};
