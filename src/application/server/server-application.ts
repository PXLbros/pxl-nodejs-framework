import Application from '../application';
import ClusterManager from '../../cluster/cluster-manager';
import { ServerApplicationConfig, StartServerApplicationProps } from './server-application.interface';
import WebServer from '../../webserver/webserver';
import RedisInstance from 'src/redis/redis-instance';

export default class ServerApplication extends Application {
  protected readonly config: ServerApplicationConfig;

  protected webServer: WebServer;

  constructor(config: ServerApplicationConfig) {
    super({
      redis: config.redis,
    });

    this.config = config;
  }

  /**
   * Start server application
   */
  public async start(props?: StartServerApplicationProps): Promise<void> {
    if (this.config.cluster?.enabled) {
      // Initialize clustered server application
      const clusterManager = new ClusterManager({
        config: this.config.cluster,

        startApplicationCallback: () => this.startInstance(props),
        stopApplicationCallback: () => this.stop(),
      });

      // Start cluster
      clusterManager.start();
    } else {
      // Start standalone server application
      await this.startInstance(props);

      // Handle standalone server application shutdown
      this.handleShutdown();
    }
  }

  private async startInstance(props?: StartServerApplicationProps): Promise<void> {
    try {
      const { redisInstance } = await this.onPreStart(props);

      await this.startCallback({ redisInstance });

      await this.onPostStart();
    } catch (error) {
      // Log error
      console.error(error);

      process.exit(1);
    }
  }

  /**
   * Start server application callback
   */
  protected async startCallback({ redisInstance }: { redisInstance: RedisInstance }): Promise<void> {
    // Initialize web server
    this.webServer = new WebServer({
      config: this.config.webServer,

      redisInstance,
    });

    // Start web server
    await this.webServer.start();
  }

  /**
   * Stop server application callback
   */
  protected async stopCallback(): Promise<void> {
    // Stop web server
    if (this.webServer) {
      await this.webServer.stop();
    }
  }
}
