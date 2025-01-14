import { MikroORM } from '@mikro-orm/postgresql';
import DatabaseInstance from './instance.js';
import { Logger } from '../logger/index.js';
/**
 * Database manager
 */
export default class DatabaseManager {
    logger = Logger;
    options;
    instances = [];
    /**
     * Database manager constructor
     */
    constructor(options) {
        this.options = options;
    }
    /**
     * Connect to database
     */
    async connect() {
        const orm = await MikroORM.init();
        const databaseInstance = new DatabaseInstance({ databaseManager: this, applicationConfig: this.options.applicationConfig, orm });
        this.instances.push(databaseInstance);
        return databaseInstance;
    }
    /**
     * Disconnect from database
     */
    async disconnect() {
        await Promise.all(this.instances.map((instance) => instance.disconnect()));
        this.instances = [];
    }
    /**
     * Log database message
     */
    log(message, meta) {
        this.logger.custom('database', message, meta);
    }
}
//# sourceMappingURL=manager.js.map