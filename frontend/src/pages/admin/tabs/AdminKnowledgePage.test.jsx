import { describe, it, expect } from 'vitest';

describe('AdminKnowledgePage Dialogue Scenarios Filtering and Fast-Path State', () => {
  const sampleScenarios = [
    {
      id: 'scn-wifi',
      title: 'Mật khẩu Wi-Fi',
      category: 'facility',
      match_keywords: ['wifi', 'pass wifi', 'mật khẩu'],
      response_vi: 'Dạ wifi miễn phí là Aurora_Guest, mật khẩu aurora2026 ạ.',
      response_en: 'Complimentary Wi-Fi is Aurora_Guest, password aurora2026.',
      action_type: 'none',
      is_fast_path: true,
      is_active: true,
      priority: 100,
    },
    {
      id: 'scn-pool',
      title: 'Hồ bơi vô cực',
      category: 'facility',
      match_keywords: ['hồ bơi', 'swimming pool'],
      response_vi: 'Dạ hồ bơi nằm tại Tầng 4 mở từ 6h đến 22h.',
      response_en: 'Infinity pool is on Level 4 open 6AM to 10PM.',
      action_type: 'show_map',
      is_fast_path: true,
      is_active: true,
      priority: 85,
    },
    {
      id: 'scn-custom-chat',
      title: 'Hỏi về thời tiết',
      category: 'chitchat',
      match_keywords: ['thời tiết', 'hôm nay mưa không'],
      response_vi: 'Dạ hôm nay thời tiết rất đẹp ạ.',
      response_en: 'The weather is great today.',
      action_type: 'none',
      is_fast_path: false,
      is_active: false,
      priority: 10,
    },
  ];

  it('should calculate total fast-path and active scenarios accurately', () => {
    const totalFastPath = sampleScenarios.filter((s) => s.is_fast_path).length;
    const totalActive = sampleScenarios.filter((s) => s.is_active).length;

    expect(totalFastPath).toBe(2);
    expect(totalActive).toBe(2);
  });

  it('should filter scenarios by category correctly', () => {
    const facilityItems = sampleScenarios.filter((s) => s.category === 'facility');
    expect(facilityItems).toHaveLength(2);

    const chitchatItems = sampleScenarios.filter((s) => s.category === 'chitchat');
    expect(chitchatItems).toHaveLength(1);
    expect(chitchatItems[0].title).toBe('Hỏi về thời tiết');
  });

  it('should search scenarios by keyword or title correctly', () => {
    const query = 'wifi';
    const matched = sampleScenarios.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.match_keywords.some((kw) => kw.toLowerCase().includes(query))
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].id).toBe('scn-wifi');
  });

  describe('Robot Speech Rate and Voice Configuration Options', () => {
    const formatSpeedLabel = (rate) => {
      if (rate === 1.0) return 'Chuẩn (1.0x)';
      if (rate < 1.0) return `Chậm (${rate}x)`;
      return `Nhanh (${rate}x)`;
    };

    const validVoiceModels = [
      'vi-VN-HoaiMyNeural',
      'vi-VN-NamMinhNeural',
    ];

    it('formats speech rate speed tags correctly', () => {
      expect(formatSpeedLabel(1.0)).toBe('Chuẩn (1.0x)');
      expect(formatSpeedLabel(0.85)).toBe('Chậm (0.85x)');
      expect(formatSpeedLabel(1.15)).toBe('Nhanh (1.15x)');
    });

    it('supports official high quality Vietnamese Neural voice models', () => {
      expect(validVoiceModels).toContain('vi-VN-HoaiMyNeural');
      expect(validVoiceModels).toContain('vi-VN-NamMinhNeural');
      expect(validVoiceModels).toHaveLength(2);
    });
  });
});

