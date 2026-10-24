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
  size = null,
  isSpeakingActive = false,
  eyeExpression = null,
  className = '',
}) => {
  const isListening = mode === 'listening';
  const isSpeaking = mode === 'speaking';
  const isProcessing = mode === 'processing';
  const isHappy = mode === 'happy' || mode === 'smile' || eyeExpression === 'happy' || eyeExpression === 'smile';
  const isMiniSize = size === 'mini' || size === 'avatar';
  const isMobileSize = size === 'mobile' && !isMiniSize;
  const isCompactSize = compact && !isMobileSize && !isMiniSize;

  // Biểu cảm mắt linh hoạt: hỗ trợ truyền qua eyeExpression prop hoặc trực tiếp qua mode
  const activeEye = eyeExpression || (
    ['look_up', 'look_left', 'look_right', 'look_around'].includes(mode) ? mode : null
  );

  const isWelcome = (mode === 'welcome' || isHappy || activeEye !== null) && !isListening && !isSpeaking;

  // 1. Sleeping Mode (Snooze - Giữ nguyên không đổi theo chỉ đạo của ông chủ)
  if (mode === 'sleeping') {
    return (
      <div className={`relative flex items-center justify-center transition-all duration-500 select-none ${isMiniSize ? 'w-8 h-8' : isCompactSize ? 'py-4 px-2 min-h-[116px]' : isMobileSize ? 'py-4 px-2 min-h-[140px]' : 'py-12 px-6 min-h-[180px]'} ${className}`}>
        <div className={`relative z-10 flex items-center justify-center transition-all duration-500 ${isMiniSize ? 'gap-2' : isCompactSize ? 'gap-8' : isMobileSize ? 'gap-12' : 'gap-20'}`}>
          <div className={`${isMiniSize ? 'w-[10px] h-[3px]' : isCompactSize ? 'w-[105px]' : isMobileSize ? 'w-[135px]' : 'w-[170px]'} bg-stone-600/70 rounded-full transition-all duration-500 translate-y-1 shadow-sm`} />
          <div className={`${isMiniSize ? 'w-[10px] h-[3px]' : isCompactSize ? 'w-[105px]' : isMobileSize ? 'w-[135px]' : 'w-[170px]'} bg-stone-600/70 rounded-full transition-all duration-500 translate-y-1 shadow-sm`} />
        </div>
      </div>
    );
  }

  // 2. Processing Mode (Loading dots spinner xoay mờ dần)
  if (isProcessing) {
    const spinnerSize = isMiniSize ? 28 : isCompactSize ? 160 : isMobileSize ? 210 : 300;
    const dotsCount = 12;
    const center = 100;
    const radius = 62;
    const dotRadius = 7.5;

    return (
      <div 
        className={`relative flex flex-col items-center justify-center select-none ${isMiniSize ? 'w-8 h-8 sm:w-9 sm:h-9' : isCompactSize ? 'w-[170px] h-[170px]' : isMobileSize ? 'w-[220px] h-[220px] sm:w-[245px] sm:h-[245px]' : 'w-[420px] h-[420px] md:w-[540px] md:h-[540px]'} ${className}`}
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

  // 3. Màu sắc: Welcome & Speaking dùng xám đậm #4A4A4A, Listening dùng xám nhạt #A0A0A0, Happy dùng xanh ngọc tươi tắn #10b981
  const color = isHappy ? '#10b981' : isListening ? '#A0A0A0' : '#4A4A4A';
  const sizeClass = isMiniSize
    ? 'w-8 h-8 sm:w-9 sm:h-9'
    : isCompactSize 
      ? 'w-[170px] h-[170px]' 
      : isMobileSize 
        ? 'w-[220px] h-[220px] sm:w-[245px] sm:h-[245px]' 
        : 'w-[420px] h-[420px] sm:w-[480px] sm:h-[480px] md:w-[560px] md:h-[560px] lg:w-[620px] lg:h-[620px]';

  // Xác định transform cho mắt theo biểu cảm
  let eyesTransform = 'translate(0px, 0px)';
  let eyesAnimationClass = '';

  if (activeEye === 'look_up') {
    eyesTransform = 'translate(0px, -52px) scaleY(0.96)';
  } else if (activeEye === 'look_left') {
    eyesTransform = 'translate(-65px, 0px)';
  } else if (activeEye === 'look_right') {
    eyesTransform = 'translate(65px, 0px)';
  } else if (activeEye === 'look_around') {
    eyesAnimationClass = 'robot-eyes-look-around';
  }

  return (
    <div 
      className={`relative flex items-center justify-center select-none transition-all duration-300 ${sizeClass} ${className}`}
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
        @keyframes robotLookAround {
          0%, 100% {
            transform: translate(0px, 0px);
          }
          20% {
            transform: translate(-65px, -15px);
          }
          45% {
            transform: translate(65px, -15px);
          }
          70% {
            transform: translate(0px, -52px);
          }
          85% {
            transform: translate(0px, -52px);
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
        .robot-eyes-look-around {
          animation: robotLookAround 3s infinite ease-in-out;
        }
        .robot-mouth-transition {
          transform-origin: 500px 780px;
          transition: opacity 0.45s cubic-bezier(0.34, 1.4, 0.64, 1),
                      transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1),
                      stroke 0.3s ease;
        }
        .robot-eyes-group {
          transform-origin: 500px 500px;
          transition: transform 0.42s cubic-bezier(0.34, 1.3, 0.64, 1);
        }
      `}</style>

      <svg 
        viewBox="0 0 1000 1000" 
        className={`w-full h-full transition-colors duration-300 ${isListening ? 'animate-pulse' : ''}`}
        style={{ animationDuration: isListening ? '2.5s' : undefined }}
      >
        {/* Nhóm hai mắt chuyển động theo biểu cảm */}
        <g 
          className={`robot-eyes-group ${eyesAnimationClass}`}
          style={{ transform: eyesAnimationClass ? undefined : eyesTransform }}
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
            className={`transition-all duration-300 ${isWelcome && !activeEye ? 'robot-blink-twice' : ''}`}
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
            className={`transition-all duration-300 ${isWelcome && !activeEye ? 'robot-blink-twice' : ''}`}
          />
        </g>

        {/* Miệng Robot có hiệu ứng Transition chuyển đổi mượt mà giữa không miệng và có miệng */}
        
        {/* 1. Miệng Listening / Happy: Nụ cười cong (Nở ra từ từ khi chuyển từ Welcome sang Listening hoặc Happy) */}
        <path 
          d="M 334 736 Q 500 826 666 736" 
          fill="none" 
          stroke={color} 
          strokeWidth="24" 
          strokeLinecap="round" 
          className="robot-mouth-transition"
          style={{
            transformOrigin: '500px 780px',
            opacity: (isListening || isHappy) ? 1 : 0,
            transform: (isListening || isHappy) 
              ? 'scale(1) translateY(0)' 
              : 'scale(0.6) translateY(24px)',
            pointerEvents: (isListening || isHappy) ? 'auto' : 'none',
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
