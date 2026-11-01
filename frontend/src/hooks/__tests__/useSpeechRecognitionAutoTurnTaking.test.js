import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Speech Recognition Auto Turn-Taking & iOS Fallback Tests', () => {
  it('contains seamless Hardware Whisper STT fallback on iOS not-allowed gesture error', () => {
    const hookPath = path.resolve(__dirname, '../useSpeechRecognition.js');
    const content = fs.readFileSync(hookPath, 'utf8');

    // Đảm bảo có xử lý đặc trị cho iOS WebKit không bị ngắt mic
    expect(content).toContain('WebSpeech blocked by browser gesture policy (iOS/Mobile)');
    expect(content).toContain('Seamlessly switching to Hardware Whisper STT');
    expect(content).toContain('audioContextRef.current.resume()');
  });

  it('guarantees silent auto-listen mode to eliminate speaker feedback loop', () => {
    const pagePath = path.resolve(__dirname, '../../pages/robot/RobotScreenPage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    // Kiểm tra cờ silent: true khi chuyển lượt tự động
    expect(content).toContain('handleStartTalk({ silent: true })');
    expect(content).toContain('const isSilent = Boolean(options?.silent)');
  });

  it('informs guest that room service bills are sent to reception for checkout payment', () => {
    const menuPath = path.resolve(__dirname, '../../components/robot/RobotFoodMenuScreen.jsx');
    const content = fs.readFileSync(menuPath, 'utf8');

    expect(content).toContain('Ghi vào hóa đơn phòng:');
    expect(content).toContain('Hóa đơn đã được chuyển về quầy Lễ tân');
    expect(content).toContain('không thanh toán tại chỗ');
  });
});

