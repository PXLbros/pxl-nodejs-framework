import logger from '../../logger/logger';
import Application from '../application';
import ClusterManager from '../../cluster/cluster-manager';
import { ServerApplicationConfig } from './server-application.interface';
import ServerApplicationInstance from './server-application-instance';
import WebServer from '../../webserver/webserver';
import { ClusterManagerConfig } from 'src/cluster/cluster-manager.interface';

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

  private async startStandalone(): Promise<void> {
    const serverApplicationInstance = await this.create();
  }

  private async startCluster(config: ClusterManagerConfig): Promise<void> {
    const clusterManager = new ClusterManager({
      config,

      createApplicationCallback: () => this.create(),
      stopApplicationCallback: () => this.stopServer(),
    });

    clusterManager.start();
  }

  /**
   * Start server application
   */
  public async startServer(): Promise<void> {
    // // Connect
    // const serverApplicationInstance = await this.create();

    // logger.info('Started server application');
    if (this.config.cluster?.enabled) {
      // Start clustered server
      await this.startCluster(this.config.cluster);
    } else {
      // Start standalone server
      await this.startStandalone();
    }
  }
  
  public async stopServer(): Promise<void> {
    console.log('STOPPING APPLICATION SERVER');
  }
}
