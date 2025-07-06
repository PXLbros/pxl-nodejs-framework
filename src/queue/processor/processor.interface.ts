import QueueManager from '../manager.js';
import { ApplicationConfig } from '../../application/base-application.interface.js';
import { RedisInstance } from '../../redis/index.js';
import { DatabaseInstance } from '../../database/index.js';
import EventManager from '../../event/manager.js';
import BaseProcessor from './base.js';

export interface ProcessorConstructorParams {
  queueManager: QueueManager;
  applicationConfig: ApplicationConfig;
  redisInstance: RedisInstance;
  databaseInstance: DatabaseInstance | null;
  eventManager?: EventManager;
}

export type ProcessorConstructor = new (
  queueManager: QueueManager,
  applicationConfig: ApplicationConfig,
  redisInstance: RedisInstance,
  databaseInstance: DatabaseInstance | null,
  eventManager?: EventManager
) => BaseProcessor;