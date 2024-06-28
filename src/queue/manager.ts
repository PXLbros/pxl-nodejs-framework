import { Queue, Worker, WorkerOptions, Job, Processor, QueueOptions } from 'bullmq';
import path from 'path';
import { QueueManagerConstructorParams, QueueManagerOptions } from './manager.interface.js';
import { RedisInstance } from '../redis/index.js';
import { DatabaseInstance } from '../database/index.js';
import { Logger } from '../logger/index.js';
import QueueWorker from './worker.js';
import BaseProcessor from './processor/base.js';
import { Helper, Loader } from '../util/index.js';
import { QueueJob } from './job.interface.js';
import { QueueItem } from './index.interface.js';
import { existsSync } from 'fs';
import { ApplicationConfig } from '../application/base-application.interface.js';

export default class QueueManager {
  private logger: typeof Logger = Logger;

  private applicationConfig: ApplicationConfig;

  private options: QueueManagerOptions;

  private redisInstance: RedisInstance;
  private databaseInstance: DatabaseInstance;

  private queues: Map<string, Queue> = new Map();

  private jobProcessors: Map<string, BaseProcessor> = new Map();

  constructor({ applicationConfig, options, queues, redisInstance, databaseInstance }: QueueManagerConstructorParams) {
    // Define default options
    const defaultOptions: Partial<QueueManagerOptions> = {};

    // Merge options
    this.options = Helper.defaultsDeep(options, defaultOptions);

    this.applicationConfig = applicationConfig;

    this.redisInstance = redisInstance;
    this.databaseInstance = databaseInstance;

    // Register jobs
    this.registerQueues({ queues });
  }

  private async registerQueues({ queues }: { queues: QueueItem[] }): Promise<void> {
    if (!queues) {
      return;
    }

    // Check if processors directory exists
    const processorsDirectoryExists = await existsSync(this.options.processorsDirectory);

    if (!processorsDirectoryExists) {
      Logger.warn('Processors directory not found', { Directory: this.options.processorsDirectory });

      return;
    }

    try {
      const jobProcessorClasses = await Loader.loadModulesInDirectory({
        directory: this.options.processorsDirectory,
        extensions: ['.ts'],
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
      Logger.error(error);
    }
  }

  private registerQueue({ queue, jobProcessorClasses }: { queue: QueueItem; jobProcessorClasses: any }): void {
    if (!queue.jobs) {
      return;
    }

    const queueOptions: QueueOptions = {
      connection: this.redisInstance.client,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    };

    const queueInstance = new Queue(queue.name, queueOptions);

    queueInstance.on('error', this.onQueueError);
    queueInstance.on('waiting', this.onQueueWaiting);
    queueInstance.on('progress', this.onQueueProgress);
    queueInstance.on('removed', this.onQueueRemoved);

    if (!queue.isExternal) {
      const workerOptions: WorkerOptions = {
        connection: this.redisInstance.client,
        autorun: true,
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
      this.log('Registered queue', { Name: queue.name });
    }

    // Register job processors
    this.registerJobProcessors({ queue, jobs: queue.jobs, jobProcessorClasses });
  }

  private registerJobProcessors({ queue, jobs, jobProcessorClasses }: { queue: QueueItem; jobs: QueueJob[]; jobProcessorClasses: any }): void {
    if (!jobs) {
      return;
    }

    for (const job of jobs) {
      if (!queue.isExternal) {
        const ProcessorClass = jobProcessorClasses[job.id];

        if (!ProcessorClass) {
          const jobPath = path.join(this.options.processorsDirectory, `${job.id}.ts`);

          throw new Error(`Processor class not found (Job ID: ${job.id} | Path: ${jobPath})`);
        }

        const processorInstance = new ProcessorClass(this, this.applicationConfig, this.databaseInstance);

        this.jobProcessors.set(job.id, processorInstance);
      }

      if (this.applicationConfig.queue.log?.jobRegistered) {
        this.log('Job registered', { ID: job.id });
      }
    }
  }

  private onQueueError = (error: Error): void => {
    Logger.error(error);
  };

  private onQueueWaiting = (job: Job): void => {
    if (this.applicationConfig.queue.log?.queueWaiting) {
      this.log('Waiting...', { Queue: job.queueName, Job: job.id });
    }
  };

  private onQueueProgress = (job: Job<any, any, string>, progress: number | object): void => {
    this.log('Progress update', {
      Queue: job.queueName,
      'Job Name': job.name,
      'Job ID': job.id,
      Progress: progress,
    });
  };

  private onQueueRemoved = (job: Job): void => {
    this.log('Removed queue', { Queue: job.queueName, Job: job.id });
  };

  public addJobToQueue = async ({ queueId, jobId, data }: { queueId: string; jobId: string; data: any }) => {
    const queue = this.queues.get(queueId);

    if (!queue) {
      this.log('Queue not found', { 'Queue ID': queueId });

      return;
    }

    const job = await queue.add(jobId, data);

    const dataStr = JSON.stringify(data);

    const maxLogDataStrLength = 50;
    const truncatedLogDataStr =
      dataStr.length > maxLogDataStrLength ? `${dataStr.substring(0, maxLogDataStrLength)}...` : dataStr;

    if (this.applicationConfig.queue.log?.jobAdded) {
      this.log('Job added', { Queue: queueId, 'Job ID': jobId, Data: truncatedLogDataStr });
    }

    return job;
  };

  private workerProcessor = async (job: Job): Promise<Processor<any, any, string> | undefined> => {
    if (!job) {
      return;
    }

    const startTime = process.hrtime();

    // Add start time to job data
    job.updateData({ ...job.data, startTime });

    this.log('Worker processing...', {
      Queue: job.queueName,
      'Job Name': job.name,
      'Job ID': job.id,
    });

    const processor = this.jobProcessors.get(job.name);

    if (!processor) {
      throw new Error(`No processor registered for job (Name: ${job.name})`);
    }

    try {
      const jobResult = await processor.process({ job });

      return jobResult;
    } catch (error) {
      Logger.warn('Queue worker processing error', {
        Queue: job.queueName,
        'Job Name': job.name,
        'Job ID': job.id,
        Error: (error as Error).message,
      });

      Logger.error(error);
    }
  };

  public async listAllJobsWithStatus(): Promise<any[]> {
    const jobsSummary: any[] = [];

    for (const [queueName, queue] of this.queues) {
      const jobStates = ['active', 'waiting', 'completed', 'failed', 'delayed', 'paused'];

      const jobsDetailsPromises = jobStates.map(async (state: any) => {
        const jobs = await queue.getJobs([state]);
        return jobs.map((job) => ({
          id: job.id,
          name: job.name,
          queueName: queueName,
          state: state,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
        }));
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
    this.logger.custom('queue', message, meta);
  }
}
