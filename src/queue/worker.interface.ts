import { Processor, WorkerOptions } from 'bullmq';
import { RedisInstance } from '../redis/index.js';

export interface QueueWorkerConstructorParams {
  name: string;
  processor: string | URL | Processor<any, any, string> | null | undefined;
  options?: WorkerOptions;
  redisInstance: RedisInstance;
}
