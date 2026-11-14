import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AdminPhoneCameraTab } from '../AdminPhoneCameraTab';

describe('AdminPhoneCameraTab Component & Minimal Expression Anchors & Rotation', () => {
  it('exports AdminPhoneCameraTab as a valid React component function', () => {
    expect(typeof AdminPhoneCameraTab).toBe('function');
  });

  it('draws only ultra-minimal key expression anchors without clutter', () => {
    const filePath = path.resolve(__dirname, '../AdminPhoneCameraTab.jsx');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    // Kiem tra co tap hop cac diem neo toi gian nhat
    expect(sourceCode).toContain('MINIMAL_EXPRESSION_ANCHORS');

    // Kiem tra khong con dung luoi da giac toan mat
    expect(sourceCode).not.toContain('FACE_LANDMARKS_TESSELATION');
    expect(sourceCode).not.toContain('FACE_LANDMARKS_FACE_OVAL');

    // Kiem tra da co the canvas phu len video
    expect(sourceCode).toContain('ref={canvasRef}');
  });

  it('supports video orientation rotation for landscape phone placement', () => {
    const filePath = path.resolve(__dirname, '../AdminPhoneCameraTab.jsx');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    // Kiem tra co state videoRotation va nut xoay RotateCw
    expect(sourceCode).toContain('videoRotation');
    expect(sourceCode).toContain('RotateCw');
    expect(sourceCode).toContain('setVideoRotation');
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

  it('complies with admin system palette, black buttons, and no emojis', () => {
    const filePath = path.resolve(__dirname, '../AdminPhoneCameraTab.jsx');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    // Theme mau beige he thong va nut den
    expect(sourceCode).toContain('#F2EFE9');
    expect(sourceCode).toContain('#FAF8F5');
    expect(sourceCode).toContain('#262626');
    expect(sourceCode).toContain('#BFBFBD');

    // Khong su dung bat ky emoji nao
    const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]/;
    expect(emojiRegex.test(sourceCode)).toBe(false);
  });
});
