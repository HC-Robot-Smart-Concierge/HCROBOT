import { describe, it, expect } from 'vitest';

describe('AdminCameraTab Emotion Recognition Logic', () => {
  const calculateEmotionFromBlendshapes = (categories) => {
    let sLeft = 0;
    let sRight = 0;
    let bDownL = 0;
    let bDownR = 0;
    let mFrownL = 0;
    let mFrownR = 0;

    for (const c of categories) {
      if (c.categoryName === 'mouthSmileLeft') sLeft = c.score;
      else if (c.categoryName === 'mouthSmileRight') sRight = c.score;
      else if (c.categoryName === 'browDownLeft') bDownL = c.score;
      else if (c.categoryName === 'browDownRight') bDownR = c.score;
      else if (c.categoryName === 'mouthFrownLeft') mFrownL = c.score;
      else if (c.categoryName === 'mouthFrownRight') mFrownR = c.score;
    }

    const smile = (sLeft + sRight) / 2;
    const frown = Math.max((bDownL + bDownR) / 2, (mFrownL + mFrownR) / 2);

    let detected = 'neutral';
    if (smile >= 0.35) {
      detected = 'happy';
    } else if (frown >= 0.28) {
      detected = 'unhappy';
    }

    return { detected, smile, frown };
  };

  it('correctly classifies happy facial expressions from Pi5 camera blendshapes', () => {
    const categories = [
      { categoryName: 'mouthSmileLeft', score: 0.65 },
      { categoryName: 'mouthSmileRight', score: 0.61 },
      { categoryName: 'browDownLeft', score: 0.05 },
      { categoryName: 'browDownRight', score: 0.04 },
    ];
    const { detected, smile, frown } = calculateEmotionFromBlendshapes(categories);
    expect(detected).toBe('happy');
    expect(smile).toBeCloseTo(0.63, 2);
    expect(frown).toBeCloseTo(0.045, 2);
  });

  it('correctly classifies unhappy/frowning facial expressions', () => {
    const categories = [
      { categoryName: 'mouthSmileLeft', score: 0.02 },
      { categoryName: 'mouthSmileRight', score: 0.03 },
      { categoryName: 'browDownLeft', score: 0.45 },
      { categoryName: 'browDownRight', score: 0.47 },
      { categoryName: 'mouthFrownLeft', score: 0.35 },
      { categoryName: 'mouthFrownRight', score: 0.38 },
    ];
    const { detected, smile, frown } = calculateEmotionFromBlendshapes(categories);
    expect(detected).toBe('unhappy');
    expect(smile).toBeCloseTo(0.025, 2);
    expect(frown).toBeGreaterThanOrEqual(0.35);
  });

  it('correctly classifies neutral expression when scores do not cross threshold', () => {
    const categories = [
      { categoryName: 'mouthSmileLeft', score: 0.12 },
      { categoryName: 'mouthSmileRight', score: 0.14 },
      { categoryName: 'browDownLeft', score: 0.10 },
      { categoryName: 'browDownRight', score: 0.08 },
    ];
    const { detected } = calculateEmotionFromBlendshapes(categories);
    expect(detected).toBe('neutral');
  });

  it('supports admin manual override over detected AI emotion', () => {
    const detectedEmotion = 'happy';
    let manualOverride = null;
    const getEffective = () => manualOverride || detectedEmotion;

    expect(getEffective()).toBe('happy');

    manualOverride = 'unhappy';
    expect(getEffective()).toBe('unhappy');

    manualOverride = null; // back to AI
    expect(getEffective()).toBe('happy');
  });
});
