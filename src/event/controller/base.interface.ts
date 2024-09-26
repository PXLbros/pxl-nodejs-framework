import { ApplicationConfig } from '../../application/base-application.interface.js';
import { DatabaseInstance } from '../../database/index.js';
// import { QueueManager } from '../../queue/index.js';
import { RedisInstance } from '../../redis/index.js';
import EventBaseController from './base.js';

export interface EventControllerConstructorParams {
  applicationConfig: ApplicationConfig;

  redisInstance: RedisInstance;
  // queueManager: QueueManager;
  databaseInstance: DatabaseInstance | null;
}

export type EventControllerType = new (params: EventControllerConstructorParams) => EventBaseController;
