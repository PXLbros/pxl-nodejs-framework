import cluster from 'cluster';
import { DatabaseInstance } from '../../database/index.js';
import { RedisInstance } from '../../redis/index.js';
import { EventControllerConstructorParams } from './base.interface.js';
import { Logger } from '../../logger/index.js';
import { ApplicationConfig } from '../../application/base-application.interface.js';

export default abstract class {
  protected logger: typeof Logger = Logger;

  protected workerId: number | undefined;

  protected applicationConfig: ApplicationConfig;

  protected redisInstance: RedisInstance;
  // protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance | null;

  constructor({ applicationConfig, redisInstance, databaseInstance }: EventControllerConstructorParams) {
    this.workerId = cluster.worker?.id;

    this.applicationConfig = applicationConfig;

    this.redisInstance = redisInstance;
    // this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;
  }

  /**
   * Enhanced logger with structured methods
   */
  public log = {
    error: (error: Error | unknown, message?: string, meta?: Record<string, unknown>): void => {
      if (message) {
        const errorMeta = { 
          ...(meta || {}),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        };
        this.logger.custom('event', message, errorMeta);
      } else {
        this.logger.custom('event', error);
      }
    },
    
    info: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom('event', message, meta);
    },
    
    warn: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom('event', message, meta);
    },
    
    debug: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom('event', message, meta);
    }
  };
}
