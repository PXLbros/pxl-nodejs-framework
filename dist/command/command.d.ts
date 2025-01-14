import { ApplicationConfig } from '../application/base-application.interface.js';
import DatabaseInstance from '../database/instance.js';
import { QueueManager } from '../queue/index.js';
import RedisInstance from '../redis/instance.js';
import { CommandConstructorParams } from './command.interface.js';
import { Logger } from '../logger/index.js';
export default abstract class Command {
    /** Command name */
    abstract name: string;
    /** Command description */
    abstract description: string;
    protected applicationConfig: ApplicationConfig;
    protected redisInstance: RedisInstance;
    protected queueManager: QueueManager;
    protected databaseInstance: DatabaseInstance;
    protected logger: typeof Logger;
    constructor({ applicationConfig, redisInstance, queueManager, databaseInstance }: CommandConstructorParams);
    /**
     * Run command
     */
    abstract run(): Promise<void>;
    /**
     * Log command message
     */
    log(message: string, meta?: Record<string, unknown>): void;
}
//# sourceMappingURL=command.d.ts.map