import React, { useState, useEffect } from 'react';
import { Film, Image as ImageIcon, Clock, Sparkles, Volume2, VolumeX, Maximize2, Tag } from 'lucide-react';

const DEFAULT_PROMO_IMAGE =
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80';
const DEFAULT_PROMO_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

export const KioskMediaPromo = ({ activeStep, isMoving = false }) => {
  const params = activeStep?.params || {};
  const isVideo =
    params.media_type === 'VIDEO' ||
    params.screen_mode === 'PROMO_VIDEO' ||
    params.content_id === 'PROMO_VIDEO' ||
    (params.media_url && /\.(mp4|webm|ogg)$/i.test(params.media_url));

  const mediaUrl =
    params.media_url || (isVideo ? DEFAULT_PROMO_VIDEO : DEFAULT_PROMO_IMAGE);
  const bannerTitle =
    params.display_banner ||
    params.banner_text ||
    params.title ||
    (isVideo
      ? 'VIDEO QUẢNG BÁ KHÁCH SẠN & RESORT 5 SAO'
      : 'POSTER ƯU ĐÃI NGHỈ DƯỠNG & TIỆC TRÀ HOÀNG GIA');

  const [countdown, setCountdown] = useState(
    parseInt(params.timeout || params.slide_duration_sec || params.timeout_sec) || 30
  );
  const [isMuted, setIsMuted] = useState(true);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    setCountdown(parseInt(params.timeout || params.slide_duration_sec || params.timeout_sec) || 30);
    setMediaError(false);
  }, [activeStep?.step_id, activeStep?.id, params.media_url, isVideo]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-3 animate-in fade-in duration-300 select-none">
      <div className="relative overflow-hidden rounded-2xl bg-stone-900 border-2 border-stone-700 shadow-xl text-white">
        {/* Header HUD */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${
                isVideo ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'
              }`}
            >
              {isVideo ? <Film className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
              <span>{isVideo ? 'VIDEO QUẢNG CÁO' : 'HÌNH ẢNH POSTER'}</span>
            </span>
            {isMoving && (
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-500/90 text-white flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Vừa đi vừa chiếu</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isVideo && (
              <button
                type="button"
                onClick={() => setIsMuted((prev) => !prev)}
                className="p-1 rounded-lg bg-black/50 hover:bg-black/70 text-white border border-white/20 cursor-pointer transition-colors"
                title={isMuted ? 'Bật âm thanh video' : 'Tắt tiếng video'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            )}
            <span className="text-[10px] font-mono font-bold bg-black/60 px-2.5 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>{countdown}s</span>
            </span>
          </div>
        </div>

        {/* Media Container */}
        <div className="relative w-full aspect-video sm:aspect-[16/9] max-h-72 bg-black flex items-center justify-center overflow-hidden">
          {isVideo && !mediaError ? (
            <video
              key={mediaUrl}
              src={mediaUrl}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              onError={() => setMediaError(true)}
              className="w-full h-full object-cover"
            />
          ) : !mediaError ? (
            <img
              key={mediaUrl}
              src={mediaUrl}
              alt="Promo Poster"
              onError={() => setMediaError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-8 text-center space-y-2">
              <Film className="w-10 h-10 mx-auto text-stone-500" />
              <div className="text-xs font-bold text-stone-300">
                Không thể tải trực tiếp tập tin media từ URL
              </div>
              <div className="text-[10px] text-stone-500 font-mono truncate max-w-sm">
                {mediaUrl}
              </div>
            </div>
          )}

          {/* Bottom Gradient Overlay for Title */}
          <div className="absolute bottom-0 inset-x-0 z-20 p-3.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
            <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
              <Tag className="w-3 h-3" />
              <span>Dịch vụ nổi bật</span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight drop-shadow-md">
              {bannerTitle}
            </h3>
            {params.speech_text && (
              <p className="text-[11px] text-stone-300 mt-1 line-clamp-1 italic">
                "{params.speech_text}"
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
