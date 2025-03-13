import { DatabaseInstance, DatabaseManager } from '../database/index.js';
import QueueManager from '../queue/manager.js';
import RedisManager from '../redis/manager.js';
import { ApplicationConfig } from './base-application.interface.js';
import RedisInstance from '../redis/instance.js';
import CacheManager from '../cache/manager.js';
import EventManager from '../event/manager.js';
export default abstract class BaseApplication {
    /** Unique instance ID */
    uniqueInstanceId: string;
    /** Shutdown signals */
    protected shutdownSignals: NodeJS.Signals[];
    /** Application start time */
    protected startTime: [number, number];
    /** Whether application is stopping */
    protected isStopping: boolean;
    /** Cluster worker ID */
    protected workerId: number | null;
    /** Application config */
    protected config: ApplicationConfig;
    /** Application version */
    protected applicationVersion?: string;
    /** Redis manager */
    redisManager: RedisManager;
    /** Cache manager */
    cacheManager: CacheManager;
    /** Database manager */
    databaseManager?: DatabaseManager;
    /** Queue manager */
    queueManager?: QueueManager;
    /** Event manager */
    eventManager?: EventManager;
    get Name(): string;
    /**
     * Application constructor
     */
    constructor(config: ApplicationConfig);
    /**
     * Get application version
     */
    getApplicationVersion(): Promise<any>;
    /**
     * Start application
     */
    start(): Promise<void>;
    /**
     * Before application start
     */
    private onBeforeStart;
    /**
     * Application started event
     */
    protected onStarted({ startupTime, }: {
        startupTime: number;
    }): void;
    /**
     * Application stopped event
     */
    protected onStopped({ runtime, }: {
        runtime: number;
    }): void;
    /**
     * Before application stop event
     */
    private onBeforeStop;
    /**
     * Start application instance
     */
    private startInstance;
    protected abstract startHandler({ redisInstance, databaseInstance, queueManager, eventManager, }: {
        redisInstance: RedisInstance;
        databaseInstance?: DatabaseInstance | null;
        queueManager: QueueManager;
        eventManager?: EventManager | null;
    }): Promise<void>;
    protected abstract stopCallback(): void;
    /**
     * Handle shutdown
     */
    handleShutdown({ onStopped, }: {
        onStopped?: ({ runtime }: {
            runtime: number;
        }) => void;
    }): void;
    /**
     * Stop application
     */
    private stop;
}
//# sourceMappingURL=base-application.d.ts.map