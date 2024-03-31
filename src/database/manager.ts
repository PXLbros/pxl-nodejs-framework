import { MikroORM } from '@mikro-orm/postgresql';
import DatabaseInstance from './instance.js';

/**
 * Database Manager
 */
export default class DatabaseManager {
  /**
   * Database Manager constructor
   */
  constructor() {}

  /**
   * Connect to database
   * @returns Database instance
   */
  public async connect(): Promise<DatabaseInstance> {
    const orm = await MikroORM.init();

    return new DatabaseInstance({ orm });
  }
}
