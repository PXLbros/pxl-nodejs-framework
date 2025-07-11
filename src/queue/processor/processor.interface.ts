import type QueueManager from '../manager.js';
import type { ApplicationConfig } from '../../application/base-application.interface.js';
import type { RedisInstance } from '../../redis/index.js';
import type { DatabaseInstance } from '../../database/index.js';
import type EventManager from '../../event/manager.js';
import type BaseProcessor from './base.js';

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
  eventManager?: EventManager,
) => BaseProcessor;
