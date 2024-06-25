import { ApplicationConfig } from '../application/base-application.interface.js';
import { QueueItem } from './index.interface.js';

export interface QueueManagerOptions {
  /** Queue processors directory */
  processorsDirectory: string;
}

export interface QueueManagerConstructorParams {
  applicationConfig: ApplicationConfig;
  options?: QueueManagerOptions;
  queues: QueueItem[];
  redisInstance: any;
  databaseInstance: any;
}
