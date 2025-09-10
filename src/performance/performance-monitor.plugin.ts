import type BaseApplication from '../application/base-application.js';
import { Logger } from '../logger/index.js';
import { PerformanceMonitor, type PerformanceMonitorOptions } from './performance-monitor.js';
import { CachePerformanceWrapper, DatabasePerformanceWrapper, QueuePerformanceWrapper } from './index.js';

/**
 * PerformanceMonitorPlugin
 *
 * Converts the previous side-effect constructor initialization into an opt‑in plugin.
 * Responsibilities:
 *  - Initialize PerformanceMonitor when enabled in config
 *  - Register metric wrappers (DB / Queue / Cache) based on flags
 *  - Schedule periodic reporting (tracked via lifecycle for auto cleanup)
 *  - Dispose monitor on shutdown
 */
export class PerformanceMonitorPlugin {
  private started = false;
  private reportIntervalId?: NodeJS.Timeout;

  private constructor(private readonly app: BaseApplication) {}

  /** Register and immediately start (idempotent) */
  public static register(app: BaseApplication): PerformanceMonitorPlugin {
    const plugin = new PerformanceMonitorPlugin(app);
    plugin.start();
    // Ensure cleanup on shutdown
    app.lifecycle.onShutdown(async () => plugin.stop());
    return plugin;
  }

  /** Initialize monitor & ancillary behaviors */
  public start(): void {
    if (this.started) return;
    const cfg = this.app['config'].performanceMonitoring; // internal access
    if (!cfg?.enabled) {
      Logger.debug({ message: 'PerformanceMonitorPlugin: disabled via configuration' });
      return; // remain not started
    }

    const options: PerformanceMonitorOptions = {
      enabled: true,
      thresholds: cfg.thresholds,
      maxMetricsHistory: cfg.maxMetricsHistory,
      logSlowOperations: cfg.logSlowOperations,
      logAllOperations: cfg.logAllOperations,
    };

    this.app.performanceMonitor = PerformanceMonitor.initialize(options);

    // Register component wrappers according to config
    try {
      if (cfg.monitorDatabaseOperations !== false) {
        DatabasePerformanceWrapper.setPerformanceMonitor(this.app.performanceMonitor);
      }
      if (cfg.monitorQueueOperations !== false) {
        QueuePerformanceWrapper.setPerformanceMonitor(this.app.performanceMonitor);
      }
      if (cfg.monitorCacheOperations !== false) {
        CachePerformanceWrapper.setPerformanceMonitor(this.app.performanceMonitor);
      }
    } catch (error) {
      Logger.warn({ message: 'PerformanceMonitorPlugin: error configuring wrappers', error });
    }

    // Periodic reporting
    if (cfg.reportInterval && cfg.reportInterval > 0) {
      this.reportIntervalId = setInterval(() => {
        try {
          const reportFormat = cfg.reportFormat ?? 'detailed';
          const report = this.app.performanceMonitor?.generateFormattedReport(reportFormat);
          if (report) {
            Logger.info({ message: report });
          }
        } catch (error) {
          Logger.warn({ message: 'PerformanceMonitorPlugin: failed generating report', error });
        }
      }, cfg.reportInterval);
      this.app.lifecycle.trackInterval(this.reportIntervalId);
    }

    this.started = true;
    Logger.debug({ message: 'PerformanceMonitorPlugin: started' });
  }

  /** Destroy monitor & clear references */
  public stop(): void {
    if (!this.started) return;
    try {
      this.app.performanceMonitor?.destroy();
    } catch (error) {
      Logger.warn({ message: 'PerformanceMonitorPlugin: error during destroy', error });
    }
    this.app.performanceMonitor = undefined;
    this.started = false;
    Logger.debug({ message: 'PerformanceMonitorPlugin: stopped' });
  }
}
