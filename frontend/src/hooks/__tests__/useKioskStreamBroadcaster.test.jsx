import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { useKioskStreamBroadcaster, WEBRTC_ICE_SERVERS } from '../useKioskStreamBroadcaster';

describe('useKioskStreamBroadcaster Hook & WebRTC Signaling Tests', () => {
  it('exports useKioskStreamBroadcaster function and WEBRTC_ICE_SERVERS configuration', () => {
    expect(typeof useKioskStreamBroadcaster).toBe('function');
    expect(WEBRTC_ICE_SERVERS).toBeDefined();
    expect(Array.isArray(WEBRTC_ICE_SERVERS.iceServers)).toBe(true);

    const hasTurn = WEBRTC_ICE_SERVERS.iceServers.some(
      (s) => typeof s.urls === 'string' && s.urls.startsWith('turn:')
    );
    expect(hasTurn).toBe(true);
  });

  it('handles displaced message to gracefully yield broadcaster role when another phone connects', () => {
    const filePath = path.resolve(__dirname, '../useKioskStreamBroadcaster.js');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    expect(sourceCode).toContain("data.type === 'displaced'");
    expect(sourceCode).toContain('isDisplacedRef.current = true');
    expect(sourceCode).toContain('!isDisplacedRef.current');
  });

  it('safely wraps addIceCandidate in try/catch to avoid unhandled candidate exceptions', () => {
    const filePath = path.resolve(__dirname, '../useKioskStreamBroadcaster.js');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    expect(sourceCode).toContain('addIceCandidate(new RTCIceCandidate(data.candidate))');
  });

  it('has zero emojis across the file', () => {
    const filePath = path.resolve(__dirname, '../useKioskStreamBroadcaster.js');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]/;
    expect(emojiRegex.test(sourceCode)).toBe(false);
  });
});
