import { submitFeedbackStrict } from '../services/aiApi';

const FEEDBACK_CONTENT_KEYS = new Set(['UI_RATING', 'FEEDBACK']);

export function isFeedbackWorkflowStep(step) {
  if (!step) return false;
  if (step.type === 'FEEDBACK') return true;
  if (step.type === 'SHOW') {
    const params = step.params || {};
    return [params.content_id, params.screen_mode, params.screen_type]
      .map((val) => String(val || '').toUpperCase().trim())
      .some((key) => FEEDBACK_CONTENT_KEYS.has(key));
  }
  return false;
}

export async function submitWorkflowFeedback({
  step,
  rating,
  comment = '',
  sessionId = null,
  roomNumber = null,
}) {
  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new Error('Invalid feedback rating');
  }
  const cleanRoom = roomNumber ? String(roomNumber).trim() : '';
  const cleanComment = comment ? String(comment).trim() : '';
  const params = step?.params || {};

  return submitFeedbackStrict({
    chat_session_id: sessionId || undefined,
    rating: numericRating,
    category: params.category || 'Robot Concierge',
    comment: cleanComment || undefined,
    guest_name: cleanRoom ? `Khách Phòng ${cleanRoom}` : 'Khách tại Kiosk',
    room_number: cleanRoom || undefined,
  });
}
