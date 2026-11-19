import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  Camera,
  RefreshCw,
  Maximize2,
  Minimize2,
  Smile,
  Frown,
  Meh,
  Activity,
  Sparkles,
  VideoOff,
  CheckCircle,
  RotateCw,
  UserCheck,
  Compass,
  Cpu,
  Laptop,
} from 'lucide-react';
import {
  getLaptopWebcamConstraints,
  buildWebRTCOfferPayload,
  resolveFeedBadgeText,
  estimateFacialDemographics,
} from './adminCameraHelpers';

// Cac chi so diem moc then chot nhat tao nen bieu cam (Sieu toi gian: 2 khoe mieng, 2 dau long may, dinh va day moi)
const MINIMAL_EXPRESSION_ANCHORS = [
  { id: 'mouth_left', index: 61, label: 'Mouth Left' },
  { id: 'mouth_right', index: 291, label: 'Mouth Right' },
  { id: 'brow_left', index: 70, label: 'Brow Left' },
  { id: 'brow_right', index: 300, label: 'Brow Right' },
  { id: 'lip_top', index: 13, label: 'Upper Lip' },
  { id: 'lip_bottom', index: 14, label: 'Lower Lip' },
];

export const AdminPhoneCameraTab = ({ currentUser }) => {
  // Connection States
  const [feedSource, setFeedSource] = useState('pi5_tailscale'); // 'pi5_tailscale' | 'local_webcam'
  const [controlIp, setControlIp] = useState(() => import.meta.env.VITE_PI5_IP || '100.99.72.51');
  const [pi5Port, setPi5Port] = useState(8554);
  const [activeResolution, setActiveResolution] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected'
  const [iceConnectionState, setIceConnectionState] = useState('idle');
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState(null);

  // Huong xoay video: Doc tu localStorage hoac mac dinh 0 do cho Camera USB Pi 5 va Webcam Laptop
  const [videoRotation, setVideoRotationState] = useState(() => {
    try {
      const saved = localStorage.getItem('kiosk_video_rotation');
      if (saved !== null) return parseInt(saved, 10);
    } catch {}
    return 0;
  });

  const setVideoRotation = useCallback((valOrFn) => {
    setVideoRotationState((prev) => {
      const nextVal = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      try {
        localStorage.setItem('kiosk_video_rotation', String(nextVal));
      } catch {}
      return nextVal;
    });
  }, []);

  // Che do hien thi khung hinh video: 'cover' (tran 100% do rong) | 'contain' (vua van nguyen ban)
  const [fitMode, setFitMode] = useState(() => {
    try {
      const saved = localStorage.getItem('kiosk_video_fit');
      if (saved) return saved;
    } catch {}
    return 'cover';
  });

  // AI Emotion Recognition States
  const [isAiEmotionActive, setIsAiEmotionActive] = useState(true);
  const [visionModelReady, setVisionModelReady] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState('neutral');
  const [smileScore, setSmileScore] = useState(0);
  const [frownScore, setFrownScore] = useState(0);
  const [overrideEmotion, setOverrideEmotion] = useState(null);
  const [showMeshDiagnostics, setShowMeshDiagnostics] = useState(false);

  // AI Demographics States (Age & Gender Detection)
  const [detectedGender, setDetectedGender] = useState('female');
  const [detectedAgeGroup, setDetectedAgeGroup] = useState('young_adult');
  const [demographicsConfidence, setDemographicsConfidence] = useState(88);
  const demographicsHistoryRef = useRef([]);

  // Detailed Facial Blendshapes Metrics
  const [blendshapeMetrics, setBlendshapeMetrics] = useState({
    smileLeft: 0,
    smileRight: 0,
    browDownLeft: 0,
    browDownRight: 0,
    mouthFrownLeft: 0,
    mouthFrownRight: 0,
    eyeSquint: 0,
    jawOpen: 0,
  });

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const landmarkerRef = useRef(null);
  const noFaceCountRef = useRef(0);
  const consecutiveUnhappyFramesRef = useRef(0);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const containerRef = useRef(null);

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

  // 2. Don dep ket noi WebRTC va Local Streams
  const cleanupWebRTC = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      localStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    remoteStreamRef.current = null;
    iceCandidateQueueRef.current = [];
    setHasRemoteVideo(false);
    setConnectionStatus('disconnected');
    setIceConnectionState('disconnected');
    setActiveResolution(null);

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  // 3. Ket noi WebRTC toi Camera USB Pi 5 qua Tailscale (Port 8554 / webrtc-offer)
  const connectPi5WebRTC = useCallback(async () => {
    cleanupWebRTC();
    setConnectionStatus('connecting');

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        event.track.enabled = true;
        let incomingStream = event.streams && event.streams[0];
        if (!incomingStream) {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          if (!remoteStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
            remoteStreamRef.current.addTrack(event.track);
          }
          incomingStream = remoteStreamRef.current;
        } else {
          remoteStreamRef.current = incomingStream;
        }

        const videoEl = videoRef.current;
        if (videoEl) {
          if (videoEl.srcObject !== incomingStream) {
            videoEl.srcObject = incomingStream;
          }
          videoEl.muted = true;
          videoEl.playsInline = true;

          const playPromise = videoEl.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {});
          }

          videoEl.onloadedmetadata = () => {
            setActiveResolution({ width: videoEl.videoWidth, height: videoEl.videoHeight });
            videoEl.play().catch(() => {});
          };
        }

        setHasRemoteVideo(true);
        setConnectionStatus('connected');
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectionStatus('connected');
          setHasRemoteVideo(true);
        } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          setConnectionStatus('disconnected');
          setHasRemoteVideo(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState) {
          setIceConnectionState(pc.iceConnectionState);
        }
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setConnectionStatus('connected');
          setHasRemoteVideo(true);
          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
        } else if (pc.iceConnectionState === 'failed') {
          setConnectionStatus('disconnected');
          setHasRemoteVideo(false);
        }
      };

      pc.addTransceiver('video', { direction: 'recvonly' });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (pc.iceGatheringState !== 'complete') {
        await new Promise((resolve) => {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
          setTimeout(() => {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }, 2500);
        });
      }

      const res = await fetch('/api/v1/operations/robot/camera/webrtc-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildWebRTCOfferPayload(pc.localDescription, controlIp, pi5Port)),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        throw new Error(`Pi 5 WebRTC server returned status ${res.status}`);
      }

      const answer = await res.json();
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.warn('[AdminPhoneCameraTab] Kết nối Pi 5 WebRTC qua Tailscale thất bại:', err);
      setConnectionStatus('disconnected');
      setHasRemoteVideo(false);
    }
  }, [cleanupWebRTC, controlIp, pi5Port]);

  // 4. Che do Camera Laptop Test (Cau hinh do phan giai chuan Pi 5 USB: 640x480 @ 15fps, ti le 4:3)
  const connectLocalWebcam = useCallback(async () => {
    cleanupWebRTC();
    setConnectionStatus('connecting');
    try {
      let mediaStream;
      try {
        // Uu tien ep dung do phan giai goc 640x480 @ 15fps giong Camera USB Pi 5
        mediaStream = await navigator.mediaDevices.getUserMedia(getLaptopWebcamConstraints(true));
      } catch (errExact) {
        // Fallback ideal neu webcam laptop khong ho tro exact constraint
        mediaStream = await navigator.mediaDevices.getUserMedia(getLaptopWebcamConstraints(false));
      }

      localStreamRef.current = mediaStream;
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.srcObject = mediaStream;
        videoEl.muted = true;
        videoEl.playsInline = true;
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
        videoEl.onloadedmetadata = () => {
          setActiveResolution({ width: videoEl.videoWidth, height: videoEl.videoHeight });
          videoEl.play().catch(() => {});
        };
      }
      setHasRemoteVideo(true);
      setConnectionStatus('connected');
    } catch (err) {
      console.warn('[AdminPhoneCameraTab] Không thể khởi động Camera Laptop Test:', err);
      setConnectionStatus('disconnected');
      setHasRemoteVideo(false);
    }
  }, [cleanupWebRTC]);

  // 5. Dong bo trang thai Nhan dien Khach (Bieu cam, Gioi tinh, Do tuoi) ve Server -> Ban qua Robot Screen
  const lastSyncStateRef = useRef({
    emotion: '',
    gender: '',
    ageGroup: '',
    isFaceDetected: false,
    timestamp: 0,
  });

  const syncPerceptionToRobot = useCallback(
    async ({ emotion, gender, ageGroup, confidence, isFaceDetected }) => {
      const now = Date.now();
      const prev = lastSyncStateRef.current;
      const stateChanged =
        prev.emotion !== emotion ||
        prev.gender !== gender ||
        prev.ageGroup !== ageGroup ||
        prev.isFaceDetected !== isFaceDetected;

      // Rate limit: sync ngay khi state thay doi, hoac dinh ky 3s neu khach van o truoc camera
      if (!stateChanged && now - prev.timestamp < 3000) {
        return;
      }
      if (now - prev.timestamp < 400) {
        return;
      }

      lastSyncStateRef.current = {
        emotion,
        gender,
        ageGroup,
        isFaceDetected,
        timestamp: now,
      };

      try {
        await fetch('/api/v1/operations/robot/guest-perception', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emotion,
            gender,
            age_group: ageGroup,
            confidence,
            is_face_detected: isFaceDetected,
          }),
        });
      } catch {
        // Tranh anh huong UI khi backend tam thoi khong phan hoi
      }
    },
    []
  );

  useEffect(() => {
    if (feedSource === 'pi5_tailscale') {
      connectPi5WebRTC();
    } else if (feedSource === 'local_webcam') {
      connectLocalWebcam();
    }
    return () => {
      cleanupWebRTC();
    };
  }, [feedSource, connectPi5WebRTC, connectLocalWebcam, cleanupWebRTC]);

  // Dam bao video thuc su play khi remote video duoc bat
  useEffect(() => {
    if (hasRemoteVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [hasRemoteVideo]);

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

            let demoResult = null;
            // 3. Demographics Estimation (Gender & Age Group via 3D Facial Anthropometry & Hysteresis Filter)
            if (landmarks && landmarks[10] && landmarks[152]) {
              const demo = estimateFacialDemographics({
                landmarks,
                videoWidth: videoEl.videoWidth,
                videoHeight: videoEl.videoHeight,
                trackerRef: demographicsHistoryRef,
                smileScore: smile,
              });

              demoResult = demo;
              setDetectedGender(demo.gender);
              setDetectedAgeGroup(demo.ageGroup);
              setDemographicsConfidence(demo.confidence);
            }

            syncPerceptionToRobot({
              emotion: currentDetected,
              gender: demoResult?.gender || 'unknown',
              ageGroup: demoResult?.ageGroup || 'adult',
              confidence: demoResult?.confidence ?? 0,
              isFaceDetected: true,
            });
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
            demographicsHistoryRef.current = [];
            if (canvas && ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            syncPerceptionToRobot({
              emotion: 'neutral',
              gender: 'unknown',
              ageGroup: 'adult',
              confidence: 0,
              isFaceDetected: false,
            });
          }
        }
      } catch {
        // Tranh treo khi frame bi gian doan
      }
    }, 200);

    return () => clearInterval(intervalId);
  }, [isAiEmotionActive, connectionStatus, syncPerceptionToRobot]);

  // 5. Override bieu cam thu cong va gui len Robot
  const handleOverrideEmotion = useCallback(
    async (emo) => {
      setOverrideEmotion(emo);
      syncPerceptionToRobot({
        emotion: emo || 'neutral',
        gender: detectedGender,
        ageGroup: detectedAgeGroup,
        confidence: demographicsConfidence,
        isFaceDetected: true,
      });
      if (emo) {
        try {
          await fetch('/api/v1/operations/robot/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              command: `emotion:${emo}`,
              target_ip: controlIp,
              port: 9999,
            }),
          });
        } catch {
          // ignore
        }
      }
    },
    [controlIp, syncPerceptionToRobot, detectedGender, detectedAgeGroup, demographicsConfidence]
  );

  // 6. Chup anh Snapshot tu Video (ho tro tinh ca huong xoay video)
  const handleTakeSnapshot = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const isSideways = videoRotation === 90 || videoRotation === 270;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    canvas.width = isSideways ? vh : vw;
    canvas.height = isSideways ? vw : vh;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((videoRotation * Math.PI) / 180);
      ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);
      if (canvasRef.current) {
        ctx.drawImage(canvasRef.current, -vw / 2, -vh / 2, vw, vh);
      }
      setSnapshotUrl(canvas.toDataURL('image/jpeg'));
    }
  }, [videoRotation]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const activeDisplayEmotion = overrideEmotion || detectedEmotion;
  const activeGender = detectedGender;
  const activeAgeGroup = detectedAgeGroup;

  const getDemographicRecommendations = (gender, ageGroup) => {
    if (ageGroup === 'child') {
      return [
        {
          poiKey: 'infinity_pool',
          name: 'Hồ Bơi Vô Cực Nước Ấm',
          location: 'Tầng 5 · 06:00 - 22:00',
          tag: 'RAG: Thư giãn · Miễn phí',
          fastPathQuery: 'hồ bơi ở đâu',
          scenarioId: 'scn-pool',
        },
        {
          poiKey: 'restaurant',
          name: 'Room Service Gọi Món Tận Phòng 24/7',
          location: 'Tầng 2 Bếp Trung Tâm · 24/7',
          tag: 'RAG: Ẩm thực 24/7',
          fastPathQuery: 'đặt món tận phòng',
          scenarioId: 'scn-restaurant',
        },
        {
          poiKey: 'gift_shop',
          name: 'Cửa Hàng Lưu Niệm (Gift Shop)',
          location: 'Tầng 6 · 08:00 - 22:00',
          tag: 'RAG: Mua sắm & Quà tặng',
          fastPathQuery: 'cửa hàng lưu niệm ở đâu',
          scenarioId: 'scn-gift-shop',
        },
      ];
    }
    if (ageGroup === 'senior') {
      return [
        {
          poiKey: 'spa',
          name: 'Thảo Mộc Spa & Massage Trị Liệu',
          location: 'Tầng 5 · 09:00 - 22:00',
          tag: 'RAG: Sức khỏe & Trị liệu',
          fastPathQuery: 'dịch vụ spa ở đâu',
          scenarioId: 'scn-spa',
        },
        {
          poiKey: 'rooftop_coffee',
          name: 'Rooftop Coffee & Trà Thảo Mộc',
          location: 'Tầng 6 · 07:00 - 23:00',
          tag: 'RAG: Thư thái ngắm cảnh',
          fastPathQuery: 'rooftop coffee mở cửa mấy giờ',
          scenarioId: 'scn-rooftop-coffee',
        },
        {
          poiKey: 'front_desk',
          name: 'Quầy Lễ Tân & Hỗ Trợ 24/7',
          location: 'Tầng Trệt Sảnh Chính · 24/7',
          tag: 'RAG: Dịch vụ Lễ tân 24/7',
          fastPathQuery: 'quầy lễ tân ở đâu',
          scenarioId: 'scn-front-desk',
        },
      ];
    }
    if (ageGroup === 'young_adult') {
      if (gender === 'female') {
        return [
          {
            poiKey: 'spa',
            name: 'Thảo Mộc Spa & Xông Hơi Đá Muối',
            location: 'Tầng 5 · 09:00 - 22:00',
            tag: 'RAG: Thư giãn cao cấp',
            fastPathQuery: 'thảo mộc spa ở đâu',
            scenarioId: 'scn-spa',
          },
          {
            poiKey: 'rooftop_coffee',
            name: 'Rooftop Coffee & Check-in View Toàn Cảnh',
            location: 'Tầng 6 · 07:00 - 23:00',
            tag: 'RAG: Điểm check-in nổi bật',
            fastPathQuery: 'quán cà phê ở đâu',
            scenarioId: 'scn-rooftop-coffee',
          },
          {
            poiKey: 'infinity_pool',
            name: 'Hồ Bơi Vô Cực (Infinity Pool)',
            location: 'Tầng 5 · 06:00 - 22:00',
            tag: 'RAG: Hồ bơi ngắm hoàng hôn',
            fastPathQuery: 'hồ bơi ở đâu',
            scenarioId: 'scn-pool',
          },
        ];
      }
      return [
        {
          poiKey: 'gym',
          name: 'Fitness & Gym Center 24/7',
          location: 'Tầng 5 · Mở cửa 24/7',
          tag: 'RAG: Thể thao miễn phí',
          fastPathQuery: 'phòng gym ở đâu',
          scenarioId: 'scn-gym',
        },
        {
          poiKey: 'bar',
          name: 'Sky Lounge Bar & Craft Beer',
          location: 'Tầng 6 · 16:30 - 01:00 đêm',
          tag: 'RAG: Giải trí về đêm',
          fastPathQuery: 'quầy bar ở đâu',
          scenarioId: 'scn-rooftop-bar',
        },
        {
          poiKey: 'karaoke',
          name: 'Phòng VIP Karaoke Cách Âm',
          location: 'Tầng 6 · 14:00 - 00:00 đêm',
          tag: 'RAG: Âm thanh đỉnh cao',
          fastPathQuery: 'phòng karaoke ở đâu',
          scenarioId: 'scn-karaoke',
        },
      ];
    }
    // adult
    if (gender === 'female') {
      return [
        {
          poiKey: 'spa',
          name: 'Thảo Mộc Spa Trị Liệu Đá Nóng',
          location: 'Tầng 5 · 09:00 - 22:00',
          tag: 'RAG: Trị liệu chuyên sâu',
          fastPathQuery: 'dịch vụ spa ở đâu',
          scenarioId: 'scn-spa',
        },
        {
          poiKey: 'restaurant',
          name: 'Room Service Ẩm Thực Tận Phòng 24/7',
          location: 'Tầng 2 Bếp Trung Tâm · 24/7',
          tag: 'RAG: Ẩm thực 24/7',
          fastPathQuery: 'đặt món tận phòng',
          scenarioId: 'scn-restaurant',
        },
        {
          poiKey: 'rooftop_coffee',
          name: 'Rooftop Coffee & View Thành Phố',
          location: 'Tầng 6 · 07:00 - 23:00',
          tag: 'RAG: Thư giãn thanh tịnh',
          fastPathQuery: 'rooftop coffee',
          scenarioId: 'scn-rooftop-coffee',
        },
      ];
    }
    return [
      {
        poiKey: 'gym',
        name: 'Fitness & Gym Center 24/7',
        location: 'Tầng 5 · Mở cửa 24/7',
        tag: 'RAG: Thể hình & Sức khỏe',
        fastPathQuery: 'giờ mở cửa phòng gym',
        scenarioId: 'scn-gym-hours',
      },
      {
        poiKey: 'bar',
        name: 'Sky Lounge Bar',
        location: 'Tầng 6 · 16:30 - 01:00 đêm',
        tag: 'RAG: Tiếp khách & Vang nhập',
        fastPathQuery: 'quầy bar ở đâu',
        scenarioId: 'scn-rooftop-bar',
      },
      {
        poiKey: 'parking_car',
        name: 'Bãi Đỗ Xe Ô Tô & Trạm Sạc EV',
        location: 'Hầm B2 · Mở cửa 24/7',
        tag: 'RAG: Bãi đỗ xe an ninh',
        fastPathQuery: 'bãi đỗ xe ở đâu',
        scenarioId: 'scn-parking',
      },
    ];
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col p-3 overflow-y-auto custom-scrollbar gap-2.5 text-[#262626] font-sans select-none"
      style={{ background: '#F2EFE9' }}
    >
      {/* Top Header & Toolbar (System Theme: Sand-Beige #F2EFE9, Cards #FAF8F5, Border #BFBFBD, Buttons #262626) */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border rounded-xl px-3.5 py-2 shadow-xs shrink-0"
        style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-xs shrink-0"
            style={{ background: '#262626', color: '#FFFFFF' }}
          >
            <Camera className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1
                className="text-xs sm:text-sm font-bold tracking-wide uppercase font-mono"
                style={{ color: '#262626' }}
              >
                Camera AI & Phân Tích Biểu Cảm (Pi 5 Tailscale)
              </h1>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  connectionStatus === 'connected' && hasRemoteVideo
                    ? 'bg-emerald-500 animate-pulse'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-stone-400'
                }`}
              />
            </div>
            <p className="text-[10px] font-mono hidden sm:block" style={{ color: '#8C8C8C' }}>
              {feedSource === 'pi5_tailscale'
                ? `Nhận diện khuôn mặt & cảm xúc từ Camera USB Pi 5 (Tailscale: ${controlIp}:${pi5Port})`
                : 'Chế độ Laptop Test (Độ phân giải 640x480 @ 15fps mô phỏng chuẩn Camera Pi 5)'}
            </p>
          </div>
        </div>

        {/* Action Controls & Feed Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Cụm chọn nguồn Feed */}
          <div
            className="flex items-center rounded-lg border p-0.5 text-xs font-mono"
            style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
          >
            <button
              type="button"
              onClick={() => setFeedSource('pi5_tailscale')}
              className="px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer text-[11px] flex items-center gap-1.5"
              style={
                feedSource === 'pi5_tailscale'
                  ? { background: '#262626', color: '#FFFFFF' }
                  : { background: 'transparent', color: '#555555' }
              }
            >
              <Cpu className="w-3 h-3" />
              Pi 5 (Tailscale)
            </button>
            <button
              type="button"
              onClick={() => setFeedSource('local_webcam')}
              className="px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer text-[11px] flex items-center gap-1.5"
              style={
                feedSource === 'local_webcam'
                  ? { background: '#262626', color: '#FFFFFF' }
                  : { background: 'transparent', color: '#555555' }
              }
            >
              <Laptop className="w-3 h-3" />
              Laptop Test (640x480)
            </button>
          </div>

          {/* Bộ chọn nhanh góc xoay video 4 nấc (0°, 90°, 180°, 270°) */}
          <div
            className="flex items-center rounded-lg border p-0.5 text-xs font-mono"
            style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
          >
            <span className="px-1.5 text-[10px] uppercase font-bold flex items-center gap-1" style={{ color: '#8C8C8C' }}>
              <RotateCw className="w-3 h-3" style={{ color: '#262626' }} /> Xoay:
            </span>
            {[
              { deg: 0, label: '0°' },
              { deg: 90, label: '90°' },
              { deg: 180, label: '180°' },
              { deg: 270, label: '270°' },
            ].map((item) => (
              <button
                key={item.deg}
                type="button"
                onClick={() => setVideoRotation(item.deg)}
                className="px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer text-[10px]"
                style={
                  videoRotation === item.deg
                    ? { background: '#262626', color: '#FFFFFF' }
                    : { background: 'transparent', color: '#555555' }
                }
                title={`Xoay video ${item.deg} độ`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Tùy chọn Tỷ lệ hiển thị (Vừa vặn / Tràn khung độ rộng) */}
          <div
            className="flex items-center rounded-lg border p-0.5 text-xs font-mono"
            style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
          >
            <button
              type="button"
              onClick={() => {
                setFitMode('contain');
                try { localStorage.setItem('kiosk_video_fit', 'contain'); } catch {}
              }}
              className="px-2 py-0.5 rounded font-bold transition-all cursor-pointer text-[10px]"
              style={
                fitMode === 'contain'
                  ? { background: '#262626', color: '#FFFFFF' }
                  : { background: 'transparent', color: '#555555' }
              }
              title="Vừa vặn (Giữ nguyên toàn bộ khung hình gốc)"
            >
              Vừa vặn
            </button>
            <button
              type="button"
              onClick={() => {
                setFitMode('cover');
                try { localStorage.setItem('kiosk_video_fit', 'cover'); } catch {}
              }}
              className="px-2 py-0.5 rounded font-bold transition-all cursor-pointer text-[10px]"
              style={
                fitMode === 'cover'
                  ? { background: '#262626', color: '#FFFFFF' }
                  : { background: 'transparent', color: '#555555' }
              }
              title="Tràn khung (Mở rộng 100% độ rộng khung hình)"
            >
              Tràn khung (100% Rộng)
            </button>
          </div>

          {/* Nút Reconnect (Đen hệ thống) */}
          <button
            type="button"
            onClick={() => {
              if (feedSource === 'pi5_tailscale') connectPi5WebRTC();
              else if (feedSource === 'local_webcam') connectLocalWebcam();
            }}
            className="p-1.5 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 hover:opacity-90"
            style={{ background: '#262626', color: '#FFFFFF' }}
            title="Reconnect Stream"
          >
            <RefreshCw className="w-3.5 h-3.5 text-white" />
          </button>

          {/* Nút Take Snapshot (Đen hệ thống) */}
          <button
            type="button"
            onClick={handleTakeSnapshot}
            className="p-1.5 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 hover:opacity-90"
            style={{ background: '#262626', color: '#FFFFFF' }}
            title="Take Snapshot"
          >
            <Camera className="w-3.5 h-3.5 text-white" />
          </button>

          {/* Nút Fullscreen (Đen hệ thống) */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 hover:opacity-90"
            style={{ background: '#262626', color: '#FFFFFF' }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-white" /> : <Maximize2 className="w-3.5 h-3.5 text-white" />}
          </button>
        </div>
      </div>

      {/* Main Grid: Video Stream with Landmark Canvas (Left) + Emotion Analytics HUD (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left Column: Video Viewport + Overlaid Canvas (System Theme) */}
        <div
          className="lg:col-span-6 flex flex-col border rounded-xl overflow-hidden relative shadow-xs"
          style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
        >
          <div className="flex-1 min-h-[380px] w-full relative flex items-center justify-center bg-stone-950 overflow-hidden p-2 rounded-t-xl">
            {/* Container chua Video va Canvas duoc Xoay dong bo */}
            <div
              className="relative flex items-center justify-center transition-all duration-300 w-full h-full"
              style={{
                transform: `rotate(${videoRotation}deg)`,
                width: videoRotation % 180 !== 0 ? (fitMode === 'cover' ? '100%' : '75%') : '100%',
                height: videoRotation % 180 !== 0 ? (fitMode === 'cover' ? '100%' : '75%') : '100%',
                maxHeight: '100%',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  e.target.play().catch(() => {});
                }}
                onCanPlay={(e) => {
                  e.target.play().catch(() => {});
                }}
                className={`w-full h-full ${fitMode === 'cover' ? 'object-cover' : 'object-contain'} ${!hasRemoteVideo && 'hidden'}`}
              />

              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full ${fitMode === 'cover' ? 'object-cover' : 'object-contain'} pointer-events-none ${
                  !hasRemoteVideo && 'hidden'
                }`}
              />
            </div>

            {!hasRemoteVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-stone-400 gap-3 select-none bg-stone-950/95">
                <VideoOff className="w-12 h-12 text-stone-600" />
                <div>
                  <h3 className="text-sm font-bold text-stone-200 font-mono uppercase">
                    {feedSource === 'pi5_tailscale'
                      ? 'Waiting for Pi 5 Camera Stream (Tailscale)...'
                      : 'Laptop Webcam Test Standby (640x480)'}
                  </h3>
                  <p className="text-xs text-stone-400 font-mono mt-1">
                    {feedSource === 'pi5_tailscale'
                      ? `Đang kết nối WebRTC tới Pi 5 tại http://${controlIp}:${pi5Port} qua Tailscale`
                      : 'Nhấn nút Reconnect để cấp quyền Camera Laptop (chuẩn Pi 5: 640x480 @ 15fps)'}
                  </p>
                </div>
              </div>
            )}

            {/* Overlaid Status Badges (System Theme Warm Overlay) */}
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
              <span
                className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border shadow-xs"
                style={{ background: 'rgba(250, 248, 245, 0.95)', borderColor: '#BFBFBD', color: '#262626' }}
              >
                {resolveFeedBadgeText(feedSource, controlIp)}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border backdrop-blur-md ${
                  isFaceDetected
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-black/60 border-white/20 text-stone-300'
                }`}
              >
                {isFaceDetected ? 'EXPRESSION ANCHORS' : 'SEARCHING FACE'}
              </span>
              {activeResolution && (
                <span
                  className="px-2 py-1 rounded-lg text-[10px] font-mono border backdrop-blur-md bg-black/60 border-white/20 text-stone-300"
                >
                  {activeResolution.width}x{activeResolution.height}
                </span>
              )}
            </div>

            {/* Overlaid Active Emotion Badge */}
            {hasRemoteVideo && isFaceDetected && (
              <div
                className="absolute bottom-3 left-3 border px-3 py-1.5 rounded-xl flex items-center gap-2 pointer-events-none shadow-sm"
                style={{ background: 'rgba(250, 248, 245, 0.95)', borderColor: '#BFBFBD' }}
              >
                {activeDisplayEmotion === 'happy' ? (
                  <Smile className="w-4 h-4 text-emerald-600" />
                ) : activeDisplayEmotion === 'unhappy' ? (
                  <Frown className="w-4 h-4 text-rose-600" />
                ) : (
                  <Meh className="w-4 h-4 text-sky-600" />
                )}
                <span
                  className="text-xs font-mono font-bold uppercase tracking-wider"
                  style={{ color: '#262626' }}
                >
                  {activeDisplayEmotion}
                </span>
                <span className="text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                  Smile: {Math.round(smileScore * 100)}% | Frown: {Math.round(frownScore * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Footer Information (System Theme: Sand-Beige #E9E5DC, Border #BFBFBD) */}
          <div
            className="flex items-center justify-between px-3 py-1.5 border-t text-[10px] sm:text-[11px] font-mono shrink-0"
            style={{ background: '#E9E5DC', borderColor: '#BFBFBD', color: '#555555' }}
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              <span>
                Status: <strong style={{ color: '#262626' }}>{connectionStatus.toUpperCase()}</strong>
                {feedSource === 'pi5_tailscale' && (
                  <span className="text-[9px] text-stone-500 ml-1">
                    (Tailscale: {controlIp}:{pi5Port})
                  </span>
                )}
              </span>
              <span>
                AI: <strong style={{ color: '#262626' }}>
                  {visionModelReady ? 'EXPRESSION AI' : 'INIT'}
                </strong>
              </span>
              <span>
                Độ phân giải: <strong style={{ color: '#262626' }}>
                  {activeResolution ? `${activeResolution.width}x${activeResolution.height}` : '640x480'}
                </strong>
              </span>
              <span>
                Góc: <strong style={{ color: '#262626' }}>{videoRotation}°</strong>
              </span>
            </div>
            {feedSource === 'pi5_tailscale' && (
              <div className="flex items-center gap-1.5">
                <span style={{ color: '#555555' }}>Pi 5 IP (Tailscale):</span>
                <input
                  type="text"
                  value={controlIp}
                  onChange={(e) => setControlIp(e.target.value)}
                  placeholder="100.99.72.51"
                  className="border rounded px-1.5 py-0.5 text-[10px] font-mono w-28 outline-none"
                  style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                />
              </div>
            )}
            {feedSource === 'local_webcam' && (
              <div className="text-[10px] font-mono text-stone-500">
                Độ phân giải ép chuẩn: <strong>640x480 @ 15fps (4:3)</strong>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Emotion Analytics & Facial Mesh Diagnostics (System Theme) */}
        <div className="lg:col-span-6 flex flex-col gap-2.5 overflow-y-auto custom-scrollbar pr-0.5">
          {/* Main Emotion Analytics Card */}
          <div
            className="border rounded-xl p-3 shadow-xs flex flex-col gap-2 shrink-0"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" style={{ color: '#262626' }} />
                <span
                  className="text-xs font-bold font-mono uppercase tracking-wider"
                  style={{ color: '#262626' }}
                >
                  AI Expression Analytics
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowMeshDiagnostics((prev) => !prev)}
                  className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold cursor-pointer transition-all border flex items-center gap-1"
                  style={
                    showMeshDiagnostics
                      ? { background: '#262626', color: '#FFFFFF', borderColor: '#262626' }
                      : { background: '#E9E5DC', color: '#555555', borderColor: '#BFBFBD' }
                  }
                  title="Bật/Tắt bảng chi tiết Mesh Blendshapes"
                >
                  <Activity className="w-3 h-3" />
                  <span>{showMeshDiagnostics ? 'Mesh On' : 'Mesh Off'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAiEmotionActive((prev) => !prev)}
                  className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold cursor-pointer transition-all border"
                  style={
                    isAiEmotionActive
                      ? { background: '#262626', color: '#FFFFFF', borderColor: '#262626' }
                      : { background: '#E9E5DC', color: '#8C8C8C', borderColor: '#BFBFBD' }
                  }
                >
                  {isAiEmotionActive ? 'AI ON' : 'AI OFF'}
                </button>
              </div>
            </div>

            {/* Current Emotion State & Gauges side-by-side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div
                className="p-2 rounded-lg border flex items-center justify-between"
                style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
              >
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-semibold" style={{ color: '#8C8C8C' }}>
                    Current Expression
                  </span>
                  <span
                    className="text-sm font-black tracking-wide uppercase mt-0.5"
                    style={{ color: '#262626' }}
                  >
                    {activeDisplayEmotion}
                  </span>
                </div>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-md font-bold shadow-xs"
                  style={{ background: '#262626', color: '#FFFFFF' }}
                >
                  {overrideEmotion ? 'OVERRIDE' : 'REALTIME AI'}
                </span>
              </div>

              {/* Gauges for Smile & Frown */}
              <div
                className="p-2 rounded-lg border flex flex-col justify-center gap-1.5"
                style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
              >
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5" style={{ color: '#555555' }}>
                    <span className="flex items-center gap-1 font-semibold">
                      <Smile className="w-3 h-3 text-emerald-600" /> Smile
                    </span>
                    <span className="font-bold" style={{ color: '#262626' }}>
                      {Math.round(smileScore * 100)}%
                    </span>
                  </div>
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden border"
                    style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
                  >
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round(smileScore * 100))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] mb-0.5" style={{ color: '#555555' }}>
                    <span className="flex items-center gap-1 font-semibold">
                      <Frown className="w-3 h-3 text-rose-600" /> Frown
                    </span>
                    <span className="font-bold" style={{ color: '#262626' }}>
                      {Math.round(frownScore * 100)}%
                    </span>
                  </div>
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden border"
                    style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
                  >
                    <div
                      className="h-full bg-rose-600 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round(frownScore * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Test Robot Expression Override Buttons */}
            <div className="pt-1.5 border-t space-y-1" style={{ borderColor: '#BFBFBD' }}>
              <span className="text-[9px] font-mono block uppercase font-bold" style={{ color: '#8C8C8C' }}>
                Test / Override Robot Expression:
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                {[
                  { id: null, label: 'AUTO' },
                  { id: 'happy', label: 'HAPPY' },
                  { id: 'neutral', label: 'NEUTRAL' },
                  { id: 'unhappy', label: 'UNHAPPY' },
                  { id: 'look_up', label: 'UP' },
                  { id: 'look_left', label: 'LEFT' },
                  { id: 'look_right', label: 'RIGHT' },
                  { id: 'look_around', label: 'AROUND' },
                ].map((mode) => (
                  <button
                    key={String(mode.id)}
                    type="button"
                    onClick={() => handleOverrideEmotion(mode.id)}
                    className="py-1 rounded-md text-[9px] font-mono font-bold transition-all cursor-pointer border text-center"
                    style={
                      overrideEmotion === mode.id
                        ? { background: '#262626', color: '#FFFFFF', borderColor: '#262626' }
                        : { background: '#E9E5DC', color: '#262626', borderColor: '#BFBFBD' }
                    }
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Guest Profile & Demographics Card (AI Recommendations) */}
          <div
            className="border rounded-xl p-3 shadow-xs flex flex-col gap-2 font-mono shrink-0"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" style={{ color: '#262626' }} />
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: '#262626' }}
                >
                  Guest Profile & Demographics
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-md font-bold border flex items-center gap-1"
                  style={{
                    background: isFaceDetected ? '#E8F5E9' : '#E9E5DC',
                    borderColor: isFaceDetected ? '#A5D6A7' : '#BFBFBD',
                    color: isFaceDetected ? '#2E7D32' : '#8C8C8C',
                  }}
                >
                  {isFaceDetected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                  {isFaceDetected ? 'AI LIVE' : 'NO FACE'}
                </span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-md font-bold border"
                  style={{ background: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                >
                  Confidence: {isFaceDetected ? `${demographicsConfidence}%` : '--'}
                </span>
              </div>
            </div>

            {/* Demographics Detected Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div
                className="p-2 rounded-lg border flex flex-col justify-between"
                style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
              >
                <span className="text-[9px] font-semibold uppercase" style={{ color: '#8C8C8C' }}>
                  Giới tính (Gender)
                </span>
                <span className="text-xs font-bold uppercase mt-0.5" style={{ color: '#262626' }}>
                  {activeGender === 'female' ? 'Nữ (Female)' : 'Nam (Male)'}
                </span>
              </div>
              <div
                className="p-2 rounded-lg border flex flex-col justify-between"
                style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
              >
                <span className="text-[9px] font-semibold uppercase" style={{ color: '#8C8C8C' }}>
                  Độ tuổi (Age Group)
                </span>
                <span className="text-xs font-bold uppercase mt-0.5" style={{ color: '#262626' }}>
                  {activeAgeGroup === 'child'
                    ? 'Trẻ em (Child)'
                    : activeAgeGroup === 'young_adult'
                    ? 'Thanh niên (18-35)'
                    : activeAgeGroup === 'senior'
                    ? 'Lớn tuổi (Senior)'
                    : 'Trưởng thành (Adult)'}
                </span>
              </div>
            </div>

            {/* Recommended Services based on Demographics */}
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold" style={{ color: '#8C8C8C' }}>
                <Compass className="w-3 h-3 text-stone-600" />
                <span>Dịch vụ AI đề xuất theo hồ sơ khách:</span>
              </div>
              <div className="space-y-1.5">
                {getDemographicRecommendations(activeGender, activeAgeGroup).map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg border flex flex-col gap-1 text-xs shadow-2xs transition-all hover:border-[#262626]"
                    style={{ background: '#FFFFFF', borderColor: '#BFBFBD' }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="font-bold text-[11px] leading-tight" style={{ color: '#262626' }}>
                        {rec.name}
                      </div>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-md font-bold shrink-0"
                        style={{ background: '#E9E5DC', color: '#262626' }}
                      >
                        {rec.tag}
                      </span>
                    </div>
                    <div className="text-[10px]" style={{ color: '#555555' }}>
                      {rec.location}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 border-t" style={{ borderColor: '#E9E5DC' }}>
                      <span
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                        style={{ background: '#E8F5E9', color: '#2E7D32', border: '1px solid #C8E6C9' }}
                      >
                        Fast-Path: "{rec.fastPathQuery}"
                      </span>
                      <span
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                        style={{ background: '#F5F5F5', color: '#424242', border: '1px solid #E0E0E0' }}
                      >
                        POI: {rec.poiKey.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Facial Landmark Mesh & Blendshapes Diagnostic Panel (Collapsible Toggle) */}
          {showMeshDiagnostics && (
            <div
              className="border rounded-xl p-3 shadow-xs flex flex-col gap-2 font-mono shrink-0"
              style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
            >
              <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: '#BFBFBD' }}>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" style={{ color: '#262626' }} />
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: '#262626' }}
                  >
                    Facial Mesh & Blendshapes
                  </span>
                </div>
                <span className="text-[9px] font-bold" style={{ color: '#8C8C8C' }}>
                  Key Anchors (6 PTS)
                </span>
              </div>

              {/* Muscle Blendshapes Diagnostic Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div
                  className="p-2 rounded-lg border space-y-1"
                  style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
                >
                  <div
                    className="text-[10px] font-bold flex items-center justify-between"
                    style={{ color: '#262626' }}
                  >
                    <span>Mouth Corners (Smile L/R)</span>
                    <span className="text-emerald-700">
                      {Math.round(blendshapeMetrics.smileLeft * 100)}% | {Math.round(blendshapeMetrics.smileRight * 100)}%
                    </span>
                  </div>
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden flex gap-0.5"
                    style={{ background: '#FAF8F5' }}
                  >
                    <div
                      className="h-full bg-emerald-600 transition-all duration-200"
                      style={{ width: `${Math.round(blendshapeMetrics.smileLeft * 50)}%` }}
                    />
                    <div
                      className="h-full bg-emerald-500 transition-all duration-200"
                      style={{ width: `${Math.round(blendshapeMetrics.smileRight * 50)}%` }}
                    />
                  </div>
                </div>

                <div
                  className="p-2 rounded-lg border space-y-1"
                  style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
                >
                  <div
                    className="text-[10px] font-bold flex items-center justify-between"
                    style={{ color: '#262626' }}
                  >
                    <span>Brow Depression (Distress L/R)</span>
                    <span className="text-rose-700">
                      {Math.round(blendshapeMetrics.browDownLeft * 100)}% | {Math.round(blendshapeMetrics.browDownRight * 100)}%
                    </span>
                  </div>
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden flex gap-0.5"
                    style={{ background: '#FAF8F5' }}
                  >
                    <div
                      className="h-full bg-rose-600 transition-all duration-200"
                      style={{ width: `${Math.round(blendshapeMetrics.browDownLeft * 50)}%` }}
                    />
                    <div
                      className="h-full bg-rose-500 transition-all duration-200"
                      style={{ width: `${Math.round(blendshapeMetrics.browDownRight * 50)}%` }}
                    />
                  </div>
                </div>

                <div
                  className="p-2 rounded-lg border space-y-1"
                  style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
                >
                  <div
                    className="text-[10px] font-bold flex items-center justify-between"
                    style={{ color: '#262626' }}
                  >
                    <span>Mouth Frown (Sadness L/R)</span>
                    <span className="text-amber-700">
                      {Math.round(blendshapeMetrics.mouthFrownLeft * 100)}% | {Math.round(blendshapeMetrics.mouthFrownRight * 100)}%
                    </span>
                  </div>
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden flex gap-0.5"
                    style={{ background: '#FAF8F5' }}
                  >
                    <div
                      className="h-full bg-amber-600 transition-all duration-200"
                      style={{ width: `${Math.round(blendshapeMetrics.mouthFrownLeft * 50)}%` }}
                    />
                    <div
                      className="h-full bg-amber-500 transition-all duration-200"
                      style={{ width: `${Math.round(blendshapeMetrics.mouthFrownRight * 50)}%` }}
                    />
                  </div>
                </div>

                {/* Eye Squint and Jaw Opening */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div
                    className="p-1.5 rounded-lg border flex flex-col justify-between"
                    style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
                  >
                    <span className="font-semibold" style={{ color: '#8C8C8C' }}>
                      Eye Squint
                    </span>
                    <span className="text-xs font-bold mt-0.5" style={{ color: '#262626' }}>
                      {Math.round(blendshapeMetrics.eyeSquint * 100)}%
                    </span>
                  </div>
                  <div
                    className="p-1.5 rounded-lg border flex flex-col justify-between"
                    style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
                  >
                    <span className="font-semibold" style={{ color: '#8C8C8C' }}>
                      Jaw Open
                    </span>
                    <span className="text-xs font-bold mt-0.5" style={{ color: '#262626' }}>
                      {Math.round(blendshapeMetrics.jawOpen * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Mesh Status Note */}
              <div
                className="mt-1 pt-1.5 border-t text-[9px] flex items-center justify-between"
                style={{ borderColor: '#BFBFBD', color: '#8C8C8C' }}
              >
                <span className="flex items-center gap-1 font-semibold" style={{ color: '#262626' }}>
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  Minimal Anchors Mode
                </span>
                <span className="font-mono" style={{ color: '#8C8C8C' }}>
                  GPU Accelerated
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Snapshot Preview Modal if Captured (System Theme) */}
      {snapshotUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="border rounded-2xl p-5 max-w-xl w-full flex flex-col gap-3 shadow-2xl"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#BFBFBD' }}>
              <span
                className="text-xs font-mono font-bold uppercase"
                style={{ color: '#262626' }}
              >
                Snapshot Captured with Mesh
              </span>
              <button
                type="button"
                onClick={() => setSnapshotUrl(null)}
                className="text-xs font-mono font-bold cursor-pointer transition-colors"
                style={{ color: '#8C8C8C' }}
              >
                Close
              </button>
            </div>
            <img
              src={snapshotUrl}
              alt="Snapshot"
              className="rounded-xl w-full object-contain max-h-[400px] border"
              style={{ borderColor: '#BFBFBD' }}
            />
            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: '#BFBFBD' }}>
              <a
                href={snapshotUrl}
                download={`kiosk-snapshot-${Date.now()}.jpg`}
                className="px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all shadow-xs"
                style={{ background: '#262626', color: '#FFFFFF' }}
              >
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
