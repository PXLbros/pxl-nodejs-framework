import { calculateElapsedTime } from 'src/util/time';
import RedisInstance from '../redis/redis-instance';
import RedisManager from '../redis/redis-manager';
import { ApplicationConfig, OnStoppedEvent, StartApplicationProps } from './application.interface';

export default abstract class Application {
  protected readonly config: ApplicationConfig;

  protected startTime: [number, number];

  private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  private onStopped?: OnStoppedEvent;
  private isStopping = false;

  protected redisManager: RedisManager;
  // protected databaseManager: DatabaseManager;

  protected redisInstance: RedisInstance;

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

    // this.databaseManager = new DatabaseManager({});
  }

  /**
   * Connect
   */
  protected async connect(): Promise<{ redisInstance: RedisInstance }> {
    this.redisManager = new RedisManager({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
    });

    // Connect to Redis
    this.redisInstance = await this.redisManager.connect();

    return { redisInstance: this.redisInstance };
  }

  /**
   * Disconnect
   */
  protected async disconnect(): Promise<void> {
    if (this.redisInstance) {
      await this.redisInstance.disconnect();
    }
  }

  public abstract start(props?: StartApplicationProps): Promise<void>;

  /**
   * Start application
   */
  // public async startInstance(props?: StartApplicationProps): Promise<void> {
  //   this.onStopped = props?.onStopped;

  //   // Connect
  //   const { redisInstance } = await this.connect();

  //   // Start callback
  //   await this.startCallback({ redisInstance });

  //   if (props?.onStarted) {
  //     // Calculate startup time
  //     const startupTime = calculateElapsedTime({ startTime: this.startTime });

  //     // Emit started event
  //     props.onStarted({ startupTime });
  //   }
  // }

  protected async onPreStart(props?: StartApplicationProps): Promise<{ redisInstance: RedisInstance }> {
    // Log start
    console.log('PRE START...');

    this.onStopped = props?.onStopped;

    // Connect
    const { redisInstance } = await this.connect();

    return { redisInstance };
  }

  protected async onPostStart(props?: StartApplicationProps): Promise<void> {
    // Log start
    console.log('POST START...');

    if (props?.onStarted) {
      // Calculate startup time
      const startupTime = calculateElapsedTime({ startTime: this.startTime });

      // Emit started event
      await props.onStarted({ startupTime });
    }
  }

  /**
   * Start application callback
   */
  protected abstract startCallback({ redisInstance }: { redisInstance: RedisInstance }): Promise<void>;

  /**
   * Stop application
   */
  protected async stop(): Promise<void> {
    if (this.isStopping) {
      return;
    }

    this.isStopping = true;

    // Stop callback
    await this.stopCallback();

    // Disconnect
    await this.disconnect();

    if (this.onStopped) {
      // Calculate runtime
      const runtime = process.uptime() * 1000;

      // Emit stopped event
      await this.onStopped({ runtime });
    }

    process.exit(0);
  }

  /**
   * Stop application callback
   */
  protected abstract stopCallback(): Promise<void>;

  /**
   * Handle shutdown
   */
  public handleShutdown(): void {
    this.shutdownSignals.forEach((signal) => {
      process.on(signal, async () => {
        // Stop application
        await this.stop();
      });
    });
  }
}
