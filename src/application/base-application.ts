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
import { ConfigValidationError, formatConfigIssues, validateFrameworkConfig } from '../config/schema.js';
import { type ExitOutcome, requestExit } from '../lifecycle/exit.js';
import { safeSerializeError } from '../error/error-reporter.js';

// Re-export types for external use
export type { ApplicationConfig } from './base-application.interface.js';

export default abstract class BaseApplication {
  /** Unique instance ID */
  public uniqueInstanceId: string;

  /** Application start time */
  protected startTime: number = 0;

  /** Shutdown timeout (30 seconds) */
  protected shutdownTimeout = 30000;

  /** Cache for application version to avoid repeated imports */
  private static applicationVersionCache: string | undefined;
  private static globalErrorHandlersRegistered = false;
  private static readonly instances = new Set<WeakRef<BaseApplication>>();

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
    // Validate configuration early (fail-fast before side effects)
    try {
      const validated = validateFrameworkConfig(config as any);
      config = validated as unknown as ApplicationConfig;
    } catch (err) {
      if (err instanceof ConfigValidationError) {
        const formatted = formatConfigIssues(err.issues);
        throw new Error(`Configuration validation failed:\n${formatted}`);
      }
      throw err;
    }
    const computerName = os.hostname();

    this.uniqueInstanceId = `${config.instanceId}-${computerName}-${OS.getUniqueComputerId()}`;
    this.config = config;

    // Configure logger with application settings
    if (this.config.log?.showRequestIdInConsole !== undefined) {
      Logger.configure({ showRequestIdInConsole: this.config.log.showRequestIdInConsole });
    }

    // Initialize lifecycle management
    const lifecycleConfig: Partial<LifecycleConfig> = {
      gracefulShutdown: {
        timeoutMs: this.shutdownTimeout,
      },
      readiness: {
        timeoutMs: 30000,
        checkIntervalMs: 100,
      },
    };
    this.lifecycle = new LifecycleManager(lifecycleConfig);
    this.shutdownController = new ShutdownController(this.lifecycle);

    // Register shutdown hooks for cleanup
    this.registerShutdownHooks();

    // Initialize Redis manager
    this.redisManager = new RedisManager({
      applicationConfig: this.config,
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
    });

    // Initialize cache manager
    this.cacheManager = new CacheManager({
      redisManager: this.redisManager,
    });

    // Register performance monitor plugin (idempotent & opt-in)
    PerformanceMonitorPlugin.register(this);

    // Track instance and ensure global error handlers are registered once
    BaseApplication.registerInstance(this);

