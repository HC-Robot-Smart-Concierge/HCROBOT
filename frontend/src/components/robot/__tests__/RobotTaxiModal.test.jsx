import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import {
  AUTO_CLOSE_SECONDS,
  POPULAR_DESTINATIONS,
  TAXI_PARTNERS,
  isDismissVoiceIntent,
  isSelfBookingVoiceIntent,
  isConciergeVoiceIntent,
  buildTaxiBookingPayload,
} from '../RobotTaxiModal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RobotTaxiModal Component & Logic Tests', () => {
  it('cấu hình thời gian tự tắt màn hình danh bạ taxi chính xác là 45 giây', () => {
    expect(AUTO_CLOSE_SECONDS).toBe(45);
  });

  it('danh sách đối tác taxi Đà Nẵng đầy đủ 4 hãng uy tín kèm số hotline chính xác', () => {
    expect(TAXI_PARTNERS.length).toBeGreaterThanOrEqual(4);

    const maiLinh = TAXI_PARTNERS.find((p) => p.id === 'mailinh');
    expect(maiLinh).toBeDefined();
    expect(maiLinh.hotline).toBe('0236 3 56 56 56');
    expect(maiLinh.shortCode).toBe('1055');

    const vinasun = TAXI_PARTNERS.find((p) => p.id === 'vinasun');
    expect(vinasun).toBeDefined();
    expect(vinasun.hotline).toBe('0236 3 68 68 68');

    const tienSa = TAXI_PARTNERS.find((p) => p.id === 'tiensa');
    expect(tienSa).toBeDefined();
    expect(tienSa.hotline).toBe('0236 3 79 79 79');

    const airportTaxi = TAXI_PARTNERS.find((p) => p.id === 'airport_taxi');
    expect(airportTaxi).toBeDefined();
    expect(airportTaxi.hotline).toBe('0236 3 82 82 82');
  });

  it('nhận diện chính xác câu nói tắt màn hình hoặc cảm ơn (isDismissVoiceIntent)', () => {
    expect(isDismissVoiceIntent('cảm ơn em')).toBe(true);
    expect(isDismissVoiceIntent('cam on')).toBe(true);
    expect(isDismissVoiceIntent('tắt đi')).toBe(true);
    expect(isDismissVoiceIntent('tat man hinh')).toBe(true);
    expect(isDismissVoiceIntent('đóng lại')).toBe(true);
    expect(isDismissVoiceIntent('xong rồi')).toBe(true);
    expect(isDismissVoiceIntent('thôi')).toBe(true);
    expect(isDismissVoiceIntent('close')).toBe(true);

    // Không đóng khi hỏi nội dung khác
    expect(isDismissVoiceIntent('gọi cho tôi taxi mai linh')).toBe(false);
    expect(isDismissVoiceIntent('sân bay bao xa')).toBe(false);
  });

  it('nhận diện ý định khách muốn tự đặt xe qua số điện thoại (isSelfBookingVoiceIntent)', () => {
    expect(isSelfBookingVoiceIntent('tôi muốn tự đặt')).toBe(true);
    expect(isSelfBookingVoiceIntent('tự gọi xe')).toBe(true);
    expect(isSelfBookingVoiceIntent('cho tôi số điện thoại taxi')).toBe(true);
    expect(isSelfBookingVoiceIntent('cho so hotline')).toBe(true);
    expect(isSelfBookingVoiceIntent('option 1')).toBe(true);
    expect(isSelfBookingVoiceIntent('lựa chọn một')).toBe(true);

    expect(isSelfBookingVoiceIntent('nhờ khách sạn đặt')).toBe(false);
  });

  it('nhận diện ý định khách muốn nhờ Concierge đặt giùm (isConciergeVoiceIntent)', () => {
    expect(isConciergeVoiceIntent('nhờ đặt giùm')).toBe(true);
    expect(isConciergeVoiceIntent('đặt hộ tôi')).toBe(true);
    expect(isConciergeVoiceIntent('nhờ concierge đặt')).toBe(true);
    expect(isConciergeVoiceIntent('nhân viên đặt giúp')).toBe(true);
    expect(isConciergeVoiceIntent('option 2')).toBe(true);
    expect(isConciergeVoiceIntent('hai')).toBe(true);

    expect(isConciergeVoiceIntent('tôi tự đặt xe')).toBe(false);
  });

  it('tạo payload đặt xe chính xác có gắn số phòng của session hiện tại', () => {
    const payload = buildTaxiBookingPayload({
      activeRoomNumber: '301',
      destination: 'Sân bay Quốc tế Đà Nẵng (DAD)',
      vehicleType: '7-Seater SUV',
      partySize: 4,
      note: 'Có 3 vali lớn',
    });

    expect(payload.room_number).toBe('301');
    expect(payload.guest_name).toBe('Khách Phòng 301');
    expect(payload.pickup_location).toBe('Sảnh chính (Khách Phòng 301)');
    expect(payload.destination).toBe('Sân bay Quốc tế Đà Nẵng (DAD)');
    expect(payload.vehicle_type).toBe('7-Seater SUV');
    expect(payload.party_size).toBe(4);
    expect(payload.description).toContain('Ghi chú: Có 3 vali lớn');
    expect(payload.description).toContain('Phiên phòng: 301');
  });

  it('kiểm tra tính toàn vẹn tích hợp luồng taxi trong RobotScreenPage.jsx', () => {
    const robotScreenPath = path.resolve(__dirname, '../../../pages/robot/RobotScreenPage.jsx');
    const sourceCode = fs.readFileSync(robotScreenPath, 'utf-8');

    // Phải có hàm handleTriggerTaxiBooking
    expect(sourceCode).toContain('handleTriggerTaxiBooking');

    // Phải kiểm tra authenticatedRoom để không hỏi lại PIN nếu đã trong session
    expect(sourceCode).toContain('if (authenticatedRoom)');

    // Phải xử lý pinModalAction cho book_taxi / taxi
    expect(sourceCode).toMatch(/['"]book_taxi['"].*pinModalAction|pinModalAction.*['"]book_taxi['"]/);

    // Phải truyền lastVoiceTranscript={transcript} cho RobotTaxiModal
    expect(sourceCode).toContain('lastVoiceTranscript={transcript}');

    // Phải mở modal taxi với activeRoomNumber từ authenticatedRoom
    expect(sourceCode).toContain('activeRoomNumber={authenticatedRoom || activeRoomNumber}');
  });
});
