import { QueueJob } from './job.interface.js';

export interface QueueManagerOptions {}

export interface QueueManagerConstructorParams {
  options?: QueueManagerOptions;
  jobs: QueueJob[];
  redisInstance: any;
  databaseInstance: any;
}
