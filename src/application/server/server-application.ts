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
  protected async create(): Promise<ServerApplicationInstance> { // This is equivalent of startServer in old
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

  private async startStandalone(): Promise<void> {
    const serverApplicationInstance = await this.create();

    // this.handleShutdown({
    //   callback: async () => {
    //     this.stopServer();
    //   },
    // });
  }

  /**
   * Start server application
   */
  public async startServer(): Promise<void> {
    // // Connect
    // const serverApplicationInstance = await this.create();

    // logger.info('Started server application');
    if (this.config.cluster?.enabled) {
      // // Start clustered server
      // await this.startCluster();
    } else {
      // Start standalone server
      await this.startStandalone();
    }
  }
  
  public async stopServer(): Promise<void> {
    console.log('STOP SERVER');
    
  }
}
