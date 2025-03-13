import { ClusterManagerProps } from './cluster-manager.interface.js';
export default class ClusterManager {
    private readonly config;
    private startApplicationCallback;
    private stopApplicationCallback;
    private shutdownSignals;
    private isShuttingDown;
    constructor({ config, startApplicationCallback, stopApplicationCallback }: ClusterManagerProps);
    start(): void;
    private setupPrimary;
    private setupWorker;
    private handleShutdown;
    private initiateShutdown;
}
//# sourceMappingURL=cluster-manager.d.ts.map