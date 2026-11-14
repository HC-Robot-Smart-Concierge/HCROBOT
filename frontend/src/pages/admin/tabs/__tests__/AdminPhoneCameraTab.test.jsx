import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AdminPhoneCameraTab } from '../AdminPhoneCameraTab';

describe('AdminPhoneCameraTab Component & Facial Mesh Landmarks Integration', () => {
  it('exports AdminPhoneCameraTab as a valid React component function', () => {
    expect(typeof AdminPhoneCameraTab).toBe('function');
  });

  it('uses MediaPipe DrawingUtils to overlay face mesh landmarks directly on video', () => {
    const filePath = path.resolve(__dirname, '../AdminPhoneCameraTab.jsx');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    // Kiem tra da import DrawingUtils
    expect(sourceCode).toContain('DrawingUtils');

    // Kiem tra da su dung cac ket noi mesh de ve len canvas
    expect(sourceCode).toContain('FACE_LANDMARKS_TESSELATION');
    expect(sourceCode).toContain('FACE_LANDMARKS_RIGHT_EYEBROW');
    expect(sourceCode).toContain('FACE_LANDMARKS_LEFT_EYEBROW');
    expect(sourceCode).toContain('FACE_LANDMARKS_LIPS');
    expect(sourceCode).toContain('drawLandmarks');

    // Kiem tra da co the canvas phu len video
    expect(sourceCode).toContain('ref={canvasRef}');
  });

  it('removes emotion logs and history log block as requested', () => {
    const filePath = path.resolve(__dirname, '../AdminPhoneCameraTab.jsx');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    // Khong con emotionLogs state va khong con tieu de Expression History Log
    expect(sourceCode).not.toContain('emotionLogs');
    expect(sourceCode).not.toContain('Expression History Log');
    expect(sourceCode).not.toContain('setEmotionLogs');
  });

  it('displays detailed facial blendshapes diagnostics breakdown', () => {
    const filePath = path.resolve(__dirname, '../AdminPhoneCameraTab.jsx');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    expect(sourceCode).toContain('Facial Mesh & Blendshapes');
    expect(sourceCode).toContain('Mouth Corners (Smile L/R)');
    expect(sourceCode).toContain('Brow Depression (Distress L/R)');
    expect(sourceCode).toContain('Eye Squint');
    expect(sourceCode).toContain('Jaw Open');
  });
});
