import { type Job, Queue, type QueueOptions, type WorkerOptions } from 'bullmq';
import path from 'path';
import type { QueueManagerConstructorParams, QueueManagerOptions } from './manager.interface.js';
import type { RedisInstance } from '../redis/index.js';
import type { DatabaseInstance } from '../database/index.js';
import { Logger } from '../logger/index.js';
import QueueWorker from './worker.js';
import type BaseProcessor from './processor/base.js';
import { File, Helper, Loader, Time } from '../util/index.js';
import type { QueueJob, QueueJobData, QueueJobPayload } from './job.interface.js';
import type { ProcessorConstructor } from './processor/processor.interface.js';
import type { QueueItem } from './index.interface.js';
import type { ApplicationConfig } from '../application/base-application.interface.js';
import type EventManager from '../event/manager.js';

export interface JobSummary {
  id: string;
  name: string;
  queueName: string;
  state: 'active' | 'waiting' | 'completed' | 'failed' | 'delayed' | 'paused';
  attemptsMade: number;
  failedReason?: string;
}

export default class QueueManager {
  private logger: typeof Logger = Logger;

  private applicationConfig: ApplicationConfig;

  private options: QueueManagerOptions;

  private redisInstance: RedisInstance;
  private databaseInstance: DatabaseInstance | null;
  private eventManager?: EventManager;

  private queues: Map<string, Queue> = new Map();

  private jobProcessors: Map<string, BaseProcessor> = new Map();

  constructor({
    applicationConfig,
    options,
    queues: _queues,
    redisInstance,
    databaseInstance,
    eventManager,
  }: QueueManagerConstructorParams) {
    // Merge options with defaults if provided
    if (options) {
      this.options = options;
    } else {
      // This shouldn't happen, but handle the edge case
      this.options = { processorsDirectory: '' };
    }

    this.applicationConfig = applicationConfig;

    this.redisInstance = redisInstance;
    this.databaseInstance = databaseInstance;
    this.eventManager = eventManager;
  }

  public async registerQueues({ queues }: { queues: QueueItem[] }): Promise<void> {
    if (!queues) {
      return;
    }

    // Check if processors directory exists
    const processorsDirectoryExists = await File.pathExists(this.options.processorsDirectory);

    if (!processorsDirectoryExists) {
      return;
    }

    try {
      const jobProcessorClasses = await Loader.loadModulesInDirectory<ProcessorConstructor>({
        directory: this.options.processorsDirectory,
        extensions: ['.ts', '.js'],
      });

      for (const queue of queues) {
        this.registerQueue({ queue, jobProcessorClasses });
      }

      if (this.applicationConfig.queue.log?.queuesRegistered) {
        this.log('Registered queue', {
          'Queue Count': queues.length,
          'Job Count': this.jobProcessors.size,
        });
      }
    } catch (error) {
      Logger.error({ error });
    }
  }

  private registerQueue({
    queue,
    jobProcessorClasses,
  }: {
    queue: QueueItem;
    jobProcessorClasses: Record<string, ProcessorConstructor>;
  }): void {
    if (!queue.jobs) {
      Logger.warn({
        message: 'No jobs found for queue, skip register',
        meta: {
          Name: queue.name,
        },
      });

      return;
    }

    // Merge framework defaults with queue-specific default job options
    const queueOptions: QueueOptions = {
      connection: this.redisInstance.client,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        ...(queue.defaultJobOptions ?? {}),
      },
    };

    const queueInstance = new Queue(queue.name, queueOptions);

    queueInstance.on('error', this.onQueueError);
    queueInstance.on('waiting', this.onQueueWaiting);
    queueInstance.on('progress', this.onQueueProgress);
    queueInstance.on('removed', this.onQueueRemoved);

    if (!queue.isExternal) {
      // Build worker options, applying per-queue runtime settings
      const workerOptions: WorkerOptions = {
        connection: this.redisInstance.client,
        autorun: true,
        ...(queue.settings ?? {}),
      };

      new QueueWorker({
        applicationConfig: this.applicationConfig,
        queueManager: this,
        name: queue.name,
        processor: this.workerProcessor,
        options: workerOptions,
        redisInstance: this.redisInstance,
      });
    }

    this.queues.set(queue.name, queueInstance);

    if (this.applicationConfig.queue.log?.queueRegistered) {
      this.log('Registered queue', {
        Name: queue.name,
        Settings: queue.settings ? JSON.stringify(queue.settings) : 'default',
      });
    }

