import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  detectPerson,
  loadPersonDetector,
  getDetectorStatus,
} from '../../services/personDetector';

const PI5_STREAM_DEFAULT_URL = 'http://localhost:8554/stream';

const EMOTIONS = [
  { id: 'happy', label: 'Vui vẻ', emoji: '😊' },
  { id: 'neutral', label: 'Bình thường', emoji: '😐' },
  { id: 'unhappy', label: 'Khó chịu', emoji: '😠' },
];

export const CameraPreview = ({
  onGuestApproached,
  onGuestLeft,
  onEmotionChange,
  autoStart = true,
  controlsClassName = '',
  source = 'local',
  streamUrl = PI5_STREAM_DEFAULT_URL,
}) => {
  const isPi5 = source === 'pi5';

  const offscreenVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const pi5ImgRef = useRef(null);
  const pi5PreviewImgRef = useRef(null);
  const landmarkerRef = useRef(null);

  const isTriggeredRef = useRef(false);
  const negativeFramesRef = useRef(0);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [stream, setStream] = useState(null);
  const [pi5StreamError, setPi5StreamError] = useState(false);

  // Model & Detection States
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [isPersonDetected, setIsPersonDetected] = useState(false);
  const [latestDetection, setLatestDetection] = useState(null);

  // Emotion & Face States (MediaPipe)
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [visionModelReady, setVisionModelReady] = useState(false);
  const [smileScore, setSmileScore] = useState(0);
  const [frownScore, setFrownScore] = useState(0);

  // 1. Khởi tạo và nạp model COCO-SSD trong background
  useEffect(() => {
    let isMounted = true;
    setModelLoading(true);

    loadPersonDetector()
      .then(() => {
        if (isMounted) {
          setModelLoaded(true);
          setModelLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Không thể tải trước COCO-SSD, sẽ dùng fallback:', err);
        if (isMounted) {
          setModelLoaded(false);
          setModelLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Khởi tạo Google MediaPipe Face Landmarker nhận diện cơ mặt (Blendshapes)
  useEffect(() => {
    let isCancelled = false;

    const initLandmarker = async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        if (isCancelled) return;

        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });

        if (isCancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setVisionModelReady(true);
        console.log('[MediaPipe] Face Landmarker with Blendshapes initialized successfully!');
      } catch (err) {
        console.warn('[MediaPipe] Could not load cloud model, continuing with fallback:', err);
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
          facingMode: 'user',
        },
      });
      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Camera HD access error, trying fallback:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        setStream(fallbackStream);
        setIsCameraActive(true);
      } catch (fbErr) {
        console.error('Không thể truy cập camera:', fbErr);
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
    setIsPersonDetected(false);
    setIsFaceDetected(false);
    setLatestDetection(null);
    setPi5StreamError(false);
    if (isTriggeredRef.current) {
      isTriggeredRef.current = false;
      if (onGuestLeft) onGuestLeft();
    }

    // Xóa overlay canvas
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [isPi5, stream, onGuestLeft]);

  // Tự động bật camera nếu autoStart = true
  useEffect(() => {
    if (autoStart) startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [autoStart, startCamera]);

  // Gán stream cho các thẻ video và bắt buộc gọi play()
  useEffect(() => {
    if (!isPi5 && stream) {
      if (offscreenVideoRef.current) {
        offscreenVideoRef.current.srcObject = stream;
        offscreenVideoRef.current.play().catch(() => {});
      }
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
        previewVideoRef.current.play().catch(() => {});
      }
    }
  }, [stream, isCameraActive, isMinimized, isPi5]);

  // Lấy media element đang hoạt động và có sẵn frame hình (hỗ trợ cả video webcam và img stream từ Pi5)
  const getActiveSource = useCallback(() => {
    if (isPi5) {
      const pi5Preview = pi5PreviewImgRef.current;
      if (pi5Preview && pi5Preview.complete && pi5Preview.naturalWidth > 0) {
        return pi5Preview;
      }
      const pi5Hidden = pi5ImgRef.current;
      if (pi5Hidden && pi5Hidden.complete && pi5Hidden.naturalWidth > 0) {
        return pi5Hidden;
      }
      return null;
    }

    const previewEl = previewVideoRef.current;
    if (previewEl && previewEl.readyState >= 2 && previewEl.videoWidth > 0) {
      return previewEl;
    }
    const offscreenEl = offscreenVideoRef.current;
    if (offscreenEl && offscreenEl.readyState >= 2 && offscreenEl.videoWidth > 0) {
      return offscreenEl;
    }
    return null;
  }, [isPi5]);

  // Vẽ Bounding Box & nhãn thông tin lên Overlay Canvas
  const drawBoundingBox = useCallback((detection, sourceEl) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !sourceEl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vW = sourceEl.videoWidth || sourceEl.naturalWidth || 640;
    const vH = sourceEl.videoHeight || sourceEl.naturalHeight || 480;

    if (canvas.width !== vW || canvas.height !== vH) {
      canvas.width = vW;
      canvas.height = vH;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detection || !detection.detected) return;

    const [x, y, w, h] = detection.bbox;
    const isClose = detection.distance === 'CLOSE';

    // Vẽ Bounding Box với màu sắc động
    ctx.strokeStyle = isClose ? '#10b981' : '#38bdf8'; // Emerald nếu gần, Sky blue nếu đang tiến tới
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    // Vẽ 4 góc định vị (Corner accents)
    const cornerLen = Math.min(w, h) * 0.15;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;

    // Góc trên - trái
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen, y);
    ctx.stroke();

    // Góc trên - phải
    ctx.beginPath();
    ctx.moveTo(x + w - cornerLen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + cornerLen);
    ctx.stroke();

    // Góc dưới - trái
    ctx.beginPath();
    ctx.moveTo(x, y + h - cornerLen);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + cornerLen, y + h);
    ctx.stroke();

    // Góc dưới - phải
    ctx.beginPath();
    ctx.moveTo(x + w - cornerLen, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - cornerLen);
    ctx.stroke();

    // Vẽ nhãn phân loại (Label tag)
    const labelText = `GUEST: ${detection.distance || 'DETECTED'} (${detection.score}%)`;
    ctx.font = 'bold 13px monospace';
    const textMetrics = ctx.measureText(labelText);
    const tagHeight = 22;
    const tagWidth = textMetrics.width + 16;

    // Nền nhãn
    ctx.fillStyle = isClose ? 'rgba(16, 185, 129, 0.9)' : 'rgba(56, 189, 248, 0.9)';
    ctx.fillRect(x, Math.max(0, y - tagHeight), tagWidth, tagHeight);

    // Chữ nhãn
    ctx.fillStyle = '#0f172a';
    ctx.fillText(labelText, x + 8, Math.max(15, y - 6));
  }, []);

  // VÒNG LẶP THỊ GIÁC (AI PERSON + EMOTION DETECTOR)
  useEffect(() => {
    if (!isCameraActive) return;

    const intervalId = setInterval(async () => {
      const sourceEl = getActiveSource();
      if (!sourceEl) return;

      try {
        let result = null;

        // TẦNG 1: Nhận diện người bằng mô hình AI COCO-SSD
        try {
          result = await detectPerson(sourceEl, { minConfidence: 0.28 });
        } catch (aiErr) {
          console.warn('[CameraPreview] Lỗi tạm thời khi chạy COCO-SSD:', aiErr);
        }

        // TẦNG 2: FaceDetector trình duyệt nếu COCO-SSD chưa bắt được do quá sát
        if ((!result || !result.detected) && 'FaceDetector' in window) {
          try {
            const detector = new window.FaceDetector({ fastMode: true });
            const faces = await detector.detect(sourceEl);
            if (faces && faces.length > 0) {
              const face = faces[0];
              const box = face.boundingBox;
              result = {
                detected: true,
                class: 'person',
                score: 95,
                bbox: [
                  Math.round(box.x),
                  Math.round(box.y),
                  Math.round(box.width),
                  Math.round(box.height),
                ],
                center: {
                  x: Math.round(box.x + box.width / 2),
                  y: Math.round(box.y + box.height / 2),
                  relativeX: 0,
                },
                distance: 'CLOSE',
                distanceRatio: 0.65,
                allPersonsCount: faces.length,
              };
            }
          } catch (faceErr) {
            // Fallback
          }
        }

        // TẦNG 3: Fallback màu da / pixel nếu chưa phát hiện
        if (!result || !result.detected) {
          const canvas = hiddenCanvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = 80;
            canvas.height = 60;
            try {
              ctx.drawImage(sourceEl, 0, 0, 80, 60);
              const frame = ctx.getImageData(0, 0, 80, 60);
              const data = frame.data;
              let skinPixels = 0;

              for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                if (
                  r > 80 &&
                  g > 35 &&
                  b > 15 &&
                  r > g &&
                  r > b &&
                  Math.max(r, g, b) - Math.min(r, g, b) > 12 &&
                  Math.abs(r - g) > 12
                ) {
                  skinPixels++;
                }
              }

              if (skinPixels > 55) {
                const vW = sourceEl.videoWidth || sourceEl.naturalWidth || 640;
                const vH = sourceEl.videoHeight || sourceEl.naturalHeight || 480;
                result = {
                  detected: true,
                  class: 'person',
                  score: Math.min(99, Math.round(skinPixels * 0.9)),
                  bbox: [
                    Math.round(vW * 0.15),
                    Math.round(vH * 0.1),
                    Math.round(vW * 0.7),
                    Math.round(vH * 0.8),
                  ],
                  center: {
                    x: Math.round(vW / 2),
                    y: Math.round(vH / 2),
                    relativeX: 0,
                  },
                  distance: 'CLOSE',
                  distanceRatio: 0.7,
                  allPersonsCount: 1,
                };
              }
            } catch (drawErr) {}
          }
        }

        // XỬ LÝ KẾT QUẢ NHẬN DIỆN NGƯỜI
        if (result && result.detected) {
          negativeFramesRef.current = 0;
          setLatestDetection(result);
          drawBoundingBox(result, sourceEl);
          setIsPersonDetected(true);

          if (!isTriggeredRef.current) {
            isTriggeredRef.current = true;
            if (onGuestApproached) {
              onGuestApproached(result);
            }
          }
        } else {
          negativeFramesRef.current++;

          if (negativeFramesRef.current >= 2) {
            drawBoundingBox(null, sourceEl);
          }

          if (negativeFramesRef.current >= 4) {
            setLatestDetection(null);
            setIsPersonDetected(false);
            if (isTriggeredRef.current) {
              isTriggeredRef.current = false;
              if (onGuestLeft) {
                onGuestLeft();
              }
            }
          }
        }

        // TẦNG 4: Nhận diện biểu cảm gương mặt với Google MediaPipe Face Landmarker
        if (landmarkerRef.current && sourceEl) {
          try {
            const nowMs = performance.now();
            let results = null;
            if (sourceEl.tagName === 'VIDEO') {
              results = landmarkerRef.current.detectForVideo(sourceEl, nowMs);
            } else if (sourceEl.tagName === 'IMG' && sourceEl.complete) {
              // Đối với ảnh Pi5 stream
              results = landmarkerRef.current.detect(sourceEl);
            }

            if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
              setIsFaceDetected(true);

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
            } else {
              setIsFaceDetected(false);
              setSmileScore(0);
              setFrownScore(0);
            }
          } catch (mpErr) {
            // Lỗi đọc frame tạm thời
          }
        }
      } catch (err) {
        console.warn('[CameraPreview] Lỗi vòng lặp thị giác:', err);
      }
    }, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    isCameraActive,
    onGuestApproached,
    onGuestLeft,
    onEmotionChange,
    drawBoundingBox,
    getActiveSource,
  ]);

  const handleEmotionSelect = (emotionId) => {
    setCurrentEmotion(emotionId);
    if (onEmotionChange) {
      onEmotionChange(emotionId);
    }
  };

  return (
    <>
      {/* Media ngầm luôn decode khung hình ở background */}
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
          ref={offscreenVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'fixed',
            top: -9999,
            left: -9999,
            width: '640px',
            height: '480px',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      <canvas ref={hiddenCanvasRef} className="hidden" />

      {isMinimized ? (
        /* Nút xem Camera ở chế độ Thu nhỏ (Collapsed) */
        <button
          onClick={() => setIsMinimized(false)}
          className={`absolute top-5 left-5 md:top-3 md:left-4 z-40 bg-stone-900/95 text-stone-200 px-3.5 py-1.5 rounded-full border border-stone-700/80 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-semibold hover:bg-stone-800 transition-all cursor-pointer ${controlsClassName}`}
          title="Bấm để xem khung hình Camera, AI Bounding Box & Cảm xúc"
        >
          <span className="flex items-center gap-1.5">
            <span>AI Camera</span>
            {isPi5 && <span className="text-[8px] text-cyan-400 font-mono">PI5</span>}
            {latestDetection?.detected && (
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                [{latestDetection.distance}]
              </span>
            )}
          </span>

          {isCameraActive ? (
            pi5StreamError ? (
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            ) : isPersonDetected ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )
          ) : (
            <span className="w-2 h-2 rounded-full bg-stone-500" />
          )}

          <div className="h-3 w-px bg-stone-700 mx-0.5" />

          {/* Current Emotion Badge in Collapsed Mode */}
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
              currentEmotion === 'happy'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : currentEmotion === 'unhappy'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                : 'bg-stone-800 text-stone-300 border-stone-600'
            }`}
          >
            <span>{currentEmotion === 'happy' ? '😊' : currentEmotion === 'unhappy' ? '😠' : '😐'}</span>
            <span>{currentEmotion === 'happy' ? 'Vui vẻ' : currentEmotion === 'unhappy' ? 'Khó chịu' : 'Bình thường'}</span>
          </span>
        </button>
      ) : (
        /* Khung xem Camera ở chế độ Mở rộng (Expanded với Bounding Box HUD & Emotion Panel) */
        <div className={`absolute top-5 left-5 md:top-3 md:left-4 z-40 ${controlsClassName}`}>
          <div className="w-[280px] bg-stone-900/95 rounded-2xl overflow-hidden border-2 border-stone-700/80 shadow-2xl backdrop-blur-md flex flex-col transition-all">
            {/* Header thông tin công nghệ */}
            <div className="px-3 py-2 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    pi5StreamError
                      ? 'bg-red-400'
                      : isPersonDetected
                      ? 'bg-emerald-400 animate-ping'
                      : isCameraActive
                      ? 'bg-cyan-400 animate-pulse'
                      : 'bg-stone-500'
                  }`}
                />
                <span className="text-white text-[10px] font-mono font-bold tracking-wider">
                  {isPi5 ? 'PI5 MJPEG' : 'CAM LAPTOP'}
                </span>
                <span className="text-[9px] font-mono text-stone-400">
                  {modelLoading
                    ? 'LOAD...'
                    : pi5StreamError
                    ? 'ERR'
                    : isPersonDetected
                    ? `[${latestDetection?.distance || 'DETECT'}]`
                    : 'SCAN'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    isFaceDetected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-stone-800 text-stone-400 border border-stone-700'
                  }`}
                >
                  {isFaceDetected ? '👤 Thấy mặt' : '👤 Quét mặt...'}
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

            {/* Video or Image Preview */}
            <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
              {isPi5 ? (
                <>
                  <img
                    ref={pi5PreviewImgRef}
                    src={isCameraActive && !pi5StreamError ? streamUrl : undefined}
                    alt="Pi5 Camera Stream"
                    crossOrigin="anonymous"
                    onError={() => setPi5StreamError(true)}
                    onLoad={() => setPi5StreamError(false)}
                    className={`w-full h-full object-cover aspect-video scale-x-[-1] ${
                      isCameraActive && !pi5StreamError ? 'block' : 'hidden'
                    }`}
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
              ) : (
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover aspect-video scale-x-[-1] ${
                    isCameraActive ? 'block' : 'hidden'
                  }`}
                />
              )}

              {/* Canvas vẽ Bounding Box bao quanh người */}
              <canvas
                ref={overlayCanvasRef}
                className={`absolute inset-0 w-full h-full object-cover pointer-events-none scale-x-[-1] ${
                  isCameraActive ? 'block' : 'hidden'
                }`}
              />

              {/* HUD scan overlay */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none border border-emerald-500/20 m-2 rounded-lg flex flex-col justify-between p-1.5">
                  <div className="flex justify-between text-[8px] font-mono text-emerald-400/80 font-bold">
                    <span>{visionModelReady ? '[AI BLENDSHAPES]' : '[COCO-SSD]'}</span>
                    <span>{isFaceDetected ? 'FACE: LOCKED' : isPersonDetected ? 'GUEST: LOCKED' : 'SEARCHING...'}</span>
                  </div>

                  {isFaceDetected && (
                    <div className="self-center flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1.5 text-[8px] font-mono text-stone-300 bg-black/75 px-2 py-0.5 rounded-full border border-stone-700">
                        <span>Cười: {(smileScore * 100).toFixed(0)}%</span>
                        <span>•</span>
                        <span>Khó chịu: {(frownScore * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}

                  <div className="text-[8px] font-mono text-stone-400/70 text-right">
                    {isPi5 ? 'MJPEG STREAM' : '720p HD @ 30FPS'}
                  </div>
                </div>
              )}

              {!isCameraActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startCamera();
                  }}
                  className="text-stone-300 hover:text-white transition-colors p-3 text-center text-xs font-semibold cursor-pointer bg-stone-800/80 hover:bg-stone-700/80 rounded-xl border border-stone-600 z-10"
                >
                  📷 Bấm để bật Camera AI
                </button>
              )}
            </div>

            {/* Emotion Detection & Selection Control */}
            <div className="p-2.5 bg-stone-900/90 border-t border-stone-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold tracking-wide uppercase text-stone-300">
                  Cảm xúc từ Camera:
                </span>
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

              <p className="text-[8.5px] text-stone-400/80 italic text-center mt-0.5">
                💡 Rora tự điều chỉnh ngữ điệu và phản hồi tương ứng!
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
