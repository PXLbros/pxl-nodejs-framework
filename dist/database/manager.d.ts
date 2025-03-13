import DatabaseInstance from './instance.js';
import { ApplicationDatabaseOptions } from './manager.interface.js';
/**
 * Database manager
 */
export default class DatabaseManager {
    private logger;
    private readonly options;
    private instances;
    /**
     * Database manager constructor
     */
    constructor(options: ApplicationDatabaseOptions);
    /**
     * Connect to database
     */
    connect(): Promise<DatabaseInstance>;
    /**
     * Disconnect from database
     */
    disconnect(): Promise<void>;
    /**
     * Log database message
     */
    log(message: string, meta?: Record<string, unknown>): void;
}
//# sourceMappingURL=manager.d.ts.map