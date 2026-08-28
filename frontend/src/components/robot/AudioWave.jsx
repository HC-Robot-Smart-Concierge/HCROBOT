import React from 'react';

export const AudioWave = ({ isActive = true }) => {
  return (
    <div className="w-[86px] h-7 flex items-center justify-start gap-1.5 overflow-hidden">
      <div 
        className={`w-2 rounded-full bg-aurora-border transition-all duration-300 ${
          isActive ? 'h-[10px] animate-bounce' : 'h-[6px]'
        }`} 
      />
      <div 
        className={`w-2 rounded-full bg-aurora-border transition-all duration-300 ${
          isActive ? 'h-[18px] animate-bounce [animation-delay:0.15s]' : 'h-[10px]'
        }`} 
      />
      <div 
        className={`w-2 rounded-full bg-aurora-border transition-all duration-300 ${
          isActive ? 'h-[26px] animate-bounce [animation-delay:0.3s]' : 'h-[14px]'
        }`} 
      />
      <div 
        className={`w-2 rounded-full bg-aurora-border transition-all duration-300 ${
          isActive ? 'h-[18px] animate-bounce [animation-delay:0.45s]' : 'h-[10px]'
        }`} 
      />
      <div 
        className={`w-2 rounded-full bg-aurora-border transition-all duration-300 ${
          isActive ? 'h-[10px] animate-bounce [animation-delay:0.6s]' : 'h-[6px]'
        }`} 
      />
    </div>
  );
};
