import cluster from 'cluster';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { type DatabaseInstance, DatabaseManager } from '../database/index.js';
import QueueManager from '../queue/manager.js';
import RedisManager from '../redis/manager.js';
import type {
  ApplicationConfig,
  ApplicationStartInstanceOptions,
  ApplicationStopInstanceOptions,
} from './base-application.interface.js';
import ClusterManager from '../cluster/cluster-manager.js';
import type RedisInstance from '../redis/instance.js';
import { OS, Time } from '../util/index.js';
import CacheManager from '../cache/manager.js';
import os from 'os';
import EventManager from '../event/manager.js';
import Logger from '../logger/logger.js';
import type { PerformanceMonitor } from '../performance/performance-monitor.js';
// Performance monitoring now pluginized
import { PerformanceMonitorPlugin } from '../performance/performance-monitor.plugin.js';
import { type LifecycleConfig, LifecycleManager, ShutdownController } from '../lifecycle/index.js';
import { type ExitOutcome, requestExit } from '../lifecycle/exit.js';

// Re-export types for external use
export type { ApplicationConfig } from './base-application.interface.js';

export default abstract class BaseApplication {
  /** Unique instance ID */
  public uniqueInstanceId: string;

  /** Application start time */
  protected startTime: [number, number] = [0, 0];

  /** Shutdown timeout (30 seconds) */
  protected shutdownTimeout = 30000;

  /** Cache for application version to avoid repeated imports */
  private static applicationVersionCache: string | undefined;

  /** Cluster worker ID */
  protected workerId = cluster.isWorker && cluster.worker ? cluster.worker.id : null;

  /** Application config */
  protected config: ApplicationConfig;

  /** Application version */
  protected applicationVersion?: string;

  /** Redis manager */
  public redisManager: RedisManager;

  /** Cache manager */
  public cacheManager: CacheManager;

  /** Database manager */
  public databaseManager?: DatabaseManager;

  /** Queue manager */
  public queueManager?: QueueManager;

  /** Event manager */
  public eventManager?: EventManager;

  /** Performance monitor */
  public performanceMonitor?: PerformanceMonitor;

  /** Lifecycle manager */
  public lifecycle: LifecycleManager;

  /** Shutdown controller */
  public shutdownController: ShutdownController;

  public get Name() {
    return this.config.name;
  }

  /**
   * Application constructor
   */
  constructor(config: ApplicationConfig) {
    const computerName = os.hostname();

    this.uniqueInstanceId = `${config.instanceId}-${computerName}-${OS.getUniqueComputerId()}`;

    this.config = config;

    // Initialize lifecycle management
    const lifecycleConfig: Partial<LifecycleConfig> = {
      gracefulShutdown: {
        timeoutMs: this.shutdownTimeout,
      },
    };
    this.lifecycle = new LifecycleManager(lifecycleConfig);
    this.shutdownController = new ShutdownController(this.lifecycle);

    // Register shutdown hooks for cleanup
    this.registerShutdownHooks();

    // const schema = Joi.object({
    //   name: Joi.string().required(),

    //   redis: {
    //     host: Joi.string().required(),
    //     port: Joi.number().required(),
    //     password: Joi.string().allow('').optional(),
    //   },

    //   database: {
    //     host: Joi.string().required(),
    //     port: Joi.number().required(),
    //     username: Joi.string().required(),
    //     password: Joi.string().required(),
    //     databaseName: Joi.string().required(),
    //   },
    // });

    // // Validation application constructor props
    // const validationResult = schema.validate(props);

    // if (validationResult.error) {
    //   throw new Error(validationResult.error.message);
    // }

    // Initialize Redis manager
    this.redisManager = new RedisManager({
      applicationConfig: this.config,
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
    });

    // Initialize cache manager
    this.cacheManager = new CacheManager({
      applicationConfig: this.config,
      redisManager: this.redisManager,
    });

    // Register performance monitor plugin (idempotent & opt-in)
    PerformanceMonitorPlugin.register(this);

    // Set up global error handlers
    this.setupGlobalErrorHandlers();

    if (this.config.database && this.config.database.enabled === true) {
      const defaultEntitiesDirectory = join(this.config.rootDirectory, 'src', 'database', 'entities');

      if (!this.config.database.entitiesDirectory) {
        this.config.database.entitiesDirectory = defaultEntitiesDirectory;
      }

      if (!existsSync(this.config.database.entitiesDirectory)) {
        throw new Error(`Database entities directory not found (Path: ${this.config.database.entitiesDirectory})`);
      }

      // Initialize Database manager
      this.databaseManager = new DatabaseManager({
        applicationConfig: this.config,
        host: this.config.database.host,
        port: this.config.database.port,
        username: this.config.database.username,
        password: this.config.database.password,
        databaseName: this.config.database.databaseName,
        entitiesDirectory: this.config.database.entitiesDirectory,
      });
    }
  }

