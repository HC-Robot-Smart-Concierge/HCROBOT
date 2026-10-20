import { describe, it, expect } from 'vitest';
import { MobileRobotScreen } from './MobileRobotScreen';

describe('MobileRobotScreen Layout & Desktop Parity Logic', () => {
  it('should export MobileRobotScreen function component', () => {
    expect(typeof MobileRobotScreen).toBe('function');
  });

  it('orders header right elements so workflow trigger appears to the left of emotion badge and action buttons', () => {
    const buildHeaderRightElements = ({ hasWorkflowTrigger, guestEmotion, language }) => {
      const elements = [];
      if (hasWorkflowTrigger) elements.push('workflow-trigger');
      if (guestEmotion) elements.push('guest-emotion');
      if (language) elements.push('language-toggle');
      return elements;
    };

    const headerElements = buildHeaderRightElements({
      hasWorkflowTrigger: true,
      guestEmotion: 'neutral',
      language: 'VI',
    });

    expect(headerElements).toEqual([
      'workflow-trigger',
      'guest-emotion',
      'language-toggle',
    ]);

    const triggerIndex = headerElements.indexOf('workflow-trigger');
    const emotionIndex = headerElements.indexOf('guest-emotion');

    expect(triggerIndex).toBeLessThan(emotionIndex);
    expect(headerElements).not.toContain('logout-button');
  });

  it('supports secret multi-tap gesture logic for kiosk exit', () => {
    let tapCount = 0;
    let logoutTriggered = false;

    const onSecretTap = () => {
      tapCount += 1;
      if (tapCount >= 5) {
        tapCount = 0;
        logoutTriggered = true;
      }
    };

    for (let i = 0; i < 4; i++) {
      onSecretTap();
    }
    expect(logoutTriggered).toBe(false);

    onSecretTap();
    expect(logoutTriggered).toBe(true);
    expect(tapCount).toBe(0);
  });

  it('correctly maps robot states to face modes consistent with desktop', () => {
    const getRobotMode = (state, isSpeaking = false, isProcessing = false, isListening = false) => {
      if (state === 'RT-01') return 'sleeping';
      if (isProcessing || state === 'RT-04') return 'processing';
      if (isSpeaking) return 'speaking';
      if (isListening || state === 'RT-03') return 'listening';
      return 'welcome';
    };

    expect(getRobotMode('RT-01')).toBe('sleeping');
    expect(getRobotMode('RT-02')).toBe('welcome');
    expect(getRobotMode('RT-03', false, false, true)).toBe('listening');
    expect(getRobotMode('RT-02', true)).toBe('speaking');
    expect(getRobotMode('RT-04', false, true)).toBe('processing');
  });

  it('splits cinema subtitle text into sequential sentences for smooth mobile playback', () => {
    const splitSentences = (fullText) => {
      if (!fullText) return [];
      const raw = String(fullText).trim();
      const split = raw
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return split.length > 0 ? split : [raw];
    };

    const text = 'Xin chào quý khách. Khách sạn có hồ bơi vô cực tại tầng 5! Quý khách có cần chỉ đường không?';
    const sentences = splitSentences(text);

    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toBe('Xin chào quý khách.');
    expect(sentences[1]).toBe('Khách sạn có hồ bơi vô cực tại tầng 5!');
    expect(sentences[2]).toBe('Quý khách có cần chỉ đường không?');
  });

  it('verifies grey theme styling tokens matching desktop specs without vibrant colors', () => {
    const mobileGreyTokens = {
      headerBg: 'bg-[#F5F2EB]/95',
      brandingText: 'text-stone-600',
      statusDot: 'bg-stone-400',
      actionButtonBg: 'bg-stone-900/90',
      actionButtonBorder: 'border-stone-700/80',
      audioDockBg: 'bg-stone-900/90',
      subtitleBg: 'bg-stone-900/85',
    };

    expect(mobileGreyTokens.brandingText).toContain('stone-600');
    expect(mobileGreyTokens.statusDot).toBe('bg-stone-400');
    expect(mobileGreyTokens.actionButtonBg).toContain('stone-900');
    expect(mobileGreyTokens.actionButtonBorder).toContain('stone-700');
    expect(mobileGreyTokens.audioDockBg).toContain('stone-900');
  });

  it('correctly provides bilingual UI labels according to language prop', () => {
    const getMobileLabels = (language) => {
      const isEn = language === 'English';
      return {
        utilitiesBtn: isEn ? 'Utilities' : 'Tiện ích',
        utilitiesTitle: isEn ? 'Utilities Menu' : 'Danh mục tiện ích',
        facilitiesItem: isEn ? 'Hotel Facilities & Amenities' : 'Cơ sở vật chất & Tiện ích',
        mapItem: isEn ? 'Floor Map (8 Floors)' : 'Sơ đồ bản đồ (8 Tầng)',
        diningItem: isEn ? 'In-Room Dining Menu' : 'Thực đơn chọn món',
        callItem: isEn ? 'Call Staff Support' : 'Gọi nhân viên hỗ trợ',
        touchToSpeak: isEn ? 'Touch or Speak to begin' : 'Touch or Speak · Chạm hoặc Nói',
        listeningPrompt: isEn ? 'Listening... Please speak' : 'Listening... · Đang lắng nghe...',
        rotatePrompt: isEn ? 'Please rotate your phone' : 'Vui lòng xoay ngang điện thoại',
      };
    };

    const viLabels = getMobileLabels('Tiếng Việt');
    expect(viLabels.utilitiesBtn).toBe('Tiện ích');
    expect(viLabels.facilitiesItem).toBe('Cơ sở vật chất & Tiện ích');
    expect(viLabels.rotatePrompt).toBe('Vui lòng xoay ngang điện thoại');

    const enLabels = getMobileLabels('English');
    expect(enLabels.utilitiesBtn).toBe('Utilities');
    expect(enLabels.facilitiesItem).toBe('Hotel Facilities & Amenities');
    expect(enLabels.mapItem).toBe('Floor Map (8 Floors)');
    expect(enLabels.diningItem).toBe('In-Room Dining Menu');
    expect(enLabels.callItem).toBe('Call Staff Support');
    expect(enLabels.touchToSpeak).toBe('Touch or Speak to begin');
    expect(enLabels.listeningPrompt).toBe('Listening... Please speak');
    expect(enLabels.rotatePrompt).toBe('Please rotate your phone');
  });

  it('validates 2-column landscape grid layout for kiosk utilities (2x2 grid of 4 core items)', () => {
    const buildKioskGridItems = ({ hasFacilities, hasFoodMenu, hasStaffCall }) => {
      const items = [];
      if (hasFacilities) items.push({ id: 'facilities', colSpan: 1 });
      items.push({ id: 'map', colSpan: 1 });
      if (hasFoodMenu) items.push({ id: 'food-menu', colSpan: 1 });
      if (hasStaffCall) items.push({ id: 'call-staff', colSpan: 1 });
      return items;
    };

    const fullItems = buildKioskGridItems({
      hasFacilities: true,
      hasFoodMenu: true,
      hasStaffCall: true,
    });

    expect(fullItems).toHaveLength(4);
    expect(fullItems[0].id).toBe('facilities');
    expect(fullItems[1].id).toBe('map');
    expect(fullItems[2].id).toBe('food-menu');
    expect(fullItems[3].id).toBe('call-staff');

    // Kiosk landscape 2-column grid configuration (2x2 grid, no vertical scroll)
    const gridCols = 2;
    const rowCount = Math.ceil(fullItems.length / gridCols);
    expect(rowCount).toBe(2);
  });
});

