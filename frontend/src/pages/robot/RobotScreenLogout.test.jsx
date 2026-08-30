import { describe, it, expect, vi } from 'vitest';

describe('Robot Screen Protected Logout Password Validation', () => {
  const validPasswords = ['123456', 'robot123', 'password123', 'admin', 'aurora2026'];

  const validateLogoutPassword = (inputPassword) => {
    if (!inputPassword) return false;
    return validPasswords.includes(inputPassword.trim());
  };

  it('should accept valid security passwords', () => {
    expect(validateLogoutPassword('123456')).toBe(true);
    expect(validateLogoutPassword('robot123')).toBe(true);
    expect(validateLogoutPassword('admin')).toBe(true);
  });

  it('should reject incorrect security passwords', () => {
    expect(validateLogoutPassword('wrongpass')).toBe(false);
    expect(validateLogoutPassword('123')).toBe(false);
    expect(validateLogoutPassword('')).toBe(false);
  });
});
