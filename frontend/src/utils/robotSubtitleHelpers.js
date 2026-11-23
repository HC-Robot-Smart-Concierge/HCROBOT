/**
 * Utility helpers for robot subtitles and guest question display.
 */

export const formatGuestPrompt = (userPrompt, language = 'Tiếng Việt') => {
  if (!userPrompt || typeof userPrompt !== 'string') return null;
  const trimmed = userPrompt.trim();
  if (!trimmed) return null;
  const isEn = language === 'English';
  return {
    label: isEn ? 'Guest:' : 'Khách hỏi:',
    prompt: `"${trimmed}"`,
    fullText: `${isEn ? 'Guest:' : 'Khách hỏi:'} "${trimmed}"`,
  };
};

export const splitSubtitleSentences = (text) => {
  if (!text) return [];
  const raw = String(text).trim();
  if (!raw) return [];
  const split = raw
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return split.length > 0 ? split : [raw];
};
