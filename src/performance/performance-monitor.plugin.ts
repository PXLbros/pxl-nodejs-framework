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
  private abortController = new AbortController();

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
      // Note: setInterval with signal option requires Node.js 15+
      // TypeScript types may not reflect this, so we use type assertion
      (setInterval as (fn: () => void, ms: number, options?: { signal: AbortSignal }) => NodeJS.Timeout)(
        () => {
          try {
            const reportFormat = cfg.reportFormat ?? 'detailed';
            const report = this.app.performanceMonitor?.generateFormattedReport(reportFormat);
            if (report) {
              Logger.info({ message: report });
            }
          } catch (error) {
            Logger.warn({ message: 'PerformanceMonitorPlugin: failed generating report', error });
          }
        },
        cfg.reportInterval,
        { signal: this.abortController.signal },
      );
    }

    this.started = true;
    Logger.debug({ message: 'PerformanceMonitorPlugin: started' });
  }

  /** Destroy monitor & clear references */
  public stop(): void {
    if (!this.started) return;

    // Abort all ongoing operations (intervals, etc.)
    this.abortController.abort();

    try {
      this.app.performanceMonitor?.destroy();
    } catch (error) {
      Logger.warn({ message: 'PerformanceMonitorPlugin: error during destroy', error });
    }
    this.app.performanceMonitor = undefined;

    // Create new AbortController for potential restart
    this.abortController = new AbortController();

    this.started = false;
    Logger.debug({ message: 'PerformanceMonitorPlugin: stopped' });
  }
}
