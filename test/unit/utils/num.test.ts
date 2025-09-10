import { describe, it, expect } from 'vitest';
import Num from '../../../src/util/num.js';

describe('Num', () => {
  describe('getRandomNumber', () => {
    it('should generate random numbers within range', () => {
      for (let i = 0; i < 100; i++) {
        const result = Num.getRandomNumber({ min: 1, max: 10 });
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(10);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should generate random numbers with min = max', () => {
      const result = Num.getRandomNumber({ min: 5, max: 5 });
      expect(result).toBe(5);
    });

    it('should handle negative ranges', () => {
      for (let i = 0; i < 100; i++) {
        const result = Num.getRandomNumber({ min: -10, max: -1 });
        expect(result).toBeGreaterThanOrEqual(-10);
        expect(result).toBeLessThanOrEqual(-1);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should handle zero in range', () => {
      for (let i = 0; i < 100; i++) {
        const result = Num.getRandomNumber({ min: -5, max: 5 });
        expect(result).toBeGreaterThanOrEqual(-5);
        expect(result).toBeLessThanOrEqual(5);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should handle large ranges', () => {
      for (let i = 0; i < 50; i++) {
        const result = Num.getRandomNumber({ min: 1, max: 1000 });
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(1000);
        expect(Number.isInteger(result)).toBe(true);
      }
    });
  });

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(Num.clamp({ value: 5, min: 1, max: 10 })).toBe(5);
      expect(Num.clamp({ value: 0, min: 1, max: 10 })).toBe(1);
      expect(Num.clamp({ value: 15, min: 1, max: 10 })).toBe(10);
    });

    it('should handle negative values', () => {
      expect(Num.clamp({ value: -5, min: -10, max: -1 })).toBe(-5);
      expect(Num.clamp({ value: -15, min: -10, max: -1 })).toBe(-10);
      expect(Num.clamp({ value: 5, min: -10, max: -1 })).toBe(-1);
    });

    it('should handle decimal values', () => {
      expect(Num.clamp({ value: 2.5, min: 1.5, max: 3.5 })).toBe(2.5);
      expect(Num.clamp({ value: 1.0, min: 1.5, max: 3.5 })).toBe(1.5);
      expect(Num.clamp({ value: 4.0, min: 1.5, max: 3.5 })).toBe(3.5);
    });

    it('should handle edge cases', () => {
      expect(Num.clamp({ value: 5, min: 5, max: 5 })).toBe(5);
      expect(Num.clamp({ value: 0, min: 0, max: 0 })).toBe(0);
      expect(Num.clamp({ value: -0, min: 0, max: 10 })).toBe(0);
    });

    it('should handle reversed min/max', () => {
      // When min > max, the clamp function should use min as the lower bound
      expect(Num.clamp({ value: 5, min: 10, max: 1 })).toBe(1);
    });
  });
});
