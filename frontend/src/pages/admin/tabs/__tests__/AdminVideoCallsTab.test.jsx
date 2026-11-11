import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { AdminVideoCallsTab } from '../AdminVideoCallsTab';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AdminVideoCallsTab (WF-04 Call Monitoring & Video Tab)', () => {
  const componentPath = path.resolve(__dirname, '../AdminVideoCallsTab.jsx');
  const componentContent = fs.readFileSync(componentPath, 'utf8');

  it('exports AdminVideoCallsTab as a functional component', () => {
    expect(typeof AdminVideoCallsTab).toBe('function');
  });

  it('guarantees no emoji characters in AdminVideoCallsTab', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(componentContent)).toBe(false);
  });

  it('verifies 4 core metrics cards: total_calls, ready_recordings, saving_recordings, failed_recordings', () => {
    expect(componentContent).toContain('metrics.total_calls');
    expect(componentContent).toContain('metrics.ready_recordings');
    expect(componentContent).toContain('metrics.saving_recordings');
    expect(componentContent).toContain('metrics.failed_recordings');
    expect(componentContent).toContain('Tổng cuộc gọi');
    expect(componentContent).toContain('Có thể xem');
    expect(componentContent).toContain('Đang lưu ngầm');
    expect(componentContent).toContain('Lưu thất bại');
  });

  it('verifies date filters, status filter, and search inputs', () => {
    expect(componentContent).toContain('setStartDate');
    expect(componentContent).toContain('setEndDate');
    expect(componentContent).toContain('setRecordingStatusFilter');
    expect(componentContent).toContain('setSearchTerm');
    expect(componentContent).toContain('Tất cả trạng thái');
  });

  it('verifies video player modal with autoPlay and external link', () => {
    expect(componentContent).toContain('playingVideo');
    expect(componentContent).toContain('<video');
    expect(componentContent).toContain('playingVideo.recording_url');
    expect(componentContent).toContain('Mở file gốc');
  });

  it('verifies Cloudinary sync button and handler', () => {
    expect(componentContent).toContain('handleSyncCloudinary');
    expect(componentContent).toContain('syncCloudinaryRecordings');
    expect(componentContent).toContain('Đồng bộ Cloudinary');
  });
});
