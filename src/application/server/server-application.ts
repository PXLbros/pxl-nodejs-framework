import logger from '../../logger/logger';
import Application from '../application';
import ClusterManager from '../../cluster/cluster-manager';
import { ClusterManagerConfig } from '../../cluster/cluster-manager.interface';
import { ServerApplicationConfig, StartServerApplicationProps } from './server-application.interface';
import ServerApplicationInstance from './server-application-instance';
import WebServer from '../../webserver/webserver';
import { calculateElapsedTime } from '../../util/time';

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
  protected async startInstance(props?: StartServerApplicationProps): Promise<ServerApplicationInstance> {
    const { redisInstance } = await this.connect();

    // Initialize web server
    const webServer = new WebServer({
      config: this.config.webServer,

      redisInstance: redisInstance,
    });

    // Start web server
    await webServer.start();

    // Initialize server application instance
    const serverApplicationInstance = new ServerApplicationInstance({
      redisInstance,

      webServer,

      events: {
        onStopped: props?.onStopped,
      },
    });

    // Calcualte startup time
    const startupTime = calculateElapsedTime({ startTime: this.startTime });

    if (props?.onStarted) {
      // Emit started event
      props.onStarted({ startupTime });
    }

    return serverApplicationInstance;
  }

  /**
   * Start server application
   */
  public async startServer(props: StartServerApplicationProps): Promise<void> {
    if (this.config.cluster?.enabled) {
      // Start clustered server application
      const clusterManager = new ClusterManager({
        config: this.config.cluster,

        startApplicationCallback: () => this.startInstance(props),
        stopApplicationCallback: () => this.stop(),
      });

      clusterManager.start();
    } else {
      // Start standalone server application
      const serverApplicationInstance = await this.startInstance(props);

      serverApplicationInstance.handleShutdown();
    }
  }

  /**
   * Stop server application
   */
  protected async stop(): Promise<void> {
    console.log('STOPPING SERVER APPLICATION');

    await parent.stop();
  }
}
