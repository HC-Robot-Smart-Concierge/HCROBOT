import React from 'react';
import { X } from 'lucide-react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

export const EMOTIONS = [
  { id: 'happy', label: 'Vui vẻ' },
  { id: 'neutral', label: 'Bình thường' },
  { id: 'unhappy', label: 'Khó chịu' },
];

export const createFaceLandmarkerInstance = async () => {
  const fileset = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU',
    },
    outputFaceBlendshapes: true,
    runningMode: 'VIDEO',
    numFaces: 1,
  });
};

export const acquireLocalCameraStream = async () => {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 360 },
        aspectRatio: { ideal: 1.7777777778 },
        facingMode: 'user',
      },
    });
  } catch (err) {
    console.warn('Camera HD access error, trying fallback:', err);
    return navigator.mediaDevices.getUserMedia({ video: true });
  }
};

export const pickActiveCameraSource = ({
  isPi5,
  pi5PreviewImgRef,
  pi5ImgRef,
  previewVideoRef,
  offscreenVideoRef,
}) => {
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
};

export const drawDetectionOverlay = (canvas, detection, sourceEl) => {
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

  ctx.strokeStyle = isClose ? '#10b981' : '#38bdf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);

  const cornerLen = Math.min(w, h) * 0.15;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + cornerLen);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cornerLen, y);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + cornerLen);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + h - cornerLen);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + cornerLen, y + h);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - cornerLen);
  ctx.stroke();

  const labelText = `GUEST: ${detection.distance || 'DETECTED'} (${detection.score}%)`;
  ctx.font = 'bold 13px monospace';
  const textMetrics = ctx.measureText(labelText);
  const tagHeight = 22;
  const tagWidth = textMetrics.width + 16;

  ctx.fillStyle = isClose ? 'rgba(16, 185, 129, 0.9)' : 'rgba(56, 189, 248, 0.9)';
  ctx.fillRect(x, Math.max(0, y - tagHeight), tagWidth, tagHeight);

  ctx.fillStyle = '#0f172a';
  ctx.fillText(labelText, x + 8, Math.max(15, y - 6));
};

