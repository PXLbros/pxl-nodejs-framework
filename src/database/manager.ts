import { MikroORM } from '@mikro-orm/postgresql';
import DatabaseInstance from './instance.js';
import { ApplicationDatabaseConfig } from '../application/application.interface.js';

/**
 * Database Manager
 */
export default class DatabaseManager {
  private readonly config: ApplicationDatabaseConfig;

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

    return new DatabaseInstance({ orm });
  }
}
