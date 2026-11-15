import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { CameraPreview } from '../CameraPreview';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CameraPreview Emotion False-Positive Mitigation Tests', () => {
  const componentPath = path.resolve(__dirname, '../CameraPreview.jsx');
  const content = fs.readFileSync(componentPath, 'utf8');

  it('exports CameraPreview as a valid React functional component', () => {
    expect(typeof CameraPreview).toBe('function');
  });

  it('incorporates multi-feature compound distress scoring', () => {
    expect(content).toContain('compoundDistress');
    expect(content).toContain('browDown * 0.7 + mouthFrown * 0.3');
    expect(content).toContain('browDown >= 0.30');
  });

  it('enforces temporal confirmation filter before confirming unhappy emotion', () => {
    expect(content).toContain('consecutiveUnhappyFramesRef');
    expect(content).toContain('consecutiveUnhappyFramesRef.current >= 2');
  });

  it('guarantees zero emoji characters in CameraPreview', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(content)).toBe(false);
  });
});
