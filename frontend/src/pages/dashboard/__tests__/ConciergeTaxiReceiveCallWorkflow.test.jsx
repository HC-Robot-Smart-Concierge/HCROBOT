import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { ConciergeDashboard } from '../ConciergeDashboard';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Concierge Taxi Reception & Calling Workflow Tests', () => {
  const conciergePath = path.resolve(__dirname, '../ConciergeDashboard.jsx');
  const conciergeContent = fs.readFileSync(conciergePath, 'utf8');

  it('exports ConciergeDashboard as a functional component', () => {
    expect(typeof ConciergeDashboard).toBe('function');
  });

  it('guarantees no emoji characters in ConciergeDashboard', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(conciergeContent)).toBe(false);
  });

  it('verifies Concierge does NOT have fleet dispatching or driver assignment modals', () => {
    // Không có modal gán tài xế hay điều phối xe phức tạp
    expect(conciergeContent).not.toContain('assignModal');
    expect(conciergeContent).not.toContain('Điều Phối Tài Xế Cho Chuyến Đi');
    expect(conciergeContent).not.toContain('Gán tài xế');
  });

  it('verifies 2-step button actions: Nhận yêu cầu (Calling) and Thành công (Completed)', () => {
    // Bước 1: Khi còn Pending -> Concierge bấm "Nhận yêu cầu" để chuyển sang "Calling"
    expect(conciergeContent).toContain("handleUpdateTaxiStatus(trip.id, 'Calling')");
    expect(conciergeContent).toContain('Nhận yêu cầu');

    // Bước 2: Khi đang Gọi -> Concierge gọi xong bấm "Thành công" để chuyển sang "Completed"
    expect(conciergeContent).toContain("handleUpdateTaxiStatus(trip.id, 'Completed')");
    expect(conciergeContent).toContain('Thành công');
  });

  it('verifies status labels and badges for Taxi requests', () => {
    expect(conciergeContent).toContain('Chờ tiếp nhận');
    expect(conciergeContent).toContain('Đang gọi');
    expect(conciergeContent).toContain('Thành công');
    expect(conciergeContent).toContain('Đã gọi xong');
  });

  it('verifies header and subtab title updated from dispatching to reception & calling', () => {
    expect(conciergeContent).toContain('Tiếp Nhận & Gọi Xe Taxi Cho Khách');
    expect(conciergeContent).toContain('Yêu cầu gọi Taxi');
    expect(conciergeContent).toContain('Danh Sách Yêu Cầu Gọi Xe Taxi');
  });

  it('verifies pagination is integrated for call recordings, taxi requests, and guest feedback', () => {
    expect(conciergeContent).toContain("import { Pagination } from '../../components/common/Pagination';");
    expect(conciergeContent).toContain('paginatedRecordings');
    expect(conciergeContent).toContain('paginatedTaxiRequests');
    expect(conciergeContent).toContain('paginatedFeedbacks');
    expect(conciergeContent).toContain('recordingsPage');
    expect(conciergeContent).toContain('taxiPage');
    expect(conciergeContent).toContain('feedbackPage');
  });

  it('verifies guest feedback filtering mechanisms are integrated with 3 rating pills', () => {
    expect(conciergeContent).toContain('feedbackRatingFilter');
    expect(conciergeContent).toContain('filteredFeedbacks');
    expect(conciergeContent).toContain('Tất cả');
    expect(conciergeContent).toContain('Cần can thiệp');
    expect(conciergeContent).toContain('Hài lòng (4-5 sao)');
  });
});

