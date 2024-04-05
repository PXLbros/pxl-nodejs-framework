import DatabaseManager from '../database/manager.js';
import RedisManager from '../redis/manager.js';
import { Logger } from '../logger/index.js';
// import Joi from 'joi';
import { ApplicationConfig, ApplicationStartInstanceOptions, ApplicationStopInstanceOptions } from './application.interface.js';
import RedisInstance from '../redis/instance.js';
import DatabaseInstance from '../database/instance.js';
import ClusterManager from '../cluster/cluster-manager.js';
import WebServer from '../webserver/webserver.js';
import QueueManager from '../queue/manager.js';
import { Time } from '../util/index.js';

/**
 * Application
 */
export default class Application {
  /** Shutdown signals */
  private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  /** Application start time */
  private startTime: [number, number] = [0, 0];

  /** Whether application is stopping */
  private isStopping = false;

  /** Application config */
  private config: ApplicationConfig;

  /** Application version */
  private applicationVersion?: string;

  /** Redis manager */
  private redisManager: RedisManager;

  /** Database manager */
  private databaseManager: DatabaseManager;

  /** Queue manager */
  private queueManager?: QueueManager;

  /** Web server */
  private webServer?: WebServer;

  /**
   * Application constructor
   */
  constructor(config: ApplicationConfig) {
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
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
    });

    // Initialize Database manager
    this.databaseManager = new DatabaseManager({
      host: this.config.database.host,
      port: this.config.database.port,
      username: this.config.database.username,
      password: this.config.database.password,
      databaseName: this.config.database.databaseName,
    });
  }

  /**
   * Get application version
  */
  private async getApplicationVersion() {
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

    // Get application version
    this.applicationVersion = await this.getApplicationVersion();

    const startInstanceOptions: ApplicationStartInstanceOptions = {
      onStarted: ({ startupTime }) => {
        Logger.info('Application started', {
          Name: this.config.name,
          'PXL Framework Version': this.applicationVersion,
          'Startup Time': Time.formatTime({ time: startupTime, format: 's', numDecimals: 2, showUnit: true }),
        });
      },
    };

    const stopInstanceOptions: ApplicationStopInstanceOptions = {
      onStopped: ({ runtime }) => {
        Logger.info('Application stopped', {
          Name: this.config.name,
          'Runtime': Time.formatTime({ time: runtime, format: 's', numDecimals: 2, showUnit: true }),
        });
      },
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
  private async onBeforeStart(): Promise<{ redisInstance: RedisInstance; databaseInstance: DatabaseInstance; queueManager: QueueManager }> {
    // Connect to Redis
    const redisInstance = await this.redisManager.connect();

    // Connect to database
    const databaseInstance = await this.databaseManager.connect();

    // Initialize queue
    const queueManager = new QueueManager({
      options: {
        processorsDirectory: this.config.queue.processorsDirectory,
      },
      jobs: this.config.queue.jobs,
      redisInstance,
      databaseInstance,
    });

    // Create queue
    queueManager.createQueue({ name: 'default' });

    return { redisInstance, databaseInstance, queueManager };
  }

  /**
   * Before application stop
   */
  private async onBeforeStop(): Promise<void> {
    // Disconnect from Redis
    await this.redisManager.disconnect();

    // Disconnect from database
    await this.databaseManager.disconnect();
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

  private async startHandler({ redisInstance, databaseInstance, queueManager }: { redisInstance: RedisInstance; databaseInstance: DatabaseInstance; queueManager: QueueManager }): Promise<void> {
    if (this.config.webServer?.enabled) {
      // Initialize web server
      this.webServer = new WebServer({
        // config: this.config.webServer,
        options: {
          port: this.config.webServer.port,
          controllersDirectory: this.config.webServer.controllersDirectory,
        },

        routes: this.config.webServer.routes,

        redisInstance,
        databaseInstance,
        queueManager,
      });

      // Load web server
      await this.webServer.load();

      // Start web server
      await this.webServer.start();
    }
  }

  /**
   * Run command
   */
  public runCommand(): void {
    // ...
  }

  /**
   * Stop application callback
   */
  private async stopCallback(): Promise<void> {
    if (this.webServer) {
      // Stop web server
      await this.webServer.stop();
    }
  }

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
