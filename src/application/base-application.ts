import { existsSync } from 'fs';
import { DatabaseInstance, DatabaseManager } from '../database/index.js';
import QueueManager from '../queue/manager.js';
import RedisManager from '../redis/manager.js';
import { ApplicationConfig, ApplicationStartInstanceOptions, ApplicationStopInstanceOptions } from './base-application.interface.js';
import path from 'path';
import ClusterManager from '../cluster/cluster-manager.js';
import RedisInstance from '../redis/instance.js';
import { OS, Time } from '../util/index.js';
import CacheManager from '../cache/manager.js';
import os from 'os';

export default abstract class BaseApplication {
  /** Unique instance ID */
  public uniqueInstanceId: string;

  /** Shutdown signals */
  protected shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  /** Application start time */
  protected startTime: [number, number] = [0, 0];

  /** Whether application is stopping */
  protected isStopping = false;

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

  public get Name () {
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

    if (this.config.database && this.config.database.enabled === true) {
      const defaultEntitiesDirectory = path.join(this.config.rootDirectory, 'src', 'database', 'entities');

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
  public async getApplicationVersion() {
    const packagePath = new URL('../../package.json', import.meta.url).href;
    const packageJson = await import(packagePath, { assert: { type: 'json' } });

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
      this.handleShutdown({ onStopped: stopInstanceOptions.onStopped });
    }
  }

  /**
   * Before application start
   */
  private async onBeforeStart(): Promise<{ redisInstance: RedisInstance; databaseInstance: DatabaseInstance | null; queueManager: QueueManager }> {
    // Connect to Redis
    const redisInstance = await this.redisManager.connect();

    // Connect to database
    const databaseInstance = this.databaseManager ? await this.databaseManager.connect() : null;

    // Initialize queue
    const queueManager = new QueueManager({
      applicationConfig: this.config,
      options: {
        processorsDirectory: this.config.queue.processorsDirectory,
      },
      queues: this.config.queue.queues,
      redisInstance,
      databaseInstance,
    });

    return { redisInstance, databaseInstance, queueManager };
  }

  /**
   * Application started event
   */
  protected onStarted({ startupTime }: { startupTime: number }): void {}

  /**
   * Application stopped event
   */
  protected onStopped({ runtime }: { runtime: number }): void {}

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
  private async startInstance(options: ApplicationStartInstanceOptions): Promise<void> {
    try {
      // Before application start
      const { redisInstance, databaseInstance, queueManager } = await this.onBeforeStart();

      // Start application
      await this.startHandler({ redisInstance, databaseInstance, queueManager });

      // Calculate application startup time
      const startupTime = Time.calculateElapsedTime({ startTime: this.startTime });

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

  protected abstract startHandler({ redisInstance, databaseInstance, queueManager }: { redisInstance: RedisInstance; databaseInstance?: DatabaseInstance | null; queueManager: QueueManager }): Promise<void>;

  protected abstract stopCallback(): void;

  /**
   * Handle shutdown
   */
  public handleShutdown({ onStopped }: { onStopped?: ({ runtime }: { runtime: number }) => void }): void {
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
  private async stop({ onStopped }: ApplicationStopInstanceOptions = {}): Promise<void> {
    if (this.isStopping) {
      return;
    }

    this.isStopping = true;

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

    process.exit(0);
  }
}
