import { DatabaseInstance } from '../../database/index.js';
import { QueueManager } from '../../queue/index.js';
import { RedisInstance } from '../../redis/index.js';
import BaseController from './base.js';

export interface BaseControllerConstructorParams {
  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export type BaseControllerType = new (params: BaseControllerConstructorParams) => BaseController;
