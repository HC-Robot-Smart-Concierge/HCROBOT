import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import {
  AUTO_CLOSE_SECONDS,
  CONFIRMED_AUTO_CLOSE_SECONDS,
  POPULAR_DESTINATIONS,
  TAXI_PARTNERS,
  isDismissVoiceIntent,
  isSelfBookingVoiceIntent,
  isConciergeVoiceIntent,
  isConfirmVoiceIntent,
  isEditVoiceIntent,
  extractDestinationFromVoice,
  extractVehicleAndPartyFromVoice,
  buildTaxiBookingPayload,
} from '../RobotTaxiModal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RobotTaxiModal Component & Logic Tests', () => {
  it('cấu hình thời gian tự tắt màn hình danh bạ taxi chính xác là 45 giây và màn hình hoàn tất đặt xe là 5 giây', () => {
    expect(AUTO_CLOSE_SECONDS).toBe(45);
    expect(CONFIRMED_AUTO_CLOSE_SECONDS).toBe(5);
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
    expect(isDismissVoiceIntent('cám ơn')).toBe(true);
    expect(isDismissVoiceIntent('cam on')).toBe(true);
    expect(isDismissVoiceIntent('thank you')).toBe(true);
    expect(isDismissVoiceIntent('tắt đi')).toBe(true);
    expect(isDismissVoiceIntent('tat man hinh')).toBe(true);
    expect(isDismissVoiceIntent('đóng lại')).toBe(true);
    expect(isDismissVoiceIntent('xong rồi')).toBe(true);
    expect(isDismissVoiceIntent('được rồi')).toBe(true);
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

  it('nhận diện ý định khách xác nhận thông tin đúng (isConfirmVoiceIntent)', () => {
    expect(isConfirmVoiceIntent('đúng rồi')).toBe(true);
    expect(isConfirmVoiceIntent('chính xác')).toBe(true);
    expect(isConfirmVoiceIntent('xác nhận')).toBe(true);
    expect(isConfirmVoiceIntent('gửi đi')).toBe(true);
    expect(isConfirmVoiceIntent('ok')).toBe(true);
    expect(isConfirmVoiceIntent('chuẩn rồi em')).toBe(true);
    expect(isConfirmVoiceIntent('gửi yêu cầu')).toBe(true);

    expect(isConfirmVoiceIntent('chưa đúng')).toBe(false);
    expect(isConfirmVoiceIntent('sai rồi')).toBe(false);
  });

  it('nhận diện ý định khách muốn chỉnh sửa lại thông tin (isEditVoiceIntent)', () => {
    expect(isEditVoiceIntent('chưa đúng')).toBe(true);
    expect(isEditVoiceIntent('sai rồi')).toBe(true);
    expect(isEditVoiceIntent('sửa lại')).toBe(true);
    expect(isEditVoiceIntent('thay đổi thông tin')).toBe(true);
    expect(isEditVoiceIntent('chọn lại')).toBe(true);

    expect(isEditVoiceIntent('đúng rồi')).toBe(false);
    expect(isEditVoiceIntent('xác nhận')).toBe(false);
  });

  it('trích xuất điểm đến chuẩn xác từ giọng nói khách (extractDestinationFromVoice)', () => {
    expect(extractDestinationFromVoice('tôi muốn đi Sân bay')).toBe('Sân bay Quốc tế Đà Nẵng (DAD)');
    expect(extractDestinationFromVoice('cho tôi đi Hội An')).toBe('Phố cổ Hội An');
    expect(extractDestinationFromVoice('đi Bà Nà')).toBe('Bà Nà Hills & Cầu Vàng');
    expect(extractDestinationFromVoice('đến Bán đảo Sơn Trà')).toBe('Bán đảo Sơn Trà & Chùa Linh Ứng');
    expect(extractDestinationFromVoice('ra Bãi biển Mỹ Khê')).toBe('Bãi biển Mỹ Khê');
    expect(extractDestinationFromVoice('đi Cầu Rồng')).toBe('Cầu Rồng Đà Nẵng');
    expect(extractDestinationFromVoice('đi Vinpearl Resort')).toBe('Vinpearl Resort');
  });

  it('trích xuất loại xe và số lượng khách từ giọng nói (extractVehicleAndPartyFromVoice)', () => {
    const res1 = extractVehicleAndPartyFromVoice('xe 4 chỗ 2 người');
    expect(res1?.vehicleType).toBe('4-Seater Sedan');
    expect(res1?.partySize).toBe(2);

    const res2 = extractVehicleAndPartyFromVoice('tôi muốn xe 7 chỗ 4 khách');
    expect(res2?.vehicleType).toBe('7-Seater SUV');
    expect(res2?.partySize).toBe(4);

    const res3 = extractVehicleAndPartyFromVoice('đi 5 người');
    expect(res3?.partySize).toBe(5);
    expect(res3?.vehicleType).toBe('7-Seater SUV');
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

    // Phải truyền lastVoiceTranscript cho RobotTaxiModal
    expect(sourceCode).toContain('lastVoiceTranscript={taxiVoiceInput || transcript}');

    // Phải có callback handleSelectTaxiSelfBooking và handleSelectTaxiConciergeBooking
    expect(sourceCode).toContain('handleSelectTaxiSelfBooking');
    expect(sourceCode).toContain('handleSelectTaxiConciergeBooking');

    // Phải mở modal taxi với activeRoomNumber từ authenticatedRoom
    expect(sourceCode).toContain('activeRoomNumber={authenticatedRoom || activeRoomNumber}');

    // Phải có handleCloseTaxiModal để đóng modal và quay về màn hình robot khi khách nói cảm ơn
    expect(sourceCode).toContain('handleCloseTaxiModal');
    expect(sourceCode).toContain('onClose={handleCloseTaxiModal}');

    // Giao diện RobotTaxiModal không hiển thị "(Nói hoặc bấm chọn)" và không hiển thị mục "3. Số khách"
    const modalPath = path.resolve(__dirname, '../RobotTaxiModal.jsx');
    const modalSource = fs.readFileSync(modalPath, 'utf-8');
    expect(modalSource).not.toContain('(Nói hoặc bấm chọn)');
    expect(modalSource).not.toContain('3. Số khách');
  });
});
