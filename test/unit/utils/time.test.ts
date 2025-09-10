import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Time from '../../../src/util/time.js';

describe('Time', () => {
  describe('calculateElapsedTime', () => {
    it('should calculate elapsed time correctly', () => {
      const startTime = process.hrtime();
      const result = Time.calculateElapsedTime({ startTime });

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('should calculate elapsed time with specific hrtime values', () => {
      // Mock a start time of [1, 500000000] (1 second + 500ms)
      const startTime: [number, number] = [1, 500000000];

      // Mock process.hrtime to return [2, 0] (2 seconds elapsed from start)
      vi.spyOn(process, 'hrtime').mockReturnValue([0, 500000000]);

      const result = Time.calculateElapsedTime({ startTime });

      // Should return 500ms (0.5 seconds * 1000)
      expect(result).toBe(500);

      vi.restoreAllMocks();
    });
  });

  describe('formatTime', () => {
    it('should format time in seconds by default for time < 60000ms', () => {
      const result = Time.formatTime({ time: 5000 });
      expect(result).toBe('5s');
    });

    it('should format time in seconds with decimals', () => {
      const result = Time.formatTime({ time: 5500, numDecimals: 1 });
      expect(result).toBe('5.5s');
    });

    it('should format time in hh:mm:ss for time >= 60000ms', () => {
      const result = Time.formatTime({ time: 3661000 }); // 1 hour, 1 minute, 1 second
      expect(result).toBe('01:01:01');
    });

    it('should format time without unit when showUnit is false', () => {
      const result = Time.formatTime({ time: 5000, showUnit: false });
      expect(result).toBe('5');
    });

    it('should format time in milliseconds when format is ms', () => {
      const result = Time.formatTime({ time: 1500, format: 'ms' });
      expect(result).toBe('1500ms');
    });

    it('should format time in seconds when format is s', () => {
      const result = Time.formatTime({ time: 5000, format: 's' });
      expect(result).toBe('5s');
    });

    it('should format time in hh:mm:ss when format is hh:mm:ss', () => {
      const result = Time.formatTime({ time: 3661000, format: 'hh:mm:ss' });
      expect(result).toBe('01:01:01');
    });

    it('should handle zero time', () => {
      const result = Time.formatTime({ time: 0 });
      expect(result).toBe('0s');
    });

    it('should handle auto format for large times', () => {
      const result = Time.formatTime({ time: 120000, format: 'auto' });
      expect(result).toBe('00:02:00');
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should sleep for specified seconds', async () => {
      const sleepPromise = Time.sleep({ seconds: 2 });

      // Fast-forward time by 2 seconds
      vi.advanceTimersByTime(2000);

      await expect(sleepPromise).resolves.toBeUndefined();
    });

    it('should handle fractional seconds', async () => {
      const sleepPromise = Time.sleep({ seconds: 0.5 });

      // Fast-forward time by 500ms
      vi.advanceTimersByTime(500);

      await expect(sleepPromise).resolves.toBeUndefined();
    });
  });

  describe('formatRelativeTime', () => {
    const baseDate = new Date('2023-01-01T12:00:00Z');

    it('should return "just now" for times within a minute when includeSeconds is false', () => {
      const date = new Date('2023-01-01T12:00:30Z'); // 30 seconds later
      const result = Time.formatRelativeTime({ date, baseDate });
      expect(result).toBe('just now');
    });

    it('should return seconds when includeSeconds is true', () => {
      const date = new Date('2023-01-01T12:00:30Z'); // 30 seconds later
      const result = Time.formatRelativeTime({ date, baseDate, includeSeconds: true });
      expect(result).toBe('in 30 seconds');
    });

    it('should format past times correctly', () => {
      const date = new Date('2023-01-01T11:00:00Z'); // 1 hour ago
      const result = Time.formatRelativeTime({ date, baseDate });
      expect(result).toBe('1 hour ago');
    });

    it('should format future times correctly', () => {
      const date = new Date('2023-01-01T13:30:00Z'); // 1.5 hours later
      const result = Time.formatRelativeTime({ date, baseDate });
      expect(result).toBe('in 1 hour');
    });

    it('should handle days correctly', () => {
      const date = new Date('2023-01-03T12:00:00Z'); // 2 days later
      const result = Time.formatRelativeTime({ date, baseDate });
      expect(result).toBe('in 2 days');
    });

    it('should handle weeks correctly', () => {
      const date = new Date('2023-01-15T12:00:00Z'); // 2 weeks later
      const result = Time.formatRelativeTime({ date, baseDate });
      expect(result).toBe('in 2 weeks');
    });

    it('should handle months correctly', () => {
      const date = new Date('2023-03-15T12:00:00Z'); // ~2.5 months later
      const result = Time.formatRelativeTime({ date, baseDate });
      expect(result).toBe('in 2 months');
    });

    it('should handle years correctly', () => {
      const date = new Date('2025-01-01T12:00:00Z'); // 2 years later
      const result = Time.formatRelativeTime({ date, baseDate });
      expect(result).toBe('in 2 years');
    });

    it('should use singular forms correctly', () => {
      const date = new Date('2023-01-01T13:01:00Z'); // 1 hour and 1 minute later
      const result = Time.formatRelativeTime({ date, baseDate });
      expect(result).toBe('in 1 hour'); // Should be 1 hour since it's > 60 minutes
    });

    it('should use current date as default base', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60000); // 1 minute ago

      const result = Time.formatRelativeTime({ date: pastDate });
      expect(result).toBe('1 minute ago');
    });
  });

  describe('calculateElapsedTimeMs (new method)', () => {
    it('should calculate elapsed time using performance.now()', () => {
      const startTime = 100.5;
      const endTime = 250.75;

      const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValue(endTime);

      const result = Time.calculateElapsedTimeMs({ startTime });

      expect(result).toBe(150.25);
      expect(perfNowSpy).toHaveBeenCalled();

      perfNowSpy.mockRestore();
    });

    it('should handle decimal precision correctly', () => {
      const startTime = 123.456789;
      const endTime = 654.123456;

      const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValue(endTime);

      const result = Time.calculateElapsedTimeMs({ startTime });

      expect(result).toBeCloseTo(530.666667);

      perfNowSpy.mockRestore();
    });
  });

  describe('Modern timing methods (from Timing class)', () => {
    describe('now', () => {
      it('should return current timestamp', () => {
        const timestamp = Time.now();
        expect(typeof timestamp).toBe('number');
        expect(timestamp).toBeGreaterThan(0);
      });
    });

    describe('start', () => {
      it('should return a timer instance', () => {
        const timer = Time.start();

        expect(timer).toHaveProperty('startTime');
        expect(timer).toHaveProperty('stop');
        expect(timer).toHaveProperty('elapsed');
      });
    });

    describe('measure', () => {
      it('should measure async function execution', async () => {
        const mockFn = vi.fn().mockResolvedValue('test');

        const result = await Time.measure(mockFn);

        expect(result).toHaveProperty('result', 'test');
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('startTime');
        expect(result).toHaveProperty('endTime');
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });
    });

    describe('measureSync', () => {
      it('should measure sync function execution', () => {
        const mockFn = vi.fn().mockReturnValue('sync test');

        const result = Time.measureSync(mockFn);

        expect(result).toHaveProperty('result', 'sync test');
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('startTime');
        expect(result).toHaveProperty('endTime');
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });
    });

    describe('duration', () => {
      it('should calculate duration between timestamps', () => {
        const start = 100.5;
        const end = 200.25;

        const result = Time.duration(start, end);

        expect(result).toBe(99.75);
      });
    });

    describe('hrtimeToMs (deprecated helper)', () => {
      it('should convert hrtime tuple to milliseconds', () => {
        const hrtime: [number, number] = [2, 500000000]; // 2.5 seconds

        const result = Time.hrtimeToMs(hrtime);

        expect(result).toBe(2500);
      });
    });

    describe('msToHrtime (deprecated helper)', () => {
      it('should convert milliseconds to hrtime format', () => {
        const milliseconds = 1500; // 1.5 seconds

        const result = Time.msToHrtime(milliseconds);

        expect(result).toEqual([1, 500000000]);
      });
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain existing calculateElapsedTime behavior', () => {
      const startTime: [number, number] = [1, 500000000];

      // Mock process.hrtime to return [2, 0] (1 second elapsed)
      vi.spyOn(process, 'hrtime').mockReturnValue([0, 500000000]);

      const result = Time.calculateElapsedTime({ startTime });

      expect(result).toBe(500); // 0.5 seconds = 500ms

      vi.restoreAllMocks();
    });

    it('should have all original methods available', () => {
      expect(typeof Time.calculateElapsedTime).toBe('function');
      expect(typeof Time.formatTime).toBe('function');
      expect(typeof Time.formatRelativeTime).toBe('function');
      expect(typeof Time.sleep).toBe('function');
    });

    it('should have all new methods available', () => {
      expect(typeof Time.calculateElapsedTimeMs).toBe('function');
      expect(typeof Time.now).toBe('function');
      expect(typeof Time.start).toBe('function');
      expect(typeof Time.measure).toBe('function');
      expect(typeof Time.measureSync).toBe('function');
      expect(typeof Time.duration).toBe('function');
      expect(typeof Time.hrtimeToMs).toBe('function');
      expect(typeof Time.msToHrtime).toBe('function');
    });
  });
});
