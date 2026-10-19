import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export const RobotAdPlayer = ({
  isOpen = false,
  onClose = () => {},
  ads = [],
  pushedAd = null,
  onUserInteract = () => {},
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);
  const slideTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Nếu có pushedAd, ưu tiên hiển thị ad đó lên đầu
  const playlist = React.useMemo(() => {
    if (pushedAd) {
      const exists = ads.find((a) => a.id === pushedAd.id);
      if (exists) {
        return [exists, ...ads.filter((a) => a.id !== pushedAd.id)];
      }
      return [pushedAd, ...ads];
    }
    return ads;
  }, [ads, pushedAd]);

  const currentAd = playlist[currentIndex] || null;
  const isVideo = currentAd?.media_type === 'VIDEO';
  const durationSec = currentAd?.duration_seconds || 10;

  // Next / Prev slide handlers
  const handleNext = (e) => {
    if (e) e.stopPropagation();
    if (playlist.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % playlist.length);
    setProgress(0);
  };

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    if (playlist.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    setProgress(0);
  };

  // Reset index khi mở lại modal hoặc khi có pushedAd
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setProgress(0);
    }
  }, [isOpen, pushedAd?.id]);

  // Điều phối chuyển slide theo thời lượng
  useEffect(() => {
    if (!isOpen || !currentAd || playlist.length === 0) return;

    // Reset progress
    setProgress(0);
    const stepTimeMs = 100;
    const totalSteps = (durationSec * 1000) / stepTimeMs;
    let stepCount = 0;

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      stepCount += 1;
      const pct = Math.min(100, (stepCount / totalSteps) * 100);
      setProgress(pct);
    }, stepTimeMs);

    if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    if (!isVideo) {
      slideTimerRef.current = setTimeout(() => {
        handleNext();
      }, durationSec * 1000);
    }

    return () => {
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isOpen, currentIndex, currentAd?.id, isVideo, durationSec, playlist.length]);

  if (!isOpen) return null;

  return (
    <div
      onClick={() => {
        onUserInteract();
        onClose();
      }}
      className="fixed inset-0 z-50 bg-[#0F0E0E] flex items-center justify-center cursor-pointer select-none animate-in fade-in duration-300"
      title="Chạm vào màn hình để bắt đầu tương tác"
    >
      {/* Khung nội dung quảng cáo toàn màn hình tối giản */}
      <div className="relative w-full h-full max-h-screen flex items-center justify-center p-0">
        {playlist.length === 0 ? (
          /* Fallback poster mặc định Dave Drinks nếu chưa set quảng cáo nào */
          <div className="relative h-full max-h-screen flex items-center justify-center">
            <img
              src="/images/robot/standby-poster.jpg"
              alt="Promotion Poster"
              className="h-full max-h-[96vh] w-auto max-w-[100vw] object-contain rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
            />
          </div>
        ) : isVideo ? (
          /* Video Cloudinary Player */
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              key={currentAd.media_url}
              src={currentAd.media_url}
              poster={currentAd.thumbnail_url || undefined}
              autoPlay
              playsInline
              muted={isMuted}
              onEnded={() => handleNext()}
              className="h-full max-h-screen w-auto max-w-full object-contain shadow-2xl"
            />
            {/* Video mute toggle nếu là video */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              className="absolute top-6 right-6 p-3 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 hover:bg-black/80 transition-all cursor-pointer z-30 opacity-70 hover:opacity-100"
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        ) : (
          /* Image Cloudinary Banner */
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              key={currentAd.media_url}
              src={currentAd.media_url}
              alt={currentAd.title || 'Quảng cáo'}
              className="h-full max-h-screen w-auto max-w-full object-contain shadow-2xl"
            />
          </div>
        )}
      </div>
    </div>
  );
};
