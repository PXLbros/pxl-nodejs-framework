import { MikroORM } from '@mikro-orm/postgresql';
import DatabaseInstance from './instance.js';
import { ApplicationDatabaseOptions } from './manager.interface.js';

/**
 * Database Manager
 */
export default class DatabaseManager {
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

    const databaseInstance = new DatabaseInstance({ applicationConfig: this.options.applicationConfig, orm });

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
}
