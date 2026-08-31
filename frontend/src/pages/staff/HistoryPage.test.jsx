import { describe, it, expect } from 'vitest';

describe('History Page Conversation Rating Logic', () => {
  const sampleConversations = [
    { id: 'SESS-1', rating: 5.0, room: 'Room 402' },
    { id: 'SESS-2', rating: 4.0, room: 'Suite 501' },
    { id: 'SESS-3', rating: 3.0, room: 'Room 502' },
  ];

  it('should calculate average rating correctly', () => {
    const sum = sampleConversations.reduce((acc, curr) => acc + curr.rating, 0);
    const avg = (sum / sampleConversations.length).toFixed(1);
    expect(avg).toBe('4.0');
  });

  it('should filter 5-star ratings correctly', () => {
    const fiveStar = sampleConversations.filter(c => c.rating >= 5.0);
    expect(fiveStar).toHaveLength(1);
    expect(fiveStar[0].id).toBe('SESS-1');
  });
});
