import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocketSubscriberHandlerContext } from '../../../src/websocket/websocket.interface.js';
import type { WebSocketSubscriberMiddleware } from '../../../src/websocket/subscriber-middleware.js';
import {
  executeWithMiddleware,
  loggingMiddleware,
  timingMiddleware,
  validationMiddleware,
  rateLimitMiddleware,
} from '../../../src/websocket/subscriber-middleware.js';

describe('Subscriber Middleware', () => {
  let mockContext: WebSocketSubscriberHandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      channel: 'test-channel',
      message: {
        type: 'test',
        action: 'execute',
        data: { value: 'test' },
      },
      webSocketServer: {} as any,
      databaseInstance: {} as any,
      redisInstance: {} as any,
      queueManager: {} as any,
    };
  });

  describe('executeWithMiddleware', () => {
    it('should execute handler without middleware', async () => {
      const handler = vi.fn().mockResolvedValue('success');

      await executeWithMiddleware(handler, [], mockContext);

      expect(handler).toHaveBeenCalledWith(mockContext);
    });

    it('should execute middleware in correct order', async () => {
      const callOrder: string[] = [];

      const middleware1: WebSocketSubscriberMiddleware = {
        name: 'mw1',
        onBefore: () => {
          callOrder.push('mw1:before');
          return true;
        },
        onAfter: () => {
          callOrder.push('mw1:after');
        },
      };

      const middleware2: WebSocketSubscriberMiddleware = {
        name: 'mw2',
        onBefore: () => {
          callOrder.push('mw2:before');
          return true;
        },
        onAfter: () => {
          callOrder.push('mw2:after');
        },
      };

      const handler = vi.fn().mockImplementation(() => {
        callOrder.push('handler');
        return 'success';
      });

      await executeWithMiddleware(handler, [middleware1, middleware2], mockContext);

      // Middleware onBefore runs in order, then handler, then middleware onAfter in same order
      expect(callOrder).toEqual(['mw1:before', 'mw2:before', 'handler', 'mw1:after', 'mw2:after']);
    });

    it('should skip handler when middleware returns false from onBefore', async () => {
      const middleware: WebSocketSubscriberMiddleware = {
        name: 'skipMiddleware',
        onBefore: () => false,
      };

      const handler = vi.fn().mockResolvedValue('success');

      await executeWithMiddleware(handler, [middleware], mockContext);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should pass result to onAfter', async () => {
      const onAfter = vi.fn();
      const middleware: WebSocketSubscriberMiddleware = {
        name: 'testMiddleware',
        onAfter,
      };

      const handler = vi.fn().mockResolvedValue('test-result');

      await executeWithMiddleware(handler, [middleware], mockContext);

      expect(onAfter).toHaveBeenCalledWith(mockContext, 'test-result');
    });

    it('should handle handler errors with onError middleware', async () => {
      const error = new Error('Handler error');
      const onError = vi.fn().mockResolvedValue(false); // Don't suppress

      const middleware: WebSocketSubscriberMiddleware = {
        name: 'errorMiddleware',
        onError,
      };

      const handler = vi.fn().mockRejectedValue(error);

      await expect(executeWithMiddleware(handler, [middleware], mockContext)).rejects.toThrow('Handler error');

      expect(onError).toHaveBeenCalledWith(mockContext, error);
    });

    it('should suppress error when onError returns true', async () => {
      const middleware: WebSocketSubscriberMiddleware = {
        name: 'suppressMiddleware',
        onError: () => true, // Suppress error
      };

      const handler = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(executeWithMiddleware(handler, [middleware], mockContext)).resolves.toBeUndefined();

      expect(handler).toHaveBeenCalled();
    });

    it('should handle non-Error objects thrown from handler', async () => {
      const onError = vi.fn().mockResolvedValue(false);

      const middleware: WebSocketSubscriberMiddleware = {
        name: 'errorMiddleware',
        onError,
      };

      const handler = vi.fn().mockRejectedValue('String error');

      await expect(executeWithMiddleware(handler, [middleware], mockContext)).rejects.toThrow();

      expect(onError).toHaveBeenCalled();
      const callArgs = onError.mock.calls[0];
      expect(callArgs[1]).toBeInstanceOf(Error);
      expect(callArgs[1].message).toBe('String error');
    });

    it('should continue with other middleware if onError callback fails', async () => {
      const middleware1: WebSocketSubscriberMiddleware = {
        name: 'failingMiddleware',
        onError: () => {
          throw new Error('Middleware error');
        },
      };

      const middleware2: WebSocketSubscriberMiddleware = {
        name: 'successMiddleware',
        onError: vi.fn().mockResolvedValue(false),
      };

      const handler = vi.fn().mockRejectedValue(new Error('Handler error'));

      await expect(executeWithMiddleware(handler, [middleware1, middleware2], mockContext)).rejects.toThrow(
        'Handler error',
      );

      expect(middleware2.onError).toHaveBeenCalled();
    });

    it('should handle middleware that returns non-boolean from onBefore', async () => {
      const middleware: WebSocketSubscriberMiddleware = {
        name: 'testMiddleware',
        onBefore: () => 'truthy' as any,
      };

      const handler = vi.fn().mockResolvedValue('success');

      await executeWithMiddleware(handler, [middleware], mockContext);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('loggingMiddleware', () => {
    it('should create logging middleware', () => {
      const mw = loggingMiddleware('testHandler');

      expect(mw.name).toBe('logging');
      expect(mw.onBefore).toBeDefined();
      expect(mw.onAfter).toBeDefined();
      expect(mw.onError).toBeDefined();
    });

    it('should return true from onBefore', async () => {
      const mw = loggingMiddleware('testHandler');

      const result = await mw.onBefore!(mockContext);

      expect(result).toBe(true);
    });

    it('should log on successful execution', async () => {
      const mw = loggingMiddleware('testHandler');

      await mw.onAfter!(mockContext, 'result');

      // Middleware executed without throwing
      expect(mw).toBeDefined();
    });

    it('should return false from onError to propagate error', async () => {
      const mw = loggingMiddleware('testHandler');
      const error = new Error('Test error');

      const result = await mw.onError!(mockContext, error);

      expect(result).toBe(false); // Don't suppress
    });
  });

  describe('timingMiddleware', () => {
    it('should create timing middleware', () => {
      const mw = timingMiddleware();

      expect(mw.name).toBe('timing');
      expect(mw.onBefore).toBeDefined();
      expect(mw.onAfter).toBeDefined();
      expect(mw.onError).toBeDefined();
    });

    it('should allow execution to proceed', async () => {
      const mw = timingMiddleware();

      const result = await mw.onBefore!(mockContext);

      expect(result).toBe(true);
    });

    it('should measure execution time', async () => {
      vi.useFakeTimers();
      const mw = timingMiddleware();

      await mw.onBefore!(mockContext);
      vi.advanceTimersByTime(100);
      await mw.onAfter!(mockContext, undefined);

      // Middleware executed without throwing
      expect(mw).toBeDefined();

      vi.useRealTimers();
    });
  });

  describe('validationMiddleware', () => {
    it('should create validation middleware', () => {
      const validator = vi.fn();
      const mw = validationMiddleware(validator);

      expect(mw.name).toBe('validation');
      expect(mw.onBefore).toBeDefined();
    });

    it('should execute validator and allow execution', async () => {
      const validator = vi.fn();
      const mw = validationMiddleware(validator);

      const result = await mw.onBefore!(mockContext);

      expect(validator).toHaveBeenCalledWith(mockContext.message);
      expect(result).toBe(true);
    });

    it('should throw when validation fails', async () => {
      const validator = vi.fn().mockImplementation(() => {
        throw new Error('Validation failed');
      });
      const mw = validationMiddleware(validator);

      await expect(mw.onBefore!(mockContext)).rejects.toThrow('Validation failed');
    });

    it('should support async validators', async () => {
      const validator = vi.fn().mockResolvedValue(undefined);
      const mw = validationMiddleware(validator);

      const result = await mw.onBefore!(mockContext);

      expect(validator).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('rateLimitMiddleware', () => {
    it('should create rate limit middleware', () => {
      const mw = rateLimitMiddleware(10, 60000);

      expect(mw.name).toBe('rate-limit');
      expect(mw.onBefore).toBeDefined();
    });

    it('should allow executions within limit', async () => {
      const mw = rateLimitMiddleware(3, 1000);

      const result1 = await mw.onBefore!(mockContext);
      const result2 = await mw.onBefore!(mockContext);
      const result3 = await mw.onBefore!(mockContext);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('should block executions exceeding limit', async () => {
      const mw = rateLimitMiddleware(2, 1000);

      await mw.onBefore!(mockContext);
      await mw.onBefore!(mockContext);
      const result = await mw.onBefore!(mockContext);

      expect(result).toBe(false);
    });

    it('should reset limit after time window', async () => {
      vi.useFakeTimers();
      const mw = rateLimitMiddleware(1, 100);

      const result1 = await mw.onBefore!(mockContext);
      expect(result1).toBe(true);

      const result2 = await mw.onBefore!(mockContext);
      expect(result2).toBe(false); // Limited

      vi.advanceTimersByTime(101);
      const result3 = await mw.onBefore!(mockContext);
      expect(result3).toBe(true); // Reset

      vi.useRealTimers();
    });

    it('should track rate limits per channel', async () => {
      const mw = rateLimitMiddleware(1, 1000);

      const context1 = { ...mockContext, channel: 'channel-1' };
      const context2 = { ...mockContext, channel: 'channel-2' };

      const result1 = await mw.onBefore!(context1);
      const result2 = await mw.onBefore!(context1);
      const result3 = await mw.onBefore!(context2);

      expect(result1).toBe(true);
      expect(result2).toBe(false); // Limited on channel-1
      expect(result3).toBe(true); // Allowed on channel-2
    });
  });

  describe('Middleware Integration', () => {
    it('should compose multiple middleware correctly', async () => {
      const mw1: WebSocketSubscriberMiddleware = {
        name: 'first',
        onBefore: vi.fn().mockResolvedValue(true),
        onAfter: vi.fn(),
      };

      const mw2: WebSocketSubscriberMiddleware = {
        name: 'second',
        onBefore: vi.fn().mockResolvedValue(true),
        onAfter: vi.fn(),
      };

      const handler = vi.fn().mockResolvedValue('result');

      await executeWithMiddleware(handler, [mw1, mw2], mockContext);

      expect(mw1.onBefore).toHaveBeenCalled();
      expect(mw2.onBefore).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
      expect(mw1.onAfter).toHaveBeenCalled();
      expect(mw2.onAfter).toHaveBeenCalled();
    });

    it('should handle middleware and handler errors together', async () => {
      const mw: WebSocketSubscriberMiddleware = {
        name: 'testMiddleware',
        onBefore: vi.fn().mockResolvedValue(true),
        onError: vi.fn().mockResolvedValue(false), // Propagate
      };

      const handler = vi.fn().mockRejectedValue(new Error('Handler error'));

      await expect(executeWithMiddleware(handler, [mw], mockContext)).rejects.toThrow('Handler error');

      expect(mw.onError).toHaveBeenCalled();
    });
  });
});
