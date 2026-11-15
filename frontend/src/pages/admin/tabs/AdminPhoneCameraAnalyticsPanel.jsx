import React from 'react';
import { Smile, Frown, Activity, Sparkles, CheckCircle } from 'lucide-react';

export const AdminPhoneCameraAnalyticsPanel = ({
  isAiEmotionActive, setIsAiEmotionActive, activeDisplayEmotion, overrideEmotion, handleOverrideEmotion, smileScore, frownScore, blendshapeMetrics,
}) => (
        <div className="flex flex-col gap-4">
          {/* Main Emotion Analytics Card */}
          <div
            className="border rounded-2xl p-4 shadow-xs flex flex-col gap-3"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: '#262626' }} />
                <span
                  className="text-xs font-bold font-mono uppercase tracking-wider"
                  style={{ color: '#262626' }}
                >
                  AI Expression Analytics
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAiEmotionActive((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-all border"
                style={
                  isAiEmotionActive
                    ? { background: '#262626', color: '#FFFFFF', borderColor: '#262626' }
                    : { background: '#E9E5DC', color: '#8C8C8C', borderColor: '#BFBFBD' }
                }
              >
                {isAiEmotionActive ? 'AI ON' : 'AI OFF'}
              </button>
            </div>

            {/* Current Emotion State */}
            <div
              className="p-3 rounded-xl border flex items-center justify-between"
              style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase font-semibold" style={{ color: '#8C8C8C' }}>
                  Current Expression
                </span>
                <span
                  className="text-base font-black font-mono tracking-wide uppercase mt-0.5"
                  style={{ color: '#262626' }}
                >
                  {activeDisplayEmotion}
                </span>
              </div>
              <span
                className="text-[10px] font-mono px-2 py-1 rounded-lg font-bold shadow-xs"
                style={{ background: '#262626', color: '#FFFFFF' }}
              >
                {overrideEmotion ? 'MANUAL OVERRIDE' : 'REALTIME AI'}
              </span>
            </div>

            {/* Gauges for Smile & Frown */}
            <div className="space-y-2.5 font-mono text-xs">
              <div>
                <div className="flex justify-between mb-1" style={{ color: '#555555' }}>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Smile className="w-3.5 h-3.5 text-emerald-600" /> Smile Level
                  </span>
                  <span className="font-bold" style={{ color: '#262626' }}>
                    {Math.round(smileScore * 100)}%
                  </span>
                </div>
                <div
                  className="w-full h-2 rounded-full overflow-hidden border"
                  style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
                >
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round(smileScore * 100))}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1" style={{ color: '#555555' }}>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Frown className="w-3.5 h-3.5 text-rose-600" /> Frown / Distress Level
                  </span>
                  <span className="font-bold" style={{ color: '#262626' }}>
                    {Math.round(frownScore * 100)}%
                  </span>
                </div>
                <div
                  className="w-full h-2 rounded-full overflow-hidden border"
                  style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
                >
                  <div
                    className="h-full bg-rose-600 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round(frownScore * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Test Robot Expression Override Buttons (Toan bo Nut Den He Thong / Khung Beige) */}
            <div className="pt-2 border-t space-y-2" style={{ borderColor: '#BFBFBD' }}>
              <span className="text-[10px] font-mono block uppercase font-bold" style={{ color: '#8C8C8C' }}>
                Test / Override Robot Expression:
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: null, label: 'AUTO' },
                  { id: 'happy', label: 'HAPPY' },
                  { id: 'neutral', label: 'NEUTRAL' },
                  { id: 'unhappy', label: 'UNHAPPY' },
                  { id: 'look_up', label: 'UP' },
                  { id: 'look_left', label: 'LEFT' },
                  { id: 'look_right', label: 'RIGHT' },
                  { id: 'look_around', label: 'AROUND' },
                ].map((mode) => (
                  <button
                    key={String(mode.id)}
                    type="button"
                    onClick={() => handleOverrideEmotion(mode.id)}
                    className="py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border"
                    style={
                      overrideEmotion === mode.id
                        ? { background: '#262626', color: '#FFFFFF', borderColor: '#262626' }
                        : { background: '#E9E5DC', color: '#262626', borderColor: '#BFBFBD' }
                    }
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Facial Landmark Mesh & Blendshapes Diagnostic Panel (System Theme) */}
          <div
            className="border rounded-2xl p-4 shadow-xs flex-1 flex flex-col gap-3 font-mono"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: '#262626' }} />
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: '#262626' }}
                >
                  Facial Mesh & Blendshapes
                </span>
              </div>
              <span className="text-[10px] font-bold" style={{ color: '#8C8C8C' }}>
                Key Anchors (6 PTS)
              </span>
            </div>

            {/* Muscle Blendshapes Diagnostic Breakdown */}
            <div className="space-y-2 text-xs">
              <div
                className="p-2 rounded-xl border space-y-2"
                style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
              >
                <div
                  className="text-[11px] font-bold flex items-center justify-between"
                  style={{ color: '#262626' }}
                >
                  <span>Mouth Corners (Smile L/R)</span>
                  <span className="text-emerald-700">
                    {Math.round(blendshapeMetrics.smileLeft * 100)}% | {Math.round(blendshapeMetrics.smileRight * 100)}%
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden flex gap-0.5"
                  style={{ background: '#FAF8F5' }}
                >
                  <div
                    className="h-full bg-emerald-600 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.smileLeft * 50)}%` }}
                  />
                  <div
                    className="h-full bg-emerald-500 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.smileRight * 50)}%` }}
                  />
                </div>
              </div>

              <div
                className="p-2 rounded-xl border space-y-2"
                style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
              >
                <div
                  className="text-[11px] font-bold flex items-center justify-between"
                  style={{ color: '#262626' }}
                >
                  <span>Brow Depression (Distress L/R)</span>
                  <span className="text-rose-700">
                    {Math.round(blendshapeMetrics.browDownLeft * 100)}% | {Math.round(blendshapeMetrics.browDownRight * 100)}%
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden flex gap-0.5"
                  style={{ background: '#FAF8F5' }}
                >
                  <div
                    className="h-full bg-rose-600 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.browDownLeft * 50)}%` }}
                  />
                  <div
                    className="h-full bg-rose-500 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.browDownRight * 50)}%` }}
                  />
                </div>
              </div>

              <div
                className="p-2 rounded-xl border space-y-2"
                style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
              >
                <div
                  className="text-[11px] font-bold flex items-center justify-between"
                  style={{ color: '#262626' }}
                >
                  <span>Mouth Frown (Sadness L/R)</span>
                  <span className="text-amber-700">
                    {Math.round(blendshapeMetrics.mouthFrownLeft * 100)}% | {Math.round(blendshapeMetrics.mouthFrownRight * 100)}%
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden flex gap-0.5"
                  style={{ background: '#FAF8F5' }}
                >
                  <div
                    className="h-full bg-amber-600 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.mouthFrownLeft * 50)}%` }}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.mouthFrownRight * 50)}%` }}
                  />
                </div>
              </div>

              {/* Eye Squint and Jaw Opening */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div
                  className="p-2 rounded-xl border flex flex-col justify-between"
                  style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
                >
                  <span className="font-semibold" style={{ color: '#8C8C8C' }}>
                    Eye Squint
                  </span>
                  <span className="text-sm font-bold mt-1" style={{ color: '#262626' }}>
                    {Math.round(blendshapeMetrics.eyeSquint * 100)}%
                  </span>
                </div>
                <div
                  className="p-2 rounded-xl border flex flex-col justify-between"
                  style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
                >
                  <span className="font-semibold" style={{ color: '#8C8C8C' }}>
                    Jaw Open
                  </span>
                  <span className="text-sm font-bold mt-1" style={{ color: '#262626' }}>
                    {Math.round(blendshapeMetrics.jawOpen * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Mesh Status Note */}
            <div
              className="mt-auto pt-2 border-t text-[10px] flex items-center justify-between"
              style={{ borderColor: '#BFBFBD', color: '#8C8C8C' }}
            >
              <span className="flex items-center gap-1 font-semibold" style={{ color: '#262626' }}>
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                Minimal Anchors Mode
              </span>
              <span className="font-mono" style={{ color: '#8C8C8C' }}>
                GPU Accelerated
              </span>
            </div>
          </div>
        </div>
);
