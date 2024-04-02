import { MikroORM } from '@mikro-orm/postgresql';
import DatabaseInstance from './instance.js';
import { ApplicationDatabaseConfig } from '../application/application.js';

/**
 * Database Manager
 */
export default class DatabaseManager {
  /**
   * Database Manager constructor
   */
  constructor(private readonly config: ApplicationDatabaseConfig) {
  }

  /**
   * Connect to database
   */
  public async connect(): Promise<DatabaseInstance> {
    const orm = await MikroORM.init();

    return new DatabaseInstance({ orm });
  }
}
