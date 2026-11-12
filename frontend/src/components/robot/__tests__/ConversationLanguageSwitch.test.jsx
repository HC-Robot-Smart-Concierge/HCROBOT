import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Conversation Voice Language Switching Tests', () => {
  const robotScreenPath = path.resolve(__dirname, '../../../pages/robot/RobotScreenPage.jsx');
  const robotScreenContent = fs.readFileSync(robotScreenPath, 'utf8');

  const useSpeechPath = path.resolve(__dirname, '../../../hooks/useSpeechRecognition.js');
  const useSpeechContent = fs.readFileSync(useSpeechPath, 'utf8');

  it('guarantees no emoji characters in modified frontend files', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(robotScreenContent)).toBe(false);
    expect(emojiRegex.test(useSpeechContent)).toBe(false);
  });

  it('maintains language state and languageRef synchronization in RobotScreenPage', () => {
    expect(robotScreenContent).toContain("const [language, setLanguage] = useState('Tiếng Việt')");
    expect(robotScreenContent).toContain("const languageRef = useRef('Tiếng Việt')");
    expect(robotScreenContent).toContain('languageRef.current = language');
  });

  it('updates both language state and languageRef upon toggleLanguage call', () => {
    expect(robotScreenContent).toContain('const toggleLanguage = useCallback((targetLang) => {');
    expect(robotScreenContent).toContain('languageRef.current = targetLang');
    expect(robotScreenContent).toContain('setLanguage(targetLang)');
    expect(robotScreenContent).toContain("languageRef.current === 'English' ? 'Tiếng Việt' : 'English'");
  });

  it('uses latest languageRef when restarting speech listening in handleStartTalk', () => {
    expect(robotScreenContent).toContain('startListening(languageRef.current || language');
  });

  it('updates languageRef and language upon receiving detected_language from AI response', () => {
    expect(robotScreenContent).toContain('setLanguage(detectedLang)');
    expect(robotScreenContent).toContain('languageRef.current = detectedLang');
  });

  it('re-initializes speech recognition with target language tag in useSpeechRecognition', () => {
    expect(useSpeechContent).toContain("const isEn = typeof language === 'string' && (language.toLowerCase().includes('en') || language.toLowerCase() === 'english')");
    expect(useSpeechContent).toContain("const targetLang = isEn ? 'en-US' : 'vi-VN'");
    expect(useSpeechContent).toContain('recognitionRef.current.lang = targetLang');
    expect(useSpeechContent).toContain('if (liveRef.current && langChanged)');
  });
});

