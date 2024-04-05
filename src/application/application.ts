import DatabaseManager from '../database/manager.js';
import RedisManager from '../redis/manager.js';
import { Logger } from '../logger/index.js';
// import Joi from 'joi';
import { ApplicationConfig } from './application.interface.js';
import RedisInstance from '../redis/instance.js';
import DatabaseInstance from '../database/instance.js';
import ClusterManager from '../cluster/cluster-manager.js';
import WebServer from '../webserver/webserver.js';
import QueueManager from '../queue/manager.js';

/**
 * Application
 */
export default class Application {
  /** Shutdown signals */
  private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  /** Application start time */
  private startTime?: [number, number];

  /** Application config */
  private config: ApplicationConfig;

  /** Redis manager */
  private redisManager: RedisManager;

  /** Database manager */
  private databaseManager: DatabaseManager;

  /** Queue manager */
  private queueManager: QueueManager;

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

    // Initialize queue manager
    this.queueManager = new QueueManager({
      options: {
        processorsDirectory: this.config.queue.processorsDirectory,
      },
      jobs: [],
      redisInstance: this.redisManager,
      databaseInstance: this.databaseManager,
    });
  }

  /**
   * Start application
   */
  public async start(): Promise<void> {
    if (this.config.cluster?.enabled) {
      // Initialize clustered server application
      const clusterManager = new ClusterManager({
        config: this.config.cluster,

        startApplicationCallback: () => this.startInstance(),
        stopApplicationCallback: () => this.stop(),
      });

      // Start cluster
      clusterManager.start();
    } else {
      // Start standalone server application
      await this.startInstance();

      // Handle standalone server application shutdown
      this.handleShutdown();
    }

    // Start application timer
    this.startTime = process.hrtime();

    Logger.info('Application started', {
      Name: this.config.name,
    });
  }

  /**
   * Before application start event
   */
  private async onBeforeStart(): Promise<{ redisInstance: RedisInstance; databaseInstance: DatabaseInstance }> {
    const redisInstance = await this.redisManager.connect();
    const databaseInstance = await this.databaseManager.connect();

    return { redisInstance, databaseInstance };
  }

  /**
   * Start application instance
   */
  private async startInstance(): Promise<void> {
    try {
      // Before application start
      const { redisInstance, databaseInstance } = await this.onBeforeStart();

      // Start application
      await this.startHandler({ redisInstance, databaseInstance });

      // // On application started
      // await this.onStarted();
    } catch (error) {
      // Log error
      console.error(error);

      process.exit(1);
    }
  }

  private async startHandler({ redisInstance, databaseInstance }: { redisInstance: RedisInstance; databaseInstance: DatabaseInstance }): Promise<void> {
    if (this.config.webServer?.enabled) {
      // Initialize web server
      this.webServer = new WebServer({
        // config: this.config.webServer,
        options: {
          port: 3000,
        },

        routes: [],

        redisInstance,
        databaseInstance,
        queueManager: this.queueManager,
      });

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
   * Handle shutdown
   */
  public handleShutdown(): void {
    this.shutdownSignals.forEach((signal) => {
      process.on(signal, async () => {
        // Stop application
        await this.stop();
      });
    });
  }

  /**
   * Stop application
   */
  private async stop(): Promise<void> {
    // if (this.isStopping) {
    //   return;
    // }

    // this.isStopping = true;

    // // Stop callback
    // await this.stopCallback();

    // // Disconnect
    // await this.disconnect();

    // if (this.onStopped) {
    //   // Calculate runtime
    //   const runtime = process.uptime() * 1000;

    //   // Emit stopped event
    //   await this.onStopped({ runtime });
    // }

    Logger.info('Application stopped');

    process.exit(0);
  }
}
