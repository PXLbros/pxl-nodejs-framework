import cluster from 'cluster';
import { cpus } from 'os';
import { ClusterManagerConfig, ClusterManagerProps } from './cluster-manager.interface';
import logger from '../logger/logger';
import ApplicationInstance from 'src/application/application-instance';

export default class ClusterManager {
  private readonly config: ClusterManagerConfig;

  private createApplicationCallback: () => Promise<ApplicationInstance>;
  private stopApplicationCallback: () => void;

  private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  private isShuttingDown = false;

  private applicationInstance: ApplicationInstance;

  constructor({ config, createApplicationCallback, stopApplicationCallback }: ClusterManagerProps) {
    this.config = config;

    this.createApplicationCallback = createApplicationCallback;
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

    const numDefaultClusterWorkers = 2;
    const numClusterWorkers =
      this.config.workerMode === 'auto' ? numCPUs : this.config.workerCount || numDefaultClusterWorkers;

    for (let workerIndex = 0; workerIndex < numClusterWorkers; workerIndex++) {
      cluster.fork();
    }

    cluster.on('online', (worker) => {
      logger.debug('Started cluster worker', {
        PID: worker.process.pid,
      });
    });

    cluster.on('exit', () => {
      if (!this.isShuttingDown) {
        // Restart worker on unexpected exit
        cluster.fork();
      }
    });

    logger.debug('Started cluster master', {
      Mode: this.config.workerMode,
      'Worker Count': numClusterWorkers,
      CPUs: numCPUs,
    });
  }

  private async setupWorker(): Promise<void> {
    this.applicationInstance = await this.createApplicationCallback();

    process.on('message', (message) => {
      if (message === 'shutdown') {
        logger.debug('Worker received shutdown message, stopping...', {
          PID: process.pid,
        });

        // Stop application instance
        this.applicationInstance.shutdown();

        // Stop application
        this.stopApplicationCallback();
      }
    });
  }

  private handleShutdown(): void {
    this.shutdownSignals.forEach((signal) => {
      process.on(signal, () => this.initiateShutdown());
    });
  }

  private initiateShutdown(): void {
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

        const clusterWorkers = cluster.workers || {};
        const numClusterWorkers = Object.keys(clusterWorkers).length;

        if (exitedWorkers === numClusterWorkers) {
          process.exit();
        }
      });
    } else {
      this.stopApplicationCallback();
    }
  }
}
