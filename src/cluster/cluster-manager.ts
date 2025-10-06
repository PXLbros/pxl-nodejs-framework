import cluster from 'node:cluster';
import { cpus } from 'node:os';
import type {
  ClusterManagerConfig,
  ClusterManagerProps,
  ClusterManagerWorkerModeManualConfig,
} from './cluster-manager.interface.js';
import { Logger } from '../logger/index.js';
import { requestExit } from '../lifecycle/exit.js';

export default class ClusterManager {
  private readonly config: ClusterManagerConfig;

  private startApplicationCallback: () => Promise<void>;
  private stopApplicationCallback: () => Promise<void>;

  private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  private isShuttingDown = false;
  private initialWorkerCount = 0;
  private shutdownTimeout = 30000; // 30 seconds
  private shutdownTimer?: NodeJS.Timeout;

  constructor({ config, startApplicationCallback, stopApplicationCallback }: ClusterManagerProps) {
    this.config = config;

    this.startApplicationCallback = startApplicationCallback;
    this.stopApplicationCallback = stopApplicationCallback;
  }

  public start(): void {
    if (cluster.isPrimary) {
      this.setupPrimary();
    } else {
      this.setupWorker();
    }

    this.handleShutdown();
  }

  private setupPrimary(): void {
    const numCPUs: number = cpus().length;

    const numClusterWorkers =
      this.config.workerMode === 'auto' ? numCPUs : (this.config as ClusterManagerWorkerModeManualConfig).workerCount;

    // Track initial worker count for shutdown
    this.initialWorkerCount = numClusterWorkers;

    for (let workerIndex = 0; workerIndex < numClusterWorkers; workerIndex++) {
      cluster.fork();
    }

    cluster.on('online', worker => {
      Logger.debug({
        message: 'Started cluster worker',
        meta: {
          ID: worker.id,
          PID: worker.process.pid,
        },
      });
    });

    cluster.on('exit', (worker, code, signal) => {
      if (!this.isShuttingDown) {
        // Restart worker on unexpected exit
        Logger.warn({
          message: 'Cluster worker died unexpectedly, restarting',
          meta: {
            ID: worker.id,
            PID: worker.process.pid,
            exitCode: code,
            signal,
          },
        });
        cluster.fork();
      }
    });

    Logger.debug({
      message: 'Started cluster master',
      meta: {
        Mode: this.config.workerMode,
        'Worker Count': numClusterWorkers,
        CPUs: numCPUs,
      },
    });
  }

  private async setupWorker(): Promise<void> {
    await this.startApplicationCallback();

    process.on('message', async message => {
      if (message === 'shutdown') {
        Logger.debug({
          message: 'Worker received shutdown message, stopping...',
          meta: {
            PID: process.pid,
          },
        });

        // Stop application
        await this.stopApplicationCallback();
      }
    });
  }

  private handleShutdown(): void {
    this.shutdownSignals.forEach(signal => {
      process.on(signal, async () => await this.initiateShutdown());
    });
  }

  private async initiateShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    if (cluster.isPrimary) {
      Logger.info({
        message: 'Initiating cluster shutdown',
        meta: { workerCount: this.initialWorkerCount },
      });

      let exitedWorkers = 0;

      // Set up exit handler BEFORE sending shutdown messages to avoid race condition
      const exitHandler = () => {
        exitedWorkers++;

        Logger.debug({
          message: 'Cluster worker exited during shutdown',
          meta: { exitedWorkers, totalWorkers: this.initialWorkerCount },
        });

        if (exitedWorkers === this.initialWorkerCount) {
          if (this.shutdownTimer) {
            clearTimeout(this.shutdownTimer);
          }
          Logger.info({ message: 'All cluster workers exited gracefully' });
          requestExit({ code: 0, reason: 'cluster-workers-exited' });
        }
      };

      // Attach exit listener first
      cluster.on('exit', exitHandler);

      // Set shutdown timeout
      this.shutdownTimer = setTimeout(() => {
        Logger.warn({
          message: 'Cluster shutdown timeout reached, forcing exit',
          meta: {
            exitedWorkers,
            totalWorkers: this.initialWorkerCount,
            timeoutMs: this.shutdownTimeout,
          },
        });
        requestExit({ code: 1, reason: 'cluster-shutdown-timeout' });
      }, this.shutdownTimeout);

      // Now send shutdown messages to all workers
      Object.values(cluster.workers ?? {}).forEach(worker => {
        if (worker) {
          worker.send('shutdown');
        }
      });
    } else {
      await this.stopApplicationCallback();
    }
  }
}
