import cluster from 'cluster';
import { cpus } from 'os';
import { Logger } from '../logger/index.js';
export default class ClusterManager {
    config;
    startApplicationCallback;
    stopApplicationCallback;
    shutdownSignals = ['SIGTERM', 'SIGINT'];
    isShuttingDown = false;
    constructor({ config, startApplicationCallback, stopApplicationCallback }) {
        this.config = config;
        this.startApplicationCallback = startApplicationCallback;
        this.stopApplicationCallback = stopApplicationCallback;
    }
    start() {
        if (cluster.isPrimary) {
            this.setupPrimary();
        }
        else {
            this.setupWorker();
        }
        this.handleShutdown();
    }
    setupPrimary() {
        const numCPUs = cpus().length;
        const numClusterWorkers = this.config.workerMode === 'auto' ? numCPUs : this.config.workerCount;
        for (let workerIndex = 0; workerIndex < numClusterWorkers; workerIndex++) {
            cluster.fork();
        }
        cluster.on('online', (worker) => {
            Logger.debug('Started cluster worker', {
                ID: worker.id,
                PID: worker.process.pid,
            });
        });
        cluster.on('exit', () => {
            if (!this.isShuttingDown) {
                // Restart worker on unexpected exit
                cluster.fork();
            }
        });
        Logger.debug('Started cluster master', {
            Mode: this.config.workerMode,
            'Worker Count': numClusterWorkers,
            CPUs: numCPUs,
        });
    }
    async setupWorker() {
        await this.startApplicationCallback();
        process.on('message', async (message) => {
            if (message === 'shutdown') {
                Logger.debug('Worker received shutdown message, stopping...', {
                    PID: process.pid,
                });
                // Stop application
                await this.stopApplicationCallback();
            }
        });
    }
    handleShutdown() {
        this.shutdownSignals.forEach((signal) => {
            process.on(signal, async () => await this.initiateShutdown());
        });
    }
    async initiateShutdown() {
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
        }
        else {
            await this.stopApplicationCallback();
        }
    }
}
//# sourceMappingURL=cluster-manager.js.map