  /**
   * Get application version
   */
  public async getApplicationVersion(): Promise<string> {
    // Return cached version if available
    if (BaseApplication.applicationVersionCache !== undefined) {
      return BaseApplication.applicationVersionCache;
    }

    // Resolve the path to package.json
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = resolve(__dirname, '../../package.json');

    // Read and parse the file
    const fileContents = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(fileContents);

    if (!packageJson?.version) {
      throw new Error('Application version not found');
    }

    // Cache and return the version
    BaseApplication.applicationVersionCache = packageJson.version;

    return packageJson.version;
  }

  /**
   * Start application
   */
  public async start(): Promise<void> {
    // Start application timer
    this.startTime = process.hrtime();

    // Get application version`
    this.applicationVersion = await this.getApplicationVersion();

    const startInstanceOptions: ApplicationStartInstanceOptions = {
      // onStarted: ({ startupTime }) => {
      //   if (this.config.log?.startUp) {
      //     Logger.info('Application started', {
      //       Name: this.config.name,
      //       'PXL Framework Version': this.applicationVersion,
      //       'Startup Time': Time.formatTime({ time: startupTime, format: 's', numDecimals: 2, showUnit: true }),
      //     });
      //   }

      //   if (this.config.events?.onStarted) {
      //     this.config.events.onStarted({ app: this, startupTime });
      //   }
      // },
      onStarted: this.onStarted.bind(this),
    };

    const stopInstanceOptions: ApplicationStopInstanceOptions = {
      // onStopped: ({ runtime }) => {
      //   if (this.config.log?.shutdown) {
      //     Logger.info('Application stopped', {
      //       Name: this.config.name,
      //       'Runtime': Time.formatTime({ time: runtime, format: 's', numDecimals: 2, showUnit: true }),
      //     });
      //   }

      //   if (this.config.events?.onStopped) {
      //     this.config.events.onStopped({ app: this, runtime });
      //   }
      // },
      onStopped: this.onStopped.bind(this),
    };

    if (this.config.cluster?.enabled) {
      // Initialize clustered application
      const clusterManager = new ClusterManager({
        config: this.config.cluster,

        startApplicationCallback: () => this.startInstance(startInstanceOptions),
        stopApplicationCallback: () => this.stop(stopInstanceOptions),
      });

      // Start cluster
      clusterManager.start();
    } else {
      // Start standalone application
      await this.startInstance(startInstanceOptions);

      // Handle standalone application shutdown
      this.handleShutdown({
        onStopped: stopInstanceOptions.onStopped,
      });
    }
  }

  /**
   * Before application start
   */
  private async onBeforeStart(): Promise<{
    redisInstance: RedisInstance;
    databaseInstance: DatabaseInstance | null;
    queueManager: QueueManager;
    eventManager?: EventManager;
  }> {
    // Connect to Redis
    const redisInstance = await this.redisManager.connect();

    // Connect to database
    const databaseInstance = this.databaseManager ? await this.databaseManager.connect() : null;

    let eventManager: EventManager | undefined;

    if (this.config.event?.enabled) {
      eventManager = new EventManager({
        applicationConfig: this.config,
        options: this.config.event,
        events: this.config.event.events || [],
        redisInstance,
        databaseInstance,
        // queueManager,
      });

      eventManager.load();
    }

    // Initialize queue
    const queueManager = new QueueManager({
      applicationConfig: this.config,
      options: {
        processorsDirectory: this.config.queue.processorsDirectory,
      },
      queues: this.config.queue.queues,
      redisInstance,
      databaseInstance,
      eventManager,
    });

    // Register queues
    await queueManager.registerQueues({
      queues: this.config.queue.queues,
    });

    return {
      redisInstance,
      databaseInstance,
      queueManager,
      eventManager,
    };
  }

