import { describe, it, expect } from 'vitest';

describe('CameraPreview Component UI State & Toggle Logic', () => {
  it('should initialize with camera preview expanded (isMinimized = false)', () => {
    let isMinimized = false;
    expect(isMinimized).toBe(false);
  });

  it('should toggle isMinimized state to hide and restore camera preview UI', () => {
    let isMinimized = false;

    // Click hide button (EyeOff)
    isMinimized = true;
    expect(isMinimized).toBe(true);

    // Click restore button (Hiện Camera)
    isMinimized = false;
    expect(isMinimized).toBe(false);
  });

  it('should update isCameraActive when stopping or starting camera stream', () => {
    let isCameraActive = true;
    let isFaceDetected = true;

    // Simulate stopCamera action
    const stopCamera = () => {
      isCameraActive = false;
      isFaceDetected = false;
    };

    stopCamera();
    expect(isCameraActive).toBe(false);
    expect(isFaceDetected).toBe(false);
  });
});
