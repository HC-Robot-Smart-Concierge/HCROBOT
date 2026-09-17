import { describe, it, expect, vi } from 'vitest';
import { estimateDistance, getDetectorStatus } from './personDetector';

describe('PersonDetector Service', () => {
  describe('estimateDistance', () => {
    it('should classify ratio >= 0.60 as CLOSE (< 1.5m)', () => {
      const result = estimateDistance(300, 480); // ratio = 0.625
      expect(result.distanceLabel).toBe('CLOSE');
      expect(result.ratio).toBeCloseTo(0.625);
    });

    it('should classify ratio between 0.30 and 0.59 as APPROACHING (~1.8m - 3m)', () => {
      const result = estimateDistance(200, 480); // ratio = 0.416
      expect(result.distanceLabel).toBe('APPROACHING');
      expect(result.ratio).toBeGreaterThanOrEqual(0.3);
      expect(result.ratio).toBeLessThan(0.6);
    });

    it('should classify ratio < 0.30 as FAR (> 3m)', () => {
      const result = estimateDistance(100, 480); // ratio = 0.208
      expect(result.distanceLabel).toBe('FAR');
      expect(result.ratio).toBeLessThan(0.3);
    });

    it('should handle zero or undefined videoHeight gracefully without division by zero', () => {
      const result = estimateDistance(150, 0);
      expect(result.distanceLabel).toBeDefined();
      expect(Number.isFinite(result.ratio)).toBe(true);
    });
  });

  describe('getDetectorStatus', () => {
    it('should report initial model loading status', () => {
      const status = getDetectorStatus();
      expect(status).toHaveProperty('isLoaded');
      expect(status).toHaveProperty('isLoading');
      expect(status).toHaveProperty('error');
    });
  });
});
