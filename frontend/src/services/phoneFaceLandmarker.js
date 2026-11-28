import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import simdLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import simdBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import basicLoader from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url';
import basicBinary from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url';

export async function createPhoneFaceLandmarker() {
  const simd = await FilesetResolver.isSimdSupported();
  return FaceLandmarker.createFromOptions({
    wasmLoaderPath: simd ? simdLoader : basicLoader,
    wasmBinaryPath: simd ? simdBinary : basicBinary,
  }, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    numFaces: 1,
  });
}