  /**
   * Application started event
   */
  protected onStarted({ startupTime: _startupTime }: { startupTime: number }): void {}

  /**
   * Application stopped event
   */
  protected onStopped({ runtime: _runtime }: { runtime: number }): void {}

  /**
   * Before application stop event (deprecated - now handled by lifecycle hooks)
   * @deprecated This method is no longer used. Cleanup is handled by registerShutdownHooks()
   */
  private async onBeforeStop(): Promise<void> {
    // This method is deprecated - cleanup is now handled by lifecycle hooks in registerShutdownHooks()
  }

  /**
   * Start application instance
   */
  private async startInstance(options: ApplicationStartInstanceOptions): Promise<void> {
    try {
      // Phase 1: Initialize (resource setup)
      const initResult = await this.lifecycle.initialize();
      if (initResult.errors.length > 0) {
        Logger.warn({
          message: 'Lifecycle init phase encountered errors',
          meta: { errors: initResult.errors.map(e => (e instanceof Error ? e.message : String(e))) },
        });
      }

      // Before application start
      const { redisInstance, databaseInstance, queueManager, eventManager } = await this.onBeforeStart();

      // Phase 2: Start (component startup)
      const startResult = await this.lifecycle.start();
      if (startResult.errors.length > 0) {
        Logger.warn({
          message: 'Lifecycle start phase encountered errors',
          meta: { errors: startResult.errors.map(e => (e instanceof Error ? e.message : String(e))) },
        });
      }

      // Start application
      await this.startHandler({
        redisInstance,
        databaseInstance,
        queueManager,
        eventManager,
      });

      // Phase 3: Ready (application accepting traffic)
      const readyResult = await this.lifecycle.ready();
      if (readyResult.errors.length > 0) {
        Logger.warn({
          message: 'Lifecycle ready phase encountered errors',
          meta: { errors: readyResult.errors.map(e => (e instanceof Error ? e.message : String(e))) },
        });
      }

      // Calculate application startup time
      const startupTime = Time.calculateElapsedTime({
        startTime: this.startTime,
      });

      // On application started
      if (options.onStarted) {
        await options.onStarted({ startupTime });
      }
    } catch (error) {
      Logger.error({
        error: error instanceof Error ? error : new Error(String(error)),
        message: 'startInstance failure',
      });
      throw error;
    }
  }

  protected abstract startHandler({
    redisInstance,
    databaseInstance,
    queueManager,
    eventManager,
  }: {
    redisInstance: RedisInstance;
    databaseInstance?: DatabaseInstance | null;
    queueManager: QueueManager;
    eventManager?: EventManager | null;
  }): Promise<void>;

  protected abstract stopCallback(): void;

