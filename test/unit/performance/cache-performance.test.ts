import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CachePerformanceWrapper } from '../../../src/performance/cache-performance.js';
import { PerformanceMonitor } from '../../../src/performance/performance-monitor.js';

vi.mock('../../../src/performance/performance-monitor.js', () => {
  const mockMonitor = {
    measureAsync: vi.fn(async (options: any) => {
      if (typeof options.fn === 'function') {
        return options.fn();
      }
      return undefined;
    }),
    measureSync: vi.fn((fn: any) => {
      if (typeof fn === 'function') {
        return fn();
      }
      return undefined;
    }),
  };

  return {
    PerformanceMonitor: {
      getInstance: vi.fn(() => mockMonitor),
    },
  };
});

describe('CachePerformanceWrapper', () => {
  let mockMonitor: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMonitor = PerformanceMonitor.getInstance();
  });

  describe('setPerformanceMonitor and getPerformanceMonitor', () => {
    it('should set and get performance monitor', () => {
      const customMonitor = { custom: 'monitor' } as any;
      CachePerformanceWrapper.setPerformanceMonitor(customMonitor);

      const result = CachePerformanceWrapper.getPerformanceMonitor();
      expect(result).toBe(customMonitor);
    });

    it('should get default monitor if not set', () => {
      // Reset by setting to undefined
      CachePerformanceWrapper.setPerformanceMonitor(undefined as any);

      const result = CachePerformanceWrapper.getPerformanceMonitor();
      expect(result).toBeDefined();
    });
  });

  describe('monitorConnection', () => {
    it('should monitor connection operation', async () => {
      const operation = vi.fn().mockResolvedValue('connected');

      const result = await CachePerformanceWrapper.monitorConnection('connect', operation);

      expect(result).toBe('connected');
      expect(mockMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'connection.connect',
        type: 'cache',
        fn: operation,
        metadata: { operation: 'connect' },
      });
    });

    it('should monitor connection with metadata', async () => {
      const operation = vi.fn().mockResolvedValue('connected');
      const metadata = { host: 'localhost', port: 6379 };

      await CachePerformanceWrapper.monitorConnection('connect', operation, metadata);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'connection.connect',
        type: 'cache',
        fn: operation,
        metadata: { operation: 'connect', host: 'localhost', port: 6379 },
      });
    });
  });

  describe('monitorGet', () => {
    it('should monitor get operation with cache hit', async () => {
      const operation = vi.fn().mockResolvedValue('cached-value');

      const result = await CachePerformanceWrapper.monitorGet('test-key', operation);

      expect(result).toBe('cached-value');
      expect(mockMonitor.measureAsync).toHaveBeenCalled();
    });

    it('should monitor get operation with cache miss', async () => {
      const operation = vi.fn().mockResolvedValue(null);

      const result = await CachePerformanceWrapper.monitorGet('test-key', operation);

      expect(result).toBeNull();
      expect(mockMonitor.measureAsync).toHaveBeenCalled();
    });
  });

  describe('monitorSet', () => {
    it('should monitor set operation', async () => {
      const operation = vi.fn().mockResolvedValue('OK');

      const result = await CachePerformanceWrapper.monitorSet('test-key', operation);

      expect(result).toBe('OK');
      expect(mockMonitor.measureAsync).toHaveBeenCalled();
    });

    it('should monitor set operation with TTL metadata', async () => {
      const operation = vi.fn().mockResolvedValue('OK');
      const metadata = { ttl: 3600 };

      await CachePerformanceWrapper.monitorSet('test-key', operation, metadata);

      expect(mockMonitor.measureAsync).toHaveBeenCalled();
    });
  });

  describe('monitorDelete', () => {
    it('should monitor delete operation', async () => {
      const operation = vi.fn().mockResolvedValue(1);

      const result = await CachePerformanceWrapper.monitorDelete('test-key', operation);

      expect(result).toBe(1);
      expect(mockMonitor.measureAsync).toHaveBeenCalled();
    });
  });

  describe('monitorExists', () => {
    it('should monitor exists operation', async () => {
      const operation = vi.fn().mockResolvedValue(true);

      const result = await CachePerformanceWrapper.monitorExists('test-key', operation);

      expect(result).toBe(true);
      expect(mockMonitor.measureAsync).toHaveBeenCalled();
    });
  });

  describe('monitorClear', () => {
    it('should monitor clear operation with pattern', async () => {
      const operation = vi.fn().mockResolvedValue(10);

      const result = await CachePerformanceWrapper.monitorClear('user:*', operation);

      expect(result).toBe(10);
      expect(mockMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'clear.user:*',
        type: 'cache',
        fn: operation,
        metadata: { operation: 'clear', keyPattern: 'user:*' },
      });
    });

    it('should monitor clear with metadata', async () => {
      const operation = vi.fn().mockResolvedValue(5);
      const metadata = { size: 5 };

      await CachePerformanceWrapper.monitorClear('session:*', operation, metadata);

      expect(mockMonitor.measureAsync).toHaveBeenCalled();
    });
  });

  describe('monitorMultiGet', () => {
    it('should monitor multi-get operation', async () => {
      const operation = vi.fn().mockResolvedValue(['value1', 'value2', 'value3']);
      const keys = ['key1', 'key2', 'key3'];

      const result = await CachePerformanceWrapper.monitorMultiGet(keys, operation);

      expect(result).toEqual(['value1', 'value2', 'value3']);
      expect(mockMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'multi_get.3_keys',
        type: 'cache',
        fn: operation,
        metadata: { operation: 'multi_get', keyPattern: '[key1, key2, key3]' },
      });
    });

    it('should monitor multi-get with metadata', async () => {
      const operation = vi.fn().mockResolvedValue([]);
      const metadata = { ttl: 60 };

      await CachePerformanceWrapper.monitorMultiGet(['a', 'b'], operation, metadata);

      expect(mockMonitor.measureAsync).toHaveBeenCalled();
    });
  });

  describe('monitorMultiSet', () => {
    it('should monitor multi-set operation', async () => {
      const operation = vi.fn().mockResolvedValue('OK');
      const keys = ['key1', 'key2', 'key3'];

      const result = await CachePerformanceWrapper.monitorMultiSet(keys, operation);

      expect(result).toBe('OK');
      expect(mockMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'multi_set.3_keys',
        type: 'cache',
        fn: operation,
        metadata: { operation: 'multi_set', keyPattern: '[key1, key2, key3]' },
      });
    });

    it('should monitor multi-set with TTL', async () => {
      const operation = vi.fn().mockResolvedValue('OK');
      const metadata = { ttl: 3600 };

      await CachePerformanceWrapper.monitorMultiSet(['x', 'y'], operation, metadata);

      expect(mockMonitor.measureAsync).toHaveBeenCalled();
    });
  });

  describe('monitorIncrement', () => {
    it('should monitor increment operation', async () => {
      const operation = vi.fn().mockResolvedValue(42);

      const result = await CachePerformanceWrapper.monitorIncrement('counter', operation);

      expect(result).toBe(42);
      expect(mockMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'increment.counter',
        type: 'cache',
        fn: operation,
        metadata: { operation: 'increment', key: 'counter' },
      });
    });

    it('should monitor increment with metadata', async () => {
      const operation = vi.fn().mockResolvedValue(100);
      const metadata = { size: 1 };

      await CachePerformanceWrapper.monitorIncrement('views', operation, metadata);

      expect(mockMonitor.measureAsync).toHaveBeenCalled();
    });
  });

  describe('monitorDecrement', () => {
    it('should monitor decrement operation', async () => {
      const operation = vi.fn().mockResolvedValue(10);

      const result = await CachePerformanceWrapper.monitorDecrement('countdown', operation);

      expect(result).toBe(10);
      expect(mockMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'decrement.countdown',
        type: 'cache',
        fn: operation,
        metadata: { operation: 'decrement', key: 'countdown' },
      });
    });

    it('should monitor decrement with metadata', async () => {
      const operation = vi.fn().mockResolvedValue(0);
      const metadata = { size: 1 };

      await CachePerformanceWrapper.monitorDecrement('stock', operation, metadata);

      expect(mockMonitor.measureAsync).toHaveBeenCalled();
    });
  });
});
