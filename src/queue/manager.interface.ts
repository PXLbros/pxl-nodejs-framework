import type { ApplicationConfig } from '../application/base-application.interface.js';
import type DatabaseInstance from '../database/instance.js';
import type EventManager from '../event/manager.js';
import type { RedisInstance } from '../redis/index.js';
import type { QueueItem } from './index.interface.js';

export interface QueueManagerOptions {
  /** Queue processors directory */
  processorsDirectory: string;
}

export interface QueueManagerConstructorParams {
  applicationConfig: ApplicationConfig;
  options?: QueueManagerOptions;
  queues: QueueItem[];
  redisInstance: RedisInstance;
  databaseInstance: DatabaseInstance | null;
  eventManager?: EventManager;
}
