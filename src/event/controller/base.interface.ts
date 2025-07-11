import type { ApplicationConfig } from '../../application/base-application.interface.js';
import type { DatabaseInstance } from '../../database/index.js';
// import { QueueManager } from '../../queue/index.js';
import type { RedisInstance } from '../../redis/index.js';
import type EventBaseController from './base.js';

export interface EventControllerConstructorParams {
  applicationConfig: ApplicationConfig;

  redisInstance: RedisInstance;
  // queueManager: QueueManager;
  databaseInstance: DatabaseInstance | null;
}

export type EventControllerType = new (params: EventControllerConstructorParams) => EventBaseController;
