import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { Logger } from '../logger/index.js';
import { ApplicationConfig } from '../application/base-application.interface.js';
import DatabaseManager from './manager.js';

/**
 * Database Instance
 */
export default class DatabaseInstance {
  /** Database manager */
  private databaseManager: DatabaseManager;

  /** Application config */
  private applicationConfig: ApplicationConfig;

  /** MikroORM instance */
  private orm: MikroORM;

  /**
   * Database Instance constructor
   * @param orm MikroORM instance
   */
  constructor({ databaseManager, applicationConfig, orm }: { databaseManager: DatabaseManager; applicationConfig: ApplicationConfig; orm: MikroORM }) {
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

    this.databaseManager.log('Disconnected from database');
  }
}
