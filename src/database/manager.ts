import { MikroORM } from '@mikro-orm/postgresql';
import DatabaseInstance from './instance.js';
import { ApplicationDatabaseOptions } from './manager.interface.js';
import { Logger } from '../logger/index.js';

/**
 * Database Manager
 */
export default class DatabaseManager {
  private logger: typeof Logger = Logger;

  private readonly options: ApplicationDatabaseOptions;

  private instances: DatabaseInstance[] = [];

  /**
   * Database Manager constructor
   */
  constructor(options: ApplicationDatabaseOptions) {
    this.options = options;
  }

  /**
   * Connect to database
   */
  public async connect(): Promise<DatabaseInstance> {
    const orm = await MikroORM.init();

    const databaseInstance = new DatabaseInstance({ databaseManager: this, applicationConfig: this.options.applicationConfig, orm });

    this.instances.push(databaseInstance);

    return databaseInstance;
  }

  /**
   * Disconnect from database
   */
  public async disconnect(): Promise<void> {
    await Promise.all(this.instances.map((instance) => instance.disconnect()));

    this.instances = [];
  }

  /**
   * Log database message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom('database', message, meta);
  }
}
