/**
 * Database Instance
 */
export default class DatabaseInstance {
    /** Database manager */
    databaseManager;
    /** Application config */
    applicationConfig;
    /** MikroORM instance */
    orm;
    /**
     * Database Instance constructor
     * @param orm MikroORM instance
     */
    constructor({ databaseManager, applicationConfig, orm }) {
        this.databaseManager = databaseManager;
        this.applicationConfig = applicationConfig;
        this.orm = orm;
        const config = orm.config.getAll();
        if (this.applicationConfig.log?.startUp) {
            this.databaseManager.log('Connected', {
                Host: config.host,
                User: config.user,
                Database: config.dbName,
            });
        }
    }
    /**
     * Check if database is connected
     */
    isConnected() {
        return this.orm.isConnected();
    }
    /**
     * Get EntityManager
     */
    getEntityManager() {
        return this.orm.em.fork();
    }
    /**
     * Disconnect
     */
    async disconnect() {
        await this.orm.close();
        this.databaseManager.log('Disconnected');
    }
}
//# sourceMappingURL=instance.js.map