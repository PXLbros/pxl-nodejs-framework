import { Processor, WorkerOptions } from 'bullmq';
import { RedisInstance } from '../redis/index.js';

export interface QueueWorkerConstructorParams {
  name: string;
  processor: string | URL | Processor<any, Processor<any, any, string>, string> | null | undefined;
  options?: WorkerOptions;
  redisInstance: RedisInstance;
}
