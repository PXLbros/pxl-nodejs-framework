import RedisInstance from '../redis/redis-instance';
import RedisManager from '../redis/redis-manager';
import ApplicationInstance from './application-instance';
import { ApplicationConfig, StartApplicationProps } from './application.interface';

export default abstract class Application {
  protected readonly config: ApplicationConfig;

  protected startTime: [number, number];

  private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  protected isShuttingDown = false;

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
  public abstract start(props?: StartApplicationProps): Promise<void>;

  /**
   * Start application instance
   */
  protected abstract startInstance(props?: StartApplicationProps): Promise<ApplicationInstance>;

  /**
   * Stop application
   */
  protected async stop(): Promise<void> {
    // Disconnect redis and stuff
    // ...

    console.log('STOP APPLICATION...');
  }

  /**
   * Handle shutdown
   */
  public async handleShutdown({ applicationInstance }: { applicationInstance: ApplicationInstance }): Promise<void> {
    this.shutdownSignals.forEach((signal) => {
      process.on(signal, async () => {
        if (this.isShuttingDown) {
          return;
        }

        this.isShuttingDown = true;

        // Stop application instance
        await applicationInstance.stop();
      });
    });
  }
}
