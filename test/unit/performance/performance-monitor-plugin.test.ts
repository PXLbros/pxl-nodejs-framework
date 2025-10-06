import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceMonitorPlugin } from '../../../src/performance/performance-monitor.plugin.js';
import { PerformanceMonitor } from '../../../src/performance/performance-monitor.js';
import { Logger } from '../../../src/logger/index.js';
import {
  DatabasePerformanceWrapper,
  QueuePerformanceWrapper,
  CachePerformanceWrapper,
} from '../../../src/performance/index.js';
import type BaseApplication from '../../../src/application/base-application.js';

vi.mock('../../../src/logger/index.js', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/performance/performance-monitor.js', () => ({
  PerformanceMonitor: {
    initialize: vi.fn(),
  },
}));

vi.mock('../../../src/performance/index.js', () => ({
  DatabasePerformanceWrapper: {
    setPerformanceMonitor: vi.fn(),
  },
  QueuePerformanceWrapper: {
    setPerformanceMonitor: vi.fn(),
  },
  CachePerformanceWrapper: {
    setPerformanceMonitor: vi.fn(),
  },
}));

describe('PerformanceMonitorPlugin', () => {
  let mockApp: any;
  let mockPerformanceMonitor: any;
  let mockLifecycle: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPerformanceMonitor = {
      generateFormattedReport: vi.fn(),
      destroy: vi.fn(),
    };

    mockLifecycle = {
      onShutdown: vi.fn(),
    };

    mockApp = {
      config: {
        performanceMonitoring: {
          enabled: true,
          thresholds: {},
          maxMetricsHistory: 1000,
          logSlowOperations: true,
          logAllOperations: false,
        },
      },
      lifecycle: mockLifecycle,
      performanceMonitor: undefined,
    };

    vi.mocked(PerformanceMonitor.initialize).mockReturnValue(mockPerformanceMonitor);
  });

  describe('register', () => {
    it('should register plugin and call start', () => {
      const plugin = PerformanceMonitorPlugin.register(mockApp);

      expect(plugin).toBeDefined();
      expect(mockLifecycle.onShutdown).toHaveBeenCalled();
    });

    it('should register shutdown handler', () => {
      PerformanceMonitorPlugin.register(mockApp);

      expect(mockLifecycle.onShutdown).toHaveBeenCalledTimes(1);
      expect(typeof mockLifecycle.onShutdown.mock.calls[0][0]).toBe('function');
    });
  });

  describe('start', () => {
    it('should initialize performance monitor when enabled', () => {
      const plugin = PerformanceMonitorPlugin.register(mockApp);

      expect(PerformanceMonitor.initialize).toHaveBeenCalledWith({
        enabled: true,
        thresholds: {},
        maxMetricsHistory: 1000,
        logSlowOperations: true,
        logAllOperations: false,
      });
      expect(mockApp.performanceMonitor).toBe(mockPerformanceMonitor);
    });

    it('should not start when disabled in config', () => {
      mockApp.config.performanceMonitoring.enabled = false;

      PerformanceMonitorPlugin.register(mockApp);

      expect(PerformanceMonitor.initialize).not.toHaveBeenCalled();
      expect(Logger.debug).toHaveBeenCalledWith({
        message: 'PerformanceMonitorPlugin: disabled via configuration',
      });
    });

    it('should not start when performanceMonitoring config is missing', () => {
      mockApp.config.performanceMonitoring = undefined;

      PerformanceMonitorPlugin.register(mockApp);

      expect(PerformanceMonitor.initialize).not.toHaveBeenCalled();
    });

    it('should be idempotent when called multiple times', () => {
      const plugin = PerformanceMonitorPlugin.register(mockApp);
      (plugin as any).start();
      (plugin as any).start();

      expect(PerformanceMonitor.initialize).toHaveBeenCalledTimes(1);
    });

    it('should configure database monitoring when enabled', () => {
      mockApp.config.performanceMonitoring.monitorDatabaseOperations = true;

      PerformanceMonitorPlugin.register(mockApp);

      expect(DatabasePerformanceWrapper.setPerformanceMonitor).toHaveBeenCalledWith(mockPerformanceMonitor);
    });

    it('should skip database monitoring when disabled', () => {
      mockApp.config.performanceMonitoring.monitorDatabaseOperations = false;

      PerformanceMonitorPlugin.register(mockApp);

      expect(DatabasePerformanceWrapper.setPerformanceMonitor).not.toHaveBeenCalled();
    });

    it('should configure queue monitoring when enabled', () => {
      mockApp.config.performanceMonitoring.monitorQueueOperations = true;

      PerformanceMonitorPlugin.register(mockApp);

      expect(QueuePerformanceWrapper.setPerformanceMonitor).toHaveBeenCalledWith(mockPerformanceMonitor);
    });

    it('should skip queue monitoring when disabled', () => {
      mockApp.config.performanceMonitoring.monitorQueueOperations = false;

      PerformanceMonitorPlugin.register(mockApp);

      expect(QueuePerformanceWrapper.setPerformanceMonitor).not.toHaveBeenCalled();
    });

    it('should configure cache monitoring when enabled', () => {
      mockApp.config.performanceMonitoring.monitorCacheOperations = true;

      PerformanceMonitorPlugin.register(mockApp);

      expect(CachePerformanceWrapper.setPerformanceMonitor).toHaveBeenCalledWith(mockPerformanceMonitor);
    });

    it('should skip cache monitoring when disabled', () => {
      mockApp.config.performanceMonitoring.monitorCacheOperations = false;

      PerformanceMonitorPlugin.register(mockApp);

      expect(CachePerformanceWrapper.setPerformanceMonitor).not.toHaveBeenCalled();
    });

    it('should handle errors when configuring wrappers', () => {
      vi.mocked(DatabasePerformanceWrapper.setPerformanceMonitor).mockImplementation(() => {
        throw new Error('Wrapper configuration failed');
      });

      PerformanceMonitorPlugin.register(mockApp);

      expect(Logger.warn).toHaveBeenCalledWith({
        message: 'PerformanceMonitorPlugin: error configuring wrappers',
        error: expect.any(Error),
      });
    });

    it('should setup periodic reporting when reportInterval is configured', () => {
      vi.useFakeTimers();
      mockApp.config.performanceMonitoring.reportInterval = 5000;
      mockApp.config.performanceMonitoring.reportFormat = 'summary';
      mockPerformanceMonitor.generateFormattedReport.mockReturnValue('Performance Report');

      PerformanceMonitorPlugin.register(mockApp);

      vi.advanceTimersByTime(5000);

      expect(mockPerformanceMonitor.generateFormattedReport).toHaveBeenCalledWith('summary');
      expect(Logger.info).toHaveBeenCalledWith({ message: 'Performance Report' });

      vi.useRealTimers();
    });

    it('should use default report format when not specified', () => {
      vi.useFakeTimers();
      mockApp.config.performanceMonitoring.reportInterval = 5000;
      mockPerformanceMonitor.generateFormattedReport.mockReturnValue('Performance Report');

      PerformanceMonitorPlugin.register(mockApp);

      vi.advanceTimersByTime(5000);

      expect(mockPerformanceMonitor.generateFormattedReport).toHaveBeenCalledWith('detailed');

      vi.useRealTimers();
    });

    it('should handle errors during report generation', () => {
      vi.useFakeTimers();
      mockApp.config.performanceMonitoring.reportInterval = 5000;
      mockPerformanceMonitor.generateFormattedReport.mockImplementation(() => {
        throw new Error('Report generation failed');
      });

      PerformanceMonitorPlugin.register(mockApp);

      vi.advanceTimersByTime(5000);

      expect(Logger.warn).toHaveBeenCalledWith({
        message: 'PerformanceMonitorPlugin: failed generating report',
        error: expect.any(Error),
      });

      vi.useRealTimers();
    });

    it('should not setup reporting when reportInterval is 0', () => {
      mockApp.config.performanceMonitoring.reportInterval = 0;
      mockPerformanceMonitor.generateFormattedReport.mockReturnValue('Report');

      PerformanceMonitorPlugin.register(mockApp);

      expect(mockPerformanceMonitor.generateFormattedReport).not.toHaveBeenCalled();
    });

    it('should not setup reporting when reportInterval is negative', () => {
      mockApp.config.performanceMonitoring.reportInterval = -1000;

      PerformanceMonitorPlugin.register(mockApp);

      expect(mockPerformanceMonitor.generateFormattedReport).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should destroy performance monitor and clean up', () => {
      const plugin = PerformanceMonitorPlugin.register(mockApp);

      (plugin as any).stop();

      expect(mockPerformanceMonitor.destroy).toHaveBeenCalled();
      expect(mockApp.performanceMonitor).toBeUndefined();
      expect(Logger.debug).toHaveBeenCalledWith({ message: 'PerformanceMonitorPlugin: stopped' });
    });

    it('should be idempotent when called multiple times', () => {
      const plugin = PerformanceMonitorPlugin.register(mockApp);

      (plugin as any).stop();
      (plugin as any).stop();

      expect(mockPerformanceMonitor.destroy).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during destroy', () => {
      mockPerformanceMonitor.destroy.mockImplementation(() => {
        throw new Error('Destroy failed');
      });

      const plugin = PerformanceMonitorPlugin.register(mockApp);

      (plugin as any).stop();

      expect(Logger.warn).toHaveBeenCalledWith({
        message: 'PerformanceMonitorPlugin: error during destroy',
        error: expect.any(Error),
      });
    });

    it('should abort ongoing operations when stopped', () => {
      vi.useFakeTimers();
      mockApp.config.performanceMonitoring.reportInterval = 5000;
      mockPerformanceMonitor.generateFormattedReport.mockReturnValue('Report');

      const plugin = PerformanceMonitorPlugin.register(mockApp);

      vi.advanceTimersByTime(5000);
      expect(mockPerformanceMonitor.generateFormattedReport).toHaveBeenCalledTimes(1);

      (plugin as any).stop();

      vi.advanceTimersByTime(5000);
      // Should not be called again after stop
      expect(mockPerformanceMonitor.generateFormattedReport).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
