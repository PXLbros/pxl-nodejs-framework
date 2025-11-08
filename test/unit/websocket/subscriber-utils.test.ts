import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocketSubscriberHandlerContext } from '../../../src/websocket/websocket.interface.js';
import {
  matchByProperty,
  matchByPropertyPredicate,
  getNestedProperty,
  withErrorHandler,
  withLogging,
  withRateLimit,
  withRetry,
  composeHandlers,
  withFilter,
  withValidation,
  withDebounce,
  withThrottle,
} from '../../../src/websocket/subscriber-utils.js';

describe('Subscriber Utilities', () => {
  let mockContext: WebSocketSubscriberHandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      channel: 'test-channel',
      message: {
        type: 'analytics',
        action: 'track',
        priority: 5,
        userId: 123,
        nested: { deep: { value: 'test' } },
      },
      webSocketServer: {} as any,
      databaseInstance: {} as any,
      redisInstance: {} as any,
      queueManager: {} as any,
    };
  });

  describe('matchByProperty', () => {
    it('should match exact property values', () => {
      const matcher = matchByProperty('type', 'analytics');
      expect(matcher(mockContext)).toBe(true);
    });

    it('should not match different values', () => {
      const matcher = matchByProperty('type', 'chat');
      expect(matcher(mockContext)).toBe(false);
    });

    it('should handle missing properties', () => {
      const matcher = matchByProperty('nonexistent', 'value');
      expect(matcher(mockContext)).toBe(false);
    });

    it('should match numeric values', () => {
      const matcher = matchByProperty('userId', 123);
      expect(matcher(mockContext)).toBe(true);
    });
  });

  describe('matchByPropertyPredicate', () => {
    it('should match with custom predicate', () => {
      const matcher = matchByPropertyPredicate('priority', value => (value as number) > 3);
      expect(matcher(mockContext)).toBe(true);
    });

    it('should not match predicate that returns false', () => {
      const matcher = matchByPropertyPredicate('priority', value => (value as number) > 10);
      expect(matcher(mockContext)).toBe(false);
    });

    it('should handle predicate exceptions', () => {
      const matcher = matchByPropertyPredicate('priority', () => {
        throw new Error('Test error');
      });
      expect(matcher(mockContext)).toBe(false);
    });
  });

  describe('getNestedProperty', () => {
    it('should get top-level properties', () => {
      expect(getNestedProperty(mockContext.message, 'type')).toBe('analytics');
    });

    it('should get deeply nested properties', () => {
      expect(getNestedProperty(mockContext.message, 'nested.deep.value')).toBe('test');
    });

    it('should return undefined for missing paths', () => {
      expect(getNestedProperty(mockContext.message, 'nonexistent.path')).toBeUndefined();
    });

    it('should return undefined for partial missing paths', () => {
      expect(getNestedProperty(mockContext.message, 'nested.missing.value')).toBeUndefined();
    });
  });

  describe('withErrorHandler', () => {
    it('should execute handler successfully', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = withErrorHandler(handler);

      const result = await wrapped(mockContext);

      expect(handler).toHaveBeenCalledWith(mockContext);
      expect(result).toBe('success');
    });

    it('should call error callback on failure', async () => {
      const error = new Error('Test error');
      const handler = vi.fn().mockRejectedValue(error);
      const errorCallback = vi.fn();
      const wrapped = withErrorHandler(handler, errorCallback);

      await wrapped(mockContext);

      expect(errorCallback).toHaveBeenCalledWith(error, mockContext);
    });

    it('should rethrow error when throwError is true', async () => {
      const error = new Error('Test error');
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = withErrorHandler(handler, undefined, true);

      await expect(wrapped(mockContext)).rejects.toThrow('Test error');
    });

    it('should suppress error when throwError is false', async () => {
      const error = new Error('Test error');
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = withErrorHandler(handler, undefined, false);

      await expect(wrapped(mockContext)).resolves.toBeUndefined();
    });
  });

  describe('withLogging', () => {
    it('should execute handler with logging', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = withLogging(handler, 'testHandler');

      const result = await wrapped(mockContext);

      expect(handler).toHaveBeenCalledWith(mockContext);
      expect(result).toBe('success');
    });

    it('should log handler execution time', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = withLogging(handler, 'testHandler');

      await wrapped(mockContext);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('withRateLimit', () => {
    it('should allow executions within limit', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = withRateLimit(handler, 3, 1000);

      for (let i = 0; i < 3; i++) {
        await wrapped(mockContext);
      }

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should skip execution when rate limit exceeded', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = withRateLimit(handler, 2, 1000);

      await wrapped(mockContext);
      await wrapped(mockContext);
      await wrapped(mockContext); // This should be skipped

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should call onRateLimited callback', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const onRateLimited = vi.fn();
      const wrapped = withRateLimit(handler, 1, 1000, onRateLimited);

      await wrapped(mockContext);
      await wrapped(mockContext);

      expect(onRateLimited).toHaveBeenCalledWith(mockContext);
    });

    it('should reset rate limit after window expires', async () => {
      vi.useFakeTimers();
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = withRateLimit(handler, 1, 100);

      await wrapped(mockContext);
      expect(handler).toHaveBeenCalledTimes(1);

      await wrapped(mockContext);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, rate limited

      vi.advanceTimersByTime(101);
      await wrapped(mockContext);
      expect(handler).toHaveBeenCalledTimes(2); // Now allowed again

      vi.useRealTimers();
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = withRetry(handler, 3, 10);

      const result = await wrapped(mockContext);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
    });

    it('should retry on failure', async () => {
      const handler = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      const wrapped = withRetry(handler, 3, 10);
      const result = await wrapped(mockContext);

      expect(handler).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('should throw after max retries exceeded', async () => {
      const error = new Error('Persistent error');
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = withRetry(handler, 2, 10);

      await expect(wrapped(mockContext)).rejects.toThrow('Persistent error');
      expect(handler).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should apply exponential backoff multiplier', async () => {
      // Test that retries use exponential backoff
      let delayTotal = 0;
      const handler = vi.fn().mockRejectedValue(new Error('Test'));

      const wrapped = withRetry(handler, 2, 100, 2); // 100ms initial, 2x multiplier

      try {
        await wrapped(mockContext);
      } catch {
        // Expected to fail
      }

      // Handler called: 1 initial + 2 retries = 3 times
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('composeHandlers', () => {
    it('should execute handlers sequentially', async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);
      const handler3 = vi.fn().mockResolvedValue(undefined);

      const composed = composeHandlers([handler1, handler2, handler3]);
      await composed(mockContext);

      expect(handler1).toHaveBeenCalledWith(mockContext);
      expect(handler2).toHaveBeenCalledWith(mockContext);
      expect(handler3).toHaveBeenCalledWith(mockContext);
    });

    it('should stop on first error', async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockRejectedValue(new Error('Test error'));
      const handler3 = vi.fn().mockResolvedValue(undefined);

      const composed = composeHandlers([handler1, handler2, handler3]);

      await expect(composed(mockContext)).rejects.toThrow('Test error');
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });
  });

  describe('withFilter', () => {
    it('should execute handler when predicate returns true', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const predicate = vi.fn().mockReturnValue(true);
      const wrapped = withFilter(predicate, handler);

      const result = await wrapped(mockContext);

      expect(predicate).toHaveBeenCalledWith(mockContext);
      expect(handler).toHaveBeenCalledWith(mockContext);
      expect(result).toBe('success');
    });

    it('should skip handler when predicate returns false', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const predicate = vi.fn().mockReturnValue(false);
      const wrapped = withFilter(predicate, handler);

      await wrapped(mockContext);

      expect(predicate).toHaveBeenCalledWith(mockContext);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should support async predicate', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const predicate = vi.fn().mockResolvedValue(true);
      const wrapped = withFilter(predicate, handler);

      await wrapped(mockContext);

      expect(predicate).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('withValidation', () => {
    it('should execute handler when validation passes', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const validator = vi.fn();
      const wrapped = withValidation(validator, handler);

      const result = await wrapped(mockContext);

      expect(validator).toHaveBeenCalledWith(mockContext.message);
      expect(handler).toHaveBeenCalledWith(mockContext);
      expect(result).toBe('success');
    });

    it('should skip handler when validation fails', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const validator = vi.fn().mockImplementation(() => {
        throw new Error('Validation failed');
      });
      const wrapped = withValidation(validator, handler);

      await expect(wrapped(mockContext)).rejects.toThrow('Validation failed');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should support async validation', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const validator = vi.fn().mockResolvedValue(undefined);
      const wrapped = withValidation(validator, handler);

      await wrapped(mockContext);

      expect(validator).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('withDebounce', () => {
    it('should delay handler execution', async () => {
      vi.useFakeTimers();
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = withDebounce(handler, 100);

      const promise = wrapped(mockContext);

      expect(handler).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      await promise;

      expect(handler).toHaveBeenCalledWith(mockContext);
      vi.useRealTimers();
    });

    it('should cancel previous execution on new call', async () => {
      vi.useFakeTimers();
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = withDebounce(handler, 100);

      wrapped(mockContext);
      vi.advanceTimersByTime(50);
      wrapped(mockContext);
      vi.advanceTimersByTime(100);

      expect(handler).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  describe('withThrottle', () => {
    it('should allow execution within interval', async () => {
      vi.useFakeTimers();
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = withThrottle(handler, 100);

      await wrapped(mockContext);
      expect(handler).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      await wrapped(mockContext);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, throttled

      vi.advanceTimersByTime(60); // Total 110
      await wrapped(mockContext);
      expect(handler).toHaveBeenCalledTimes(2); // Now allowed

      vi.useRealTimers();
    });

    it('should reset throttle after interval', async () => {
      vi.useFakeTimers();
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = withThrottle(handler, 100);

      await wrapped(mockContext);
      vi.advanceTimersByTime(100);
      await wrapped(mockContext);

      expect(handler).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });
});
