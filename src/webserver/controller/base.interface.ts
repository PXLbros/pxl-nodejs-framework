import { DatabaseInstance } from '../../database/index.js';
import { QueueManager } from '../../queue/index.js';
import { RedisInstance } from '../../redis/index.js';
import WebServerBaseController from './base.js';

export interface WebServerBaseControllerConstructorParams {
  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export type WebServerBaseControllerType = new (params: WebServerBaseControllerConstructorParams) => WebServerBaseController;
