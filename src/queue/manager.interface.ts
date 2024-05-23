import { QueueItem } from './index.interface.js';
import { QueueJob } from './job.interface.js';

export interface QueueManagerOptions {
  /** Queue processors directory */
  processorsDirectory: string;
}

export interface QueueManagerConstructorParams {
  options?: QueueManagerOptions;
  queues: QueueItem[];
  redisInstance: any;
  databaseInstance: any;
}
