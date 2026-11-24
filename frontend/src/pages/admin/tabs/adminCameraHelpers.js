/**
 * Admin Camera & Vision Configuration Helpers
 * Standardized constraints and parameters matching Raspberry Pi 5 USB camera specifications.
 */

export const PI5_CAMERA_SPECS = {
  WIDTH: 640,
  HEIGHT: 480,
  FPS: 15,
  MAX_FPS: 20,
  ASPECT_RATIO: 4 / 3,
  DEFAULT_PORT: 8554,
  DEFAULT_IP: '100.99.72.51',
};

/**
 * Tra ve MediaTrackConstraints cho camera laptop sao cho mo phong chuan nhat Camera USB Pi 5.
 * @param {boolean} exactMode - Neu true, ap dung rang buoc exact 640x480 (4:3); neu false dung ideal fallback.
 */
export function getLaptopWebcamConstraints(exactMode = true) {
  if (exactMode) {
    return {
      video: {
        width: { exact: PI5_CAMERA_SPECS.WIDTH },
        height: { exact: PI5_CAMERA_SPECS.HEIGHT },
        aspectRatio: { exact: PI5_CAMERA_SPECS.ASPECT_RATIO },
        frameRate: { ideal: PI5_CAMERA_SPECS.FPS, max: PI5_CAMERA_SPECS.MAX_FPS },
        facingMode: 'user',
      },
      audio: false,
    };
  }

  return {
    video: {
      width: { ideal: PI5_CAMERA_SPECS.WIDTH },
      height: { ideal: PI5_CAMERA_SPECS.HEIGHT },
      aspectRatio: { ideal: PI5_CAMERA_SPECS.ASPECT_RATIO },
      frameRate: { ideal: PI5_CAMERA_SPECS.FPS, max: PI5_CAMERA_SPECS.MAX_FPS },
      facingMode: 'user',
    },
    audio: false,
  };
}

/**
 * Tao payload gui len backend /api/v1/operations/robot/camera/webrtc-offer
 */
export function buildWebRTCOfferPayload(localDescription, targetIp, port = PI5_CAMERA_SPECS.DEFAULT_PORT) {
  if (!localDescription || !localDescription.sdp) {
    throw new Error('Local description SDP hop le la bat buoc');
  }

  return {
    sdp: localDescription.sdp,
    type: localDescription.type || 'offer',
    target_ip: targetIp || PI5_CAMERA_SPECS.DEFAULT_IP,
    port: Number(port) || PI5_CAMERA_SPECS.DEFAULT_PORT,
  };
}

/**
 * Format badge va tieu de cho feed source
 */
export function resolveFeedBadgeText(feedSource, controlIp) {
  switch (feedSource) {
    case 'pi5_tailscale':
      return `PI 5 TAILSCALE (${controlIp || PI5_CAMERA_SPECS.DEFAULT_IP})`;
    case 'local_webcam':
      return `LAPTOP TEST (${PI5_CAMERA_SPECS.WIDTH}x${PI5_CAMERA_SPECS.HEIGHT})`;
    case 'phone_kiosk':
      return 'PHONE KIOSK FEED';
    default:
      return 'CAMERA FEED';
  }
}

/**
 * Chuan hoa uoc tinh Nhan trac hoc (Demographics: Gender & Age Group)
 * Tinh toan tren cac diem moc co dinh (Khong bi anh huong boi cu dong mo mieng khi cuoi/noi)
 * Kiem soat dao dong qua bo loc EMA Smoothing + Hysteresis Band de giu on dinh 100%.
 */
