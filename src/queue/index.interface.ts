import type { QueueJob } from './job.interface.js';

export interface QueueItem {
  /** Queue name */
  name: string;

  /** Whether queue is external */
  isExternal?: boolean;

  /** Queue jobs */
  jobs: QueueJob[];
}
