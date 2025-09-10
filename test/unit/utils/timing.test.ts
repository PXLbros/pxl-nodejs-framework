import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Timing from '../../../src/util/timing.js';

describe('Timing', () => {
  describe('now', () => {
    it('should return a number timestamp', () => {
      const timestamp = Timing.now();
      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeGreaterThan(0);
    });

    it('should use performance.now() internally', () => {
      const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValue(123.456);

      const result = Timing.now();

      expect(perfNowSpy).toHaveBeenCalled();
      expect(result).toBe(123.456);

      perfNowSpy.mockRestore();
    });
  });

  describe('start', () => {
    it('should return a Timer instance', () => {
      const timer = Timing.start();

      expect(timer).toHaveProperty('startTime');
      expect(timer).toHaveProperty('stop');
      expect(timer).toHaveProperty('elapsed');
      expect(typeof timer.startTime).toBe('number');
      expect(typeof timer.stop).toBe('function');
      expect(typeof timer.elapsed).toBe('function');
    });

    it('should record start time', () => {
      const mockTime = 100.5;
      const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValue(mockTime);

      const timer = Timing.start();

      expect(timer.startTime).toBe(mockTime);

      perfNowSpy.mockRestore();
    });
  });

  describe('Timer instance', () => {
    it('should calculate elapsed time correctly', () => {
      const startTime = 100;
      const endTime = 150.5;

      const perfNowSpy = vi
        .spyOn(performance, 'now')
        .mockReturnValueOnce(startTime) // start
        .mockReturnValueOnce(endTime); // stop

      const timer = Timing.start();
      const elapsed = timer.stop();

      expect(elapsed).toBe(50.5);

      perfNowSpy.mockRestore();
    });

    it('should provide elapsed time without stopping', () => {
      const startTime = 100;
      const currentTime = 125.25;

      const perfNowSpy = vi
        .spyOn(performance, 'now')
        .mockReturnValueOnce(startTime) // start
        .mockReturnValueOnce(currentTime); // elapsed

      const timer = Timing.start();
      const elapsed = timer.elapsed();

      expect(elapsed).toBe(25.25);

      perfNowSpy.mockRestore();
    });
  });

  describe('measure', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should measure async function execution time', async () => {
      const mockFunction = vi.fn().mockResolvedValue('test result');
      const startTime = 100;
      const endTime = 150.75;

      const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);

      const result = await Timing.measure(mockFunction);

      expect(result).toEqual({
        result: 'test result',
        duration: 50.75,
        startTime: 100,
        endTime: 150.75,
      });
      expect(mockFunction).toHaveBeenCalledOnce();

      perfNowSpy.mockRestore();
    });

    it('should measure sync function execution time', async () => {
      const mockFunction = vi.fn().mockReturnValue('sync result');
      const startTime = 200;
      const endTime = 225.123;

      const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);

      const result = await Timing.measure(mockFunction);

      expect(result.result).toBe('sync result');
      expect(result.startTime).toBe(200);
      expect(result.endTime).toBe(225.123);
      expect(result.duration).toBeCloseTo(25.123, 3);
      expect(mockFunction).toHaveBeenCalledOnce();

      perfNowSpy.mockRestore();
    });

    it('should handle function that throws error', async () => {
      const error = new Error('Test error');
      const mockFunction = vi.fn().mockRejectedValue(error);

      await expect(Timing.measure(mockFunction)).rejects.toThrow('Test error');
      expect(mockFunction).toHaveBeenCalledOnce();
    });

    it('should log execution time when log option is true', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockFunction = vi.fn().mockResolvedValue('result');

      const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(150.456);

      await Timing.measure(mockFunction, { log: true, name: 'Test Function' });

      expect(consoleSpy).toHaveBeenCalledWith('Test Function executed in 50.456ms');

      consoleSpy.mockRestore();
      perfNowSpy.mockRestore();
    });

    it('should use custom logger when provided', async () => {
      const customLogger = vi.fn();
      const mockFunction = vi.fn().mockResolvedValue('result');

      const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(175.789);

      await Timing.measure(mockFunction, {
        log: true,
        name: 'Custom Test',
        logger: customLogger,
      });

      expect(customLogger).toHaveBeenCalledWith('Custom Test executed', expect.closeTo(75.789, 3));

      perfNowSpy.mockRestore();
    });

    it('should use anonymous function name when name not provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockFunction = vi.fn().mockResolvedValue('result');

      const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(125);

      await Timing.measure(mockFunction, { log: true });

      expect(consoleSpy).toHaveBeenCalledWith('Anonymous function executed in 25.000ms');

      consoleSpy.mockRestore();
      perfNowSpy.mockRestore();
    });
  });

  describe('measureSync', () => {
    it('should measure synchronous function execution time', () => {
      const mockFunction = vi.fn().mockReturnValue('sync result');
      const startTime = 300;
      const endTime = 350.999;

      const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);

      const result = Timing.measureSync(mockFunction);

      expect(result.result).toBe('sync result');
      expect(result.startTime).toBe(300);
      expect(result.endTime).toBe(350.999);
      expect(result.duration).toBeCloseTo(50.999, 3);
      expect(mockFunction).toHaveBeenCalledOnce();

      perfNowSpy.mockRestore();
    });

    it('should handle function that throws error', () => {
      const error = new Error('Sync error');
      const mockFunction = vi.fn().mockImplementation(() => {
        throw error;
      });

      expect(() => Timing.measureSync(mockFunction)).toThrow('Sync error');
      expect(mockFunction).toHaveBeenCalledOnce();
    });

    it('should log execution time when log option is true', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockFunction = vi.fn().mockReturnValue('result');

      const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(123.456);

      Timing.measureSync(mockFunction, { log: true, name: 'Sync Test' });

      expect(consoleSpy).toHaveBeenCalledWith('Sync Test executed in 23.456ms');

      consoleSpy.mockRestore();
      perfNowSpy.mockRestore();
    });
  });

  describe('duration', () => {
    it('should calculate duration between timestamps', () => {
      const startTime = 100.5;
      const endTime = 250.75;

      const result = Timing.duration(startTime, endTime);

      expect(result).toBe(150.25);
    });

    it('should handle negative duration (end before start)', () => {
      const startTime = 200;
      const endTime = 150;

      const result = Timing.duration(startTime, endTime);

      expect(result).toBe(-50);
    });
  });

  describe('integration tests', () => {
    it('should work with real timing operations', async () => {
      // This test uses real timing, so we just check the structure
      const timer = Timing.start();

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 10));

      const elapsed = timer.stop();

      expect(elapsed).toBeGreaterThan(8); // Allow some variance
      expect(elapsed).toBeLessThan(50); // Should be reasonable
    });

    it('should measure real async function', async () => {
      const asyncFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'completed';
      };

      const result = await Timing.measure(asyncFn);

      expect(result.result).toBe('completed');
      expect(result.duration).toBeGreaterThan(8);
      expect(result.duration).toBeLessThan(50);
      expect(result.startTime).toBeGreaterThan(0);
      expect(result.endTime).toBeGreaterThan(result.startTime);
    });
  });
});
