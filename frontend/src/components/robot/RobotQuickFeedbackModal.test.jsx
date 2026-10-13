import { describe, it, expect } from 'vitest';

describe('RobotQuickFeedbackModal Stars-Only Logic', () => {
  const buildFeedbackPayload = ({
    sessionId,
    rating,
    roomNumber,
    guestName,
  }) => ({
    chat_session_id: sessionId || undefined,
    rating,
    category: 'Robot Concierge',
    room_number: roomNumber || undefined,
    guest_name: guestName || undefined,
  });

  const isServiceRecoveryNeeded = (rating) => rating <= 3;

  it('correctly constructs feedback payload with pure star rating', () => {
    const payload = buildFeedbackPayload({
      sessionId: 'sess_123',
      rating: 5,
      roomNumber: '402',
      guestName: 'Khách tại Kiosk',
    });

    expect(payload.chat_session_id).toBe('sess_123');
    expect(payload.rating).toBe(5);
    expect(payload.category).toBe('Robot Concierge');
    expect(payload.room_number).toBe('402');
  });

  it('determines rating <= 3 flags service recovery alert for concierge', () => {
    expect(isServiceRecoveryNeeded(5)).toBe(false);
    expect(isServiceRecoveryNeeded(4)).toBe(false);
    expect(isServiceRecoveryNeeded(3)).toBe(true);
    expect(isServiceRecoveryNeeded(2)).toBe(true);
    expect(isServiceRecoveryNeeded(1)).toBe(true);
  });
});
