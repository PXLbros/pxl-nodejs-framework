import { QueueJob } from './job.interface.js';

export interface QueueManagerOptions {
  /** Queue processors directory */
  processorsDirectory: string;
}

export interface QueueManagerConstructorParams {
  options?: QueueManagerOptions;
  jobs: QueueJob[];
  redisInstance: any;
  databaseInstance: any;
}
