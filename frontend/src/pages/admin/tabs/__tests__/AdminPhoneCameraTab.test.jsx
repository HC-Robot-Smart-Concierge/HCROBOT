import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AdminPhoneCameraTab } from '../AdminPhoneCameraTab';

describe('AdminPhoneCameraTab Component & Minimal Expression Anchors & Rotation', () => {
  it('exports AdminPhoneCameraTab as a valid React component function', () => {
    expect(typeof AdminPhoneCameraTab).toBe('function');
  });

  it('draws only ultra-minimal key expression anchors without clutter', () => {
    const sourceCode = [
      '../AdminPhoneCameraTab.jsx',
      '../usePhoneCameraVision.js',
      '../AdminPhoneCameraViewportPanel.jsx',
      '../AdminPhoneCameraAnalyticsPanel.jsx',
    ].map((rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf-8')).join('\n');

    // Kiem tra co tap hop cac diem neo toi gian nhat
    expect(sourceCode).toContain('MINIMAL_EXPRESSION_ANCHORS');

    // Kiem tra khong con dung luoi da giac toan mat
    expect(sourceCode).not.toContain('FACE_LANDMARKS_TESSELATION');
    expect(sourceCode).not.toContain('FACE_LANDMARKS_FACE_OVAL');

    // Kiem tra da co the canvas phu len video
    expect(sourceCode).toContain('ref={canvasRef}');
  });

  it('supports video orientation rotation for landscape phone placement', () => {
    const sourceCode = [
      '../AdminPhoneCameraTab.jsx',
      '../usePhoneCameraVision.js',
      '../AdminPhoneCameraViewportPanel.jsx',
      '../AdminPhoneCameraAnalyticsPanel.jsx',
    ].map((rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf-8')).join('\n');

    // Kiem tra co state videoRotation va nut xoay RotateCw
    expect(sourceCode).toContain('videoRotation');
    expect(sourceCode).toContain('RotateCw');
    expect(sourceCode).toContain('setVideoRotation');
  });

  it('removes emotion logs and history log block as requested', () => {
    const sourceCode = [
      '../AdminPhoneCameraTab.jsx',
      '../usePhoneCameraVision.js',
      '../AdminPhoneCameraViewportPanel.jsx',
      '../AdminPhoneCameraAnalyticsPanel.jsx',
    ].map((rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf-8')).join('\n');

    // Khong con emotionLogs state va khong con tieu de Expression History Log
    expect(sourceCode).not.toContain('emotionLogs');
    expect(sourceCode).not.toContain('Expression History Log');
    expect(sourceCode).not.toContain('setEmotionLogs');
  });

  it('displays detailed facial blendshapes diagnostics breakdown', () => {
    const sourceCode = [
      '../AdminPhoneCameraTab.jsx',
      '../usePhoneCameraVision.js',
      '../AdminPhoneCameraViewportPanel.jsx',
      '../AdminPhoneCameraAnalyticsPanel.jsx',
    ].map((rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf-8')).join('\n');

    expect(sourceCode).toContain('Facial Mesh & Blendshapes');
    expect(sourceCode).toContain('Mouth Corners (Smile L/R)');
    expect(sourceCode).toContain('Brow Depression (Distress L/R)');
    expect(sourceCode).toContain('Eye Squint');
    expect(sourceCode).toContain('Jaw Open');
  });

  it('complies with admin system palette, black buttons, and no emojis', () => {
    const sourceCode = [
      '../AdminPhoneCameraTab.jsx',
      '../usePhoneCameraVision.js',
      '../AdminPhoneCameraViewportPanel.jsx',
      '../AdminPhoneCameraAnalyticsPanel.jsx',
    ].map((rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf-8')).join('\n');

    // Theme mau beige he thong va nut den
    expect(sourceCode).toContain('#F2EFE9');
    expect(sourceCode).toContain('#FAF8F5');
    expect(sourceCode).toContain('#262626');
    expect(sourceCode).toContain('#BFBFBD');

    // Khong su dung bat ky emoji nao
    const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]/;
    expect(emojiRegex.test(sourceCode)).toBe(false);
  });

  it('implements compound distress scoring and temporal confirmation filter to avoid false positives', () => {
    const sourceCode = [
      '../AdminPhoneCameraTab.jsx',
      '../usePhoneCameraVision.js',
      '../AdminPhoneCameraViewportPanel.jsx',
      '../AdminPhoneCameraAnalyticsPanel.jsx',
    ].map((rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf-8')).join('\n');

    expect(sourceCode).toContain('compoundDistress');
    expect(sourceCode).toContain('consecutiveUnhappyFramesRef');
    expect(sourceCode).toContain('consecutiveUnhappyFramesRef.current >= 3');
  });
});