    if (this.config.database?.enabled === true) {
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
    this.startTime = Time.now();

    // Get application version`
    this.applicationVersion = await this.getApplicationVersion();

    // Log initial startup message with version
    Logger.info({
      message: 'Starting application',
      meta: {
        Name: this.config.name,
        'Instance ID': this.config.instanceId,
        'PXL Framework Version': this.applicationVersion,
      },
    });

    const startInstanceOptions: ApplicationStartInstanceOptions = {
      onStarted: this.onStarted.bind(this),
    };

    const stopInstanceOptions: ApplicationStopInstanceOptions = {
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

      // Note: Signal handling should be implemented at the application launcher level
      // The lifecycle manager provides the stop() method for programmatic shutdown
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
    const phaseStartTime = Time.now();

    // Connect to Redis
    if (process.env.DEBUG_TESTS) {
      console.log('[BaseApplication] Connecting to Redis...');
    }
    const redisInstance = await this.redisManager.connect();
    if (process.env.DEBUG_TESTS) {
      const redisElapsed = Time.calculateElapsedTimeMs({ startTime: phaseStartTime });
      console.log(`[BaseApplication] Redis connected (${redisElapsed}ms)`);
    }

    // Connect to database
    let databaseInstance: DatabaseInstance | null = null;
    if (this.databaseManager) {
      if (process.env.DEBUG_TESTS) {
        console.log('[BaseApplication] Connecting to database...');
      }
      const dbStartTime = Time.now();
      databaseInstance = await this.databaseManager.connect();
      if (process.env.DEBUG_TESTS) {
        const dbElapsed = Time.calculateElapsedTimeMs({ startTime: dbStartTime });
        console.log(`[BaseApplication] Database connected (${dbElapsed}ms)`);
      }
    }

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

    // Register readiness checks for key services
    this.lifecycle.addReadinessCheck('redis', async () => {
      try {
        return await redisInstance.isConnected();
      } catch {
        return false;
      }
    });

    if (databaseInstance) {
      this.lifecycle.addReadinessCheck('database', async () => {
        try {
          return await databaseInstance.isConnected();
        } catch {
          return false;
        }
      });
    }

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
   * Start application instance
   */
  private async startInstance(options: ApplicationStartInstanceOptions): Promise<void> {
    try {
      // Phase 1: Initialize (resource setup)
      if (process.env.DEBUG_TESTS) {
        console.log('[startInstance] Phase 1: Initializing lifecycle...');
      }
      const initStartTime = Time.now();
      const initResult = await this.lifecycle.initialize();
      if (process.env.DEBUG_TESTS) {
        const initElapsed = Time.calculateElapsedTimeMs({ startTime: initStartTime });
        console.log(`[startInstance] Phase 1 complete (${initElapsed}ms)`);
      }
      if (initResult.errors.length > 0) {
        Logger.warn({
          message: 'Lifecycle init phase encountered errors',
          meta: { errors: initResult.errors.map(e => (e instanceof Error ? e.message : String(e))) },
        });
      }

      // Before application start
      if (process.env.DEBUG_TESTS) {
        console.log('[startInstance] Connecting to services (Redis, Database, Queue, Events)...');
      }
      const beforeStartTime = Time.now();
      const { redisInstance, databaseInstance, queueManager, eventManager } = await this.onBeforeStart();

      // Store managers on instance for external access
      this.queueManager = queueManager;
      if (eventManager) {
        this.eventManager = eventManager;
      }

      if (process.env.DEBUG_TESTS) {
        const beforeStartElapsed = Time.calculateElapsedTimeMs({ startTime: beforeStartTime });
        console.log(`[startInstance] Services connected (${beforeStartElapsed}ms)`);
      }

      // Phase 2: Start (component startup)
      if (process.env.DEBUG_TESTS) {
        console.log('[startInstance] Phase 2: Starting lifecycle components...');
      }
      const startStartTime = Time.now();
      const startResult = await this.lifecycle.start();
      if (process.env.DEBUG_TESTS) {
        const startElapsed = Time.calculateElapsedTimeMs({ startTime: startStartTime });
        console.log(`[startInstance] Phase 2 complete (${startElapsed}ms)`);
      }
      if (startResult.errors.length > 0) {
        Logger.warn({
          message: 'Lifecycle start phase encountered errors',
          meta: { errors: startResult.errors.map(e => (e instanceof Error ? e.message : String(e))) },
        });
      }

      // Start application
      if (process.env.DEBUG_TESTS) {
        console.log('[startInstance] Starting application handler...');
      }
      const handlerStartTime = Time.now();
      await this.startHandler({
        redisInstance,
        databaseInstance,
        queueManager,
        eventManager,
      });
      if (process.env.DEBUG_TESTS) {
        const handlerElapsed = Time.calculateElapsedTimeMs({ startTime: handlerStartTime });
        console.log(`[startInstance] Application handler started (${handlerElapsed}ms)`);
      }

      // Phase 3: Ready (application accepting traffic)
      if (process.env.DEBUG_TESTS) {
        console.log('[startInstance] Phase 3: Waiting for application to be ready...');
      }
      const readyStartTime = Time.now();
      const readyResult = await this.lifecycle.ready();
      if (process.env.DEBUG_TESTS) {
        const readyElapsed = Time.calculateElapsedTimeMs({ startTime: readyStartTime });
        console.log(`[startInstance] Phase 3 complete (${readyElapsed}ms)`);
      }
      if (readyResult.errors.length > 0) {
        Logger.warn({
          message: 'Lifecycle ready phase encountered errors',
          meta: { errors: readyResult.errors.map(e => (e instanceof Error ? e.message : String(e))) },
        });
      }

      // Calculate application startup time
      const startupTime = Time.calculateElapsedTimeMs({
        startTime: this.startTime,
      });

      // On application started
      if (options.onStarted) {
        await options.onStarted({ startupTime });
      }
    } catch (error) {
      Logger.error({
        error: error instanceof Error ? error : new Error(safeSerializeError(error)),
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

  private static registerInstance(instance: BaseApplication): void {
    BaseApplication.pruneStaleInstances();
    BaseApplication.instances.add(new WeakRef(instance));
    BaseApplication.registerGlobalErrorHandlers();
  }

  private static unregisterInstance(instance: BaseApplication): void {
    for (const ref of Array.from(BaseApplication.instances)) {
      const current = ref.deref();
      if (!current || current === instance) {
        BaseApplication.instances.delete(ref);
      }
    }
  }

  private static pruneStaleInstances(): void {
    for (const ref of Array.from(BaseApplication.instances)) {
      if (!ref.deref()) {
        BaseApplication.instances.delete(ref);
      }
    }
  }

  private static getActiveInstances(): BaseApplication[] {
    const active: BaseApplication[] = [];
    const stale: WeakRef<BaseApplication>[] = [];

    for (const ref of BaseApplication.instances) {
      const instance = ref.deref();
      if (instance) {
        active.push(instance);
      } else {
        stale.push(ref);
      }
    }

    for (const ref of stale) {
      BaseApplication.instances.delete(ref);
    }

    return active;
  }

  private static registerGlobalErrorHandlers(): void {
    if (BaseApplication.globalErrorHandlersRegistered) {
      return;
    }

    process.on('uncaughtException', error => {
      Logger.error({ error, message: 'Uncaught Exception' });
      for (const app of BaseApplication.getActiveInstances()) {
        app.initiateGracefulShutdown();
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      Logger.error({
        error: reason instanceof Error ? reason : new Error(String(reason)),
        message: 'Unhandled Rejection',
        meta: { promise: String(promise) },
      });
      for (const app of BaseApplication.getActiveInstances()) {
        app.initiateGracefulShutdown();
      }
    });

    BaseApplication.globalErrorHandlersRegistered = true;
  }

  /**
   * Register shutdown hooks for proper cleanup
   */
  private registerShutdownHooks(): void {
    // Register shutdown hooks in reverse dependency order
    this.lifecycle.onShutdown(() => {
      BaseApplication.unregisterInstance(this);
    });

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
        error: error instanceof Error ? error : new Error(safeSerializeError(error)),
        message: 'Error during graceful shutdown',
      });
      this.finalizeExit({ code: 1, reason: 'graceful-shutdown-error', error });
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
        error: error instanceof Error ? error : new Error(safeSerializeError(error)),
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
