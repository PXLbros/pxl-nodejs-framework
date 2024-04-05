import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { Logger } from '../logger/index.js';

/**
 * Database Instance
 */
export default class DatabaseInstance {
  /** MikroORM instance */
  private orm: MikroORM;

  /**
   * Database Instance constructor
   * @param orm MikroORM instance
   */
  constructor({ orm }: { orm: MikroORM }) {
    this.orm = orm;

    const config = orm.config.getAll();

    Logger.debug('Connected to database', {
      Host: config.host,
      User: config.user,
      Database: config.dbName,
    });
  }

  /**
   * Check if database is connected
   */
  public isConnected(): Promise<boolean> {
    return this.orm.isConnected();
  }

  /**
   * Get EntityManager
   */
  public getEntityManager(): EntityManager {
    return this.orm.em.fork();
  }

  /**
   * Disconnect
   */
  public async disconnect(): Promise<void> {
    await this.orm.close();

    Logger.debug('Disconnected from database');
  }
}