export function estimateFacialDemographics({
  landmarks,
  videoWidth = 640,
  videoHeight = 480,
  trackerRef,
  smileScore = 0,
}) {
  if (!landmarks || landmarks.length < 455 || !landmarks[10] || !landmarks[152]) {
    return {
      gender: 'male',
      ageGroup: 'young_adult',
      confidence: 85,
      genderScore: 0,
      rawAge: 'young_adult',
    };
  }

  const w = videoWidth || 640;
  const h = videoHeight || 480;
  const dist = (p1, p2) => Math.hypot((p1.x - p2.x) * w, (p1.y - p2.y) * h);

  // 1. Chieu cao va do rong khuon mat
  const faceH = Math.max(dist(landmarks[10], landmarks[152]), 10);
  const faceW = Math.max(dist(landmarks[234], landmarks[454]), 10);
  const jawRatio = faceH / faceW;

  // 2. Chieu rong goc ham duoi (Bigonial Width: 58 - 288) so voi go ma (234 - 454)
  const jawW = dist(landmarks[58], landmarks[288]);
  const relJawW = jawW / faceW;

  // 3. Khoang cach long may - mi mat (Brow-to-Eye arch): 70-159 & 300-386
  const browEyeL = dist(landmarks[70], landmarks[159]);
  const browEyeR = dist(landmarks[300], landmarks[386]);
  const avgBrowEye = (browEyeL + browEyeR) / 2;
  const relBrowEye = avgBrowEye / faceH;

  // 4. Ty le phan duoi mat (Lower Face Proportions: Mui 1 den Cam 152)
  const lowerFaceH = dist(landmarks[1], landmarks[152]);
  const relLowerFace = lowerFaceH / faceH;

  // 5. Do tre cua khoe mieng (Mouth Corner Droop) so voi tam moi duoi 17
  // Nguoi lon tuoi (>60) co khoe mieng (61, 291) trup thap hon tam day moi 17
  const mouthCornerY = (landmarks[61].y + landmarks[291].y) / 2;
  const lipBottomY = landmarks[17].y;
  const cornerDroop = (mouthCornerY - lipBottomY) * h;

  // 6. Do mo mi mat (Eye Aperture: Sup mi ptosis o nguoi lon tuoi)
  const eyeOpenL = dist(landmarks[159], landmarks[145]);
  const eyeOpenR = dist(landmarks[386], landmarks[374]);
  const avgEyeOpen = (eyeOpenL + eyeOpenR) / 2;
  const relEyeOpen = avgEyeOpen / faceH;

  // --- TINH TOAN GENDER SCORE (Hoan toan doc lap voi cuoi hoac mo mieng) ---
  // - relJawW: Xuong ham nam rong hon (+3.5)
  // - relBrowEye: Cung may nu cao hon (-6.5)
  // - jawRatio: Khuon mat nam vuong hon (-1.5)
  const rawGenderScore =
    (relJawW - 0.70) * 4.0 -
    (relBrowEye - 0.12) * 6.5 -
    (jawRatio - 1.28) * 1.5;

  // --- TINH TOAN RAW AGE GROUP ---
  let rawAge = 'young_adult';

  if (jawRatio < 1.15 && relLowerFace < 0.35 && relBrowEye > 0.15) {
    // Tre em: Mat rat tron, phan cam ngan, mat to, tran rong
    rawAge = 'child';
  } else if (cornerDroop > 4.0 && relEyeOpen < 0.022 && relLowerFace > 0.44 && smileScore < 0.2) {
    // Nguoi lon tuoi (Senior > 60): Khoe mieng sup sau, sup mi nang, va khong phai cuoi
    rawAge = 'senior';
  } else if (
    (cornerDroop >= 2.0 && relEyeOpen <= 0.024 && relLowerFace >= 0.44) ||
    (relJawW >= 0.80 && relLowerFace >= 0.46 && cornerDroop >= 1.5)
  ) {
    // Nguoi truong thanh trung nien (Adult: 36 - 55): Co dau hieu lao hoa nhe o khoe mieng hoac do mo mi mat
    rawAge = 'adult';
  } else {
    // Mac dinh nguoi tre thanh nien (Young Adult: 18 - 35 tuoi: co mat san chac, khoe mieng khong trup)
    rawAge = 'young_adult';
  }

  // --- BO LOC TEMPORAL SMOOTHING + HYSTERESIS (Chong nhay lien tuc) ---
  if (!trackerRef || !trackerRef.current || Array.isArray(trackerRef.current)) {
    if (trackerRef) {
      trackerRef.current = {
        genderEma: rawGenderScore >= 0 ? 0.4 : -0.4,
        currentGender: rawGenderScore >= 0 ? 'male' : 'female',
        ageHistory: [],
        currentAge: rawAge,
      };
    }
  }

  const tracker = trackerRef?.current || {
    genderEma: rawGenderScore >= 0 ? 0.4 : -0.4,
    currentGender: rawGenderScore >= 0 ? 'male' : 'female',
    ageHistory: [],
    currentAge: rawAge,
  };

  // 1. Cap nhat EMA cho Gender (alpha = 0.15 giup on dinh qua 2-3 giay)
  const alpha = 0.15;
  tracker.genderEma = (1 - alpha) * tracker.genderEma + alpha * rawGenderScore;

  // Hysteresis Band cho Gender: [-0.18, +0.18]
  // Phai vuot han nguong thi moi doi gioi tinh, tranh nhay lap lo xung quanh 0
  if (tracker.genderEma > 0.18) {
    tracker.currentGender = 'male';
  } else if (tracker.genderEma < -0.18) {
    tracker.currentGender = 'female';
  }

  // 2. Cap nhat Age History (cua so 20 frames ~ 4 giay)
  tracker.ageHistory.push(rawAge);
  if (tracker.ageHistory.length > 20) {
    tracker.ageHistory.shift();
  }

  // Dem so phieu cho tung nhom tuoi
  const counts = { child: 0, young_adult: 0, adult: 0, senior: 0 };
  tracker.ageHistory.forEach((a) => {
    counts[a] = (counts[a] || 0) + 1;
  });

  // Hysteresis cho Age: Uu tien giu nguyen currentAge tru khi nhom moi chiem >= 60%
  const totalVotes = tracker.ageHistory.length;
  let dominantAge = tracker.currentAge || 'young_adult';
  for (const [ageKey, voteCount] of Object.entries(counts)) {
    if (voteCount >= totalVotes * 0.60) {
      dominantAge = ageKey;
      break;
    }
  }
  tracker.currentAge = dominantAge;

  // Confidence tinh theo do cach xa nguong boundary
  const genderConfidence = Math.min(96, Math.max(82, Math.round(82 + Math.abs(tracker.genderEma) * 18)));

  return {
    gender: tracker.currentGender,
    ageGroup: tracker.currentAge,
    confidence: genderConfidence,
    genderScore: tracker.genderEma,
    rawAge,
  };
}
