import logger from '../../logger/logger';
import Application from '../application';
import { ServerApplicationConfig } from './server-application.interface';
import ServerApplicationInstance from './server-application-instance';
import WebServer from '../../webserver/webserver';

export default class ServerApplication extends Application {
  protected readonly config: ServerApplicationConfig;

  constructor(config: ServerApplicationConfig) {
    super({
      redis: config.redis,
    });

    this.config = config;
  }

  /**
   * Create server application instance
   */
  protected async create(): Promise<ServerApplicationInstance> {
    const { redisInstance } = await this.connect();

    const webServer = new WebServer({
      config: this.config.webServer,

      redisInstance: redisInstance,
    });

    // Start web server
    await webServer.start();

    const serverApplicationInstance = new ServerApplicationInstance({
      redisInstance,

      webServer,
    });

    return serverApplicationInstance;
  }

  /**
   * Start server application
   */
  public async startServer(): Promise<void> {
    // Connect
    const serverApplicationInstance = await this.create();

    logger.info('Started server application');
  }
}
