export interface QueueJob {
  /** Job ID */
  id: string;

  /** The maximum number of concurrent jobs in queue */
  maxConcurrency?: number;
}

export interface QueueJobData {
  /** Unique identifier for the job */
  jobId?: string;
  
  /** Timestamp when job was created */
  createdAt?: Date;
  
  /** Timestamp when job processing started */
  startTime?: [number, number];
  
  /** Priority of the job (higher number = higher priority) */
  priority?: number;
  
  /** Maximum number of retry attempts */
  maxRetries?: number;
  
  /** Current retry attempt number */
  attemptsMade?: number;
  
  /** Delay before processing (in milliseconds) */
  delay?: number;
  
  /** WebSocket client ID for real-time updates */
  webSocketClientId?: string;
  
  /** User ID associated with the job */
  userId?: string;
  
  /** Custom metadata for the job */
  metadata?: Record<string, unknown>;
  
  /** The actual job payload data */
  payload: Record<string, unknown>;
  
  /** Job configuration options */
  options?: {
    /** Remove job from queue after completion */
    removeOnComplete?: boolean;
    /** Remove job from queue after failure */
    removeOnFail?: boolean;
    /** Exponential backoff multiplier */
    backoffMultiplier?: number;
    /** Exponential backoff delay */
    backoffDelay?: number;
  };
}
