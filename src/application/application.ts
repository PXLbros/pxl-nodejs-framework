import DatabaseManager from '../database/manager.js';
import RedisManager from '../redis/manager.js';
import { Logger } from '../logger/index.js';
import Joi from 'joi';

export interface ApplicationRedisConfig {
  /** Redis host */
  host: string;

  /** Redis port */
  port: number;

  /** Redis password */
  password?: string;
}

export interface ApplicationDatabaseConfig {
  /** Database host */
  host: string;

  /** Database port */
  port: number;

  /** Database username */
  username: string;

  /** Database password */
  password: string;

  /** Database name */
  databaseName: string;
}

export interface ApplicationWebServerConfig {
  /** Web server host */
  host: string;

  /** Web server port */
  port: number;
}

export interface ApplicationConstructorProps {
  /** Application name */
  name: string;

  /** Redis configuration */
  redis: ApplicationRedisConfig;

  /** Database configuration */
  database: ApplicationDatabaseConfig;

  /** Web server configuration */
  webServer?: ApplicationWebServerConfig;
}

/**
 * Application
 */
export default class Application {
  /** Application start time */
  protected startTime?: [number, number];

  /** Application name */
  protected name: string;

  /** Redis Manager */
  protected redisManager: RedisManager;

  /** Database Manager */
  protected databaseManager: DatabaseManager;

  /**
   * Application constructor
   */
  constructor(props: ApplicationConstructorProps) {
    const schema = Joi.object({
      name: Joi.string().required(),

      redis: {
        host: Joi.string().required(),
        port: Joi.number().required(),
        password: Joi.string().allow('').optional(),
      },

      database: {
        host: Joi.string().required(),
        port: Joi.number().required(),
        username: Joi.string().required(),
        password: Joi.string().required(),
        databaseName: Joi.string().required(),
      },
    });

    // Validation application constructor props
    const validationResult = schema.validate(props);

    if (validationResult.error) {
      throw new Error(validationResult.error.message);
    }

    this.name = props.name;

    // Initialize Redis manager
    this.redisManager = new RedisManager({
      host: props.redis.host,
      port: props.redis.port,
      password: props.redis.password,
    });

    // Initialize Database manager
    this.databaseManager = new DatabaseManager({
      host: props.database.host,
      port: props.database.port,
      username: props.database.username,
      password: props.database.password,
      databaseName: props.database.databaseName,
    });
  }

  /**
   * Start application
   */
  public start(): void {
    // Start application timer
    this.startTime = process.hrtime();

    Logger.info('Application started', {
      Name: this.name,
    });
  }

  /**
   * Stop application
   */
  public stop(): void {
    Logger.info('Application stopped');
  }

  /**
   * Run command
   */
  public runCommand(): void {
    // ...
  }
}
