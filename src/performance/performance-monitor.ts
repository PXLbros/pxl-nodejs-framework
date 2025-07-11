import { PerformanceObserver, performance } from 'perf_hooks';
import { Logger } from '../logger/index.js';

export interface PerformanceMetrics {
  name: string;
  duration: number;
  timestamp: number;
  type: 'http' | 'database' | 'cache' | 'queue' | 'websocket' | 'custom';
  metadata?: Record<string, any>;
}

export interface PerformanceThresholds {
  http: number;
  database: number;
  cache: number;
  queue: number;
  websocket: number;
  custom: number;
}

export interface PerformanceMonitorOptions {
  enabled?: boolean;
  maxMetricsHistory?: number;
  thresholds?: Partial<PerformanceThresholds>;
  logSlowOperations?: boolean;
  logAllOperations?: boolean;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private observer: PerformanceObserver | undefined;
  private metrics: PerformanceMetrics[] = [];
  private thresholds: PerformanceThresholds = {
    http: 1000, // 1 second
    database: 500, // 500ms
    cache: 100, // 100ms
    queue: 2000, // 2 seconds
    websocket: 200, // 200ms
    custom: 1000, // 1 second
  };
  private maxMetricsHistory = 10000;
  private isEnabled = true;
  private logSlowOperations = true;
  private logAllOperations = false;

  private constructor(options: PerformanceMonitorOptions = {}) {
    this.isEnabled = options.enabled ?? true;
    this.maxMetricsHistory = options.maxMetricsHistory ?? 10000;
    this.logSlowOperations = options.logSlowOperations ?? true;
    this.logAllOperations = options.logAllOperations ?? false;

    if (options.thresholds) {
      this.thresholds = { ...this.thresholds, ...options.thresholds };
    }

    if (this.isEnabled) {
      this.initializeObserver();
    }
  }

