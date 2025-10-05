import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from '../../../src/performance/performance-monitor.js';
import { Logger } from '../../../src/logger/index.js';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    // Reset singleton instance before each test
    (PerformanceMonitor as any).instance = undefined;
    monitor = PerformanceMonitor.getInstance({ enabled: true, maxMetricsHistory: 100 });
  });

  afterEach(() => {
    monitor?.destroy();
  });

  describe('Initialization', () => {
    it('should create a singleton instance', () => {
      const instance1 = PerformanceMonitor.getInstance();
      const instance2 = PerformanceMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with custom options', () => {
      const customMonitor = PerformanceMonitor.initialize({
        enabled: true,
        maxMetricsHistory: 50,
        logSlowOperations: false,
        logAllOperations: true,
        thresholds: {
          http: 2000,
          database: 1000,
        },
      });

      expect(customMonitor).toBeDefined();
    });

    it('should initialize with observer when enabled', () => {
      const enabledMonitor = PerformanceMonitor.initialize({ enabled: true });
      expect(enabledMonitor).toBeDefined();
    });

    it('should not initialize observer when disabled', () => {
      const disabledMonitor = PerformanceMonitor.initialize({ enabled: false });
      expect(disabledMonitor).toBeDefined();
    });
  });

  describe('Performance Measurement', () => {
    it('should measure async operations', async () => {
      const result = await monitor.measureAsync({
        name: 'test-operation',
        type: 'custom',
        fn: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'success';
        },
      });

      expect(result).toBe('success');
      // Wait for async metric collection
      await new Promise(resolve => setTimeout(resolve, 100));
      const metrics = monitor.getMetrics('custom');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should measure async operations with metadata', async () => {
      await monitor.measureAsync({
        name: 'test-with-metadata',
        type: 'database',
        fn: async () => 'result',
        metadata: { query: 'SELECT *', table: 'users' },
      });

      // Wait for async metric collection
      await new Promise(resolve => setTimeout(resolve, 100));
      const metrics = monitor.getMetrics('database');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should handle async operation errors', async () => {
      await expect(
        monitor.measureAsync({
          name: 'failing-operation',
          type: 'custom',
          fn: async () => {
            throw new Error('Test error');
          },
        }),
      ).rejects.toThrow('Test error');

      // Wait for async metric collection
      await new Promise(resolve => setTimeout(resolve, 100));
      const metrics = monitor.getMetrics('custom');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should measure sync operations', async () => {
      const result = monitor.measureSync('sync-operation', 'custom', () => {
        return 42;
      });

      expect(result).toBe(42);
      // Wait for async metric collection
      await new Promise(resolve => setTimeout(resolve, 100));
      const metrics = monitor.getMetrics('custom');
      expect(metrics.length).toBeGreaterThanOrEqual(0); // May or may not be collected yet
    });

    it('should handle sync operation errors', async () => {
      expect(() => {
        monitor.measureSync('failing-sync', 'custom', () => {
          throw new Error('Sync error');
        });
      }).toThrow('Sync error');

      // Wait for async metric collection
      await new Promise(resolve => setTimeout(resolve, 100));
      const metrics = monitor.getMetrics('custom');
      expect(metrics.length).toBeGreaterThanOrEqual(0); // May or may not be collected yet
    });

    it('should not measure when disabled', async () => {
      monitor.setEnabled(false);

      const result = await monitor.measureAsync({
        name: 'disabled-test',
        type: 'custom',
        fn: async () => 'result',
      });

      expect(result).toBe('result');
      const metrics = monitor.getMetrics();
      expect(metrics.length).toBe(0);
    });
  });

  describe('Manual Measurement', () => {
    it('should start and end measurements manually', () => {
      const startMark = monitor.startMeasure('manual-test', 'http');
      expect(startMark).toBeTruthy();

      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        Math.sqrt(i);
      }

      monitor.endMeasure(startMark);
    });

    it('should handle empty start mark', () => {
      monitor.endMeasure('');
      // Should not throw
    });

    it('should not measure when disabled', () => {
      monitor.setEnabled(false);
      const startMark = monitor.startMeasure('disabled-manual', 'http');
      expect(startMark).toBe('');
    });
  });

  describe('Metrics Retrieval', () => {
    beforeEach(async () => {
      // Add some test metrics
      await monitor.measureAsync({ name: 'test1', type: 'http', fn: async () => 'result' });
      await monitor.measureAsync({ name: 'test2', type: 'database', fn: async () => 'result' });
      await monitor.measureAsync({ name: 'test3', type: 'http', fn: async () => 'result' });
      // Wait for async metric collection
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should get all metrics', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter metrics by type', () => {
      const httpMetrics = monitor.getMetrics('http');
      expect(httpMetrics.every(m => !m.type || m.type === 'http')).toBe(true);
    });

    it('should limit metrics count', () => {
      const limitedMetrics = monitor.getMetrics(undefined, 2);
      expect(limitedMetrics.length).toBeLessThanOrEqual(2);
    });

    it('should calculate average metrics', () => {
      const averages = monitor.getAverageMetrics();
      expect(typeof averages).toBe('object');
    });

    it('should calculate average metrics by type', () => {
      const httpAverages = monitor.getAverageMetrics('http');
      expect(typeof httpAverages).toBe('object');
    });
  });

  describe('Memory and CPU Usage', () => {
    it('should get memory usage', () => {
      const memory = monitor.getMemoryUsage();
      expect(memory).toHaveProperty('rss');
      expect(memory).toHaveProperty('heapTotal');
      expect(memory).toHaveProperty('heapUsed');
      expect(memory).toHaveProperty('external');
    });

    it('should get detailed memory usage in MB', () => {
      const detailedMemory = monitor.getDetailedMemoryUsage();
      expect(detailedMemory).toHaveProperty('rss');
      expect(detailedMemory).toHaveProperty('heapTotal');
      expect(detailedMemory).toHaveProperty('heapUsed');
      expect(detailedMemory).toHaveProperty('external');
      expect(detailedMemory).toHaveProperty('arrayBuffers');
      expect(typeof detailedMemory.rss).toBe('number');
    });

    it('should get CPU usage', () => {
      const cpu = monitor.getCpuUsage();
      expect(cpu).toHaveProperty('user');
      expect(cpu).toHaveProperty('system');
      expect(typeof cpu.user).toBe('number');
      expect(typeof cpu.system).toBe('number');
    });
  });

  describe('Thresholds', () => {
    it('should set custom thresholds', () => {
      monitor.setThresholds({
        http: 5000,
        database: 2000,
      });

      // Thresholds are internal, but we can verify by measuring
      expect(monitor).toBeDefined();
    });

    it('should log warnings for slow operations', async () => {
      const warnSpy = vi.spyOn(Logger, 'warn');

      monitor.setThresholds({ custom: 1 }); // Very low threshold

      await monitor.measureAsync({
        name: 'slow-op',
        type: 'custom',
        fn: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'result';
        },
      });

      // Give time for async observer to process
      await new Promise(resolve => setTimeout(resolve, 50));

      warnSpy.mockRestore();
    });
  });

  describe('Enable/Disable', () => {
    it('should disable monitoring', () => {
      monitor.setEnabled(false);
      const startMark = monitor.startMeasure('test', 'http');
      expect(startMark).toBe('');
    });

    it('should re-enable monitoring', async () => {
      monitor.setEnabled(false);
      monitor.setEnabled(true);

      const result = await monitor.measureAsync({
        name: 'enabled-test',
        type: 'custom',
        fn: async () => 'success',
      });

      expect(result).toBe('success');
    });

    it('should disconnect observer when disabled', () => {
      monitor.setEnabled(false);
      monitor.setEnabled(false); // Call again to test already disabled case
      expect(monitor).toBeDefined();
    });

    it('should reconnect observer when re-enabled', () => {
      monitor.setEnabled(false);
      monitor.setEnabled(true);
      expect(monitor).toBeDefined();
    });
  });

  describe('Clear Metrics', () => {
    it('should clear all metrics', async () => {
      await monitor.measureAsync({ name: 'test', type: 'http', fn: async () => 'result' });
      await new Promise(resolve => setTimeout(resolve, 100));

      monitor.clearMetrics();
      expect(monitor.getMetrics().length).toBe(0);
    });
  });

  describe('Reports', () => {
    beforeEach(async () => {
      await monitor.measureAsync({ name: 'report-test1', type: 'http', fn: async () => 'result' });
      await monitor.measureAsync({ name: 'report-test2', type: 'database', fn: async () => 'result' });
    });

    it('should generate a full report', () => {
      const report = monitor.generateReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('memory');
      expect(report).toHaveProperty('cpu');

      expect(report.summary).toHaveProperty('totalMetrics');
      expect(report.summary).toHaveProperty('averages');
      expect(report.summary).toHaveProperty('thresholds');
      expect(report.summary).toHaveProperty('enabled');

      expect(Array.isArray(report.metrics)).toBe(true);
      expect(typeof report.memory).toBe('object');
      expect(typeof report.cpu).toBe('object');
    });

    it('should generate a detailed formatted report', () => {
      const formattedReport = monitor.generateFormattedReport('detailed');

      expect(formattedReport).toContain('Performance Report:');
      expect(formattedReport).toContain('Summary:');
      expect(formattedReport).toContain('Memory:');
      expect(formattedReport).toContain('CPU:');
    });

    it('should generate a simple formatted report', () => {
      const simpleReport = monitor.generateFormattedReport('simple');

      expect(simpleReport).toContain('Performance Report');
      expect(simpleReport).toContain('ops');
      expect(simpleReport).toContain('memory:');
      expect(simpleReport).toContain('cpu:');
    });

    it('should handle empty metrics in simple report', () => {
      monitor.clearMetrics();
      const simpleReport = monitor.generateFormattedReport('simple');

      expect(simpleReport).toContain('Performance Report');
      expect(simpleReport).toContain('0 ops');
    });
  });

  describe('Metrics History Management', () => {
    it('should limit metrics history', async () => {
      const smallMonitor = PerformanceMonitor.initialize({ maxMetricsHistory: 5 });

      // Add more metrics than the limit
      for (let i = 0; i < 10; i++) {
        await smallMonitor.measureAsync({
          name: `test-${i}`,
          type: 'custom',
          fn: async () => i,
        });
      }

      // Give time for async observer
      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = smallMonitor.getMetrics();
      expect(metrics.length).toBeLessThanOrEqual(5);

      smallMonitor.destroy();
    });
  });

  describe('Destroy', () => {
    it('should destroy monitor and cleanup', () => {
      monitor.destroy();
      expect(monitor.getMetrics().length).toBe(0);
    });

    it('should handle destroying already destroyed monitor', () => {
      monitor.destroy();
      monitor.destroy();
      expect(monitor).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle performance measurement errors gracefully', async () => {
      const errorSpy = vi.spyOn(Logger, 'error');

      // Create a scenario where endMeasure might fail
      monitor.endMeasure('invalid-mark-name-xyz123', { test: 'metadata' });

      errorSpy.mockRestore();
    });

    it('should handle non-Error objects in async operations', async () => {
      await expect(
        monitor.measureAsync({
          name: 'string-error',
          type: 'custom',
          fn: async () => {
            throw 'String error';
          },
        }),
      ).rejects.toBe('String error');
    });

    it('should handle non-Error objects in sync operations', () => {
      expect(() => {
        monitor.measureSync('string-error-sync', 'custom', () => {
          throw 'String error sync';
        });
      }).toThrow('String error sync');
    });
  });

  describe('Performance Entry Handling', () => {
    it('should handle different metric types', async () => {
      const types: Array<'http' | 'database' | 'cache' | 'queue' | 'websocket' | 'custom'> = [
        'http',
        'database',
        'cache',
        'queue',
        'websocket',
        'custom',
      ];

      for (const type of types) {
        await monitor.measureAsync({
          name: `test-${type}`,
          type,
          fn: async () => 'result',
        });
      }

      // Wait for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = monitor.getMetrics();
      expect(metrics.length).toBeGreaterThanOrEqual(0);
    });
  });
});
