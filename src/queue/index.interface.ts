import type { QueueJob } from './job.interface.js';
import type { QueueOptions, WorkerOptions } from 'bullmq';

/** Runtime settings applied to the BullMQ Worker for this queue */
export interface QueueRuntimeSettings {
  /** Max number of concurrently processed jobs across all job types */
  concurrency?: WorkerOptions['concurrency'];
  /** Milliseconds a job's lock is held before considered stalled */
  lockDuration?: WorkerOptions['lockDuration'];
  /** Milliseconds between stall checks */
  stalledInterval?: WorkerOptions['stalledInterval'];
  /** Number of stall detections before failing the job */
  maxStalledCount?: WorkerOptions['maxStalledCount'];
}

export interface QueueItem {
  /** Queue name */
  name: string;

  /** Whether queue is external */
  isExternal?: boolean;

  /** Queue jobs */
  jobs: QueueJob[];

  /**
   * Runtime processing settings for this queue's worker
   * (maps to BullMQ WorkerOptions). These override global defaults if provided.
   */
  settings?: QueueRuntimeSettings;

  /**
   * Default BullMQ job options applied when jobs are added to this queue.
   * Framework sets sensible defaults (removeOnComplete/removeOnFail) which can
   * be overridden or extended here.
   */
  defaultJobOptions?: QueueOptions['defaultJobOptions'];
}
