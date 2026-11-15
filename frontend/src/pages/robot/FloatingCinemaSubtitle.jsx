import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';

/**
 * FloatingCinemaSubtitle
 * Phụ đề động tinh giản (Floating Subtitle / Cinema Captions) cho Robot Kiosk 5 sao
 * - Dải kính mờ thanh thoát: backdrop-blur-md bg-stone-900/60 border border-stone-700/50 rounded-2xl
 * - Cỡ chữ to rõ 16px - 18px, giới hạn tối đa 2 dòng chữ
 * - Tự động tách câu và chuyển câu mượt mà theo nhịp giọng nói
 */
export const FloatingCinemaSubtitle = ({ fullText, isSpeaking, onClose }) => {
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

  // Reset về câu đầu tiên khi đoạn text mới được nhận
  useEffect(() => {
    setCurrentIndex(0);
  }, [fullText]);

  // Chuyển câu mượt mà theo nhịp nói khi robot đang phát âm thanh
  useEffect(() => {
    if (!isSpeaking || sentences.length <= 1) return;

    const currentSentence = sentences[currentIndex] || '';
    const duration = Math.min(6000, Math.max(2500, currentSentence.length * 65));

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1 < sentences.length ? prev + 1 : prev));
    }, duration);

    return () => clearTimeout(timer);
  }, [currentIndex, isSpeaking, sentences]);

  const activeSentence = sentences[currentIndex] || fullText;

  return (
    <div
      className="relative mt-4 sm:mt-5 w-[640px] max-w-[92vw] px-6 py-3.5 bg-stone-900/60 backdrop-blur-md border border-stone-700/50 rounded-2xl shadow-xl flex items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300 z-20 group"
      role="region"
      aria-label="Phụ đề lời thoại của robot"
    >
      {/* Chỉ báo phát âm thanh mini & số câu */}
      <div className="absolute left-3.5 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
        <span
          className={`w-2 h-2 rounded-full transition-colors ${isSpeaking ? 'bg-stone-300 animate-pulse' : 'bg-stone-500'
            }`}
          title={isSpeaking ? 'Đang phát qua loa' : 'Đã phát xong'}
        />
        {sentences.length > 1 && (
          <span className="text-[10px] font-mono text-stone-400">
            {currentIndex + 1}/{sentences.length}
          </span>
        )}
      </div>

      {/* Dòng chữ phụ đề điện ảnh: Cỡ chữ 16px - 18px, giới hạn tối đa 2 dòng chữ */}
      <p
        key={currentIndex}
        className="text-base sm:text-[17px] font-medium text-stone-100 leading-snug sm:leading-relaxed tracking-wide px-7 select-text animate-in fade-in slide-in-from-bottom-1 duration-300 line-clamp-2"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {activeSentence}
      </p>

      {/* Nút đóng phụ đề tinh giản */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 w-5 h-5 rounded-full hover:bg-stone-800/80 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Ẩn phụ đề"
          aria-label="Ẩn phụ đề"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
