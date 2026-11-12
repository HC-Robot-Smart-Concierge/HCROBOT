import { describe, it, expect } from 'vitest';
import { isValidHotelRoom, VALID_HOTEL_ROOMS, extractSpokenRoomNumber } from '../../../utils/roomHelper';
import { detectDestinationPoi } from '../FloorMap';

describe('Room Existence Validation & Session Guard Tests', () => {
  it('should have exactly 20 valid rooms in the hotel', () => {
    expect(VALID_HOTEL_ROOMS.size).toBe(20);
  });

  it('should validate all 20 existing hotel rooms (301-310 and 401-410)', () => {
    for (let r = 301; r <= 310; r++) {
      expect(isValidHotelRoom(String(r))).toBe(true);
      expect(isValidHotelRoom(r)).toBe(true);
    }
    for (let r = 401; r <= 410; r++) {
      expect(isValidHotelRoom(String(r))).toBe(true);
      expect(isValidHotelRoom(r)).toBe(true);
    }
  });

  it('should reject non-existent hotel rooms', () => {
    const invalidRooms = ['101', '201', '202', '300', '311', '400', '411', '501', '601', '701', '801', '999', '0', '', null, undefined];
    invalidRooms.forEach((room) => {
      expect(isValidHotelRoom(room)).toBe(false);
    });
  });

  describe('detectDestinationPoi with Room Existence Guard', () => {
    it('should resolve destination key for valid rooms 301-310 and 401-410', () => {
      expect(detectDestinationPoi('chỉ đường đến phòng 301', null)).toBe('room_301');
      expect(detectDestinationPoi('phòng 310 ở đâu', null)).toBe('room_310');
      expect(detectDestinationPoi('chỉ đường đến phòng 402', null)).toBe('room_402');
      expect(detectDestinationPoi('phòng 410 ở đâu', null)).toBe('room_410');
    });

    it('should return null (no map route) for non-existent rooms', () => {
      expect(detectDestinationPoi('chỉ đường đến phòng 501', null)).toBeNull();
      expect(detectDestinationPoi('phòng 501 ở đâu', null)).toBeNull();
      expect(detectDestinationPoi('đường lên phòng 202', null)).toBeNull();
      expect(detectDestinationPoi('phòng 999 ở đâu', null)).toBeNull();
      expect(detectDestinationPoi('thông tin phòng 101', null)).toBeNull();
    });
  });

  describe('Spoken Room Session Guard', () => {
    it('should extract room number and allow session save only for valid rooms', () => {
      const validQuery = 'tôi ở phòng 305';
      const extracted = extractSpokenRoomNumber(validQuery);
      expect(extracted).toBe('305');
      expect(isValidHotelRoom(extracted)).toBe(true);
    });

    it('should identify non-existent room from spoken query and prevent session save', () => {
      const invalidQuery = 'chỉ đường đến phòng 501';
      const extracted = extractSpokenRoomNumber(invalidQuery);
      expect(extracted).toBe('501');
      // Session save guard: must not be saved
      expect(isValidHotelRoom(extracted)).toBe(false);
    });
  });
});

