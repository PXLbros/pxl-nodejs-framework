import { ApplicationConfig } from '../../application/base-application.interface.js';
import { DatabaseInstance } from '../../database/index.js';
import { QueueManager } from '../../queue/index.js';
import { RedisInstance } from '../../redis/index.js';
import WebServerBaseController from './base.js';

export interface WebServerBaseControllerConstructorParams {
  applicationConfig: ApplicationConfig;

  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export type WebServerBaseControllerType = new (params: WebServerBaseControllerConstructorParams) => WebServerBaseController;
