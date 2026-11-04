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

  it('enforces minimalist mobile header with black exit button, icon-only buttons, room number only, and large face scale', () => {
    const filePath = path.resolve(__dirname, '../MobileRobotScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Phòng chỉ hiện số phòng, không còn chấm màu xanh
    expect(content).not.toContain('bg-emerald-500 animate-pulse');
    expect(content).toContain('{activeRoomNumber}');

    // Nút thoát phiên dùng màu đen đồng bộ hệ thống
    expect(content).toContain('bg-stone-900/90');
    expect(content).toContain('LogOut');

    // Thanh nói chuyện tinh giản tối đa từ ngữ
    expect(content).toContain('Chạm hoặc nói');
    expect(content).not.toContain('Auto-detect VI · EN · Tự động nhận diện');

    // Mặt robot to hơn trên mobile
    expect(content).toContain('scale-110 sm:scale-125');
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

  it('renders large minimalist modal popup for language selector with flag icons only and concise labels', () => {
    const filePath = path.resolve(__dirname, '../MobileRobotScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Không còn dùng dropdown menu nhỏ w-44
    expect(content).not.toContain('w-44 rounded-2xl bg-stone-900/95');

    // Sử dụng modal lớn căn giữa màn hình với backdrop mờ
    expect(content).toContain('fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md');
    expect(content).toContain('rounded-3xl shadow-2xl');

    // Nút đóng
    expect(content).toContain('<X className="w-4 h-4" />');

    // Icon cờ chuẩn SVG không dùng emoji
    expect(content).toContain('fill="#DA251D"');
    expect(content).toContain('fill="#FFFF00"');
    expect(content).toContain('fill="#012169"');

    // Nhãn tên ngôn ngữ ngắn gọn, không chữ phụ rườm rà
    expect(content).toContain('Tiếng Việt');
    expect(content).toContain('English');
    expect(content).not.toContain('Vietnamese · Giọng đọc');
    expect(content).not.toContain('International hotel guest support');
    expect(content).not.toContain('Giao tiếp giọng nói và hiển thị');
  });

  it('renders full-screen wayfinding map without redundant right column, step text, or duplicated QR card', () => {
    const filePath = path.resolve(__dirname, '../MobileRobotScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Không còn chia 2 cột với cột phải cồng kềnh
    expect(content).not.toContain('w-[310px] sm:w-[350px] md:w-[380px]');

    // Không còn chữ Chặng 1, Chặng 2 hay thẻ Quét QR lưu chỉ dẫn thừa
    expect(content).not.toContain('Quét QR lưu chỉ dẫn');
    expect(content).not.toContain('Quét camera để lưu sơ đồ');
    expect(content).not.toContain('TÔI ĐÃ NHỚ ĐƯỜNG · ĐÓNG');

    // Bản đồ hiển thị full width & height
    expect(content).toContain('w-full h-full relative rounded-2xl overflow-hidden');
    expect(content).toContain('FloorMap');

    // Thanh chỉ dẫn nổi tinh giản ở đáy
    expect(content).toContain('absolute bottom-2.5 left-2.5 right-2.5 z-30');
    expect(content).toContain('currentDestination.isDifferentFloor');

    // Zoom bản đồ được đặt 1.0 tự nhiên, tránh vỡ hạt do zoom quá đà
    expect(content).toContain('defaultZoom={1.0}');
  });

  it('preserves active room session when closing map or when directions timer completes', () => {
    const mobileScreenPath = path.resolve(__dirname, '../MobileRobotScreen.jsx');
    const mobileContent = fs.readFileSync(mobileScreenPath, 'utf8');

    // Mobile screen hỗ trợ onCloseDirections và không hủy session
    expect(mobileContent).toContain('onCloseDirections');
    expect(mobileContent).toContain('handleDismissMap');

    const robotPagePath = path.resolve(__dirname, '../../../pages/robot/RobotScreenPage.jsx');
    const robotPageContent = fs.readFileSync(robotPagePath, 'utf8');

    // Đóng bản đồ gọi handleCloseDirections, không xóa phòng
    expect(robotPageContent).toContain('handleCloseDirections');
    expect(robotPageContent).toContain('onCloseDirections={handleCloseDirections}');
    expect(robotPageContent).not.toContain('qrStageTimerRef.current = setTimeout(() => {\n                    clearRouteGuidanceTimers();\n                    resetToIdle();');
  });
});

