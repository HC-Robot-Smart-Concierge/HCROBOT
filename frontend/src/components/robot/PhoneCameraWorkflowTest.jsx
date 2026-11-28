import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWorkflowById } from '../../services/workflowApi';
import { isGuestWaitingAd, resolveAdGuestTalkStepIndex } from '../../utils/workflowFlow';
import { estimateFacialDemographics } from '../../pages/admin/tabs/adminCameraHelpers';

const FRAME_INTERVAL_MS = 250;
const NO_FACE_FRAMES = 3;
const DEMOGRAPHIC_SAMPLE_COUNT = 5;
const stopTracks = (stream) => stream?.getTracks().forEach((track) => track.stop());

export const DEFAULT_PHONE_CAMERA_WORKFLOW_ID = 'wf-quang-cao-tiep-khach';

export function supportsPhoneCameraWorkflow(workflow) {
  const steps = workflow?.steps || [];
  return workflow?.is_active === true &&
    workflow.execution_config?.execution_mode === 'SCREEN' &&
    isGuestWaitingAd(steps[0]) && resolveAdGuestTalkStepIndex(steps, 0) >= 0;
}

export function PhoneCameraWorkflowTest({ workflowId, active, canStart, onStart, onStop, onPresenceChange, onDemographicsChange }) {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const autoAttemptedRef = useRef(false);
  const stopWorkflowRef = useRef(onStop);
  stopWorkflowRef.current = onStop;
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [error, setError] = useState('');
  const [savedWorkflow, setSavedWorkflow] = useState(null);
  const [loadError, setLoadError] = useState('');
  const isTest = Boolean(workflowId);
  const cameraRunning = cameraStatus !== 'idle';
  const workflow = savedWorkflow?.id === workflowId ? savedWorkflow : null;

  useEffect(() => {
    if (!workflowId) return;
    let current = true;
    setLoadError('');
    fetchWorkflowById(workflowId).then((result) => {
      if (!current) return;
      if (supportsPhoneCameraWorkflow(result)) setSavedWorkflow(result);
      else setLoadError('Bật workflow kiosk có quảng cáo chờ khách nối tới Giao tiếp, có thể qua Chào hỏi và Gợi ý.');
    }).catch(() => {
      if (current) setLoadError('Chưa tải được workflow đã lưu. Kiểm tra trong Admin rồi tải lại trang.');
    });
    return () => { current = false; };
  }, [workflowId]);

  const release = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    clearInterval(session.timer);
    stopTracks(session.stream);
    if (videoRef.current) videoRef.current.srcObject = null;
    session.detector?.close();
    onPresenceChange(false);
    onDemographicsChange?.(null);
  }, [onPresenceChange, onDemographicsChange]);

  useEffect(() => release, [release]);
  useEffect(() => {
    if (!active) {
      release();
      setCameraStatus('idle');
    }
  }, [active, release]);

  const start = async () => {
    if (!canStart || (isTest && !workflow) || sessionRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Mở kiosk bằng HTTPS được trình duyệt tin cậy để cấp quyền camera.');
      return;
    }

    const session = {};
    sessionRef.current = session;
    setError('');
    setCameraStatus('loading');
    onStart(workflow);

    const fail = (message) => {
      if (sessionRef.current !== session) return;
      release();
      setCameraStatus('idle');
      setError(message);
      stopWorkflowRef.current?.();
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 480 }, height: { ideal: 360 } },
        audio: false,
      });
      if (sessionRef.current !== session) {
        stopTracks(stream);
        return;
      }
      session.stream = stream;
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => fail('Camera đã ngắt. Bấm thử lại để mở camera.'), { once: true });
      });
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      if (sessionRef.current !== session) return;

      const { createPhoneFaceLandmarker } = await import('../../services/phoneFaceLandmarker');
      const detector = await createPhoneFaceLandmarker();
      if (sessionRef.current !== session) {
        detector.close();
        return;
      }
      session.detector = detector;
      setCameraStatus('waiting');

      let guestPresent = false;
      let missedFrames = 0;
      let lastVideoTime = -1;
      const demographicTracker = { current: null };
      let reportedProfile = null;
      session.timer = setInterval(() => {
        if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;
        try {
          const [landmarks] = detector.detectForVideo(video, performance.now()).faceLandmarks;
          const hasFace = Boolean(landmarks?.length);
          missedFrames = hasFace ? 0 : missedFrames + 1;
          const stillPresent = hasFace || (guestPresent && missedFrames < NO_FACE_FRAMES);
          if (stillPresent !== guestPresent) {
            guestPresent = stillPresent;
            setCameraStatus(guestPresent ? 'detected' : 'waiting');
            onPresenceChange(guestPresent);
            if (!guestPresent) {
              demographicTracker.current = null;
              reportedProfile = null;
              onDemographicsChange?.(null);
            }
          }
          if (!onDemographicsChange || !landmarks || landmarks.length < 455) return;

          const estimate = estimateFacialDemographics({
            landmarks, videoWidth: video.videoWidth, videoHeight: video.videoHeight, trackerRef: demographicTracker,
          });
          const recentAges = demographicTracker.current?.ageHistory.slice(-DEMOGRAPHIC_SAMPLE_COUNT);
          if (!recentAges || recentAges.length < DEMOGRAPHIC_SAMPLE_COUNT) return;
          const ageGroup = recentAges.every((age) => age === estimate.ageGroup) ? estimate.ageGroup : 'unknown';
          const gender = Math.abs(estimate.genderScore) >= 0.18 ? estimate.gender : 'unknown';
          if (reportedProfile?.ageGroup === ageGroup && reportedProfile?.gender === gender) return;
          reportedProfile = { ageGroup, gender };
          onDemographicsChange(reportedProfile);
        } catch {
          fail('Bộ nhận diện camera đã dừng. Bấm thử lại để khởi động.');
        }
      }, FRAME_INTERVAL_MS);
    } catch (cameraError) {
      fail(cameraError.name === 'NotAllowedError'
        ? 'Trình duyệt chưa cho phép dùng camera. Kiểm tra quyền camera rồi thử lại.'
        : 'Không mở được camera hoặc bộ nhận diện. Kiểm tra camera và kết nối mạng rồi thử lại.');
    }
  };

  const startRef = useRef(start);
  startRef.current = start;
  const readyToStart = canStart && (!isTest || Boolean(workflow));
  useEffect(() => {
    if (!readyToStart || autoAttemptedRef.current) return;
    const timer = setTimeout(() => {
      autoAttemptedRef.current = true;
      void startRef.current();
    }, 0);
    return () => clearTimeout(timer);
  }, [readyToStart]);

  return (
    <section className="fixed right-3 top-3 z-[65] max-w-[230px] rounded-xl bg-stone-950/90 p-2 text-xs text-white shadow-lg" aria-label="Camera điện thoại">
      {workflow && <p className="mb-2 font-semibold">{workflow.name}</p>}
      <video ref={videoRef} muted playsInline autoPlay aria-hidden="true" className="sr-only" />
      {cameraRunning ? (
        <div className="flex items-center gap-2">
          <span role="status">{cameraStatus === 'loading' ? 'Đang mở camera' : cameraStatus === 'detected' ? 'Đã thấy khách' : 'Đang chờ khách'}</span>
          <button type="button" onClick={() => { release(); setCameraStatus('idle'); onStop?.(); }} className="rounded-md border border-white/30 px-2 py-1">
            {isTest ? 'Dừng thử' : 'Tắt camera'}
          </button>
        </div>
      ) : (
        <button type="button" disabled={!canStart || (isTest && !workflow)} onClick={start} className="rounded-md bg-white px-3 py-2 font-semibold text-stone-900 disabled:opacity-50">
          {isTest ? 'Thử bằng camera trước' : 'Bật camera đón khách'}
        </button>
      )}
      {isTest && !workflow && !loadError && <p role="status" className="mt-2">Đang tải workflow đã lưu</p>}
      {(loadError || error) && <p role="alert" className="mt-2 text-amber-200">{loadError || error}</p>}
    </section>
  );
}
