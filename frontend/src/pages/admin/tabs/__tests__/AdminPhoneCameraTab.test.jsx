import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AdminPhoneCameraTab } from '../AdminPhoneCameraTab';

describe('AdminPhoneCameraTab Component & Key Expression Anchors Integration', () => {
  it('exports AdminPhoneCameraTab as a valid React component function', () => {
    expect(typeof AdminPhoneCameraTab).toBe('function');
  });

  it('draws only essential facial expression lines and anchor points with minimal clutter', () => {
    const filePath = path.resolve(__dirname, '../AdminPhoneCameraTab.jsx');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    // Kiem tra da import DrawingUtils
    expect(sourceCode).toContain('DrawingUtils');

    // Kiem tra chi ve cac vung co bieu cam quan trong (Long may, Mat, Moi)
    expect(sourceCode).toContain('FACE_LANDMARKS_RIGHT_EYEBROW');
    expect(sourceCode).toContain('FACE_LANDMARKS_LEFT_EYEBROW');
    expect(sourceCode).toContain('FACE_LANDMARKS_LIPS');
    expect(sourceCode).toContain('FACE_LANDMARKS_RIGHT_EYE');
    expect(sourceCode).toContain('FACE_LANDMARKS_LEFT_EYE');

    // Kiem tra da loai bo luoi da giac 468 diem toan mat (it diem nhat co the)
    expect(sourceCode).not.toContain('FACE_LANDMARKS_TESSELATION');
    expect(sourceCode).not.toContain('FACE_LANDMARKS_FACE_OVAL');

    // Kiem tra co tap hop KEY_EXPRESSION_INDICES de cham diem neo
    expect(sourceCode).toContain('KEY_EXPRESSION_INDICES');

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
