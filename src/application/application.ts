import DatabaseManager from '../database/manager.js';
import RedisManager from '../redis/manager.js';
import { Logger } from '../logger/index.js';
import Joi from 'joi';

export interface RedisConfig {
  /** Redis host */
  host: string;

  /** Redis port */
  port: number;

  /** Redis password */
  password?: string;
}

export interface ApplicationConstructorProps {
  /** Redis configuration */
  redis: RedisConfig;
}

/**
 * Application
 */
export default class Application {
  /** Application start time */
  protected startTime?: [number, number];

  /** Redis Manager */
  protected redisManager: RedisManager;

  /** Database Manager */
  protected databaseManager: DatabaseManager;

  /**
   * Application constructor
   */
  constructor(props: ApplicationConstructorProps) {
    const schema = Joi.object({
      redis: {
        host: Joi.string().required(),
        port: Joi.number().required(),
        password: Joi.string().allow('').optional(),
      },
    });

    // Validation application constructor props
    const validationResult = schema.validate(props);

    if (validationResult.error) {
      throw new Error(validationResult.error.message);
    }

    // Initialize Redis manager
    this.redisManager = new RedisManager({
      host: props.redis.host,
      port: props.redis.port,
      password: props.redis.password,
    });

    // Initialize Database manager
    this.databaseManager = new DatabaseManager();
  }

  /**
   * Start application
   */
  public start() {
    // Start application timer
    this.startTime = process.hrtime();

    Logger.info('Application started');
  }

  /**
   * Stop application
   */
  public stop() {
    Logger.info('Application stopped');
  }
}
