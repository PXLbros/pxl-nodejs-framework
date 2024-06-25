import { MikroORM } from '@mikro-orm/postgresql';
import DatabaseInstance from './instance.js';
import { ApplicationDatabaseConfig } from '../application/base-application.interface.js';

/**
 * Database Manager
 */
export default class DatabaseManager {
  private readonly config: ApplicationDatabaseConfig;

  private instances: DatabaseInstance[] = [];

  /**
   * Database Manager constructor
   */
  constructor(config: ApplicationDatabaseConfig) {
    this.config = config;
  }

  /**
   * Connect to database
   */
  public async connect(): Promise<DatabaseInstance> {
    const orm = await MikroORM.init();

    const databaseInstance = new DatabaseInstance({ orm });

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
