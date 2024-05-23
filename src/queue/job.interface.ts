export interface QueueJob {
  /** Job ID */
  id: string;

  /** The maximum number of concurrent jobs in queue */
  maxConcurrency?: number;
}
