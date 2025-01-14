import { Logger } from '../../logger/index.js';
export default class BaseProcessor {
    queueManager;
    applicationConfig;
    redisInstance;
    databaseInstance;
    eventManager;
    logger = Logger;
    constructor(queueManager, applicationConfig, redisInstance, databaseInstance, eventManager) {
        this.queueManager = queueManager;
        this.applicationConfig = applicationConfig;
        this.redisInstance = redisInstance;
        this.databaseInstance = databaseInstance;
        this.eventManager = eventManager;
    }
    /**
     * Log queue job message
     */
    log(message, meta) {
        this.logger.custom('queueJob', message, meta);
    }
}
//# sourceMappingURL=base.js.map