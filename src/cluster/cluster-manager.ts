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

    cluster.on('exit', () => {
      if (!this.isShuttingDown) {
        // Restart worker on unexpected exit
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
      for (const id in cluster.workers) {
        const worker = cluster.workers[id];

        if (!worker) {
          continue;
        }

        worker.send('shutdown');
      }

      let exitedWorkers = 0;

      cluster.on('exit', () => {
        exitedWorkers++;

        const clusterWorkers = cluster.workers ?? {};
        const numClusterWorkers = Object.keys(clusterWorkers).length;

        if (exitedWorkers === numClusterWorkers) {
          requestExit({ code: 0, reason: 'cluster-workers-exited' });
        }
      });
    } else {
      await this.stopApplicationCallback();
    }
  }
}