export const CameraPreviewViewport = ({
  isPi5,
  pi5ImgRef,
  pi5PreviewImgRef,
  isCameraActive,
  pi5StreamError,
  setPi5StreamError,
  streamUrl,
  offscreenVideoRef,
  previewVideoRef,
  hiddenCanvasRef,
  overlayCanvasRef,
  visible,
  isMinimized,
  setIsMinimized,
  controlsClassName,
  onClose,
  latestDetection,
  isPersonDetected,
  isFaceDetected,
  currentEmotion,
  modelLoading,
  smileScore,
  frownScore,
  startCamera,
  handleEmotionSelect,
}) => (
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

    {!visible ? null : isMinimized ? (
      /* Nút xem Camera ở chế độ Thu nhỏ (Collapsed) */
      <button
        onClick={() => setIsMinimized(false)}
        className={`absolute top-5 left-5 md:top-3 md:left-4 z-40 bg-stone-900/95 text-stone-200 px-3.5 py-1.5 rounded-full border border-stone-700/80 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-semibold hover:bg-stone-800 transition-all cursor-pointer ${controlsClassName}`}
        title="Bấm để xem khung hình Camera & Cảm xúc"
      >
        <span className="flex items-center gap-1.5">
          <span>Camera AI</span>
          {latestDetection?.detected && (
            <span className="text-[10px] text-stone-300 font-mono font-bold">
              [{latestDetection.distance}]
            </span>
          )}
        </span>

        {isCameraActive ? (
          pi5StreamError ? (
            <span className="w-2 h-2 rounded-full bg-stone-500" />
          ) : isPersonDetected ? (
            <span className="w-2 h-2 rounded-full bg-stone-300 animate-pulse" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-stone-400" />
          )
        ) : (
          <span className="w-2 h-2 rounded-full bg-stone-600" />
        )}

        <div className="h-3 w-px bg-stone-700 mx-0.5" />

        {/* Current Emotion Badge in Collapsed Mode */}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
          {currentEmotion === 'happy' ? 'Vui vẻ' : currentEmotion === 'unhappy' ? 'Khó chịu' : 'Bình thường'}
        </span>
      </button>
    ) : (
      /* Khung xem Camera ở chế độ Mở rộng (Expanded với Bounding Box HUD & Emotion Panel) */
      <div className={`absolute top-5 left-5 md:top-3 md:left-4 z-40 ${controlsClassName}`}>
        <div className="w-[280px] bg-stone-900/95 rounded-2xl overflow-hidden border border-stone-700 shadow-2xl backdrop-blur-md flex flex-col transition-all">
          {/* Header thông tin công nghệ */}
          <div className="px-3 py-2 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  pi5StreamError
                    ? 'bg-stone-500'
                    : isPersonDetected
                    ? 'bg-stone-200 animate-pulse'
                    : isCameraActive
                    ? 'bg-stone-400'
                    : 'bg-stone-600'
                }`}
              />
              <span className="text-stone-200 text-[10px] font-mono font-bold tracking-wider">
                CAMERA AI
              </span>
              <span className="text-[9px] font-mono text-stone-400">
                {modelLoading
                  ? 'ĐANG TẢI...'
                  : pi5StreamError
                  ? 'NGOẠI TUYẾN'
                  : isPersonDetected
                  ? `[${latestDetection?.distance || 'PHÁT HIỆN'}]`
                  : 'ĐANG QUÉT'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                {isFaceDetected ? 'Khuôn mặt: Có' : 'Quét mặt...'}
              </span>
              <button
                onClick={() => {
                  setIsMinimized(true);
                  onClose?.();
                }}
                className="text-stone-400 hover:text-white p-1 rounded-md hover:bg-stone-800 text-xs leading-none transition-colors cursor-pointer"
                title="Đóng camera"
              >
                <X className="w-3.5 h-3.5" />
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
                    <span className="text-stone-300 font-bold">Chưa kết nối luồng camera</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPi5StreamError(false);
                      }}
                      className="mt-1 px-2.5 py-1 bg-stone-800 border border-stone-700 rounded text-[9px] hover:bg-stone-700 cursor-pointer text-stone-200"
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
              <div className="absolute inset-0 pointer-events-none border border-stone-700/60 m-2 rounded-lg flex flex-col justify-between p-1.5">
                <div className="flex justify-between text-[8px] font-mono text-stone-400 font-bold">
                  <span>CẢM BIẾN</span>
                  <span>{isFaceDetected ? 'KHUÔN MẶT: ĐÃ KHÓA' : isPersonDetected ? 'KHÁCH: ĐÃ KHÓA' : 'ĐANG QUÉT...'}</span>
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

                <div className="text-[8px] font-mono text-stone-500 text-right">
                  CAMERA TRỰC TIẾP
                </div>
              </div>
            )}

            {!isCameraActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startCamera();
                }}
                className="text-stone-300 hover:text-white transition-colors px-3 py-2 text-center text-xs font-semibold cursor-pointer bg-stone-800 hover:bg-stone-700 rounded-xl border border-stone-700 z-10"
              >
                Bật Camera AI
              </button>
            )}
          </div>

          {/* Emotion Detection & Selection Control */}
          <div className="p-2.5 bg-stone-900/90 border-t border-stone-800 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold tracking-wide uppercase text-stone-400">
                Cảm xúc từ Camera:
              </span>
              <span className="text-[9px] text-stone-500 font-medium">Chọn để thử</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {EMOTIONS.map((item) => {
                const isSelected = currentEmotion === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleEmotionSelect(item.id)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-stone-700 text-white border-stone-500 shadow-sm'
                        : 'bg-stone-800/80 text-stone-400 border-stone-700 hover:bg-stone-800 hover:text-stone-200'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <p className="text-[8.5px] text-stone-500 italic text-center mt-0.5">
              Rora tự điều chỉnh ngữ điệu phản hồi theo cảm xúc
            </p>
          </div>
        </div>
      </div>
    )}
  </>
);
