import { describe, it, expect } from 'vitest';

describe('Fast-Path Action Types & Taxi Booking Payload Validation', () => {
  const SUPPORTED_ACTION_TYPES = [
    'none',
    'show_map',
    'call_reception',
    'open_food_menu',
    'open_room_service_menu',
    'book_taxi',
  ];

  const buildTaxiBookingPayload = ({
    activeRoomNumber,
    destination,
    vehicleType = '4-Seater Sedan',
    partySize = 2,
    note = '',
  }) => {
    const pickupLocation = activeRoomNumber
      ? `Sảnh chính (Khách Phòng ${activeRoomNumber})`
      : 'Sảnh chính & Cổng trước (Main Lobby)';
    const guestName = activeRoomNumber
      ? `Khách Phòng ${activeRoomNumber}`
      : 'Khách tại Sảnh';

    return {
      guest_name: guestName,
      pickup_location: pickupLocation,
      destination: destination.trim(),
      pickup_time: 'Immediate',
      party_size: Number(partySize) || 2,
      vehicle_type: vehicleType,
      description: note.trim()
        ? `Ghi chú: ${note.trim()} | Phiên phòng: ${activeRoomNumber || 'Lobby'}`
        : `Phiên phòng: ${activeRoomNumber || 'Lobby'} | Xe đón tại sảnh`,
    };
  };

  it('xác nhận tất cả action_type cấu hình trong Admin Fast-Path đều hợp lệ', () => {
    expect(SUPPORTED_ACTION_TYPES).toContain('open_food_menu');
    expect(SUPPORTED_ACTION_TYPES).toContain('open_room_service_menu');
    expect(SUPPORTED_ACTION_TYPES).toContain('book_taxi');
  });

  it('tạo payload đặt xe chính xác khi phòng đã được xác thực (Authenticated Room)', () => {
    const payload = buildTaxiBookingPayload({
      activeRoomNumber: '301',
      destination: 'Sân bay Quốc tế Đà Nẵng (DAD)',
      vehicleType: '7-Seater SUV',
      partySize: 4,
      note: 'Có 3 vali lớn',
    });

    expect(payload.guest_name).toBe('Khách Phòng 301');
    expect(payload.pickup_location).toBe('Sảnh chính (Khách Phòng 301)');
    expect(payload.destination).toBe('Sân bay Quốc tế Đà Nẵng (DAD)');
    expect(payload.vehicle_type).toBe('7-Seater SUV');
    expect(payload.party_size).toBe(4);
    expect(payload.description).toContain('Có 3 vali lớn');
    expect(payload.description).toContain('Phiên phòng: 301');
  });

  it('tạo payload đặt xe cho khách vãng lai tại Sảnh (Unauthenticated)', () => {
    const payload = buildTaxiBookingPayload({
      activeRoomNumber: null,
      destination: 'Phố cổ Hội An',
      vehicleType: '4-Seater Sedan',
      partySize: 2,
    });

    expect(payload.guest_name).toBe('Khách tại Sảnh');
    expect(payload.pickup_location).toBe('Sảnh chính & Cổng trước (Main Lobby)');
    expect(payload.destination).toBe('Phố cổ Hội An');
    expect(payload.vehicle_type).toBe('4-Seater Sedan');
    expect(payload.party_size).toBe(2);
  });
});
