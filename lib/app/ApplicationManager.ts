import { DatabaseInstance, DatabaseManager, env, RedisInstance, RedisManager } from '~/lib';

export default abstract class ApplicationManager {
  protected startTime: [number, number];

  protected redisManager: RedisManager;
  protected databaseManager: DatabaseManager;

  constructor() {
    this.startTime = process.hrtime();

    this.redisManager = new RedisManager({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
    });

    this.databaseManager = new DatabaseManager({});
  }

  protected async init(): Promise<{
    redisInstance: RedisInstance;
    databaseInstance: DatabaseInstance;
  }> {
    const redisInstance = await this.redisManager.connect();
    const databaseInstance = await this.databaseManager.connect();

    return { redisInstance, databaseInstance };
  }

  protected async stop({
    redisInstance,
    databaseInstance,
  }: {
    redisInstance?: RedisInstance;
    databaseInstance?: DatabaseInstance;
  }): Promise<void> {
    if (redisInstance) {
      await redisInstance.disconnect();
    }

    if (databaseInstance) {
      await databaseInstance.disconnect();
    }
  }
}
