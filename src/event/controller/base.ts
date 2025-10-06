import cluster from 'cluster';
import type { DatabaseInstance } from '../../database/index.js';
import type { RedisInstance } from '../../redis/index.js';
import type { EventControllerConstructorParams } from './base.interface.js';
import { Logger } from '../../logger/index.js';
import type { ApplicationConfig } from '../../application/base-application.interface.js';
import { safeSerializeError } from '../../error/error-reporter.js';

export default abstract class BaseEventController {
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
          ...(meta ?? {}),
          error: error instanceof Error ? error.message : safeSerializeError(error),
          stack: error instanceof Error ? error.stack : undefined,
        };
        this.logger.custom({ level: 'event', message, meta: errorMeta });
      } else {
        this.logger.custom({ level: 'event', message: error });
      }
    },

    info: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom({ level: 'event', message, meta });
    },

    warn: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom({ level: 'event', message, meta });
    },

    debug: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom({ level: 'event', message, meta });
    },
  };
}
