import React, { useEffect, useState, useMemo } from 'react';
import { X, Mic } from 'lucide-react';

export const getRobotMode = (state, isSpeaking = false, isProcessing = false, isListening = false) => {
  if (state === 'RT-01') return 'sleeping';
  if (isProcessing || state === 'RT-04') return 'processing';
  if (isSpeaking) return 'speaking';
  if (isListening || state === 'RT-03') return 'listening';
  return 'welcome';
};

export const MobileCinemaSubtitle = ({
  fullText,
  isSpeaking,
  onClose,
  onStartTalk,
  onStopSpeaking,
  onPrime,
  isEn,
}) => {
  const sentences = useMemo(() => {
    if (!fullText) return [];
    const raw = String(fullText).trim();
    const split = raw
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return split.length > 0 ? split : [raw];
  }, [fullText]);

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [fullText]);

  useEffect(() => {
    if (!isSpeaking || sentences.length <= 1) return;
    const currentSentence = sentences[currentIndex] || '';
    const duration = Math.min(5000, Math.max(2200, currentSentence.length * 60));
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1 < sentences.length ? prev + 1 : prev));
    }, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, isSpeaking, sentences]);

  const activeSentence = sentences[currentIndex] || fullText;

  return (
    <div
      className="relative mt-2.5 max-w-[92vw] sm:max-w-lg px-5 py-2.5 bg-stone-900/85 backdrop-blur-md border border-stone-700/60 rounded-2xl shadow-xl flex items-center justify-center text-center animate-in fade-in zoom-in-95 duration-200 z-20 group"
      role="region"
      aria-label="Phụ đề lời thoại của robot"
    >
      <div className="absolute left-3 flex items-center gap-1.5 opacity-60">
        <span
          className={`w-2 h-2 rounded-full transition-colors ${
            isSpeaking ? 'bg-stone-300 animate-pulse' : 'bg-stone-500'
          }`}
        />
        {sentences.length > 1 && (
          <span className="text-[9px] font-mono text-stone-400">
            {currentIndex + 1}/{sentences.length}
          </span>
        )}
      </div>

      <p
        key={currentIndex}
        className="text-xs sm:text-[13px] font-medium text-stone-100 leading-snug px-8 select-text animate-in fade-in duration-200 line-clamp-2"
      >
        {activeSentence}
      </p>

      {/* Cụm công cụ bên phải subtitle: Nút Micro & Nút Đóng */}
      <div className="absolute right-2.5 flex items-center gap-1.5">
        {onStartTalk && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onStopSpeaking && isSpeaking) onStopSpeaking();
              if (onPrime) onPrime();
              onStartTalk();
            }}
            className="w-6 h-6 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title={isSpeaking ? (isEn ? 'Stop and speak' : 'Dừng & Nói tiếp') : (isEn ? 'Touch or speak' : 'Chạm hoặc nói')}
            aria-label={isEn ? 'Microphone' : 'Micro'}
          >
            <Mic className="w-3 h-3 text-stone-300" />
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-6 h-6 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title={isEn ? 'Hide subtitle' : 'Ẩn phụ đề'}
            aria-label={isEn ? 'Close' : 'Đóng'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

