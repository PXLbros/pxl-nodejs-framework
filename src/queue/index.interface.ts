import { QueueJob } from './job.interface.js';

export interface QueueItem {
  name: string;
  jobs: QueueJob[];
}
