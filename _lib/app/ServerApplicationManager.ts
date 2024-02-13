import { cluster, DatabaseInstance, RedisInstance, WebServer } from '~/lib';
import ApplicationManager from '~/lib/app/ApplicationManager';
import { WebServerRoute } from '~/lib/webserver';
import { timeUtil } from '~/utils';

interface ServerApplicationClusterConfig {
  enabled: boolean;

  workerMode: string;
}

interface ServerApplicationWebServerConfig {
  enabled: boolean;

  port: number;

  routes: WebServerRoute[];

  helmet: {
    enabled: boolean;
  };
}

interface ServerApplicationConfig {
  cluster: ServerApplicationClusterConfig;

  webServer: ServerApplicationWebServerConfig;
}

type OnStartedServerApplicationEvent = ({ startupTime }: { startupTime: number }) => void;
type OnStoppedServerApplicationEvent = ({ executionTime }: { executionTime: number }) => void;

interface ServerApplicationEvents {
  onStarted?: OnStartedServerApplicationEvent;
  onStopped?: OnStoppedServerApplicationEvent;
}

export interface ServerApplicationStartOptions {
  events?: ServerApplicationEvents;
}

export default class ServerApplicationManager extends ApplicationManager {
  private config: ServerApplicationConfig;

  private redisInstance?: RedisInstance;
  private databaseInstance?: DatabaseInstance;

  private webServer?: WebServer;

  private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  private isShuttingDown = false;

  constructor(config: ServerApplicationConfig) {
    super();

    this.config = config;
  }

  public async start(options?: ServerApplicationStartOptions): Promise<void> {
    // Start
    if (this.config.cluster.enabled) {
      this.startCluster({ workerMode: this.config.cluster.workerMode, startOptions: options });
    } else {
      this.startStandalone({ startOptions: options });
    }
  }

  protected async startServer({ onStarted }: { onStarted?: OnStartedServerApplicationEvent }): Promise<void> {
    // Initialize
    const { redisInstance, databaseInstance } = await this.init();

    this.redisInstance = redisInstance;
    this.databaseInstance = databaseInstance;

    if (this.config.webServer.enabled) {
      this.webServer = new WebServer({
        config: {
          port: this.config.webServer.port,
          routes: this.config.webServer.routes,
          corsOrigins: [],
          helmet: {
            enabled: this.config.webServer.helmet.enabled,
          },
        },
        redisInstance: this.redisInstance,
        databaseInstance: this.databaseInstance,
      });

      // Load web server
      await this.webServer.load();

      // Start web server
      await this.webServer.start();
    }

    const startupTime = timeUtil.calculateElapsedTime({ startTime: this.startTime });

    if (onStarted) {
      onStarted({ startupTime });
    }
  }

  private startCluster({
    workerMode,
    startOptions,
  }: {
    workerMode: string;
    startOptions?: ServerApplicationStartOptions;
  }): void {
    cluster.setup({
      workerMode,
      startApplicationCallback: () => this.startServer({ onStarted: startOptions?.events?.onStarted }),
      stopApplicationCallback: () => this.stopServer({ onStopped: startOptions?.events?.onStopped }),
    });
  }

  private async startStandalone({ startOptions }: { startOptions?: ServerApplicationStartOptions }): Promise<void> {
    await this.startServer({ onStarted: startOptions?.events?.onStarted });

    this.shutdownSignals.forEach((signal) => {
      process.on(signal, () => {
        this.stopServer({ onStopped: startOptions?.events?.onStopped });
      });
    });
  }

  private async stopServer({ onStopped }: { onStopped?: OnStoppedServerApplicationEvent }): Promise<void> {
    if (this.isShuttingDown) {
      // logger.warn('Server application is already stopping');

      return;
    }

    this.isShuttingDown = true;

    if (this.webServer) {
      await this.webServer.stop();
    }

    this.stop({ redisInstance: this.redisInstance, databaseInstance: this.databaseInstance });

    const executionTime = process.uptime() * 1000;

    if (onStopped) {
      onStopped({ executionTime });
    }
  }
}
