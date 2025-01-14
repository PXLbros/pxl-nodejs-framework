import { Logger } from '../logger/index.js';
export default class Command {
    applicationConfig;
    redisInstance;
    queueManager;
    databaseInstance;
    logger;
    constructor({ applicationConfig, redisInstance, queueManager, databaseInstance }) {
        this.applicationConfig = applicationConfig;
        this.redisInstance = redisInstance;
        this.queueManager = queueManager;
        this.databaseInstance = databaseInstance;
        this.logger = Logger;
    }
    /**
     * Log command message
     */
    log(message, meta) {
        this.logger.custom('command', message, {
            Command: this.name,
            ...meta
        });
    }
}
//# sourceMappingURL=command.js.map