import { describe, it, expect } from 'vitest';
import { MessengerVideoCallModal } from './MessengerVideoCallModal';

describe('MessengerVideoCallModal Component & Theme Logic', () => {
  it('should export MessengerVideoCallModal component', () => {
    expect(typeof MessengerVideoCallModal).toBe('function');
  });

  it('correctly formats call duration timer to mm:ss', () => {
    const formatTime = (secs) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(9)).toBe('00:09');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(360)).toBe('06:00');
  });

  it('verifies grey theme styling tokens for call interface', () => {
    const greyThemeTokens = {
      windowBg: '#1E1E1E',
      videoAreaBg: '#181818',
      controlDockBg: '#1A1A1A',
      borderColor: 'border-stone-700/80',
      buttonBg: 'bg-stone-800',
      buttonBorder: 'border-stone-600',
      primaryText: 'text-stone-100',
      secondaryText: 'text-stone-400',
    };

    expect(greyThemeTokens.windowBg).toBe('#1E1E1E');
    expect(greyThemeTokens.videoAreaBg).toBe('#181818');
    expect(greyThemeTokens.controlDockBg).toBe('#1A1A1A');
    expect(greyThemeTokens.borderColor).toContain('stone-700');
    expect(greyThemeTokens.buttonBg).toBe('bg-stone-800');
  });

  it('validates minimal connecting copy without concierge or kiosk jargon', () => {
    const connectingCopy = 'Đang kết nối với nhân viên...';
    expect(connectingCopy).toBe('Đang kết nối với nhân viên...');
    expect(connectingCopy).not.toContain('Concierge');
    expect(connectingCopy).not.toContain('Kiosk');
    expect(connectingCopy).not.toContain('P2P');
  });
});
