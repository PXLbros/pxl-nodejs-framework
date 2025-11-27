import type RedisInstance from '../redis/instance.js';
import type DatabaseInstance from '../database/instance.js';
import type QueueManager from '../queue/manager.js';
import type EventManager from '../event/manager.js';
import BaseApplication from './base-application.js';
import type { WorkerApplicationConfig } from './worker-application.interface.js';
import { Helper, Time } from '../util/index.js';
import { Logger } from '../logger/index.js';

/**
 * WorkerApplication
 *
 * A long-running application focused on queue processing.
 * Unlike WebApplication, it does not start a web server.
 * Unlike CommandApplication, it runs indefinitely.
 *
 * Workers are automatically started by QueueManager during initialization
 * (via BaseApplication.onBeforeStart()) with autorun: true. This class
 * simply provides the appropriate lifecycle management for long-running
 * queue worker processes.
 *
 * @example
 * ```typescript
 * import { WorkerApplication } from '@scpxl/nodejs-framework';
 *
 * const app = new WorkerApplication({
 *   name: 'my-worker',
 *   instanceId: 'worker-1',
 *   rootDirectory: __dirname,
 *   redis: { host: 'localhost', port: 6379 },
 *   queue: {
 *     processorsDirectory: './processors',
 *     queues: [{ name: 'default', jobs: [{ id: 'my-job' }] }],
 *   },
 *   auth: { jwtSecretKey: 'secret' },
 * });
 *
 * await app.start(); // Runs indefinitely, processing jobs
 * ```
 */
export default class WorkerApplication extends BaseApplication {
  /** Worker application config */
  protected config: WorkerApplicationConfig;

  constructor(config: WorkerApplicationConfig) {
    super(config);

    const defaultConfig: Partial<WorkerApplicationConfig> = {
      log: {
        startUp: true,
        shutdown: true,
      },
    };

    const mergedConfig = Helper.defaultsDeep(config, defaultConfig);
    this.config = mergedConfig;
  }

  /**
   * Start handler - workers are already started by BaseApplication.onBeforeStart()
   * via QueueManager.registerQueues() which creates workers with autorun: true.
   *
   * This method intentionally does minimal work since the queue workers
   * are already running. It registers a readiness check for monitoring.
   */
  protected async startHandler({
    redisInstance: _redisInstance,
    databaseInstance: _databaseInstance,
    queueManager: _queueManager,
    eventManager: _eventManager,
  }: {
    redisInstance: RedisInstance;
    databaseInstance: DatabaseInstance | null;
    queueManager: QueueManager;
    eventManager?: EventManager | null;
  }): Promise<void> {
    // Workers are already running via QueueManager (autorun: true)
    // This handler exists for any additional worker-specific initialization

    // Register readiness check for queue processing
    this.lifecycle.addReadinessCheck('workers', async () => {
      // Workers are ready if queueManager exists and has registered queues
      return !!this.queueManager;
    });
  }

  /**
   * Stop callback - cleanup worker-specific resources
   */
  protected async stopCallback(): Promise<void> {
    Logger.info({ message: 'Worker application stopping' });

    // Note: QueueWorkers are closed automatically by BullMQ when the process exits
    // and Redis connections are cleaned up by BaseApplication shutdown hooks
  }

  /**
   * Application started event
   */
  protected async onStarted({ startupTime }: { startupTime: number }): Promise<void> {
    if (this.config.log?.startUp) {
      const queueCount = this.config.queue?.queues?.length ?? 0;

      Logger.info({
        message: 'Worker application started',
        meta: {
          'Startup Time': Time.formatTime({
            time: startupTime,
            format: 's',
            numDecimals: 2,
            showUnit: true,
          }),
          'Queues Registered': queueCount,
        },
      });
    }

    if (this.config.events?.onStarted) {
      this.config.events.onStarted({
        app: this,
        startupTime,
      });
    }
  }

  /**
   * Application stopped event
   */
  protected async onStopped({ runtime }: { runtime: number }): Promise<void> {
    if (this.config.log?.shutdown) {
      Logger.info({
        message: 'Worker application stopped',
        meta: {
          Name: this.config.name,
          'Instance ID': this.config.instanceId,
          Runtime: Time.formatTime({
            time: runtime,
            format: 's',
            numDecimals: 2,
            showUnit: true,
          }),
        },
      });
    }

    if (this.config.events?.onStopped) {
      this.config.events.onStopped({ app: this, runtime });
    }
  }
}
