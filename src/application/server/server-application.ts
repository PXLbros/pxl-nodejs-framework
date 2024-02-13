import logger from '../../logger/logger';
import Application from '../application';
import ClusterManager from '../../cluster/cluster-manager';
import { ServerApplicationConfig, StartServerApplicationProps } from './server-application.interface';
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
   * Start server application instance
   */
  protected async start(props?: StartServerApplicationProps): Promise<ServerApplicationInstance> {
    const { redisInstance } = await this.connect();

    const webServer = new WebServer({
      config: this.config.webServer,

      redisInstance: redisInstance,
    });

    // Start web server
    await webServer.start();

    const serverApplicationInstance = new ServerApplicationInstance({
      // TODO:
      // events: {}
      // or just
      // onStopped

      redisInstance,

      webServer,
    });

    return serverApplicationInstance;
  }

  private async startStandalone(props: StartServerApplicationProps): Promise<void> {
    const serverApplicationInstance = await this.start(props);
  }

  private async startCluster({
    props,
    clusterConfig,
  }: {
    props: StartServerApplicationProps;
    clusterConfig: ClusterManagerConfig;
  }): Promise<void> {
    const clusterManager = new ClusterManager({
      config: clusterConfig,

      startApplicationCallback: () => this.start(props),
      stopApplicationCallback: () => this.stop(),
    });

    clusterManager.start();
  }

  /**
   * Start server application
   */
  public async startServer(props: StartServerApplicationProps): Promise<void> {
    if (this.config.cluster?.enabled) {
      // Start clustered server
      await this.startCluster({
        props,

        clusterConfig: this.config.cluster,
      });
    } else {
      // Start standalone server
      await this.startStandalone(props);
    }
  }

  public async stop(): Promise<void> {
    console.log('STOPPING SERVER APPLICATION');
  }
}
