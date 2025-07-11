import type { Processor, WorkerOptions } from 'bullmq';
import type { RedisInstance } from '../redis/index.js';
import type { ApplicationConfig } from '../application/base-application.interface.js';
import type QueueManager from './manager.js';

export interface QueueWorkerConstructorParams {
  applicationConfig: ApplicationConfig;
  queueManager: QueueManager;
  name: string;
  processor: string | URL | Processor<any, any, string> | null | undefined;
  options?: WorkerOptions;
  redisInstance: RedisInstance;
}