    // Register job processors
    this.registerJobProcessors({
      queue,
      jobs: queue.jobs,
      jobProcessorClasses,
    });
  }

  private registerJobProcessors({
    queue,
    jobs,
    jobProcessorClasses,
  }: {
    queue: QueueItem;
    jobs: QueueJob[];
    jobProcessorClasses: Record<string, ProcessorConstructor>;
  }): void {
    if (!jobs) {
      return;
    }

    const scriptFileExtension = Helper.getScriptFileExtension();

    for (const job of jobs) {
      if (!queue.isExternal) {
        const ProcessorClass = jobProcessorClasses[job.id];

        if (!ProcessorClass) {
          const jobPath = path.join(this.options.processorsDirectory, `${job.id}.${scriptFileExtension}`);

          throw new Error(`Processor class not found (Job ID: ${job.id} | Path: ${jobPath})`);
        }

        const processorInstance = new ProcessorClass(
          this,
          this.applicationConfig,
          this.redisInstance,
          this.databaseInstance,
          this.eventManager,
        );

        this.jobProcessors.set(job.id, processorInstance);
      }

      if (this.applicationConfig.queue.log?.jobRegistered) {
        this.log('Job registered', { ID: job.id });
      }
    }
  }

  private onQueueError = (error: Error): void => {
    Logger.error({ error });
  };

  private onQueueWaiting = (job: Job): void => {
    if (this.applicationConfig.queue.log?.queueWaiting) {
      this.log('Waiting...', { Queue: job.queueName, Job: job.id });
    }
  };

  private onQueueProgress = (jobId: string, progress: unknown): void => {
    this.log('Progress update', {
      'Job ID': jobId,
      Progress: progress,
    });
  };

  private onQueueRemoved = (jobId: string): void => {
    this.log('Removed queue', { Job: jobId });
  };

  public addJobToQueue = async <
    TPayload extends QueueJobPayload = QueueJobPayload,
    TMetadata extends Record<string, unknown> = Record<string, unknown>,
    TResult = unknown,
    TName extends string = string,
  >({
    queueId,
    jobId,
    data,
  }: {
    queueId: string;
    jobId: TName;
    data: QueueJobData<TPayload, TMetadata>;
  }): Promise<Job<QueueJobData<TPayload, TMetadata>, TResult, TName> | undefined> => {
    const queue = this.queues.get(queueId);

    if (!queue) {
      this.log('Queue not found', { 'Queue ID': queueId });

      return;
    }

    const job = (await queue.add(jobId, data)) as Job<QueueJobData<TPayload, TMetadata>, TResult, TName>;

    const dataStr = JSON.stringify(data);

    const maxLogDataStrLength = 50;
    const truncatedLogDataStr =
      dataStr.length > maxLogDataStrLength ? `${dataStr.substring(0, maxLogDataStrLength)}...` : dataStr;

    if (this.applicationConfig.queue.log?.jobAdded) {
      this.log('Job added', {
        Queue: queueId,
        'Job ID': jobId,
        Data: truncatedLogDataStr,
      });
    }

    return job;
  };

  private workerProcessor = async (job: Job): Promise<unknown> => {
    if (!job) {
      return;
    }

    const startTime = Time.now();

    // Add start time to job data
    if (typeof job.updateData === 'function') {
      try {
        await job.updateData({ ...job.data, startTime });
      } catch (error) {
        Logger.warn({
          message: 'Failed to persist job metadata before processing',
          meta: {
            Queue: job.queueName,
            'Job Name': job.name,
            'Job ID': job.id,
            Error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    this.log('Worker processing...', {
      Queue: job.queueName,
      'Job Name': job.name,
      'Job ID': job.id,
    });

    const processor = this.jobProcessors.get(job.name);

    if (!processor) {
      throw new Error(`No processor registered for job (Name: ${job.name})`);
    }

    let result: unknown;
    let error: Error | undefined;

    try {
      // Call beforeProcess hook
      await processor.beforeProcess({ job });

      // Execute main processing
      result = await processor.process({ job });

      return result;
    } catch (err) {
      error = err as Error;

      Logger.warn({
        message: 'Queue worker processing error',
        meta: {
          Queue: job.queueName,
          'Job Name': job.name,
          'Job ID': job.id,
          Error: error.message,
        },
      });

      Logger.error({ error });

      throw error; // Re-throw to mark job as failed
    } finally {
      // ALWAYS call afterProcess for cleanup (even on error)
      try {
        await processor.afterProcess({ job, result, error });
      } catch (cleanupError) {
        // Log but don't throw - cleanup errors shouldn't fail the job
        Logger.error({
          error: cleanupError,
          message: 'Error in processor afterProcess cleanup',
        });
      }
    }
  };

  public async listAllJobsWithStatus(): Promise<JobSummary[]> {
    const jobsSummary: JobSummary[] = [];

    for (const [queueName, queue] of this.queues) {
      const jobStates = ['active', 'waiting', 'completed', 'failed', 'delayed', 'paused'] as const;

      const jobsDetailsPromises = jobStates.map(async state => {
        const jobs = await queue.getJobs([state]);
        return jobs.map(
          (job): JobSummary => ({
            id: job.id ?? 'unknown',
            name: job.name ?? 'unknown',
            queueName,
            state,
            attemptsMade: job.attemptsMade,
            failedReason: job.failedReason,
          }),
        );
      });

      const results = await Promise.all(jobsDetailsPromises);
      const flattenedResults = results.flat();

      jobsSummary.push(...flattenedResults);
    }

    return jobsSummary;
  }

  /**
   * Log queue message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom({ level: 'queue', message, meta });
  }
}
