import { Job } from 'bullmq';
import { QueueManager } from '../../queue/index.js';
import { DatabaseInstance } from '../../database/index.js';
import { ApplicationConfig } from '../../application/base-application.interface.js';

export default abstract class BaseProcessor {
  constructor(
    protected queueManager: QueueManager,
    protected applicationConfig: ApplicationConfig,
    protected databaseInstance: DatabaseInstance,
  ) {}

  public abstract process({ job }: { job: Job }): Promise<any>;
}
