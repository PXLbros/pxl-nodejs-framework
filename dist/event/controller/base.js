import cluster from 'cluster';
import { Logger } from '../../logger/index.js';
export default class {
    logger = Logger;
    workerId;
    applicationConfig;
    redisInstance;
    // protected queueManager: QueueManager;
    databaseInstance;
    constructor({ applicationConfig, redisInstance, databaseInstance }) {
        this.workerId = cluster.worker?.id;
        this.applicationConfig = applicationConfig;
        this.redisInstance = redisInstance;
        // this.queueManager = queueManager;
        this.databaseInstance = databaseInstance;
    }
    log(message, meta) {
        this.logger.custom('event', message, meta);
    }
}
//# sourceMappingURL=base.js.map