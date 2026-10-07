import React from 'react';

/**
 * RobotFace Component
 * Các trạng thái khuôn mặt của Robot:
 * - 'welcome': Mặt 2 mắt dọc không miệng, màu xám đậm, nháy mắt 2 lần liên tiếp chu kỳ tự nhiên (RT-02)
 * - 'listening': Mặt cười màu xám nhạt (2 mắt dọc + miệng cười cong) (RT-03)
 * - 'speaking': Mặt 2 mắt dọc + miệng hé bán nguyệt mấp máy (Đang phát giọng nói)
 * - 'processing': Vòng tròn 12 chấm loading dots xoay mờ dần (RT-04)
 * - 'sleeping': Mắt nhắm nằm ngang (RT-01: Snooze / Sleeping - Giữ nguyên không đổi)
 */
export const RobotFace = ({ 
  mode = 'welcome', 
  compact = false, 
  isSpeakingActive = false 
}) => {
  const isListening = mode === 'listening';
  const isSpeaking = mode === 'speaking';
  const isProcessing = mode === 'processing';
  const isWelcome = mode === 'welcome';

  // 1. Sleeping Mode (Snooze - Giữ nguyên không đổi theo chỉ đạo của ông chủ)
  if (mode === 'sleeping') {
    return (
      <div className={`relative flex items-center justify-center transition-all duration-500 select-none ${compact ? 'py-4 px-2 min-h-[116px]' : 'py-12 px-6 min-h-[180px]'}`}>
        <div className={`relative z-10 flex items-center justify-center transition-all duration-500 ${compact ? 'gap-8' : 'gap-20'}`}>
          <div className={`${compact ? 'w-[105px]' : 'w-[170px]'} h-[9px] bg-stone-600/70 rounded-full transition-all duration-500 translate-y-3 shadow-sm`} />
          <div className={`${compact ? 'w-[105px]' : 'w-[170px]'} h-[9px] bg-stone-600/70 rounded-full transition-all duration-500 translate-y-3 shadow-sm`} />
        </div>
      </div>
    );
  }

  // 2. Processing Mode (Loading dots spinner xoay mờ dần)
  if (isProcessing) {
    const spinnerSize = compact ? 160 : 300;
    const dotsCount = 12;
    const center = 100;
    const radius = 62;
    const dotRadius = 7.5;

    return (
      <div 
        className={`relative flex flex-col items-center justify-center select-none ${compact ? 'w-[170px] h-[170px]' : 'w-[420px] h-[420px] md:w-[540px] md:h-[540px]'}`}
        data-testid="robot-face-processing"
      >
        <svg 
          viewBox="0 0 200 200" 
          width={spinnerSize} 
          height={spinnerSize} 
          className="animate-spin text-[#4A4A4A]"
          style={{ animationDuration: '1.1s' }}
        >
          {Array.from({ length: dotsCount }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const cx = center + radius * Math.cos(angle);
            const cy = center + radius * Math.sin(angle);
            const opacity = Math.max(0.12, (i + 1) / dotsCount);
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={dotRadius}
                fill="currentColor"
                fillOpacity={opacity}
              />
            );
          })}
        </svg>
      </div>
    );
  }

  // 3. Màu sắc: Welcome & Speaking dùng xám đậm #4A4A4A, Listening dùng xám nhạt #A0A0A0
  const color = isListening ? '#A0A0A0' : '#4A4A4A';
  const sizeClass = compact ? 'w-[170px] h-[170px]' : 'w-[420px] h-[420px] sm:w-[480px] sm:h-[480px] md:w-[560px] md:h-[560px] lg:w-[620px] lg:h-[620px]';

  return (
    <div 
      className={`relative flex items-center justify-center select-none transition-all duration-300 ${sizeClass}`}
      data-testid={`robot-face-${mode}`}
    >
      <style>{`
        @keyframes robotBlinkTwice {
          0%, 55%, 65%, 75%, 100% {
            transform: scaleY(1);
          }
          58% {
            transform: scaleY(0.08);
          }
          70% {
            transform: scaleY(0.08);
          }
        }
        @keyframes robotTalkingMouth {
          0%, 100% {
            transform: scaleY(1) scaleX(1);
          }
          50% {
            transform: scaleY(1.22) scaleX(1.04);
          }
        }
        .robot-blink-twice {
          transform-origin: center;
          animation: robotBlinkTwice 4.2s infinite ease-in-out;
        }
        .robot-talking-mouth {
          transform-origin: 500px 760px;
          animation: robotTalkingMouth 0.35s infinite ease-in-out;
        }
        .robot-mouth-transition {
          transform-origin: 500px 780px;
          transition: opacity 0.45s cubic-bezier(0.34, 1.4, 0.64, 1),
                      transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1),
                      stroke 0.3s ease;
        }
      `}</style>

      <svg 
        viewBox="0 0 1000 1000" 
        className={`w-full h-full transition-colors duration-300 ${isListening ? 'animate-pulse' : ''}`}
        style={{ animationDuration: isListening ? '2.5s' : undefined }}
      >
        {/* Mắt Trái (Hình chữ nhật bo tròn dạng đứng) */}
        <rect 
          x="224" 
          y="350" 
          width="74" 
          height="300" 
          rx="24" 
          ry="24" 
          fill={color} 
          className={`transition-all duration-300 ${isWelcome ? 'robot-blink-twice' : ''}`}
        />

        {/* Mắt Phải (Hình chữ nhật bo tròn dạng đứng) */}
        <rect 
          x="702" 
          y="350" 
          width="74" 
          height="300" 
          rx="24" 
          ry="24" 
          fill={color} 
          className={`transition-all duration-300 ${isWelcome ? 'robot-blink-twice' : ''}`}
        />

        {/* Miệng Robot có hiệu ứng Transition chuyển đổi mượt mà giữa không miệng và có miệng */}
        
        {/* 1. Miệng Listening: Nụ cười cong xám nhạt (Nở ra từ từ khi chuyển từ Welcome sang Listening) */}
        <path 
          d="M 334 736 Q 500 826 666 736" 
          fill="none" 
          stroke={color} 
          strokeWidth="24" 
          strokeLinecap="round" 
          className="robot-mouth-transition"
          style={{
            transformOrigin: '500px 780px',
            opacity: isListening ? 1 : 0,
            transform: isListening 
              ? 'scale(1) translateY(0)' 
              : 'scale(0.6) translateY(24px)',
            pointerEvents: isListening ? 'auto' : 'none',
          }}
        />

        {/* 2. Miệng Speaking: Miệng hé bán nguyệt xám đậm (Nở ra mượt mà và mấp máy khi nói) */}
        <path 
          d="M 336 754 L 664 754 Q 500 840 336 754 Z" 
          fill="none" 
          stroke={color} 
          strokeWidth="24" 
          strokeLinejoin="round" 
          strokeLinecap="round"
          className={`robot-mouth-transition ${isSpeakingActive ? 'robot-talking-mouth' : ''}`}
          style={{
            transformOrigin: '500px 780px',
            opacity: isSpeaking ? 1 : 0,
            transform: isSpeaking 
              ? 'scale(1) translateY(0)' 
              : 'scale(0.6) translateY(24px)',
            pointerEvents: isSpeaking ? 'auto' : 'none',
          }}
        />
      </svg>
    </div>
  );
};
