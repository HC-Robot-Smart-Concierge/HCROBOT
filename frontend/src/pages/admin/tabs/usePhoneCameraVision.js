import { useEffect, useRef } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

const MINIMAL_EXPRESSION_ANCHORS = [
  { id: 'mouth_left', index: 61, label: 'Mouth Left' },
  { id: 'mouth_right', index: 291, label: 'Mouth Right' },
  { id: 'brow_left', index: 70, label: 'Brow Left' },
  { id: 'brow_right', index: 300, label: 'Brow Right' },
  { id: 'lip_top', index: 13, label: 'Upper Lip' },
  { id: 'lip_bottom', index: 14, label: 'Lower Lip' },
];

export const usePhoneCameraVision = ({
  isAiEmotionActive,
  connectionStatus,
  videoRef,
  canvasRef,
  setVisionModelReady,
  setIsFaceDetected,
  setDetectedEmotion,
  setSmileScore,
  setFrownScore,
  setBlendshapeMetrics,
}) => {
  const landmarkerRef = useRef(null);
  const noFaceCountRef = useRef(0);
  const consecutiveUnhappyFramesRef = useRef(0);

  // 1. Khoi tao Google MediaPipe Face Landmarker
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
          runningMode: 'IMAGE',
          numFaces: 1,
        });

        if (isCancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setVisionModelReady(true);
      } catch (err) {
        // Fallback init silent
      }
    };

    initLandmarker();

    return () => {
      isCancelled = true;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {}
      }
    };
  }, []);

  // 4. Vong lap nhan dien MediaPipe va Ve Cac Diem Neo Bieu Cam Toi Gian (Key Anchors Only)
  useEffect(() => {
    if (!isAiEmotionActive || connectionStatus !== 'connected') {
      setIsFaceDetected(false);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const intervalId = setInterval(() => {
      if (!landmarkerRef.current || !videoRef.current) return;
      const videoEl = videoRef.current;
      if (videoEl.readyState < 2 || videoEl.videoWidth === 0) return;

      const canvas = canvasRef.current;
      const ctx = canvas ? canvas.getContext('2d') : null;

      try {
        const results = landmarkerRef.current.detect(videoEl);

        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          setIsFaceDetected(true);
          noFaceCountRef.current = 0;

          const landmarks = results.faceLandmarks[0];

          // 4.1. Trich xuat cac chi so co mat Blendshapes
          let currentDetected = 'neutral';
          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            const categories = results.faceBlendshapes[0].categories;
            let sLeft = 0;
            let sRight = 0;
            let bDownL = 0;
            let bDownR = 0;
            let mFrownL = 0;
            let mFrownR = 0;
            let eyeSquint = 0;
            let jawOpen = 0;

            for (const c of categories) {
              if (c.categoryName === 'mouthSmileLeft') sLeft = c.score;
              else if (c.categoryName === 'mouthSmileRight') sRight = c.score;
              else if (c.categoryName === 'browDownLeft') bDownL = c.score;
              else if (c.categoryName === 'browDownRight') bDownR = c.score;
              else if (c.categoryName === 'mouthFrownLeft') mFrownL = c.score;
              else if (c.categoryName === 'mouthFrownRight') mFrownR = c.score;
              else if (c.categoryName === 'eyeSquintLeft') eyeSquint = Math.max(eyeSquint, c.score);
              else if (c.categoryName === 'eyeSquintRight') eyeSquint = Math.max(eyeSquint, c.score);
              else if (c.categoryName === 'jawOpen') jawOpen = c.score;
            }

            const smile = (sLeft + sRight) / 2;
            const browDown = (bDownL + bDownR) / 2;
            const mouthFrown = (mFrownL + mFrownR) / 2;
            const compoundDistress = browDown * 0.7 + mouthFrown * 0.3;
            const frown = Math.max(browDown, mouthFrown);
            setSmileScore(smile);
            setFrownScore(frown);

            setBlendshapeMetrics({
              smileLeft: sLeft,
              smileRight: sRight,
              browDownLeft: bDownL,
              browDownRight: bDownR,
              mouthFrownLeft: mFrownL,
              mouthFrownRight: mFrownR,
              eyeSquint,
              jawOpen,
            });

            // 1. Danh gia ung vien bieu cam (Candidate Emotion)
            let candidate = 'neutral';
            if (smile >= 0.35) {
              candidate = 'happy';
            } else if (
              (browDown >= 0.30 || mouthFrown >= 0.22 || compoundDistress >= 0.26 || (browDown >= 0.25 && mouthFrown >= 0.12)) &&
              smile < 0.18
            ) {
              candidate = 'unhappy';
            }

            // 2. Bo loc xac nhan theo thoi gian (Temporal Confirmation Filter):
            // O toc do 200ms/frame, duy tri lien tuc >= 3 frames (~600ms) giup phan hoi nhanh ma van loai bo chop mat
            if (candidate === 'unhappy') {
              consecutiveUnhappyFramesRef.current += 1;
              if (consecutiveUnhappyFramesRef.current >= 3) {
                currentDetected = 'unhappy';
              } else {
                currentDetected = 'neutral';
              }
            } else {
              consecutiveUnhappyFramesRef.current = 0;
              currentDetected = candidate;
            }

            setDetectedEmotion(currentDetected);
          }

          // 4.2. Ve Chi 6 Diem Neo Bieu Cam Then Chot (It diem nhat co the, khong ve luoi da giac)
          if (canvas && ctx) {
            if (canvas.width !== videoEl.videoWidth || canvas.height !== videoEl.videoHeight) {
              canvas.width = videoEl.videoWidth;
              canvas.height = videoEl.videoHeight;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Tinh toa do cac diem neo
            const ptMouthL = landmarks[61];
            const ptMouthR = landmarks[291];
            const ptBrowL = landmarks[70];
            const ptBrowR = landmarks[300];
            const ptLipBottom = landmarks[14];

            // 1. Ve duong cau may duy nhat khi Unhappy
            if (currentDetected === 'unhappy' && ptBrowL && ptBrowR) {
              ctx.beginPath();
              ctx.moveTo(ptBrowL.x * canvas.width, ptBrowL.y * canvas.height);
              ctx.lineTo(ptBrowR.x * canvas.width, ptBrowR.y * canvas.height);
              ctx.lineWidth = 2.5;
              ctx.strokeStyle = '#F43F5E';
              ctx.stroke();
            }

            // 2. Ve cung cuoi duy nhat khi Happy
            if (currentDetected === 'happy' && ptMouthL && ptMouthR && ptLipBottom) {
              ctx.beginPath();
              ctx.moveTo(ptMouthL.x * canvas.width, ptMouthL.y * canvas.height);
              ctx.quadraticCurveTo(
                ptLipBottom.x * canvas.width,
                ptLipBottom.y * canvas.height,
                ptMouthR.x * canvas.width,
                ptMouthR.y * canvas.height
              );
              ctx.lineWidth = 2.5;
              ctx.strokeStyle = '#10B981';
              ctx.stroke();
            }

            // 3. Cham dung cac diem neo quan trong nhat
            MINIMAL_EXPRESSION_ANCHORS.forEach((anchor) => {
              const pt = landmarks[anchor.index];
              if (!pt) return;
              const x = pt.x * canvas.width;
              const y = pt.y * canvas.height;

              let dotRadius = 3;
              let dotColor = '#38BDF8';
              let hasGlow = false;
              let glowColor = '';

              if (currentDetected === 'happy') {
                if (anchor.id === 'mouth_left' || anchor.id === 'mouth_right') {
                  dotRadius = 5;
                  dotColor = '#10B981';
                  hasGlow = true;
                  glowColor = 'rgba(16, 185, 129, 0.4)';
                } else {
                  dotColor = '#6EE7B7';
                }
              } else if (currentDetected === 'unhappy') {
                if (anchor.id === 'brow_left' || anchor.id === 'brow_right') {
                  dotRadius = 5;
                  dotColor = '#F43F5E';
                  hasGlow = true;
                  glowColor = 'rgba(244, 63, 94, 0.4)';
                } else if (anchor.id === 'mouth_left' || anchor.id === 'mouth_right') {
                  dotColor = '#FB7185';
                } else {
                  dotColor = '#FECDD3';
                }
              }

              // Glow ring
              if (hasGlow) {
                ctx.beginPath();
                ctx.arc(x, y, dotRadius + 4, 0, 2 * Math.PI);
                ctx.fillStyle = glowColor;
                ctx.fill();
              }

              // Dot chinh
              ctx.beginPath();
              ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
              ctx.fillStyle = dotColor;
              ctx.fill();
              ctx.lineWidth = 1;
              ctx.strokeStyle = '#FFFFFF';
              ctx.stroke();
            });
          }
        } else {
          noFaceCountRef.current += 1;
          if (noFaceCountRef.current >= 3) {
            setIsFaceDetected(false);
            setDetectedEmotion('neutral');
            setSmileScore(0);
            setFrownScore(0);
            consecutiveUnhappyFramesRef.current = 0;
            if (canvas && ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        }
      } catch {
        // Tranh treo khi frame bi gian doan
      }
    }, 200);

    return () => clearInterval(intervalId);
  }, [isAiEmotionActive, connectionStatus]);
};
