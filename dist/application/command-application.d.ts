import DatabaseInstance from '../database/instance.js';
import QueueManager from '../queue/manager.js';
import RedisInstance from '../redis/instance.js';
import BaseApplication from './base-application.js';
import { CommandApplicationConfig } from './command-application.interface.js';
export default class CommandApplication extends BaseApplication {
    /** Command application config */
    protected config: CommandApplicationConfig;
    constructor(config: CommandApplicationConfig);
    protected startHandler({ redisInstance, databaseInstance, queueManager }: {
        redisInstance: RedisInstance;
        databaseInstance: DatabaseInstance;
        queueManager: QueueManager;
    }): Promise<void>;
    private stopCommand;
    protected stopCallback(): void;
}
//# sourceMappingURL=command-application.d.ts.map