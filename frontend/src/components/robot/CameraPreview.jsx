import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  detectPerson,
  loadPersonDetector,
} from '../../services/personDetector';
import {
  CameraPreviewViewport,
  createFaceLandmarkerInstance,
  acquireLocalCameraStream,
  pickActiveCameraSource,
  drawDetectionOverlay,
} from './CameraPreviewViewport';

const PI5_STREAM_DEFAULT_URL = '/api/v1/operations/robot/camera/stream';

export const CameraPreview = ({
  onGuestApproached,
  onGuestLeft,
  onEmotionChange,
  autoStart = true,
  controlsClassName = '',
  source = 'local',
  streamUrl = PI5_STREAM_DEFAULT_URL,
  defaultMinimized = true,
  visible = true,
  onClose,
  externalStream = null,
}) => {
  const isPi5 = source === 'pi5';
  // Guest-session updates change the handlers, but must not restart the camera.
  const presenceHandlers = useRef({});
  presenceHandlers.current = { onGuestApproached, onGuestLeft };

  const offscreenVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const pi5ImgRef = useRef(null);
  const pi5PreviewImgRef = useRef(null);
  const landmarkerRef = useRef(null);

  const isTriggeredRef = useRef(false);
  const negativeFramesRef = useRef(0);
  const consecutiveUnhappyFramesRef = useRef(0);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
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
        const landmarker = await createFaceLandmarkerInstance();
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
      const mediaStream = await acquireLocalCameraStream();
      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (fbErr) {
      console.error('Không thể truy cập camera:', fbErr);
      setIsCameraActive(false);
    }
  }, [isPi5]);

  const stopCamera = useCallback(() => {
    if (!isPi5) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      if (offscreenVideoRef.current && offscreenVideoRef.current.srcObject) {
        try {
          offscreenVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
          offscreenVideoRef.current.srcObject = null;
        } catch (e) {}
      }
      if (previewVideoRef.current && previewVideoRef.current.srcObject) {
        try {
          previewVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
          previewVideoRef.current.srcObject = null;
        } catch (e) {}
      }
    }
    setIsCameraActive(false);
    setIsPersonDetected(false);
    setIsFaceDetected(false);
    setLatestDetection(null);
    setPi5StreamError(false);
    if (isTriggeredRef.current) {
      isTriggeredRef.current = false;
      presenceHandlers.current.onGuestLeft?.();
    }

    // Xóa overlay canvas
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [isPi5, stream]);

  // Tự động sử dụng externalStream nếu được cung cấp từ hook useKioskStreamBroadcaster
  useEffect(() => {
    if (externalStream) {
      setStream(externalStream);
      setIsCameraActive(true);
    }
  }, [externalStream]);

  // Tự động bật camera nếu autoStart = true (chỉ khi không có externalStream)
  useEffect(() => {
    if (externalStream) return undefined;

    if (autoStart) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      // Chỉ cleanup stream do chính component tự tạo, không stop externalStream
      if (!externalStream && stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [autoStart, externalStream, startCamera, stopCamera]);

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

  const getActiveSource = useCallback(
    () => pickActiveCameraSource({ isPi5, pi5PreviewImgRef, pi5ImgRef, previewVideoRef, offscreenVideoRef }),
    [isPi5]
  );

  const drawBoundingBox = useCallback((detection, sourceEl) => {
    drawDetectionOverlay(overlayCanvasRef.current, detection, sourceEl);
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
            presenceHandlers.current.onGuestApproached?.(result);
          }
        } else {
          negativeFramesRef.current++;

          if (negativeFramesRef.current >= 2) {
            drawBoundingBox(null, sourceEl);
          }

          // Yêu cầu ít nhất 16 frames âm tính liên tiếp (~8 giây không thấy bất kỳ ai) mới kích hoạt GuestLeft
          // để tránh ngắt nhầm phiên hội thoại khi khách chỉ chớp mắt, quay đầu hoặc cúi nhìn điện thoại
          if (negativeFramesRef.current >= 16) {
            setLatestDetection(null);
            setIsPersonDetected(false);
            if (isTriggeredRef.current) {
              isTriggeredRef.current = false;
              presenceHandlers.current.onGuestLeft?.();
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
                const browDown = (bDownL + bDownR) / 2;
                const mouthFrown = (mFrownL + mFrownR) / 2;
                // Diem kho chiu tong hop (Compound Distress): 60% tu chan may, 40% tu khoe mieng
                const compoundDistress = browDown * 0.6 + mouthFrown * 0.4;
                const frown = Math.max(browDown, mouthFrown);
                setSmileScore(smile);
                setFrownScore(frown);

                // 1. Danh gia ung vien bieu cam (Candidate Emotion)
                let candidate = 'neutral';
                if (smile >= 0.35) {
                  candidate = 'happy';
                } else if ((compoundDistress >= 0.38 || (browDown >= 0.45 && mouthFrown >= 0.18)) && smile < 0.15) {
                  candidate = 'unhappy';
                }

                // 2. Bo loc xac nhan theo thoi gian (Temporal Confirmation Filter):
                // Phai duy tri bieu cam kho chiu lien tuc >= 3 frames (~1.5s) de tranh bao sai khi chop mat hoac cui dau
                let confirmedEmotion = 'neutral';
                if (candidate === 'unhappy') {
                  consecutiveUnhappyFramesRef.current += 1;
                  if (consecutiveUnhappyFramesRef.current >= 3) {
                    confirmedEmotion = 'unhappy';
                  } else {
                    confirmedEmotion = 'neutral';
                  }
                } else {
                  consecutiveUnhappyFramesRef.current = 0;
                  confirmedEmotion = candidate;
                }

                setCurrentEmotion((prev) => {
                  if (prev !== confirmedEmotion) {
                    if (onEmotionChange) onEmotionChange(confirmedEmotion);
                  }
                  return confirmedEmotion;
                });
              }
            } else {
              setIsFaceDetected(false);
              setSmileScore(0);
              setFrownScore(0);
              consecutiveUnhappyFramesRef.current = 0;
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
    <CameraPreviewViewport
      isPi5={isPi5}
      pi5ImgRef={pi5ImgRef}
      pi5PreviewImgRef={pi5PreviewImgRef}
      isCameraActive={isCameraActive}
      pi5StreamError={pi5StreamError}
      setPi5StreamError={setPi5StreamError}
      streamUrl={streamUrl}
      offscreenVideoRef={offscreenVideoRef}
      previewVideoRef={previewVideoRef}
      hiddenCanvasRef={hiddenCanvasRef}
      overlayCanvasRef={overlayCanvasRef}
      visible={visible}
      isMinimized={isMinimized}
      setIsMinimized={setIsMinimized}
      controlsClassName={controlsClassName}
      onClose={onClose}
      latestDetection={latestDetection}
      isPersonDetected={isPersonDetected}
      isFaceDetected={isFaceDetected}
      currentEmotion={currentEmotion}
      modelLoading={modelLoading}
      smileScore={smileScore}
      frownScore={frownScore}
      startCamera={startCamera}
      handleEmotionSelect={handleEmotionSelect}
    />
  );
};
