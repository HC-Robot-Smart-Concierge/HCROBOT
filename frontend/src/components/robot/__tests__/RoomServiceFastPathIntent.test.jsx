import { describe, it, expect } from 'vitest';

describe('Room Service Intent Detection (Fast-Path Conflict Fix)', () => {
  const checkIsRoomServiceIntent = (query) => {
    const lowerQuery = query.toLowerCase().trim();
    const isStatusQueryPrompt = /tiến độ|trạng thái|xong chưa|nấu xong|làm xong|dọn xong|dọn tới|dọn đến|dọn phòng|nấu tới|làm tới|khi nào có|bao giờ có|tới đâu|đến đâu|kiểm tra đơn|kiểm tra món|tình trạng món|tình trạng dọn|tiến độ dọn|khăn tắm mang lên|mang lên chưa|giao chưa|tình trạng dịch vụ|tiến độ dịch vụ/i.test(lowerQuery);

    const isExplicitRoomServiceIntent = !isStatusQueryPrompt && (
      /^(mở |xem )?(dịch vụ phòng|room service)$/i.test(lowerQuery) ||
      /dịch vụ phòng|room service/i.test(lowerQuery) ||
      /(cho (tôi|mình|em)|xin|lấy|mang|đem|gửi|thêm|mượn|cần|muốn|đặt|yêu cầu).*(khăn|gối|chăn|nệm|dép|bàn chải|dao cạo|dầu gội|sữa tắm|nước|massage|mát xa|giặt|ủi|dọn|vệ sinh|bàn là|bàn ủi|máy sấy|áo choàng)/i.test(lowerQuery) ||
      /(khăn tắm|thêm khăn|khăn mặt|bộ khăn|massage tại phòng|mát xa tại phòng|giặt ủi|ủi đồ|dọn phòng giúp|vệ sinh phòng|mượn bàn là|mượn bàn ủi)/i.test(lowerQuery)
    );

    return { isStatusQueryPrompt, isExplicitRoomServiceIntent };
  };

  it('phát hiện chính xác yêu cầu "cho tôi khăn tắm" và mở menu dịch vụ phòng', () => {
    const res = checkIsRoomServiceIntent('cho tôi khăn tắm');
    expect(res.isStatusQueryPrompt).toBe(false);
    expect(res.isExplicitRoomServiceIntent).toBe(true);
  });

  it('phát hiện các biến thể yêu cầu đồ dùng buồng phòng khác', () => {
    const testCases = [
      'lấy cho tôi khăn tắm',
      'cho xin thêm khăn',
      'thêm khăn tắm',
      'cần khăn tắm',
      'mang khăn tắm lên phòng',
      'đặt massage tại phòng',
      'cho em mượn bàn là',
      'cần giặt ủi',
    ];
    for (const q of testCases) {
      const res = checkIsRoomServiceIntent(q);
      expect(res.isExplicitRoomServiceIntent).toBe(true);
    }
  });

  it('không mở menu dịch vụ phòng khi khách hỏi tiến độ / trạng thái', () => {
    const statusCases = [
      'khăn tắm mang lên chưa',
      'tiến độ dọn phòng tới đâu rồi',
      'kiểm tra trạng thái dịch vụ phòng',
      'tình trạng dịch vụ thế nào',
    ];
    for (const q of statusCases) {
      const res = checkIsRoomServiceIntent(q);
      expect(res.isStatusQueryPrompt).toBe(true);
      expect(res.isExplicitRoomServiceIntent).toBe(false);
    }
  });
});
