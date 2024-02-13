import RedisInstance from '../redis/redis-instance';
import RedisManager from '../redis/redis-manager';
import ApplicationInstance from './application-instance';
import { ApplicationConfig, StartApplicationProps } from './application.interface';

export default abstract class Application {
  protected readonly config: ApplicationConfig;

  protected startTime: [number, number];

  protected redisManager: RedisManager;
  // protected databaseManager: DatabaseManager;

  constructor(config: ApplicationConfig) {
    this.config = config;

    // Initialize application
    this.init();
  }

  /**
   * Initialize application
   */
  protected init(): void {
    this.startTime = process.hrtime();

    this.redisManager = new RedisManager({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
    });

    // this.databaseManager = new DatabaseManager({});
  }

  /**
   * Connect
   */
  protected async connect(): Promise<{ redisInstance: RedisInstance }> {
    const redisInstance = await this.redisManager.connect();

    return { redisInstance };
  }

  /**
   * Start application
   */
  protected abstract startInstance(props?: StartApplicationProps): Promise<ApplicationInstance>;

  /**
   * Stop application
   */
  protected abstract stop(): Promise<void>;
}
