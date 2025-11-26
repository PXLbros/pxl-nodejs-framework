import type { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import type { ApplicationConfig } from '../application/base-application.interface.js';
import type DatabaseManager from './manager.js';

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
  constructor({
    databaseManager,
    applicationConfig,
    orm,
  }: {
    databaseManager: DatabaseManager;
    applicationConfig: ApplicationConfig;
    orm: MikroORM;
  }) {
    this.databaseManager = databaseManager;
    this.applicationConfig = applicationConfig;
    this.orm = orm;
  }

  /**
   * Check if database is connected
   */
  public isConnected(): Promise<boolean> {
    return this.orm.isConnected();
  }

  /**
   * Get EntityManager
   *
   * Fork and return a new EntityManager instance
   * WARNING: You MUST call em.clear() when done to prevent memory leaks
   * Consider using withEntityManager() instead for automatic cleanup
   *
   * @deprecated Use withEntityManager() for automatic cleanup
   */
  public getEntityManager(): EntityManager {
    return this.orm.em.fork();
  }

  /**
   * Execute a function with a fresh EntityManager that is automatically cleaned up
   * This is the recommended pattern for short-lived operations (HTTP requests, queue jobs, etc.)
   *
   * @example
   * await databaseInstance.withEntityManager(async (em) => {
   *   const user = await em.findOne('User', { id: 1 });
   *   return user;
   * });
   */
  public async withEntityManager<T>(callback: (em: EntityManager) => Promise<T>): Promise<T> {
    const em = this.orm.em.fork();
    try {
      return await callback(em);
    } finally {
      em.clear();
    }
  }

  /**
   * Execute a function with a fresh EntityManager that supports transactions
   * The EntityManager is automatically cleaned up after the transaction
   *
   * @example
   * await databaseInstance.withTransaction(async (em) => {
   *   const user = em.create('User', { name: 'John' });
   *   await em.persistAndFlush(user);
   *   return user;
   * });
   */
  public async withTransaction<T>(callback: (em: EntityManager) => Promise<T>): Promise<T> {
    const em = this.orm.em.fork();
    try {
      return await em.transactional(async transactionalEm => {
        return await callback(transactionalEm);
      });
    } finally {
      em.clear();
    }
  }

  /**
   * Disconnect
   */
  public async disconnect(): Promise<void> {
    await this.orm.close();

    this.databaseManager.log('Disconnected');
  }
}
