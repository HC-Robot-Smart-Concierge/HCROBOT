import { describe, it, expect, vi } from 'vitest';
import {
  handleNumericKeyDown,
  handleNumberInputBlockExponent,
  sanitizeDigitsOnly,
  sanitizePhoneNumber,
} from '../numberInputHelper';

describe('numberInputHelper Utility Tests', () => {
  describe('sanitizeDigitsOnly', () => {
    it('lọc bỏ tất cả ký tự chữ và ký tự đặc biệt, chỉ giữ lại chữ số', () => {
      expect(sanitizeDigitsOnly('079201012345')).toBe('079201012345');
      expect(sanitizeDigitsOnly('ID: 079201012345 (Alex)')).toBe('079201012345');
      expect(sanitizeDigitsOnly('abc-123_456!@#')).toBe('123456');
      expect(sanitizeDigitsOnly('')).toBe('');
      expect(sanitizeDigitsOnly(null)).toBe('');
      expect(sanitizeDigitsOnly(undefined)).toBe('');
    });

    it('cắt độ dài chuỗi theo maxLength nếu được chỉ định', () => {
      expect(sanitizeDigitsOnly('0792010123456789', 12)).toBe('079201012345');
      expect(sanitizeDigitsOnly('12345678', 4)).toBe('1234');
    });
  });

  describe('sanitizePhoneNumber', () => {
    it('lọc số điện thoại giữ lại chữ số và dấu cộng ở đầu nếu có', () => {
      expect(sanitizePhoneNumber('0901234567')).toBe('0901234567');
      expect(sanitizePhoneNumber('+84 901 234 567')).toBe('+84901234567');
      expect(sanitizePhoneNumber('Phone: 090-123-4567')).toBe('0901234567');
      expect(sanitizePhoneNumber('')).toBe('');
    });

    it('giới hạn độ dài tối đa cho số điện thoại', () => {
      expect(sanitizePhoneNumber('0901234567890123456', 10)).toBe('0901234567');
    });
  });

  describe('handleNumericKeyDown', () => {
    it('cho phép gõ chữ số 0 đến 9', () => {
      for (let i = 0; i <= 9; i++) {
        const preventDefault = vi.fn();
        handleNumericKeyDown({
          key: String(i),
          preventDefault,
          ctrlKey: false,
          metaKey: false,
        });
        expect(preventDefault).not.toHaveBeenCalled();
      }
    });

    it('chặn các ký tự chữ cái và ký tự đặc biệt', () => {
      const invalidKeys = ['a', 'b', 'Z', ' ', '@', '#', '-', '/', 'e', 'E'];
      for (const k of invalidKeys) {
        const preventDefault = vi.fn();
        handleNumericKeyDown({
          key: k,
          preventDefault,
          ctrlKey: false,
          metaKey: false,
        });
        expect(preventDefault).toHaveBeenCalled();
      }
    });

    it('cho phép các phím điều khiển (Backspace, Delete, ArrowLeft, Enter, v.v.)', () => {
      const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'];
      for (const k of allowedKeys) {
        const preventDefault = vi.fn();
        handleNumericKeyDown({
          key: k,
          preventDefault,
          ctrlKey: false,
          metaKey: false,
        });
        expect(preventDefault).not.toHaveBeenCalled();
      }
    });

    it('cho phép các tổ hợp phím tắt Ctrl/Cmd (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X)', () => {
      const preventDefault = vi.fn();
      handleNumericKeyDown({
        key: 'c',
        preventDefault,
        ctrlKey: true,
        metaKey: false,
      });
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('cho phép dấu cộng ở vị trí đầu nếu cấu hình allowPlus = true', () => {
      const preventDefault = vi.fn();
      handleNumericKeyDown(
        {
          key: '+',
          preventDefault,
          ctrlKey: false,
          metaKey: false,
          currentTarget: { value: '', selectionStart: 0 },
        },
        { allowPlus: true }
      );
      expect(preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('handleNumberInputBlockExponent', () => {
    it('chặn các phím e, E, +, - trên input type="number"', () => {
      const blocked = ['e', 'E', '+', '-'];
      for (const k of blocked) {
        const preventDefault = vi.fn();
        handleNumberInputBlockExponent({
          key: k,
          preventDefault,
        });
        expect(preventDefault).toHaveBeenCalled();
      }
    });

    it('chặn dấu chấm nếu allowDecimal = false', () => {
      const preventDefault = vi.fn();
      handleNumberInputBlockExponent(
        {
          key: '.',
          preventDefault,
        },
        { allowDecimal: false }
      );
      expect(preventDefault).toHaveBeenCalled();
    });
  });
});

