import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  detectPerson,
  loadPersonDetector,
  getDetectorStatus,
} from '../../services/personDetector';

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
  const isPi5 = source === 'pi5';

  const offscreenVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const pi5ImgRef = useRef(null);
  const pi5PreviewImgRef = useRef(null);

  const isTriggeredRef = useRef(false);
  const negativeFramesRef = useRef(0);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false); // Mặc định mở camera để người dùng thấy rõ AI Bounding Box
  const [stream, setStream] = useState(null);
  const [pi5StreamError, setPi5StreamError] = useState(false);

  // Model & Detection States
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [isPersonDetected, setIsPersonDetected] = useState(false);
  const [latestDetection, setLatestDetection] = useState(null);

  // Khởi tạo và nạp model COCO-SSD trong background
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

    if (!detection || !detection.detected || !detection.bbox) {
      return;
    }

    const [x, y, w, h] = detection.bbox;

    // Chọn màu sắc theo khoảng cách
    let strokeColor = '#10b981'; // Emerald cho CLOSE
    let distanceText = 'GẦN (<1.5m)';
    if (detection.distance === 'APPROACHING') {
      strokeColor = '#06b6d4'; // Cyan cho APPROACHING
      distanceText = 'ĐANG TỚI (~2m)';
    } else if (detection.distance === 'FAR') {
      strokeColor = '#f59e0b'; // Amber cho FAR
      distanceText = 'XA (>3m)';
    }

    // 1. Vẽ khung Bounding Box
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.stroke();

    // 2. Vẽ 4 góc định vị công nghệ cao (Corner Reticles)
    const cornerSize = Math.min(24, w / 4, h / 4);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;

    // Góc trên trái
    ctx.beginPath();
    ctx.moveTo(x, y + cornerSize);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerSize, y);
    ctx.stroke();

    // Góc trên phải
    ctx.beginPath();
    ctx.moveTo(x + w - cornerSize, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + cornerSize);
    ctx.stroke();

    // Góc dưới trái
    ctx.beginPath();
    ctx.moveTo(x, y + h - cornerSize);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + cornerSize, y + h);
    ctx.stroke();

    // Góc dưới phải
    ctx.beginPath();
    ctx.moveTo(x + w - cornerSize, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - cornerSize);
    ctx.stroke();

    // 3. Vẽ nhãn Header phía trên Bounding Box
    const label = `PERSON ${detection.score}% • ${distanceText}`;
    ctx.font = 'bold 16px monospace';
    const textWidth = ctx.measureText(label).width;

    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    const tagY = Math.max(0, y - 28);
    ctx.roundRect(x, tagY, textWidth + 16, 24, 4);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.fillText(label, x + 8, tagY + 17);
  }, []);

  // Vòng lặp nhận diện người đa tầng (AI COCO-SSD + FaceDetector + Skin Fallback)
  useEffect(() => {
    if (!isCameraActive) return;

    const intervalId = setInterval(async () => {
      const sourceEl = getActiveSource();
      if (!sourceEl) return;

      try {
        let result = null;

        // TẦNG 1: Thử nhận diện bằng mô hình AI COCO-SSD (ngưỡng 0.28 tối ưu cho cả cự ly gần và xa)
        try {
          result = await detectPerson(sourceEl, { minConfidence: 0.28 });
        } catch (aiErr) {
          console.warn('[CameraPreview] Lỗi tạm thời khi chạy COCO-SSD:', aiErr);
        }

        // TẦNG 2: Nếu COCO-SSD chưa bắt được do khuôn mặt quá sát ống kính, thử FaceDetector trình duyệt
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
            // Không hỗ trợ hoặc lỗi
          }
        }

        // TẦNG 3: Fallback màu da / chuyển động nếu cả 2 AI chưa sẵn sàng
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
            } catch (drawErr) {
              // Bỏ qua nếu có lỗi đọc pixel (ví dụ cors stream)
            }
          }
        }

        // XỬ LÝ KẾT QUẢ NHẬN DIỆN
        if (result && result.detected) {
          negativeFramesRef.current = 0;
          setLatestDetection(result);
          drawBoundingBox(result, sourceEl);
          setIsPersonDetected(true);

          // Kích hoạt Robot mở mắt ngay lập tức khi phát hiện có người
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

          // Cần 4 frame liên tiếp không thấy ai (đúng 2.0 giây) để xác nhận khách đã rời đi
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
      } catch (err) {
        console.warn('[CameraPreview] Lỗi vòng lặp thị giác:', err);
      }
    }, 500); // Quét mỗi 500ms (2 lần / giây; 4 frame = đúng 2.0 giây)

    return () => {
      clearInterval(intervalId);
    };
  }, [isCameraActive, onGuestApproached, onGuestLeft, drawBoundingBox, getActiveSource]);

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
          title="Bấm để xem khung hình Camera & Bounding Box AI"
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
        </button>
      ) : (
        /* Khung xem Camera ở chế độ Mở rộng (Expanded với Bounding Box HUD) */
        <div className={`absolute top-5 left-5 md:top-3 md:left-4 z-40 ${controlsClassName}`}>
          <div
            onClick={() => setIsMinimized(true)}
            className="w-[240px] aspect-video bg-black rounded-2xl overflow-hidden relative border-2 border-stone-700/80 shadow-2xl backdrop-blur-md cursor-pointer hover:border-emerald-500/80 transition-all flex flex-col items-center justify-center group"
            title="Bấm vào khung hình để thu nhỏ"
          >
            {/* Header thông tin công nghệ */}
            <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between pointer-events-none">
              <div className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-white text-[9px] font-mono font-bold border border-white/20 flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    pi5StreamError
                      ? 'bg-red-400'
                      : isPersonDetected
                      ? 'bg-emerald-400 animate-ping'
                      : isCameraActive
                      ? 'bg-cyan-400 animate-pulse'
                      : 'bg-stone-500'
                  }`}
                />
                <span>
                  {modelLoading
                    ? 'LOADING AI...'
                    : pi5StreamError
                    ? 'STREAM ERROR'
                    : isPersonDetected
                    ? `GUEST: ${latestDetection?.distance || 'DETECTED'}`
                    : isPi5
                    ? 'PI5 STREAM'
                    : 'SCANNING GUEST'}
                </span>
              </div>

              <div className="px-1.5 py-0.5 rounded bg-black/75 text-[8px] font-mono text-stone-300 border border-white/10">
                {isPi5 ? 'PI5 MJPEG' : 'COCO-SSD'}
              </div>
            </div>

            {/* Video or Image Preview */}
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

            {/* Canvas vẽ Bounding Box bao quanh người (được mirror cùng video) */}
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none scale-x-[-1] ${
                isCameraActive ? 'block' : 'hidden'
              }`}
            />

            {/* Trạng thái khi Camera chưa bật */}
            {!isCameraActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startCamera();
                }}
                className="text-stone-300 hover:text-white transition-colors p-2 text-center text-[10px] font-semibold cursor-pointer z-10"
              >
                Bấm để bật Camera AI
              </button>
            )}

            {/* Footer gợi ý thu nhỏ */}
            <div className="absolute bottom-1 right-2 z-20 text-[8px] text-stone-400 font-mono pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              Click để thu nhỏ
            </div>
          </div>
        </div>
      )}
    </>
  );
};
