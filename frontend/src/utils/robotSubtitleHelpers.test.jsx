import { describe, it, expect } from 'vitest';
import { formatGuestPrompt, formatGuestLiveSpeech, splitSubtitleSentences } from './robotSubtitleHelpers';

describe('robotSubtitleHelpers', () => {
  describe('formatGuestPrompt', () => {
    it('returns null for null, undefined, or empty prompts', () => {
      expect(formatGuestPrompt(null)).toBeNull();
      expect(formatGuestPrompt('')).toBeNull();
      expect(formatGuestPrompt('   ')).toBeNull();
    });

    it('formats Vietnamese guest prompt correctly', () => {
      const res = formatGuestPrompt('Hồ bơi ở đâu vậy?', 'Tiếng Việt');
      expect(res).toEqual({
        label: 'Khách hỏi:',
        prompt: '"Hồ bơi ở đâu vậy?"',
        fullText: 'Khách hỏi: "Hồ bơi ở đâu vậy?"',
      });
    });

    it('formats English guest prompt correctly', () => {
      const res = formatGuestPrompt('Where is the swimming pool?', 'English');
      expect(res).toEqual({
        label: 'Guest:',
        prompt: '"Where is the swimming pool?"',
        fullText: 'Guest: "Where is the swimming pool?"',
      });
    });
  });

  describe('formatGuestLiveSpeech', () => {
    it('returns placeholder when transcript is empty', () => {
      const viRes = formatGuestLiveSpeech('', 'Tiếng Việt');
      expect(viRes).toEqual({
        label: 'Khách đang nói:',
        text: 'Rora đang lắng nghe quý khách...',
        hasContent: false,
      });

      const enRes = formatGuestLiveSpeech(null, 'English');
      expect(enRes).toEqual({
        label: 'Guest speaking:',
        text: 'Listening to you... Speak now',
        hasContent: false,
      });
    });

    it('formats live speech with quotes when transcript has text', () => {
      const viRes = formatGuestLiveSpeech('Cho tôi xem thực đơn', 'Tiếng Việt');
      expect(viRes).toEqual({
        label: 'Khách đang nói:',
        text: '"Cho tôi xem thực đơn"',
        hasContent: true,
      });

      const enRes = formatGuestLiveSpeech('Show me the menu', 'English');
      expect(enRes).toEqual({
        label: 'Guest speaking:',
        text: '"Show me the menu"',
        hasContent: true,
      });
    });
  });

  describe('splitSubtitleSentences', () => {
    it('returns empty array when text is empty', () => {
      expect(splitSubtitleSentences('')).toEqual([]);
      expect(splitSubtitleSentences(null)).toEqual([]);
    });

    it('splits multiple sentences by punctuation or newlines', () => {
      const text = 'Xin chào quý khách! Em là Rora. Em có thể giúp gì cho quý khách?';
      const sentences = splitSubtitleSentences(text);
      expect(sentences).toEqual([
        'Xin chào quý khách!',
        'Em là Rora.',
        'Em có thể giúp gì cho quý khách?',
      ]);
    });

    it('keeps single sentence intact', () => {
      const text = 'Hồ bơi nằm ở tầng 5 của khách sạn ạ';
      const sentences = splitSubtitleSentences(text);
      expect(sentences).toEqual(['Hồ bơi nằm ở tầng 5 của khách sạn ạ']);
    });
  });
});
