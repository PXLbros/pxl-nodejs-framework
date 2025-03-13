import { Queue } from 'bullmq';
import path from 'path';
import { Logger } from '../logger/index.js';
import QueueWorker from './worker.js';
import { Helper, Loader } from '../util/index.js';
import { existsSync } from 'fs';
export default class QueueManager {
    logger = Logger;
    applicationConfig;
    options;
    redisInstance;
    databaseInstance;
    eventManager;
    queues = new Map();
    jobProcessors = new Map();
    constructor({ applicationConfig, options, queues, redisInstance, databaseInstance, eventManager }) {
        // Define default options
        const defaultOptions = {};
        // Merge options
        this.options = Helper.defaultsDeep(options, defaultOptions);
        this.applicationConfig = applicationConfig;
        this.redisInstance = redisInstance;
        this.databaseInstance = databaseInstance;
        this.eventManager = eventManager;
    }
    async registerQueues({ queues }) {
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
        }
        catch (error) {
            Logger.error(error);
        }
    }
    registerQueue({ queue, jobProcessorClasses }) {
        if (!queue.jobs) {
            Logger.warn('No jobs found for queue, skip register', { Name: queue.name });
            return;
        }
        const queueOptions = {
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
            const workerOptions = {
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
    registerJobProcessors({ queue, jobs, jobProcessorClasses }) {
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
                const processorInstance = new ProcessorClass(this, this.applicationConfig, this.redisInstance, this.databaseInstance, this.eventManager);
                this.jobProcessors.set(job.id, processorInstance);
            }
            if (this.applicationConfig.queue.log?.jobRegistered) {
                this.log('Job registered', { ID: job.id });
            }
        }
    }
    onQueueError = (error) => {
        Logger.error(error);
    };
    onQueueWaiting = (job) => {
        if (this.applicationConfig.queue.log?.queueWaiting) {
            this.log('Waiting...', { Queue: job.queueName, Job: job.id });
        }
    };
    onQueueProgress = (job, progress) => {
        this.log('Progress update', {
            Queue: job.queueName,
            'Job Name': job.name,
            'Job ID': job.id,
            Progress: progress,
        });
    };
    onQueueRemoved = (job) => {
        this.log('Removed queue', { Queue: job.queueName, Job: job.id });
    };
    addJobToQueue = async ({ queueId, jobId, data }) => {
        const queue = this.queues.get(queueId);
        if (!queue) {
            this.log('Queue not found', { 'Queue ID': queueId });
            return;
        }
        const job = await queue.add(jobId, data);
        const dataStr = JSON.stringify(data);
        const maxLogDataStrLength = 50;
        const truncatedLogDataStr = dataStr.length > maxLogDataStrLength ? `${dataStr.substring(0, maxLogDataStrLength)}...` : dataStr;
        if (this.applicationConfig.queue.log?.jobAdded) {
            this.log('Job added', { Queue: queueId, 'Job ID': jobId, Data: truncatedLogDataStr });
        }
        return job;
    };
    workerProcessor = async (job) => {
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
        }
        catch (error) {
            Logger.warn('Queue worker processing error', {
                Queue: job.queueName,
                'Job Name': job.name,
                'Job ID': job.id,
                Error: error.message,
            });
            Logger.error(error);
        }
    };
    async listAllJobsWithStatus() {
        const jobsSummary = [];
        for (const [queueName, queue] of this.queues) {
            const jobStates = ['active', 'waiting', 'completed', 'failed', 'delayed', 'paused'];
            const jobsDetailsPromises = jobStates.map(async (state) => {
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
    log(message, meta) {
        this.logger.custom('queue', message, meta);
    }
}
//# sourceMappingURL=manager.js.map