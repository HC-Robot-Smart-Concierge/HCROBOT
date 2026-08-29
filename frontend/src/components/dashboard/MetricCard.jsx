import React from 'react';

export const MetricCard = ({
  title = '',
  value = '',
  subText = null,
  delta = null,
  deltaType = 'neutral', // 'positive' | 'negative' | 'neutral'
  icon: Icon = null,
  variant = 'default', // 'default' | 'dark' | 'danger-gradient' | 'danger-solid' | 'progress' | 'sparkline'
  progressValue = 0,
  progressTotal = 100,
  sparklineData = null,
  className = '',
}) => {
  // 1. Dark variant
  if (variant === 'dark') {
    return (
      <div className={`p-5 rounded-2xl bg-[#141413] text-white shadow-sm flex flex-col justify-between min-h-[110px] relative overflow-hidden ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-stone-300 uppercase">
            {title}
          </span>
          {Icon && <Icon className="w-4 h-4 text-stone-400" />}
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold tracking-tight">{value}</div>
          {subText && <p className="text-[11px] text-stone-400 mt-0.5">{subText}</p>}
        </div>
      </div>
    );
  }

  // 2. Danger Solid variant (Dark red like Housekeeping High Priority)
  if (variant === 'danger-solid') {
    return (
      <div className={`p-5 rounded-2xl bg-[#A82323] text-white shadow-sm flex flex-col justify-between min-h-[110px] relative overflow-hidden ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-red-100 uppercase">
            {title}
          </span>
          {Icon && <Icon className="w-4 h-4 text-red-200" />}
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold tracking-tight">{value}</div>
          {subText && <p className="text-[11px] text-red-200 mt-0.5">{subText}</p>}
        </div>
      </div>
    );
  }

  // 3. Danger Gradient variant (Soft peach/pink/coral gradient like Room Service & Bell Services)
  if (variant === 'danger-gradient') {
    return (
      <div className={`p-5 rounded-2xl bg-gradient-to-br from-[#FEE2E2] to-[#FECDD3] border border-[#FECACA] shadow-sm flex flex-col justify-between min-h-[110px] relative overflow-hidden ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-[#991B1B] uppercase">
            {title}
          </span>
          {Icon && <Icon className="w-4 h-4 text-[#DC2626]" />}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <div className="text-3xl font-extrabold text-[#991B1B] tracking-tight">{value}</div>
          {subText && <span className="text-xs font-semibold text-[#B91C1C]">{subText}</span>}
        </div>
      </div>
    );
  }

  // 4. Progress bar variant
  if (variant === 'progress') {
    const percentage = Math.min(100, Math.round((progressValue / (progressTotal || 1)) * 100));
    return (
      <div className={`p-5 rounded-2xl bg-white/80 border border-[#E5E1D8] shadow-sm flex flex-col justify-between min-h-[110px] ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-[#78716C] uppercase">
            {title}
          </span>
          {Icon && <Icon className="w-4 h-4 text-[#A8A29E]" />}
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold text-[#1A1917] tracking-tight">
            {progressValue} <span className="text-sm font-medium text-[#78716C]">/ {progressTotal}</span>
          </div>
          <div className="w-full bg-[#EFECE6] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[#18181B] h-full rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // 5. Sparkline trend variant
  if (variant === 'sparkline') {
    const points = sparklineData || [20, 18, 16, 17, 14, 13, 14];
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    const svgPoints = points
      .map((pt, idx) => {
        const x = (idx / (points.length - 1)) * 120;
        const y = 28 - ((pt - min) / range) * 22;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <div className={`p-5 rounded-2xl bg-white/80 border border-[#E5E1D8] shadow-sm flex flex-col justify-between min-h-[110px] ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-[#78716C] uppercase">
            {title}
          </span>
          {Icon && <Icon className="w-4 h-4 text-[#A8A29E]" />}
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-2xl font-extrabold text-[#1A1917] tracking-tight">{value}</div>
            {subText && <span className="text-xs font-semibold text-[#78716C]">{subText}</span>}
          </div>
          <div className="w-24 h-8">
            <svg viewBox="0 0 120 30" className="w-full h-full stroke-[#78716C] fill-none stroke-2">
              <polyline points={svgPoints} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Default light card
  return (
    <div className={`p-5 rounded-2xl bg-white/80 border border-[#E5E1D8] shadow-sm flex flex-col justify-between min-h-[110px] ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wider text-[#78716C] uppercase">
          {title}
        </span>
        {Icon && <Icon className="w-4 h-4 text-[#A8A29E]" />}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-3xl font-extrabold text-[#1A1917] tracking-tight">{value}</div>
        {delta && (
          <span
            className={`text-xs font-bold ${
              deltaType === 'positive'
                ? 'text-emerald-600'
                : deltaType === 'negative'
                ? 'text-red-500'
                : 'text-[#78716C]'
            }`}
          >
            {delta}
          </span>
        )}
        {subText && <span className="text-xs font-medium text-[#78716C]">{subText}</span>}
      </div>
    </div>
  );
};
