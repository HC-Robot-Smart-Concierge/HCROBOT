/**
 * personDetector.js
 * Dịch vụ nhận diện người thông minh bằng mô hình TensorFlow.js COCO-SSD (MobileNet)
 * Tối ưu hóa cho Web / PWA trên điện thoại và màn hình Robot.
 */

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

let modelInstance = null;
let modelLoadingPromise = null;
let modelLoadError = null;

/**
 * Tải mô hình COCO-SSD (Singleton - chỉ tải 1 lần)
 * @returns {Promise<cocoSsd.ObjectDetection>}
 */
export const loadPersonDetector = async () => {
  if (modelInstance) {
    return modelInstance;
  }

  if (modelLoadingPromise) {
    return modelLoadingPromise;
  }

  modelLoadingPromise = (async () => {
    try {
      // Tải mô hình MobileNet COCO-SSD tối ưu cho thiết bị di động và trình duyệt
      const model = await cocoSsd.load({
        base: 'lite_mobilenet_v2', // Siêu nhẹ, khởi động nhanh trên Web và Mobile
      });
      modelInstance = model;
      modelLoadError = null;
      return model;
    } catch (err) {
      console.error('[PersonDetector] Lỗi khi tải mô hình COCO-SSD:', err);
      modelLoadError = err;
      throw err;
    } finally {
      modelLoadingPromise = null;
    }
  })();

  return modelLoadingPromise;
};

/**
 * Ước lượng cự ly của khách dựa vào tỉ lệ chiều cao Bounding Box so với khung hình
 * @param {number} bboxHeight - Chiều cao bounding box (pixel)
 * @param {number} videoHeight - Chiều cao video (pixel)
 * @returns {{ distanceLabel: 'FAR' | 'APPROACHING' | 'CLOSE', ratio: number }}
 */
export const estimateDistance = (bboxHeight, videoHeight) => {
  const vH = videoHeight && videoHeight > 0 ? videoHeight : 480;
  const ratio = Math.min(1.0, Math.max(0.0, bboxHeight / vH));

  let distanceLabel = 'FAR';
  if (ratio >= 0.45) {
    distanceLabel = 'CLOSE'; // Khách đã đứng đối diện (< 1.5m) hoặc cận cảnh khuôn mặt/ngực
  } else if (ratio >= 0.25) {
    distanceLabel = 'APPROACHING'; // Khách đang bước lại gần (~1.8m - 3m)
  } else {
    distanceLabel = 'FAR'; // Khách ở xa (> 3m)
  }

  return { distanceLabel, ratio };
};

/**
 * Phát hiện người trong khung hình video
 * @param {HTMLVideoElement} videoElement
 * @param {object} options
 * @param {number} [options.minConfidence=0.28] - Ngưỡng độ tin cậy tối thiểu (hỗ trợ cả góc nhìn webcam cận cảnh)
 * @returns {Promise<object|null>}
 */
export const detectPerson = async (videoElement, options = {}) => {
  const minConfidence = options.minConfidence ?? 0.28;

  if (!videoElement || videoElement.readyState < 2 || !videoElement.videoWidth) {
    return null;
  }

  const model = modelInstance || (await loadPersonDetector());
  if (!model) return null;

  try {
    // Gọi model.detect với minScore = 0.25 để không bị COCO-SSD lọc mất góc cận cảnh
    const predictions = await model.detect(videoElement, 6, 0.25);
    const videoWidth = videoElement.videoWidth || 640;
    const videoHeight = videoElement.videoHeight || 480;

    // Lọc đối tượng class 'person'
    const personPredictions = predictions.filter(
      (p) => p.class === 'person' && p.score >= minConfidence
    );

    if (personPredictions.length === 0) {
      return {
        detected: false,
        score: 0,
        bbox: null,
        distance: 'NONE',
        distanceRatio: 0,
        allPersonsCount: 0,
      };
    }

    // Chọn người có diện tích Bounding Box lớn nhất (người ở gần nhất với robot)
    let bestPerson = personPredictions[0];
    let maxArea = bestPerson.bbox[2] * bestPerson.bbox[3];

    for (let i = 1; i < personPredictions.length; i++) {
      const p = personPredictions[i];
      const area = p.bbox[2] * p.bbox[3];
      if (area > maxArea) {
        maxArea = area;
        bestPerson = p;
      }
    }

    const [x, y, width, height] = bestPerson.bbox;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const relativeX = (centerX - videoWidth / 2) / (videoWidth / 2); // -1 (trái), 0 (giữa), 1 (phải)

    const distanceInfo = estimateDistance(height, videoHeight);

    return {
      detected: true,
      class: 'person',
      score: Math.round(bestPerson.score * 100),
      bbox: [Math.round(x), Math.round(y), Math.round(width), Math.round(height)],
      center: {
        x: Math.round(centerX),
        y: Math.round(centerY),
        relativeX: Number(relativeX.toFixed(2)),
      },
      distance: distanceInfo.distanceLabel,
      distanceRatio: Number(distanceInfo.ratio.toFixed(2)),
      allPersonsCount: personPredictions.length,
    };
  } catch (err) {
    console.warn('[PersonDetector] Lỗi suy luận phát hiện người:', err);
    return null;
  }
};

/**
 * Trạng thái hiện tại của mô hình
 */
export const getDetectorStatus = () => ({
  isLoaded: !!modelInstance,
  isLoading: !!modelLoadingPromise,
  error: modelLoadError ? modelLoadError.message : null,
});
