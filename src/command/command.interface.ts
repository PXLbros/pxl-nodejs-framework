import type { ApplicationConfig } from '../application/base-application.interface.js';
import type DatabaseInstance from '../database/instance.js';
import type { QueueManager } from '../queue/index.js';
import type RedisInstance from '../redis/instance.js';

export interface CommandConstructorParams {
  applicationConfig: ApplicationConfig;

  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}
