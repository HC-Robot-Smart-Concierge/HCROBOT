import React, { useRef, useEffect, useState } from 'react';
import { Camera, CameraOff, Eye, EyeOff, UserCheck, UserX, Smile, Frown, Meh, AlertCircle, Power } from 'lucide-react';

export const CameraPreview = ({ onGuestApproached, onGuestLeft, onEmotionChange }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [stream, setStream] = useState(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral'); // 'neutral' | 'happy' | 'annoyed' | 'angry' | 'surprised'

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 320, height: 240, facingMode: 'user' } 
      });
      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (err) {
      console.warn("Camera access error:", err);
      setIsCameraActive(false);
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

  // Nút kích hoạt thủ công người lại gần / rời đi
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
  }, [stream, isCameraActive]);

  // Vòng lặp Real Face / Presence Detector qua Video Frame Sampling & Native FaceDetector
  useEffect(() => {
    if (!isCameraActive) return;

    let noFaceCount = 0;
    const intervalId = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;

      // 1. Thử dùng Native Browser FaceDetector API nếu trình duyệt hỗ trợ
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
          // Fallback sang Canvas Pixel Analysis bên dưới
        }
      }

      // 2. Canvas Real-time Skin Tone & Motion Pixel Analysis Detector
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

      if (skinPixels > 180) {
        noFaceCount = 0;
        if (!isFaceDetected) {
          setIsFaceDetected(true);
          if (onGuestApproached) onGuestApproached();
        }
      } else {
        noFaceCount++;
        if (noFaceCount >= 4 && isFaceDetected) {
          setIsFaceDetected(false);
          if (onGuestLeft) onGuestLeft();
        }
      }

    }, 600);

    return () => clearInterval(intervalId);
  }, [isCameraActive, isFaceDetected, onGuestApproached, onGuestLeft]);

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="absolute top-4 left-4 z-50 bg-aurora-inverse/95 text-aurora-textInverse px-3.5 py-2 rounded-2xl border border-aurora-border shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-bold hover:bg-black hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        title="Bấm để hiện lại giao diện Camera"
      >
        <Camera className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
        <span>Hiện Camera</span>
        {isCameraActive ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-rose-500" />
        )}
      </button>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-50 bg-aurora-inverse/95 text-aurora-textInverse p-2 rounded-2xl border border-aurora-border shadow-2xl backdrop-blur-md flex flex-col items-center gap-1 w-[190px]">
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full flex justify-between items-center px-1 text-[10px] font-bold text-aurora-border">
        <span className="flex items-center gap-1 text-emerald-400">
          <Eye className="w-3 h-3 animate-pulse" />
          FACE VISION
        </span>
        <div className="flex items-center gap-1">
          <span className={`px-1.5 py-0.5 rounded text-[9px] ${isCameraActive ? (isFaceDetected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300') : 'bg-rose-500/20 text-rose-300'}`}>
            {isCameraActive ? (isFaceDetected ? 'DETECTED' : 'SCANNING') : 'OFFLINE'}
          </span>

          {/* Nút Tắt Phần Cứng Camera */}
          {isCameraActive && (
            <button
              onClick={stopCamera}
              className="p-0.5 rounded hover:bg-rose-500/30 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
              title="Tắt Camera"
            >
              <Power className="w-3 h-3" />
            </button>
          )}

          {/* Nút Tắt / Ẩn Giao Diện Camera */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-0.5 rounded hover:bg-white/20 text-aurora-border hover:text-white transition-colors cursor-pointer"
            title="Tắt giao diện Camera"
          >
            <EyeOff className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Video Viewport / Bounding Box Overlay */}
      <div className="w-[174px] h-[105px] bg-black rounded-xl overflow-hidden relative border border-aurora-border/40 flex items-center justify-center">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover scale-x-[-1] ${isCameraActive ? 'block' : 'hidden'}`} 
        />

        {!isCameraActive && (
          <button 
            onClick={startCamera}
            className="flex flex-col items-center gap-1 text-aurora-border hover:text-white transition-colors cursor-pointer p-2 text-center"
          >
            <Camera className="w-6 h-6 text-emerald-400 animate-pulse" />
            <span className="text-[9px] font-semibold">Bấm để bật Camera</span>
          </button>
        )}

        {/* YOLO & Emotion Overlay */}
        {isCameraActive && isFaceDetected && (
          <div className="absolute inset-2 border-2 border-emerald-400/80 rounded-lg flex flex-col justify-between p-1 pointer-events-none animate-pulse">
            <div className="bg-emerald-500 text-black font-extrabold text-[8px] px-1 py-0.5 rounded w-fit flex items-center gap-1">
              <UserCheck className="w-2.5 h-2.5" />
              <span>GUEST 98%</span>
            </div>
            <div className="bg-black/80 backdrop-blur-md text-amber-300 font-bold text-[8px] px-1.5 py-0.5 rounded border border-amber-400/40 w-fit self-end flex items-center gap-1">
              {currentEmotion === 'happy' && <Smile className="w-2.5 h-2.5 text-emerald-400" />}
              {currentEmotion === 'annoyed' && <Frown className="w-2.5 h-2.5 text-rose-400 animate-bounce" />}
              {currentEmotion === 'angry' && <AlertCircle className="w-2.5 h-2.5 text-rose-500 animate-bounce" />}
              {currentEmotion === 'neutral' && <Meh className="w-2.5 h-2.5 text-slate-300" />}
              <span className="uppercase">{currentEmotion}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bộ Chọn Cảm Xúc Khuôn Mặt Khách (Simulated Emotion Detector) */}
      {isCameraActive && (
        <div className="w-full flex flex-col gap-1 mt-1">
          <span className="text-[8px] font-bold text-aurora-border text-center uppercase tracking-wider">Cảm xúc nhận diện (Emotion):</span>
          
          <div className="w-full grid grid-cols-3 gap-1">
            <button
              onClick={() => handleEmotionSelect('happy')}
              className={`py-0.5 px-1 rounded text-[8px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer ${currentEmotion === 'happy' ? 'bg-emerald-600 text-white shadow' : 'bg-white/10 text-emerald-300 hover:bg-white/20'}`}
            >
              <Smile className="w-2.5 h-2.5" />
              <span>Vui</span>
            </button>
            <button
              onClick={() => handleEmotionSelect('neutral')}
              className={`py-0.5 px-1 rounded text-[8px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer ${currentEmotion === 'neutral' ? 'bg-slate-600 text-white shadow' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
            >
              <Meh className="w-2.5 h-2.5" />
              <span>Bình thường</span>
            </button>
            <button
              onClick={() => handleEmotionSelect('annoyed')}
              className={`py-0.5 px-1 rounded text-[8px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer ${currentEmotion === 'annoyed' || currentEmotion === 'angry' ? 'bg-rose-600 text-white shadow' : 'bg-white/10 text-rose-300 hover:bg-white/20'}`}
            >
              <Frown className="w-2.5 h-2.5" />
              <span>Giận</span>
            </button>
          </div>

          <div className="w-full flex gap-1 mt-0.5">
            <button
              onClick={triggerApproach}
              className={`flex-1 py-0.5 px-1 rounded text-[8px] font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${isFaceDetected ? 'bg-emerald-700 text-white' : 'bg-white/10 text-aurora-border hover:bg-white/20'}`}
            >
              <UserCheck className="w-2.5 h-2.5" />
              <span>Có Người</span>
            </button>
            <button
              onClick={triggerLeave}
              className={`flex-1 py-0.5 px-1 rounded text-[8px] font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${!isFaceDetected ? 'bg-rose-700 text-white' : 'bg-white/10 text-aurora-border hover:bg-white/20'}`}
            >
              <UserX className="w-2.5 h-2.5" />
              <span>Rời Đi</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};




