import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CachePerformanceWrapper } from '../../../src/performance/cache-performance.js';
import { PerformanceMonitor } from '../../../src/performance/performance-monitor.js';

vi.mock('../../../src/performance/performance-monitor.js', () => {
  const mockMonitor = {
    measureAsync: vi.fn(async ({ fn }) => fn()),
    measureSync: vi.fn(fn => fn()),
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
});
