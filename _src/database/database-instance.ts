import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { logger } from '../logger';

export default class DatabaseInstance {
  private orm: MikroORM;

  constructor({ orm }: { orm: MikroORM }) {
    this.orm = orm;
  }

  public isConnected(): Promise<boolean> {
    return this.orm.isConnected();
  }

  public getEntityManager(): EntityManager {
    return this.orm.em.fork();
  }

  public async disconnect(): Promise<void> {
    await this.orm.close();

    logger.debug('Disconnected from database');
  }
}
