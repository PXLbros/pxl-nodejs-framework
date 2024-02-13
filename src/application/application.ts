import RedisInstance from '../redis/redis-instance';
import RedisManager from '../redis/redis-manager';
import ApplicationInstance from './application-instance';
import { ApplicationConfig } from './application.interface';

export default abstract class Application {
  protected readonly config: ApplicationConfig;

  protected startTime: [number, number];

  // private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  protected redisManager: RedisManager;
  // protected databaseManager: DatabaseManager;

  constructor(config: ApplicationConfig) {
    this.config = config;

    // Initialize
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

  protected async connect(): Promise<{ redisInstance: RedisInstance }> {
    const redisInstance = await this.redisManager.connect();

    return { redisInstance };
  }

  /**
   * Create application instance
   */
  protected abstract create(): Promise<ApplicationInstance>;

  /**
   * Start application
   */
  protected async start(): Promise<void> {
    console.log('START APP');
  }

  /**
   * Stop application
   */
  protected async stop(): Promise<void> {
    console.log('STOP APP');
  }

  // protected handleShutdown({ callback }: { callback: () => void }): void {
  //   this.shutdownSignals.forEach((signal) => {
  //     process.on(signal, () => {
  //       callback();
  //     });
  //   });
  // }

  // protected async stop({
  //   redisInstance,
  //   databaseInstance,
  // }: {
  //   redisInstance?: RedisInstance;
  //   databaseInstance?: DatabaseInstance;
  // }): Promise<void> {
  //   if (redisInstance) {
  //     await redisInstance.disconnect();
  //   }

  //   if (databaseInstance) {
  //     await databaseInstance.disconnect();
  //   }
  // }
}
