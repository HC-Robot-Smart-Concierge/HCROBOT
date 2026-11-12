import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { BellServicesDashboard } from '../BellServicesDashboard';
import { INITIAL_BELL_SERVICES_DATA } from '../../../data/mockHotelData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Bellman 2 Core Workflows (Luggage, Lost & Found) Tests', () => {
  const bellDashPath = path.resolve(__dirname, '../BellServicesDashboard.jsx');
  const bellDashContent = fs.readFileSync(bellDashPath, 'utf8');

  const robotScreenPath = path.resolve(__dirname, '../../robot/RobotScreenPage.jsx');
  const robotScreenContent = fs.readFileSync(robotScreenPath, 'utf8');

  it('exports BellServicesDashboard as a functional component', () => {
    expect(typeof BellServicesDashboard).toBe('function');
  });

  it('guarantees no emoji characters in BellServicesDashboard', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(bellDashContent)).toBe(false);
  });

  it('supports Flow 1: Tiếp nhận yêu cầu hỗ trợ hành lý (Luggage Assistance)', () => {
    expect(bellDashContent).toContain("id: 'luggage'");
    expect(bellDashContent).toContain('Hỗ trợ hành lý');
    expect(bellDashContent).toContain('Tiếp nhận hỗ trợ hành lý');
    expect(bellDashContent).toContain('Mang hành lý lên phòng');
    expect(bellDashContent).toContain('Thu nhận hành lý trả phòng');
    expect(bellDashContent).toContain('Gửi giữ hành lý tại sảnh');
    expect(bellDashContent).toContain('Hỗ trợ chuyển phòng');
  });

  it('supports Flow 2: Tiếp nhận báo cáo đồ thất lạc (Lost & Found Report)', () => {
    expect(bellDashContent).toContain("id: 'lost_found'");
    expect(bellDashContent).toContain('Báo cáo đồ thất lạc');
    expect(bellDashContent).toContain('Tiếp nhận báo cáo đồ thất lạc');
    expect(bellDashContent).toContain('Tiếp nhận & Tìm kiếm đồ');
    expect(bellDashContent).toContain('Đã tìm thấy & Trao trả khách');
    expect(bellDashContent).toContain("request_type: 'lost_found'");
  });

  it('no longer handles emotion_alert in BellServicesDashboard (moved to Concierge)', () => {
    expect(bellDashContent).not.toContain('emotion_alert');
    expect(bellDashContent).not.toContain('Xử lý khách khó chịu');
  });

  it('wires RobotScreenPage to dispatch bellman luggage/lost_found to Bell Services and emotion alerts to Concierge', () => {
    expect(robotScreenContent).toContain('handleGuestEmotionDetected');
    expect(robotScreenContent).toContain('createConciergeEmotionAlert');
    expect(robotScreenContent).toContain("actionToExecute === 'bellman' || actionToExecute === 'lost_found'");
  });

  it('includes luggage and lost_found in INITIAL_BELL_SERVICES_DATA fallback (without emotion_alert)', () => {
    const types = INITIAL_BELL_SERVICES_DATA.requests.map((r) => r.type);
    expect(types).toContain('luggage');
    expect(types).toContain('lost_found');
    expect(types).not.toContain('emotion_alert');
  });
});
