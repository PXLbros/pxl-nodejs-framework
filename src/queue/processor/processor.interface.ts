import type QueueManager from '../manager.js';
import type { ApplicationConfig } from '../../application/base-application.interface.js';
import type { RedisInstance } from '../../redis/index.js';
import type { DatabaseInstance } from '../../database/index.js';
import type EventManager from '../../event/manager.js';
import type BaseProcessor from './base.js';
import type { QueueJobData } from '../job.interface.js';

export interface ProcessorConstructorParams<
  TQueueManager extends QueueManager = QueueManager,
  TJobData extends QueueJobData = QueueJobData,
  TResult = unknown,
> {
  queueManager: TQueueManager;
  applicationConfig: ApplicationConfig;
  redisInstance: RedisInstance;
  databaseInstance: DatabaseInstance | null;
  eventManager?: EventManager;
}

export type ProcessorConstructor<
  TQueueManager extends QueueManager = QueueManager,
  TJobData extends QueueJobData = QueueJobData,
  TResult = unknown,
> = new (
  queueManager: TQueueManager,
  applicationConfig: ApplicationConfig,
  redisInstance: RedisInstance,
  databaseInstance: DatabaseInstance | null,
  eventManager?: EventManager,
) => BaseProcessor<TQueueManager, TJobData, TResult>;
