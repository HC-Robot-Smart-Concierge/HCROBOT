import { describe, it, expect } from 'vitest';

describe('Advertisement Management and Robot Display Logic', () => {
  it('should filter advertisements by media type correctly', () => {
    const ads = [
      { id: 'AD-01', title: 'Buffet Toi', media_type: 'IMAGE', is_active: true },
      { id: 'AD-02', title: 'Video Resort 4K', media_type: 'VIDEO', is_active: true },
      { id: 'AD-03', title: 'Spa Giam Gia 30%', media_type: 'IMAGE', is_active: false },
    ];

    const imageAds = ads.filter((a) => a.media_type === 'IMAGE');
    const videoAds = ads.filter((a) => a.media_type === 'VIDEO');

    expect(imageAds).toHaveLength(2);
    expect(videoAds).toHaveLength(1);
    expect(videoAds[0].id).toBe('AD-02');
  });

  it('should prioritize pushed advertisement in robot playlist', () => {
    const currentPlaylist = [
      { id: 'AD-01', title: 'Quang cao 1' },
      { id: 'AD-02', title: 'Quang cao 2' },
    ];

    const pushedAd = { id: 'AD-03', title: 'Quang cao khan cap VIP' };

    const updatedPlaylist = [pushedAd, ...currentPlaylist.filter((a) => a.id !== pushedAd.id)];

    expect(updatedPlaylist[0].id).toBe('AD-03');
    expect(updatedPlaylist).toHaveLength(3);
  });

  it('should cycle through slides in circular playlist', () => {
    const playlist = [
      { id: 'AD-01', title: 'Slide 1' },
      { id: 'AD-02', title: 'Slide 2' },
      { id: 'AD-03', title: 'Slide 3' },
    ];

    let currentIndex = 0;
    const nextSlide = (idx) => (idx + 1) % playlist.length;
    const prevSlide = (idx) => (idx - 1 + playlist.length) % playlist.length;

    currentIndex = nextSlide(currentIndex);
    expect(currentIndex).toBe(1);

    currentIndex = nextSlide(currentIndex);
    expect(currentIndex).toBe(2);

    currentIndex = nextSlide(currentIndex);
    expect(currentIndex).toBe(0);

    currentIndex = prevSlide(currentIndex);
    expect(currentIndex).toBe(2);
  });

  it('should toggle is_active state of an advertisement', () => {
    const ads = [
      { id: 'AD-01', title: 'Quang cao A', is_active: true },
      { id: 'AD-02', title: 'Quang cao B', is_active: false },
    ];

    const targetId = 'AD-02';
    const updated = ads.map((item) =>
      item.id === targetId ? { ...item, is_active: !item.is_active } : item
    );

    expect(updated.find((a) => a.id === targetId)?.is_active).toBe(true);
    expect(updated.find((a) => a.id === 'AD-01')?.is_active).toBe(true);
  });

  it('should compute appropriate display duration for media types', () => {
    const getDuration = (ad) => {
      if (ad.duration_seconds && ad.duration_seconds > 0) return ad.duration_seconds;
      return ad.media_type === 'VIDEO' ? 15 : 10;
    };

    expect(getDuration({ media_type: 'IMAGE', duration_seconds: 8 })).toBe(8);
    expect(getDuration({ media_type: 'IMAGE' })).toBe(10);
    expect(getDuration({ media_type: 'VIDEO' })).toBe(15);
  });
});
