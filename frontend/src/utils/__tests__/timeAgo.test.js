import { describe, it, expect } from 'vitest';
import { formatTimeAgo } from '../timeAgo';

describe('formatTimeAgo utility', () => {
  it('returns fallback or "Vừa đặt" for null, undefined, or empty values', () => {
    expect(formatTimeAgo(null)).toBe('Vừa đặt');
    expect(formatTimeAgo(undefined, 'Chưa xác định')).toBe('Chưa xác định');
    expect(formatTimeAgo('', 'Vừa xong')).toBe('Vừa xong');
  });

  it('preserves existing relative strings', () => {
    expect(formatTimeAgo('4 mins ago')).toBe('4 mins ago');
    expect(formatTimeAgo('5 phút trước')).toBe('5 phút trước');
    expect(formatTimeAgo('Vừa đặt')).toBe('Vừa đặt');
    expect(formatTimeAgo('Just now')).toBe('Just now');
  });

  it('formats recent timestamps as "Vừa đặt" or "Just now"', () => {
    const now = new Date();
    expect(formatTimeAgo(now.toISOString(), 'Vừa đặt', 'vi')).toBe('Vừa đặt');
    expect(formatTimeAgo(now.toISOString(), 'Just now', 'en')).toBe('Just now');
  });

  it('correctly calculates minutes ago for timestamps within 1 hour', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatTimeAgo(fiveMinutesAgo.toISOString(), 'Vừa đặt', 'vi')).toBe('5 phút trước');
    expect(formatTimeAgo(fiveMinutesAgo.toISOString(), 'Just now', 'en')).toBe('5 mins ago');

    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
    expect(formatTimeAgo(oneMinuteAgo.toISOString(), 'Vừa đặt', 'vi')).toBe('1 phút trước');
    expect(formatTimeAgo(oneMinuteAgo.toISOString(), 'Just now', 'en')).toBe('1 min ago');
  });

  it('correctly calculates hours ago for timestamps within 24 hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatTimeAgo(twoHoursAgo.toISOString(), 'Vừa đặt', 'vi')).toBe('2 giờ trước');
    expect(formatTimeAgo(twoHoursAgo.toISOString(), 'Just now', 'en')).toBe('2 hours ago');
  });

  it('safely handles naive ISO strings by appending UTC Z', () => {
    const dateUtc = new Date(Date.now() - 10 * 60 * 1000);
    const naiveIso = dateUtc.toISOString().replace('Z', '');
    expect(formatTimeAgo(naiveIso, 'Vừa đặt', 'vi')).toBe('10 phút trước');
  });
});
