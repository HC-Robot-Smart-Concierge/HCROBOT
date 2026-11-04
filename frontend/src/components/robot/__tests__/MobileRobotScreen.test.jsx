import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { MobileRobotScreen } from '../MobileRobotScreen';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MobileRobotScreen Component & UX Tests', () => {
  it('exports MobileRobotScreen as a valid functional component', () => {
    expect(typeof MobileRobotScreen).toBe('function');
    expect(MobileRobotScreen.name).toBe('MobileRobotScreen');
  });

  it('guarantees code has no emoji characters anywhere in MobileRobotScreen.jsx', () => {
    const filePath = path.resolve(__dirname, '../MobileRobotScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(content)).toBe(false);
  });

  it('replaces ambiguous "Khách mới" label with LogOut icon and "Thoát phiên" / "Exit"', () => {
    const filePath = path.resolve(__dirname, '../MobileRobotScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Không còn chữ "Khách mới" gây khó hiểu cho khách
    expect(content).not.toContain('Khách mới');
    expect(content).not.toContain('New ✕');

    // Sử dụng icon LogOut và nhãn "Thoát phiên" / "Exit"
    expect(content).toContain('LogOut');
    expect(content).toContain('Thoát phiên');
    expect(content).toContain('Exit');
  });

  it('provides Quick Action Dock on mobile screen for direct thumb access', () => {
    const filePath = path.resolve(__dirname, '../MobileRobotScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Chạm nhanh các dịch vụ không cần vào menu sâu
    expect(content).toContain('onOpenFoodMenu');
    expect(content).toContain('onOpenRoomService');
    expect(content).toContain('onOpenFacilities');
    expect(content).toContain('onCallStaff');
    expect(content).toContain('touch-manipulation');
  });

  it('enforces 30s session idle timeout and unblocked idle check in RobotScreenPage.jsx', () => {
    const filePath = path.resolve(__dirname, '../../../pages/robot/RobotScreenPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Timeout 30 giây rảnh rỗi tự động thoát phiên
    expect(content).toContain('CONVERSATION_IDLE_TIMEOUT_MS = 30000');

    // isListening và hasAiResponse KHÔNG được nằm trong isBusy để tránh chặn idle timeout
    expect(content).not.toContain('hasAiResponse ||');
    expect(content).toContain('currentState !== \'RT-01\' || activeRoomNumber !== null');

    // Thoát phiên sẽ dọn sạch session và trả về RT-01
    expect(content).toContain('setActiveRoomNumber(null)');
    expect(content).toContain('setCurrentState(\'RT-01\')');

    // Desktop header có hiển thị nút Thoát phiên với icon LogOut
    expect(content).toContain('LogOut className="w-3 h-3 text-rose-400"');
  });
});

