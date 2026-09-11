import React, { useRef, useEffect, useState, useCallback } from 'react';

const PI5_STREAM_DEFAULT_URL = 'http://localhost:8554/stream';

export const CameraPreview = ({
  onGuestApproached,
  onGuestLeft,
  onEmotionChange,
  autoStart = true,
  controlsClassName = '',
  source = 'local',
  streamUrl = PI5_STREAM_DEFAULT_URL,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pi5ImgRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [stream, setStream] = useState(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [pi5StreamError, setPi5StreamError] = useState(false);

  const isPi5 = source === 'pi5';

  const startCamera = useCallback(async () => {
    if (isPi5) {
      setPi5StreamError(false);
      setIsCameraActive(true);
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 360 },
          aspectRatio: { ideal: 1.7777777778 },
          facingMode: 'user'
        } 
      });
      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (err) {
      console.warn("Camera access error:", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(fallbackStream);
        setIsCameraActive(true);
      } catch (fbErr) {
        setIsCameraActive(false);
      }
    }
  }, [isPi5]);

  const stopCamera = useCallback(() => {
    if (!isPi5 && stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setIsFaceDetected(false);
    setPi5StreamError(false);
  }, [isPi5, stream]);

  const handleEmotionSelect = (emotion) => {
    setCurrentEmotion(emotion);
    if (onEmotionChange) {
      onEmotionChange(emotion);
    }
  };

  const triggerApproach = () => {
    setIsFaceDetected(true);
    if (onGuestApproached) {
      onGuestApproached();
    }
  };

  const triggerLeave = () => {
    setIsFaceDetected(false);
    if (onGuestLeft) {
      onGuestLeft();
    }
  };

  useEffect(() => {
    if (autoStart) startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [autoStart]);

  useEffect(() => {
    if (!isPi5 && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isCameraActive, isMinimized, isPi5]);

  useEffect(() => {
    if (!isCameraActive) return;

    const getDetectionSource = () => {
      if (isPi5) return pi5ImgRef.current;
      return videoRef.current;
    };

    let noFaceCount = 0;
    const intervalId = setInterval(async () => {
      const sourceEl = getDetectionSource();
      if (!sourceEl) return;

      if (!isPi5 && sourceEl.readyState !== 4) return;

      if ('FaceDetector' in window) {
        try {
          const detector = new window.FaceDetector();
          const faces = await detector.detect(sourceEl);
          if (faces && faces.length > 0) {
            noFaceCount = 0;
            if (!isFaceDetected) {
              setIsFaceDetected(true);
              if (onGuestApproached) onGuestApproached();
            }
            return;
          }
        } catch (e) {
          // Fallback
        }
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = 80;
      canvas.height = 60;

      try {
        ctx.drawImage(sourceEl, 0, 0, 80, 60);
      } catch (e) {
        return;
      }

      const frame = ctx.getImageData(0, 0, 80, 60);
      const data = frame.data;
      let skinPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r > 90 && g > 40 && b > 20 && r > g && r > b && (Math.max(r, g, b) - Math.min(r, g, b) > 15) && Math.abs(r - g) > 15) {
          skinPixels++;
        }
      }

      if (skinPixels > 70) {
        noFaceCount = 0;
        if (!isFaceDetected) {
          setIsFaceDetected(true);
          if (onGuestApproached) onGuestApproached();
        }
      } else {
        noFaceCount++;
        if (noFaceCount >= 15 && isFaceDetected) {
          setIsFaceDetected(false);
          if (onGuestLeft) onGuestLeft();
        }
      }

    }, 600);

    return () => clearInterval(intervalId);
  }, [isCameraActive, isFaceDetected, onGuestApproached, onGuestLeft, isPi5]);

  const renderVideoElement = (className, refCallback) => {
    if (isPi5) {
      return (
        <>
          <img
            ref={(node) => {
              pi5ImgRef.current = node;
              if (refCallback) refCallback(node);
            }}
            src={isCameraActive && !pi5StreamError ? streamUrl : undefined}
            alt="Pi5 Camera Stream"
            crossOrigin="anonymous"
            onError={() => setPi5StreamError(true)}
            onLoad={() => setPi5StreamError(false)}
            className={`${className} ${isCameraActive && !pi5StreamError ? 'block' : 'hidden'}`}
          />
          {pi5StreamError && isCameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-stone-300 text-[10px] font-semibold gap-1 p-2 text-center">
              <span className="text-red-400 font-bold">Stream Error</span>
              <span>Không kết nối được Pi5 Camera</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPi5StreamError(false);
                }}
                className="mt-1 px-2 py-0.5 bg-stone-700 rounded text-[9px] hover:bg-stone-600 cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          )}
        </>
      );
    }

    return (
      <video
        ref={(node) => {
          if (refCallback) refCallback(node);
          if (node && stream) node.srcObject = stream;
        }}
        autoPlay
        playsInline
        muted
        className={`${className} ${isCameraActive ? 'block' : 'hidden'}`}
      />
    );
  };

  const sourceLabel = isPi5 ? 'PI5 MJPEG' : 'CAM 16:9 LANDSCAPE';

  return (
    <>
      {/* Background Hidden Video/Img for 24/7 Continuous Background Vision Detection */}
      {isPi5 ? (
        <img
          ref={pi5ImgRef}
          src={isCameraActive && !pi5StreamError ? streamUrl : undefined}
          crossOrigin="anonymous"
          onError={() => setPi5StreamError(true)}
          onLoad={() => setPi5StreamError(false)}
          className="hidden"
          alt=""
        />
      ) : (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="hidden" 
        />
      )}
      <canvas ref={canvasRef} className="hidden" />

      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className={`absolute top-5 left-5 md:top-3 md:left-4 z-40 bg-stone-900/95 text-stone-200 px-3.5 py-1.5 rounded-full border border-stone-700/80 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-semibold hover:bg-stone-800 transition-all cursor-pointer ${controlsClassName}`}
          title="Bấm để xem khung hình Camera"
        >
          <span>Camera Control</span>
          {isPi5 && <span className="text-[8px] text-cyan-400 font-mono">PI5</span>}
          {isCameraActive ? (
            <span className={`w-2 h-2 rounded-full animate-pulse ${pi5StreamError ? 'bg-red-400' : 'bg-emerald-400'}`} />
          ) : (
            <span className="w-2 h-2 rounded-full bg-stone-500" />
          )}
        </button>
      ) : (
        <div className={`absolute top-5 left-5 md:top-3 md:left-4 z-40 ${controlsClassName}`}>
          <div 
            onClick={() => setIsMinimized(true)}
            className="w-[220px] aspect-video bg-black rounded-2xl overflow-hidden relative border-2 border-stone-700/80 shadow-2xl backdrop-blur-md cursor-pointer hover:border-emerald-500/80 transition-all flex flex-col items-center justify-center group"
            title="Bấm vào khung hình để thu nhỏ"
          >
            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[9px] font-mono font-bold border border-white/20 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${pi5StreamError ? 'bg-red-400' : 'bg-emerald-400'}`} />
              <span>{sourceLabel}</span>
            </div>

            {renderVideoElement(
              'w-full h-full object-cover aspect-video scale-x-[-1]',
              null
            )}

            {!isCameraActive && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  startCamera();
                }}
                className="text-stone-300 hover:text-white transition-colors p-2 text-center text-[10px] font-semibold cursor-pointer"
              >
                Bấm để bật Camera
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
