import { describe, it, expect } from 'vitest';
import { detectDestinationPoi } from '../FloorMap';

describe('detectDestinationPoi Restroom & Toilet Intent Tests', () => {
  const testCasesGround = [
    'nhà vệ sinh ở đâu',
    'toilet ở đâu',
    'tolet ở đâu',
    'toa lét ở đâu',
    'to lét ở đâu',
    'toilét ở đâu',
    'toalet ở đâu',
    'where is the toilet',
    'where is toilet',
    'toilet',
    'đi tolet',
    'đi toa lét',
    'chỗ rửa tay ở đâu',
    'chỗ đi vệ sinh ở đâu',
  ];

  testCasesGround.forEach((query) => {
    it(`should resolve destination key 'restroom_ground' for query: "${query}"`, () => {
      const dest = detectDestinationPoi(query, null);
      expect(dest).toBe('restroom_ground');
    });
  });

  const testCasesFloor2 = [
    'toilet tầng 2',
    'tolet tầng 2',
    'toa lét tầng 2',
    'vệ sinh tầng 2',
    'nhà vệ sinh tầng 2',
    'toilet lầu 2',
    'restroom f2',
  ];

  testCasesFloor2.forEach((query) => {
    it(`should resolve destination key 'restroom_f2' for query: "${query}"`, () => {
      const dest = detectDestinationPoi(query, null);
      expect(dest).toBe('restroom_f2');
    });
  });
});

