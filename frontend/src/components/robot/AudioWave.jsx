import React from 'react';

export const AudioWave = ({ isActive = true, volumeLevel = 0 }) => {
  // Nếu có volume thật từ Microphone, tính toán chiều cao các cột theo volume thật (0 - 100)
  const isSpeakingLive = volumeLevel > 5;

  // Tính chiều cao (px) cho 5 cột sóng âm thanh
  // Cột giữa cao nhất, các cột 2 bên giảm dần
  const height1 = isSpeakingLive ? Math.max(6, Math.min(28, Math.round(volumeLevel * 0.22))) : (isActive ? 8 : 4);
  const height2 = isSpeakingLive ? Math.max(8, Math.min(32, Math.round(volumeLevel * 0.32))) : (isActive ? 14 : 6);
  const height3 = isSpeakingLive ? Math.max(10, Math.min(36, Math.round(volumeLevel * 0.40))) : (isActive ? 22 : 8);
  const height4 = isSpeakingLive ? Math.max(8, Math.min(32, Math.round(volumeLevel * 0.30))) : (isActive ? 14 : 6);
  const height5 = isSpeakingLive ? Math.max(6, Math.min(28, Math.round(volumeLevel * 0.20))) : (isActive ? 8 : 4);

  const barColor = isSpeakingLive
    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
    : isActive
    ? 'bg-cyan-400/80'
    : 'bg-stone-500/40';

  return (
    <div className="flex items-center justify-center gap-1.5 h-8 px-2" title={`Mức âm thanh: ${volumeLevel}%`}>
      <div
        className={`w-1.5 rounded-full transition-all duration-75 ${barColor}`}
        style={{ height: `${height1}px` }}
      />
      <div
        className={`w-1.5 rounded-full transition-all duration-75 ${barColor}`}
        style={{ height: `${height2}px` }}
      />
      <div
        className={`w-1.5 rounded-full transition-all duration-75 ${barColor}`}
        style={{ height: `${height3}px` }}
      />
      <div
        className={`w-1.5 rounded-full transition-all duration-75 ${barColor}`}
        style={{ height: `${height4}px` }}
      />
      <div
        className={`w-1.5 rounded-full transition-all duration-75 ${barColor}`}
        style={{ height: `${height5}px` }}
      />
    </div>
  );
};
