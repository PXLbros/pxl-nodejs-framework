import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { ApplicationConfig } from '../application/base-application.interface.js';
import DatabaseManager from './manager.js';
/**
 * Database Instance
 */
export default class DatabaseInstance {
    /** Database manager */
    private databaseManager;
    /** Application config */
    private applicationConfig;
    /** MikroORM instance */
    private orm;
    /**
     * Database Instance constructor
     * @param orm MikroORM instance
     */
    constructor({ databaseManager, applicationConfig, orm }: {
        databaseManager: DatabaseManager;
        applicationConfig: ApplicationConfig;
        orm: MikroORM;
    });
    /**
     * Check if database is connected
     */
    isConnected(): Promise<boolean>;
    /**
     * Get EntityManager
     */
    getEntityManager(): EntityManager;
    /**
     * Disconnect
     */
    disconnect(): Promise<void>;
}
//# sourceMappingURL=instance.d.ts.map