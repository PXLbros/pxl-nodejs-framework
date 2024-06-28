import RedisInstance from '../redis/instance.js';
import DatabaseInstance from '../database/instance.js';
import WebServer from '../webserver/webserver.js';
import QueueManager from '../queue/manager.js';
import WebSocket from '../websocket/websocket.js';
import BaseApplication from './base-application.js';
import { WebApplicationConfig } from './web-application.interface.js';
import { Helper, Time } from '../util/index.js';
import { Logger } from '../logger/index.js';
// import WebSocketServer from '../websocket/websocket-server.js';

/**
 * Application
 */
export default class WebApplication extends BaseApplication {
  /** Web application config */
  protected config: WebApplicationConfig;

  /** WebSocket */
  public webSocket?: WebSocket;

  /** Web server */
  public webServer?: WebServer;

  constructor(config: WebApplicationConfig) {
    super(config);

    const defaultConfig: Partial<WebApplicationConfig> = {
      log: {
        startUp: true,
      },
    };

    const mergedConfig = Helper.defaultsDeep(config, defaultConfig);

    this.config = mergedConfig;
  }

  protected async startHandler({ redisInstance, databaseInstance, queueManager }: { redisInstance: RedisInstance; databaseInstance: DatabaseInstance; queueManager: QueueManager }): Promise<void> {
    if (this.config.webSocket?.enabled) {
      this.webSocket = new WebSocket({
        options: this.config.webSocket,
        routes: this.config.webSocket.routes,
        redisInstance,
        databaseInstance,
        queueManager,
      });

      // Load WebSocket
      this.webSocket.load();

      switch (this.config.webSocket.type) {
        case 'server': {
          // const webSocketServer = new WebSocketServer({
          //   host: this.config.webSocket.host,
          //   port: this.config.webSocket.port,
          //   controllersDirectory: this.config.webSocket.controllersDirectory,
          // });

          // Start WebSocket server
          await this.webSocket.startServer();

          break;
        }
        case 'client': {
          await this.webSocket.connectToServer();

          break;
        }
        default: {
          if (!this.config.webSocket.type) {
            throw new Error('WebSocket type is required');
          } else {
            throw new Error(`WebSocket type "${this.config.webSocket.type}" is not supported`);
          }
        }
      }
    }

    if (this.config.webServer?.enabled) {
      // Initialize web server
      this.webServer = new WebServer({
        applicationConfig: this.config,

        // config: this.config.webServer,
        options: {
          host: this.config.webServer.host,
          port: this.config.webServer.port,
          controllersDirectory: this.config.webServer.controllersDirectory,
          cors: this.config.webServer.cors,
          log: this.config.webServer.log,
          debug: this.config.webServer.debug,
        },

        routes: this.config.webServer.routes,

        redisInstance,
        databaseInstance,
        queueManager,
      });

      // Load web server
      await this.webServer.load();

      // Start web server
      await this.webServer.start();
    }
  }

  /**
   * Stop application callback
   */
  protected async stopCallback(): Promise<void> {
    if (this.webServer) {
      // Stop web server
      await this.webServer.stop();
    }
  }

  /**
   * Application started event
   */
  protected async onStarted({ startupTime }: { startupTime: number }): Promise<void> {
    if (this.config.log?.startUp) {
      Logger.info('Application started', {
        Name: this.config.name,
        'PXL Framework Version': this.applicationVersion,
        'Startup Time': Time.formatTime({ time: startupTime, format: 's', numDecimals: 2, showUnit: true }),
      });
    }

    if (this.config.events?.onStarted) {
      this.config.events.onStarted({ app: this, startupTime });
    }
  }

  protected async onStopped({ runtime }: { runtime: number }): Promise<void> {
    if (this.config.log?.shutdown) {
      Logger.info('Application stopped', {
        Name: this.config.name,
        'Runtime': Time.formatTime({ time: runtime, format: 's', numDecimals: 2, showUnit: true }),
      });
    }

    if (this.config.events?.onStopped) {
      this.config.events.onStopped({ app: this, runtime });
    }
  }
}