  /**
   * Set up global error handlers
   */
  /**
   * Initialize performance monitor
   */
  // initializePerformanceMonitor deprecated in favor of PerformanceMonitorPlugin
  // (left intentionally absent)

  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', error => {
      Logger.error({ error, message: 'Uncaught Exception' });
      this.initiateGracefulShutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      Logger.error({
        error: reason instanceof Error ? reason : new Error(String(reason)),
        message: 'Unhandled Rejection',
        meta: { promise },
      });
      this.initiateGracefulShutdown();
    });
  }

  /**
   * Register shutdown hooks for proper cleanup
   */
  private registerShutdownHooks(): void {
    // Register shutdown hooks in reverse dependency order
    this.lifecycle.onShutdown(async () => {
      Logger.info({ message: 'Executing custom stop callback' });
      await this.stopCallback();
    });

    this.lifecycle.onShutdown(async () => {
      if (this.redisManager) {
        Logger.info({ message: 'Disconnecting from Redis' });
        await this.redisManager.disconnect();
      }
    });

    this.lifecycle.onShutdown(async () => {
      if (this.databaseManager) {
        Logger.info({ message: 'Disconnecting from database' });
        await this.databaseManager.disconnect();
      }
    });

    // Performance monitor is handled via trackInterval, so it will be cleaned up automatically
  }

  /**
   * Initiate graceful shutdown
   */
  private async initiateGracefulShutdown(): Promise<void> {
    if (this.shutdownController.isShuttingDown) {
      return;
    }

    Logger.info({ message: 'Initiating graceful shutdown due to error' });
    try {
      const result = await this.shutdownController.initiate('error-triggered');
      if (result.errors.length > 0) {
        Logger.error({
          message: 'Errors during shutdown',
          error: result.errors,
        });
        this.finalizeExit({ code: 1, reason: 'graceful-shutdown-error', error: result.errors });
      } else if (result.timedOut) {
        Logger.warn({ message: 'Shutdown timed out' });
        this.finalizeExit({ code: 1, reason: 'shutdown-timeout' });
      } else {
        this.finalizeExit({ code: 0, reason: 'error-shutdown-complete' });
      }
    } catch (error) {
      Logger.error({
        error: error instanceof Error ? error : new Error(String(error)),
        message: 'Error during graceful shutdown',
      });
      this.finalizeExit({ code: 1, reason: 'graceful-shutdown-error', error });
    }
  }

  /**
   * Handle shutdown - this method is deprecated in favor of proper launcher signal handling
   * @deprecated Use proper launcher signal handling instead
   */
  public handleShutdown({ onStopped }: { onStopped?: ({ runtime }: { runtime: number }) => void }): void {
    Logger.warn({
      message: 'handleShutdown() is deprecated. Signal handling should be done in the application launcher.',
    });

    // Register the onStopped callback with lifecycle if provided
    if (onStopped) {
      this.lifecycle.onShutdown(() => {
        const runtime = process.uptime() * 1000;
        onStopped({ runtime });
      });
    }

    // Backwards compatibility: register basic signal handlers expected by legacy tests
    // Only register once per instance to avoid accumulating duplicate listeners
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
    if (!(this as any)._legacySignalHandlersAttached) {
      (this as any)._legacySignalHandlersAttached = true;
      const handler = (signal: NodeJS.Signals) => {
        Logger.info({ message: `Received ${signal}, initiating shutdown (deprecated handleShutdown)` });
        // Fire and forget; internal stop will manage idempotency via shutdownController
        void this.stop({ onStopped });
      };
      for (const signal of signals) {
        try {
          process.on(signal, handler);
        } catch {
          // Ignore if environment does not support the signal (e.g., Windows SIGTERM behavior)
        }
      }
    }
  }

  /**
   * Stop application using lifecycle manager
   */
  public async stop({ onStopped }: ApplicationStopInstanceOptions = {}): Promise<void> {
    if (this.shutdownController.isShuttingDown) {
      return;
    }

    // Register the onStopped callback if provided
    if (onStopped) {
      this.lifecycle.onShutdown(() => {
        const runtime = process.uptime() * 1000;
        onStopped({ runtime });
      });
    }

    try {
      const result = await this.shutdownController.initiate('manual-stop');
      if (result.errors.length > 0) {
        Logger.error({
          message: 'Errors during shutdown',
          error: result.errors,
        });
        this.finalizeExit({ code: 1, reason: 'shutdown-error', error: result.errors });
      } else if (result.timedOut) {
        Logger.warn({ message: 'Shutdown timed out' });
        this.finalizeExit({ code: 1, reason: 'shutdown-timeout' });
      } else {
        this.finalizeExit({ code: 0, reason: 'shutdown-complete' });
      }
    } catch (error) {
      Logger.error({
        error: error instanceof Error ? error : new Error(String(error)),
        message: 'Error during shutdown',
      });
      this.finalizeExit({ code: 1, reason: 'shutdown-error', error });
    }
  }

  /**
   * Finalize exit: during tests, suppress actual process exit to avoid failing vitest runs.
   */
  private finalizeExit(outcome: ExitOutcome): void {
    const nodeEnv = process.env.NODE_ENV ?? '';
    const isTestEnv =
      nodeEnv.toLowerCase() === 'test' ||
      'VITEST' in process.env ||
      'VITEST_WORKER_ID' in process.env ||
      process.argv.some(a => a.includes('vitest')) ||
      typeof (globalThis as any).afterAll === 'function';

    if (isTestEnv) {
      Logger.info({ message: `Skipping process exit in test environment (${outcome.reason})`, code: outcome.code });
      return;
    }
    requestExit(outcome);
  }
}