  public static getInstance(options?: PerformanceMonitorOptions): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(options);
    }
    return PerformanceMonitor.instance;
  }

  public static initialize(options: PerformanceMonitorOptions = {}): PerformanceMonitor {
    PerformanceMonitor.instance = new PerformanceMonitor(options);
    return PerformanceMonitor.instance;
  }

  private initializeObserver(): void {
    this.observer = new PerformanceObserver(items => {
      items.getEntries().forEach(entry => {
        if (entry.name.startsWith('pxl-performance:')) {
          this.handlePerformanceEntry(entry);
        }
      });
    });

    this.observer.observe({ entryTypes: ['measure'] });
  }

  private handlePerformanceEntry(entry: any): void {
    if (!this.isEnabled) return;

    const [, type, name] = entry.name.split(':');
    const metricType = type as PerformanceMetrics['type'];

    const metric: PerformanceMetrics = {
      name,
      duration: entry.duration,
      timestamp: Date.now(),
      type: metricType,
      metadata: entry.detail,
    };

    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Check thresholds and log warnings
    const threshold = this.thresholds[metricType];
    if (this.logSlowOperations && entry.duration > threshold) {
      Logger.warn({
        message: `Performance threshold exceeded`,
        meta: {
          operation: entry.name,
          duration: `${entry.duration.toFixed(2)}ms`,
          threshold: `${threshold}ms`,
          type: metricType,
        },
      });
    }

    // Log all operations if enabled
    if (this.logAllOperations) {
      Logger.debug({
        message: `Performance metric`,
        meta: {
          operation: entry.name,
          duration: `${entry.duration.toFixed(2)}ms`,
          type: metricType,
        },
      });
    }
  }

  public startMeasure(name: string, type: PerformanceMetrics['type'] = 'custom'): string {
    if (!this.isEnabled) return '';

    const measureName = `pxl-performance:${type}:${name}`;
    const startMark = `${measureName}-start`;

    performance.mark(startMark);
    return startMark;
  }

  public endMeasure(startMark: string, _metadata?: Record<string, any>): void {
    if (!this.isEnabled || !startMark) return;

    const endMark = `${startMark.replace('-start', '')}-end`;
    const measureName = startMark.replace('-start', '');

    performance.mark(endMark);

    try {
      performance.measure(measureName, startMark, endMark);

      // Clean up marks
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
    } catch (error) {
      Logger.error({
        error: error instanceof Error ? error : new Error(String(error)),
        message: 'Error measuring performance',
      });
    }
  }

  public async measureAsync<T>({
    name,
    type,
    fn,
    metadata,
  }: {
    name: string;
    type: PerformanceMetrics['type'];
    fn: () => Promise<T>;
    metadata?: Record<string, any>;
  }): Promise<T> {
    if (!this.isEnabled) {
      return fn();
    }

    const startMark = this.startMeasure(name, type);

    try {
      const result = await fn();
      this.endMeasure(startMark, metadata);
      return result;
    } catch (error) {
      this.endMeasure(startMark, { ...metadata, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  public measureSync<T>(
    name: string,
    type: PerformanceMetrics['type'],
    fn: () => T,
    metadata?: Record<string, any>,
  ): T {
    if (!this.isEnabled) {
      return fn();
    }

    const startMark = this.startMeasure(name, type);

    try {
      const result = fn();
      this.endMeasure(startMark, metadata);
      return result;
    } catch (error) {
      this.endMeasure(startMark, { ...metadata, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  public getMetrics(type?: PerformanceMetrics['type'], limit?: number): PerformanceMetrics[] {
    let filteredMetrics = this.metrics;

    if (type) {
      filteredMetrics = filteredMetrics.filter(m => m.type === type);
    }

    if (limit) {
      filteredMetrics = filteredMetrics.slice(-limit);
    }

    return filteredMetrics;
  }

  public getAverageMetrics(type?: PerformanceMetrics['type']): Record<string, number> {
    const metrics = this.getMetrics(type);
    const groups = metrics.reduce(
      (acc, metric) => {
        if (!acc[metric.name]) {
          acc[metric.name] = [];
        }
        acc[metric.name].push(metric.duration);
        return acc;
      },
      {} as Record<string, number[]>,
    );

    return Object.entries(groups).reduce(
      (acc, [name, durations]) => {
        acc[name] = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  public getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  public getDetailedMemoryUsage(): Record<string, number> {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024), // MB
    };
  }

  public getCpuUsage(): NodeJS.CpuUsage {
    return process.cpuUsage();
  }

  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    if (enabled && !this.observer) {
      this.initializeObserver();
    } else if (!enabled && this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }

  public clearMetrics(): void {
    this.metrics = [];
  }

  public generateReport(): {
    summary: {
      totalMetrics: number;
      averages: Record<string, number>;
      thresholds: PerformanceThresholds;
      enabled: boolean;
    };
    metrics: PerformanceMetrics[];
    memory: Record<string, number>;
    cpu: NodeJS.CpuUsage;
  } {
    return {
      summary: {
        totalMetrics: this.metrics.length,
        averages: this.getAverageMetrics(),
        thresholds: this.thresholds,
        enabled: this.isEnabled,
      },
      metrics: this.getMetrics(undefined, 100), // Last 100 metrics
      memory: this.getDetailedMemoryUsage(),
      cpu: this.getCpuUsage(),
    };
  }

  public generateFormattedReport(format: 'simple' | 'detailed' = 'detailed'): string {
    const report = this.generateReport();

    if (format === 'simple') {
      const memoryUsed = report.memory.heapUsed;
      const cpuPercent = Math.round((report.cpu.user + report.cpu.system) / 1000000); // Convert microseconds to rough percentage
      const avgDurations = Object.values(report.summary.averages);
      const avgMetric =
        avgDurations.length > 0 ? Math.round(avgDurations.reduce((sum, val) => sum + val, 0) / avgDurations.length) : 0;

      return `Performance Report (summary: ${report.summary.totalMetrics} ops, avg: ${avgMetric}ms | metrics: ${report.metrics.length} | memory: ${memoryUsed}mb | cpu: ${cpuPercent}%)`;
    }
    const lines = [
      'Performance Report:',
      `Summary: ${report.summary.totalMetrics} operations tracked, enabled: ${report.summary.enabled}`,
      `Metrics: ${report.metrics.length} recent operations recorded`,
      `Memory: RSS: ${report.memory.rss}mb, Heap: ${report.memory.heapUsed}/${report.memory.heapTotal}mb`,
      `CPU: User: ${Math.round(report.cpu.user / 1000)}ms, System: ${Math.round(report.cpu.system / 1000)}ms`,
    ];

    if (Object.keys(report.summary.averages).length > 0) {
      lines.push(
        `Averages: ${Object.entries(report.summary.averages)
          .map(([name, avg]) => `${name}: ${Math.round(avg)}ms`)
          .join(', ')}`,
      );
    }

    return lines.join('\n');
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
    this.metrics = [];
  }
}
