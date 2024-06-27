import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { Logger } from '../logger/index.js';
import { ApplicationConfig } from '../application/base-application.interface.js';

/**
 * Database Instance
 */
export default class DatabaseInstance {
  /** Application config */
  private applicationConfig: ApplicationConfig;

  /** MikroORM instance */
  private orm: MikroORM;

  /**
   * Database Instance constructor
   * @param orm MikroORM instance
   */
  constructor({ applicationConfig, orm }: { applicationConfig: ApplicationConfig; orm: MikroORM }) {
    this.applicationConfig = applicationConfig;
    this.orm = orm;

    const config = orm.config.getAll();

    if (this.applicationConfig.log?.startUp) {
      Logger.debug('Connected to database', {
        Host: config.host,
        User: config.user,
        Database: config.dbName,
      });
    }
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
