import React, { useRef, useEffect, useState } from 'react';

export const CameraPreview = ({ onGuestApproached, onGuestLeft, onEmotionChange }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [stream, setStream] = useState(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');

  const startCamera = async () => {
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
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setIsFaceDetected(false);
  };

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
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isCameraActive, isMinimized]);

  useEffect(() => {
    if (!isCameraActive) return;

    let noFaceCount = 0;
    const intervalId = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;

      if ('FaceDetector' in window) {
        try {
          const detector = new window.FaceDetector();
          const faces = await detector.detect(videoRef.current);
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
      ctx.drawImage(videoRef.current, 0, 0, 80, 60);

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
  }, [isCameraActive, isFaceDetected, onGuestApproached, onGuestLeft]);

  return (
    <>
      {/* Background Hidden Video for 24/7 Continuous Background Vision Detection */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="hidden" 
      />
      <canvas ref={canvasRef} className="hidden" />

      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="absolute top-5 left-5 md:top-3 md:left-4 z-40 bg-stone-900/95 text-stone-200 px-3.5 py-1.5 rounded-full border border-stone-700/80 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-semibold hover:bg-stone-800 transition-all cursor-pointer"
          title="Bấm để xem khung hình Camera"
        >
          <span>Camera Control</span>
          {isCameraActive ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-stone-500" />
          )}
        </button>
      ) : (
        <div className="absolute top-5 left-5 md:top-3 md:left-4 z-40">
          <div 
            onClick={() => setIsMinimized(true)}
            className="w-[220px] aspect-video bg-black rounded-2xl overflow-hidden relative border-2 border-stone-700/80 shadow-2xl backdrop-blur-md cursor-pointer hover:border-emerald-500/80 transition-all flex flex-col items-center justify-center group"
            title="Bấm vào khung hình để thu nhỏ"
          >
            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[9px] font-mono font-bold border border-white/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>CAM 16:9 LANDSCAPE</span>
            </div>

            <video 
              ref={(node) => {
                if (node && stream) node.srcObject = stream;
              }} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover aspect-video scale-x-[-1] ${isCameraActive ? 'block' : 'hidden'}`} 
            />

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
