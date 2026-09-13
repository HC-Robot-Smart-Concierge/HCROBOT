import React, { useRef, useEffect, useState } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

export const CameraPreview = ({
  onGuestApproached,
  onGuestLeft,
  onEmotionChange,
  autoStart = true,
  controlsClassName = '',
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [stream, setStream] = useState(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [visionModelReady, setVisionModelReady] = useState(false);
  const [smileScore, setSmileScore] = useState(0);
  const [frownScore, setFrownScore] = useState(0);

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
    if (autoStart) startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [autoStart]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isCameraActive, isMinimized]);

  // Khởi tạo Google MediaPipe Face Landmarker nhận diện cơ mặt (Blendshapes)
  useEffect(() => {
    let isCancelled = false;

    const initLandmarker = async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        if (isCancelled) return;

        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

        if (isCancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setVisionModelReady(true);
        console.log("[MediaPipe] Face Landmarker with Blendshapes initialized successfully!");
      } catch (err) {
        console.warn("[MediaPipe] Could not load cloud model, continuing with Optical Canvas fallback:", err);
      }
    };

    initLandmarker();

    return () => {
      isCancelled = true;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    if (!isCameraActive) return;

    let noFaceCount = 0;
    const intervalId = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      // 1. ƯU TIÊN 1: MediaPipe 3D Landmark & 52 Blendshapes (Nhận diện chính xác nụ cười & nhíu mày)
      if (landmarkerRef.current) {
        try {
          const nowMs = performance.now();
          const results = landmarkerRef.current.detectForVideo(videoRef.current, nowMs);

          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            noFaceCount = 0;
            if (!isFaceDetected) {
              setIsFaceDetected(true);
              if (onGuestApproached) onGuestApproached();
            }

            if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
              const categories = results.faceBlendshapes[0].categories;
              let sLeft = 0, sRight = 0, bDownL = 0, bDownR = 0, mFrownL = 0, mFrownR = 0;

              for (const c of categories) {
                if (c.categoryName === 'mouthSmileLeft') sLeft = c.score;
                else if (c.categoryName === 'mouthSmileRight') sRight = c.score;
                else if (c.categoryName === 'browDownLeft') bDownL = c.score;
                else if (c.categoryName === 'browDownRight') bDownR = c.score;
                else if (c.categoryName === 'mouthFrownLeft') mFrownL = c.score;
                else if (c.categoryName === 'mouthFrownRight') mFrownR = c.score;
              }

              const smile = (sLeft + sRight) / 2;
              const frown = Math.max((bDownL + bDownR) / 2, (mFrownL + mFrownR) / 2);
              setSmileScore(smile);
              setFrownScore(frown);

              let detected = 'neutral';
              if (smile >= 0.35) {
                detected = 'happy';
              } else if (frown >= 0.28) {
                detected = 'unhappy';
              }

              setCurrentEmotion((prev) => {
                if (prev !== detected) {
                  if (onEmotionChange) onEmotionChange(detected);
                }
                return detected;
              });
            }
            return;
          } else {
            noFaceCount++;
            if (noFaceCount >= 10 && isFaceDetected) {
              setIsFaceDetected(false);
              setSmileScore(0);
              setFrownScore(0);
              if (onGuestLeft) onGuestLeft();
            }
          }
        } catch (mpErr) {
          // Fallback to Canvas
        }
      }

      // 2. ƯU TIÊN 2: Native Browser Shape Detection
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

      // 3. ƯU TIÊN 3: Optical Canvas Color & Mouth Pixel Fallback
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = 80;
      canvas.height = 60;
      ctx.drawImage(videoRef.current, 0, 0, 80, 60);

      const frame = ctx.getImageData(0, 0, 80, 60);
      const data = frame.data;
      let skinPixels = 0;
      let teethPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Nhận diện vùng da
        if (r > 90 && g > 40 && b > 20 && r > g && r > b && (Math.max(r, g, b) - Math.min(r, g, b) > 15) && Math.abs(r - g) > 15) {
          skinPixels++;
        }
        // Nhận diện răng sáng khi cười mở miệng
        if (r > 165 && g > 155 && b > 145 && Math.abs(r - g) < 18) {
          teethPixels++;
        }
      }

      if (skinPixels > 70) {
        noFaceCount = 0;
        if (!isFaceDetected) {
          setIsFaceDetected(true);
          if (onGuestApproached) onGuestApproached();
        }
        // Nếu răng sáng lộ ra nhiều -> Tự động nhận diện cười (happy)
        if (teethPixels > 25 && currentEmotion !== 'happy') {
          setCurrentEmotion('happy');
          if (onEmotionChange) onEmotionChange('happy');
        }
      } else {
        noFaceCount++;
        if (noFaceCount >= 15 && isFaceDetected) {
          setIsFaceDetected(false);
          if (onGuestLeft) onGuestLeft();
        }
      }

    }, 380);

    return () => clearInterval(intervalId);
  }, [isCameraActive, isFaceDetected, onGuestApproached, onGuestLeft, currentEmotion, onEmotionChange]);

  const EMOTIONS = [
    { id: 'happy', label: 'Vui vẻ', emoji: '😊' },
    { id: 'neutral', label: 'Bình thường', emoji: '😐' },
    { id: 'unhappy', label: 'Khó chịu', emoji: '😠' },
  ];

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
          className={`absolute top-5 left-5 md:top-3 md:left-4 z-40 bg-stone-900/95 text-stone-200 px-3.5 py-1.5 rounded-full border border-stone-700/80 shadow-xl backdrop-blur-md flex items-center gap-2.5 text-xs font-semibold hover:bg-stone-800 transition-all cursor-pointer ${controlsClassName}`}
          title="Bấm để xem khung hình Camera và Cảm xúc"
        >
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
            <span>Camera</span>
          </div>

          <div className="h-3 w-px bg-stone-700" />

          {/* Live Face Detection Indicator */}
          <span className={`text-[10px] font-medium flex items-center gap-1 ${isFaceDetected ? 'text-emerald-400' : 'text-stone-400'}`}>
            <span>👤</span>
            <span>{isFaceDetected ? 'Đã thấy khách' : 'Quét...'}</span>
          </span>

          <div className="h-3 w-px bg-stone-700" />

          {/* Current Emotion Badge */}
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
            currentEmotion === 'happy' 
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' 
              : currentEmotion === 'unhappy' 
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' 
              : 'bg-stone-800 text-stone-300 border-stone-600'
          }`}>
            <span>{currentEmotion === 'happy' ? '😊' : currentEmotion === 'unhappy' ? '😠' : '😐'}</span>
            <span>{currentEmotion === 'happy' ? 'Vui vẻ' : currentEmotion === 'unhappy' ? 'Khó chịu' : 'Bình thường'}</span>
          </span>
        </button>
      ) : (
        <div className={`absolute top-5 left-5 md:top-3 md:left-4 z-40 ${controlsClassName}`}>
          <div className="w-[300px] bg-stone-900/95 rounded-2xl overflow-hidden border-2 border-stone-700/80 shadow-2xl backdrop-blur-md flex flex-col transition-all">
            {/* Header */}
            <div className="px-3 py-2 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-white text-[10px] font-mono font-bold tracking-wider">CAM LAPTOP (16:9)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isFaceDetected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}`}>
                  {isFaceDetected ? '👤 Thấy mặt khách' : '👤 Đang quét mặt...'}
                </span>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="text-stone-400 hover:text-white p-1 rounded-md hover:bg-stone-800 text-xs leading-none transition-colors cursor-pointer"
                  title="Thu nhỏ camera"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Video stream */}
            <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={(node) => {
                  if (node && stream) node.srcObject = stream;
                }}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${isCameraActive ? 'block' : 'hidden'}`}
              />

              {/* HUD scan overlay */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none border border-emerald-500/20 m-2 rounded-lg flex flex-col justify-between p-1.5">
                  <div className="flex justify-between text-[8px] font-mono text-emerald-400/80 font-bold">
                    <span>{visionModelReady ? '[AI BLENDSHAPES: ONLINE]' : '[AI VISION ONLINE]'}</span>
                    <span>{isFaceDetected ? 'TARGET: LOCKED' : 'SEARCHING...'}</span>
                  </div>
                  {isFaceDetected && (
                    <div className="self-center flex flex-col items-center gap-1">
                      <div className="px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-xs text-[10px] font-semibold text-emerald-300 border border-emerald-400/50 shadow-md">
                        {currentEmotion === 'happy' ? '😊 Biểu cảm: Vui vẻ' : currentEmotion === 'unhappy' ? '😠 Biểu cảm: Khó chịu' : '😐 Biểu cảm: Bình thường'}
                      </div>
                      <div className="flex items-center gap-2 text-[8px] font-mono text-stone-300 bg-black/70 px-2 py-0.5 rounded-full border border-stone-700">
                        <span>Cười: {(smileScore * 100).toFixed(0)}%</span>
                        <span>•</span>
                        <span>Khó chịu: {(frownScore * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}
                  <div className="text-[8px] font-mono text-stone-400/70 text-right">
                    720p HD @ 30FPS
                  </div>
                </div>
              )}

              {!isCameraActive && (
                <button
                  onClick={startCamera}
                  className="text-stone-300 hover:text-white transition-colors p-3 text-center text-xs font-semibold cursor-pointer bg-stone-800/80 hover:bg-stone-700/80 rounded-xl border border-stone-600"
                >
                  📷 Bấm để bật Camera Laptop
                </button>
              )}
            </div>

            {/* Emotion Detection & Selection Control */}
            <div className="p-3 bg-stone-900/90 border-t border-stone-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold tracking-wide uppercase text-stone-300">Cảm xúc nhận diện từ Camera:</span>
                <span className="text-[9px] text-stone-500 font-medium">Click để đổi</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {EMOTIONS.map((item) => {
                  const isSelected = currentEmotion === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleEmotionSelect(item.id)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-0.5 border transition-all cursor-pointer ${
                        isSelected
                          ? item.id === 'happy'
                            ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400 shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400'
                            : item.id === 'unhappy'
                            ? 'bg-rose-500/25 text-rose-200 border-rose-400 shadow-md shadow-rose-950/50 ring-1 ring-rose-400'
                            : 'bg-amber-500/25 text-amber-200 border-amber-400 shadow-md shadow-amber-950/50 ring-1 ring-amber-400'
                          : 'bg-stone-800/60 text-stone-400 border-stone-700/60 hover:bg-stone-800 hover:text-stone-200'
                      }`}
                    >
                      <span className="text-base">{item.emoji}</span>
                      <span className="text-[10px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[9px] text-stone-400/80 italic text-center mt-0.5">
                💡 Rora sẽ tự điều chỉnh ngữ điệu và phản hồi tương ứng!
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
