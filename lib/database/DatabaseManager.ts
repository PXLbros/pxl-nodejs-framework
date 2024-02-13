import { MikroORM } from '@mikro-orm/postgresql';
import { DatabaseInstance, logger } from '~/lib';

interface DatabaseManagerConfig {}

export default class DatabaseManager {
  private config: DatabaseManagerConfig;

  private orm?: MikroORM;

  constructor(config: DatabaseManagerConfig) {
    this.config = config;
  }

  public async connect(): Promise<DatabaseInstance> {
    this.orm = await MikroORM.init();

    const config = this.orm.config.getAll();

    logger.debug('Connected to database', {
      Host: config.host,
      User: config.user,
      Database: config.dbName,
    });

    return new DatabaseInstance({ orm: this.orm });
  }
}
