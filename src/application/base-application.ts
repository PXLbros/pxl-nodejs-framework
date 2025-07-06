import cluster from 'cluster';
import { existsSync } from 'fs';
import {
  DatabaseInstance,
  DatabaseManager,
} from '../database/index.js';
import QueueManager from '../queue/manager.js';
import RedisManager from '../redis/manager.js';
import {
  ApplicationConfig,
  ApplicationStartInstanceOptions,
  ApplicationStopInstanceOptions,
} from './base-application.interface.js';
import path from 'path';
import ClusterManager from '../cluster/cluster-manager.js';
import RedisInstance from '../redis/instance.js';
import { OS, Time } from '../util/index.js';
import CacheManager from '../cache/manager.js';
import os from 'os';
import EventManager from '../event/manager.js';
import Logger from '../logger/logger.js';

export default abstract class BaseApplication {
  /** Unique instance ID */
  public uniqueInstanceId: string;

  /** Shutdown signals */
  protected shutdownSignals: NodeJS.Signals[] = [
    'SIGTERM',
    'SIGINT',
  ];

  /** Application start time */
  protected startTime: [number, number] = [0, 0];

  /** Whether application is stopping */
  protected isStopping = false;

  /** Shutdown timeout (30 seconds) */
  protected shutdownTimeout = 30000;

  /** Cluster worker ID */
  protected workerId =
    cluster.isWorker && cluster.worker
      ? cluster.worker.id
      : null;

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

    // Set up global error handlers
    this.setupGlobalErrorHandlers();

    if (
      this.config.database &&
      this.config.database.enabled === true
    ) {
      const defaultEntitiesDirectory = path.join(
        this.config.rootDirectory,
        'src',
        'database',
        'entities',
      );

      if (!this.config.database.entitiesDirectory) {
        this.config.database.entitiesDirectory =
          defaultEntitiesDirectory;
      }

      if (
        !existsSync(this.config.database.entitiesDirectory)
      ) {
        throw new Error(
          `Database entities directory not found (Path: ${this.config.database.entitiesDirectory})`,
        );
      }

      // Initialize Database manager
      this.databaseManager = new DatabaseManager({
        applicationConfig: this.config,
        host: this.config.database.host,
        port: this.config.database.port,
        username: this.config.database.username,
        password: this.config.database.password,
        databaseName: this.config.database.databaseName,
        entitiesDirectory:
          this.config.database.entitiesDirectory,
      });
    }
  }

  /**
   * Get application version
   */
  public async getApplicationVersion() {
    const packagePath = new URL(
      '../../package.json',
      import.meta.url,
    ).href;
    const packageJson = await import(packagePath, {
      with: { type: 'json' },
    });

    if (!packageJson?.default?.version) {
      throw new Error('Application version not found');
    }

    return packageJson.default.version;
  }

  /**
   * Start application
   */
  public async start(): Promise<void> {
    // Start application timer
    this.startTime = process.hrtime();

    // Get application version`
    this.applicationVersion =
      await this.getApplicationVersion();

    const startInstanceOptions: ApplicationStartInstanceOptions =
      {
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

    const stopInstanceOptions: ApplicationStopInstanceOptions =
      {
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

        startApplicationCallback: () =>
          this.startInstance(startInstanceOptions),
        stopApplicationCallback: () =>
          this.stop(stopInstanceOptions),
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
    const databaseInstance = this.databaseManager
      ? await this.databaseManager.connect()
      : null;

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
        processorsDirectory:
          this.config.queue.processorsDirectory,
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
  protected onStarted({
    startupTime,
  }: {
    startupTime: number;
  }): void {}

  /**
   * Application stopped event
   */
  protected onStopped({
    runtime,
  }: {
    runtime: number;
  }): void {}

  /**
   * Before application stop event
   */
  private async onBeforeStop(): Promise<void> {
    // Disconnect from Redis
    await this.redisManager.disconnect();

    if (this.databaseManager) {
      // Disconnect from database
      await this.databaseManager.disconnect();
    }
  }

  /**
   * Start application instance
   */
  private async startInstance(
    options: ApplicationStartInstanceOptions,
  ): Promise<void> {
    try {
      // Before application start
      const {
        redisInstance,
        databaseInstance,
        queueManager,
        eventManager,
      } = await this.onBeforeStart();

      // Start application
      await this.startHandler({
        redisInstance,
        databaseInstance,
        queueManager,
        eventManager,
      });

      // Calculate application startup time
      const startupTime = Time.calculateElapsedTime({
        startTime: this.startTime,
      });

      // On application started
      if (options.onStarted) {
        await options.onStarted({ startupTime });
      }
    } catch (error) {
      // Log error
      console.error(error);

      process.exit(1);
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
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      Logger.error(error, 'Uncaught Exception');
      this.initiateGracefulShutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      Logger.error(reason instanceof Error ? reason : new Error(String(reason)), 'Unhandled Rejection', { promise });
      this.initiateGracefulShutdown();
    });
  }

  /**
   * Initiate graceful shutdown
   */
  private initiateGracefulShutdown(): void {
    if (this.isStopping) {
      return;
    }

    Logger.info('Initiating graceful shutdown due to error');
    this.stop().catch((error) => {
      Logger.error(error instanceof Error ? error : new Error(String(error)), 'Error during graceful shutdown');
      process.exit(1);
    });
  }

  /**
   * Handle shutdown
   */
  public handleShutdown({
    onStopped,
  }: {
    onStopped?: ({ runtime }: { runtime: number }) => void;
  }): void {
    this.shutdownSignals.forEach((signal) => {
      process.on(signal, async () => {
        // Stop application
        await this.stop({ onStopped });
      });
    });
  }

  /**
   * Stop application
   */
  private async stop({
    onStopped,
  }: ApplicationStopInstanceOptions = {}): Promise<void> {
    if (this.isStopping) {
      return;
    }

    this.isStopping = true;

    // Set timeout for forced termination
    const forceExitTimeout = setTimeout(() => {
      Logger.warn('Forced shutdown due to timeout');
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // Stop callback
      await this.stopCallback();

      // Disconnect
      await this.onBeforeStop();

      if (onStopped) {
        // Calculate runtime
        const runtime = process.uptime() * 1000;

        // Emit stopped event
        await onStopped({ runtime });
      }

      clearTimeout(forceExitTimeout);
      process.exit(0);
    } catch (error) {
      Logger.error(error instanceof Error ? error : new Error(String(error)), 'Error during shutdown');
      clearTimeout(forceExitTimeout);
      process.exit(1);
    }
  }
}
