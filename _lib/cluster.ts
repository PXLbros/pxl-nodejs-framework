import cluster from 'cluster';
import { cpus } from 'os';
import { env, logger } from '~/lib';

export enum ClusterWorkerMode {
  Auto = 'auto',
  Manual = 'manual',
}

interface SetupClusterConfig {
  workerMode: string;
  startApplicationCallback: () => void;
  stopApplicationCallback: () => void;
}

class Cluster {
  private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  private isShuttingDown = false;

  public setup(config: SetupClusterConfig): void {
    // logger.debug('Setting up cluster...', {
    //   Mode: config.workerMode,
    //   Primary: cluster.isPrimary ? 'Yes' : 'No',
    // });

    if (cluster.isPrimary) {
      this.setupPrimary(config);
    } else {
      this.setupWorker(config);
    }

    this.shutdownSignals.forEach((signal) => {
      process.on(signal, () => this.initiateShutdown({ signal, config }));
    });
  }

  private setupPrimary(config: SetupClusterConfig): void {
    const numCPUs: number = cpus().length;
    const numClusterWorkers: number = config.workerMode === ClusterWorkerMode.Auto ? numCPUs : env.NUM_CLUSTER_WORKERS;

    // logger.info('Starting cluster...', {
    //   Mode: config.workerMode,
    //   Workers: numClusterWorkers,
    // });

    for (let workerIndex = 0; workerIndex < numClusterWorkers; workerIndex++) {
      cluster.fork();
    }

    // cluster.on('online', (worker) => {
    //   logger.debug('Worker started', {
    //     PID: worker.process.pid,
    //   });
    // });

    cluster.on('exit', (worker, code, signal) => {
      // logger.debug('Worker stopped', {
      //   Code: code,
      //   Signal: signal,
      // });

      if (!this.isShuttingDown) {
        // Restart the worker on unexpected exit
        cluster.fork();
      }
    });
  }

  private setupWorker(config: SetupClusterConfig): void {
    config.startApplicationCallback();

    process.on('message', (message) => {
      if (message === 'shutdown') {
        // logger.debug('Worker received shutdown message, stopping...', {
        //   PID: process.pid,
        // });

        config.stopApplicationCallback();
      }
    });
  }

  private initiateShutdown({ signal, config }: { signal: NodeJS.Signals; config: SetupClusterConfig }): void {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    // logger.info('Received shutdown signal, shutting down...', {
    //   Signal: signal,
    // });

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
          logger.info('All workers exited, shutting down primary...');

          process.exit();
        }
      });
    } else {
      config.stopApplicationCallback();
    }
  }
}

export default new Cluster();
