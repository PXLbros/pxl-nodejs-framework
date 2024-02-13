import { logger } from '../..';
import Application from '../application';
import { ServerApplicationConfig } from './server-application.interface';

export default class ServerApplication extends Application {
  protected readonly config: ServerApplicationConfig;

  constructor(config: ServerApplicationConfig) {
    super({
      redis: config.redis,
    });

    this.config = config;
  }

  /**
   * Start server application
   */
  public async startServer(): Promise<void> {
    // Connect
    const { redisInstance } = await this.connect();

    logger.info('Started server application');
  }

  /**
   * Stop server application
   */
  public async stopServer(): Promise<void> {
  }
}
