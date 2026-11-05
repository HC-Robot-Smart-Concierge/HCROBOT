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
          <div className={`${isMiniSize ? 'w-[10px] h-[3px]' : isCompactSize ? 'w-[105px] h-[6px]' : isMobileSize ? 'w-[135px] h-[7px]' : 'w-[170px] h-[8px]'} bg-stone-600/70 rounded-full transition-all duration-500 translate-y-1 shadow-sm`} />
          <div className={`${isMiniSize ? 'w-[10px] h-[3px]' : isCompactSize ? 'w-[105px] h-[6px]' : isMobileSize ? 'w-[135px] h-[7px]' : 'w-[170px] h-[8px]'} bg-stone-600/70 rounded-full transition-all duration-500 translate-y-1 shadow-sm`} />
        </div>
      </div>
    );
  }

  // 2. Processing Mode (Loading dots spinner xoay mờ dần - Kích thước to đồng bộ với các trạng thái khác)
  if (isProcessing) {
    const spinnerSize = isMiniSize ? 28 : isCompactSize ? 170 : isMobileSize ? 260 : 420;
    const dotsCount = 12;
    const center = 100;
    const radius = 70;
    const dotRadius = 9;

    const sizeClass = isMiniSize
      ? 'w-8 h-8 sm:w-9 sm:h-9'
      : isCompactSize 
        ? 'w-[170px] h-[170px]' 
        : isMobileSize 
          ? 'w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] max-h-[65vh]' 
          : 'w-[440px] h-[440px] sm:w-[500px] sm:h-[500px] md:w-[580px] md:h-[580px] lg:w-[640px] lg:h-[640px]';

    return (
      <div 
        className={`relative flex flex-col items-center justify-center select-none ${sizeClass} ${className}`}
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
        ? 'w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] max-h-[65vh]' 
        : 'w-[440px] h-[440px] sm:w-[500px] sm:h-[500px] md:w-[580px] md:h-[580px] lg:w-[640px] lg:h-[640px]';

  // Xác định transform cho mắt theo biểu cảm
  let eyesTransform = 'translate(0px, 0px)';
  let eyesAnimationClass = '';

  if (activeEye === 'look_up') {
    eyesTransform = 'translate(0px, -60px) scaleY(0.96)';
  } else if (activeEye === 'look_left') {
    eyesTransform = 'translate(-75px, 0px)';
  } else if (activeEye === 'look_right') {
    eyesTransform = 'translate(75px, 0px)';
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
            transform: translate(-75px, -18px);
          }
          45% {
            transform: translate(75px, -18px);
          }
          70% {
            transform: translate(0px, -60px);
          }
          85% {
            transform: translate(0px, -60px);
          }
        }
        .robot-blink-left {
          transform-box: fill-box;
          transform-origin: center;
          -webkit-transform-origin: 261px 500px;
          animation: robotBlinkTwice 4.2s infinite ease-in-out;
          will-change: transform;
        }
        .robot-blink-right {
          transform-box: fill-box;
          transform-origin: center;
          -webkit-transform-origin: 739px 500px;
          animation: robotBlinkTwice 4.2s infinite ease-in-out;
          will-change: transform;
        }
        .robot-talking-mouth {
          transform-origin: 500px 760px;
          animation: robotTalkingMouth 0.35s infinite ease-in-out;
        }
        .robot-eyes-look-around {
          animation: robotLookAround 3s infinite ease-in-out;
        }
        .robot-mouth-transition {
          transform-origin: 500px 760px;
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
        className={`w-full h-full transition-colors duration-300 block ${isListening ? 'animate-pulse' : ''}`}
        style={{ animationDuration: isListening ? '2.5s' : undefined }}
      >
        {/* Nhóm hai mắt chuyển động theo biểu cảm - Tăng kích thước mắt to rõ, cân đối với mặt ngủ */}
        <g 
          className={`robot-eyes-group ${eyesAnimationClass}`}
          style={{ transform: eyesAnimationClass ? undefined : eyesTransform }}
        >
          {/* Mắt Trái */}
          <g 
            className={`robot-eye-left ${isWelcome && !activeEye ? 'robot-blink-left' : ''}`}
            style={{ transformOrigin: '261px 500px' }}
          >
            <rect 
              x="213" 
              y="310" 
              width="96" 
              height="380" 
              rx="32" 
              ry="32" 
              fill={color} 
              className="transition-all duration-300"
            />
          </g>

          {/* Mắt Phải */}
          <g 
            className={`robot-eye-right ${isWelcome && !activeEye ? 'robot-blink-right' : ''}`}
            style={{ transformOrigin: '739px 500px' }}
          >
            <rect 
              x="691" 
              y="310" 
              width="96" 
              height="380" 
              rx="32" 
              ry="32" 
              fill={color} 
              className="transition-all duration-300"
            />
          </g>
        </g>

        {/* Miệng Robot: Kích thước to rõ hơn, nụ cười và khẩu hình mở rộng cân xứng với khuôn mặt */}
        
        {/* 1. Miệng Listening / Happy: Nụ cười cong to rõ */}
        <path 
          d="M 280 730 Q 500 850 720 730" 
          fill="none" 
          stroke={color} 
          strokeWidth="30" 
          strokeLinecap="round" 
          className="robot-mouth-transition"
          style={{
            transformOrigin: '500px 760px',
            opacity: (isListening || isHappy) ? 1 : 0,
            transform: (isListening || isHappy) 
              ? 'scale(1) translateY(0)' 
              : 'scale(0.6) translateY(24px)',
            pointerEvents: (isListening || isHappy) ? 'auto' : 'none',
          }}
        />

        {/* 2. Miệng Speaking: Miệng hé bán nguyệt to rõ, mấp máy sinh động khi nói */}
        <path 
          d="M 290 740 L 710 740 Q 500 870 290 740 Z" 
          fill="none" 
          stroke={color} 
          strokeWidth="30" 
          strokeLinejoin="round" 
          strokeLinecap="round"
          className={`robot-mouth-transition ${isSpeakingActive ? 'robot-talking-mouth' : ''}`}
          style={{
            transformOrigin: '500px 760px',
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
