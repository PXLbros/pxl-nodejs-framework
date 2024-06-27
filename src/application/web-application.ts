import RedisInstance from '../redis/instance.js';
import DatabaseInstance from '../database/instance.js';
import WebServer from '../webserver/webserver.js';
import QueueManager from '../queue/manager.js';
import WebSocket from '../websocket/websocket.js';
import BaseApplication from './base-application.js';
import { WebApplicationConfig } from './web-application.interface.js';
import { Helper } from '../util/index.js';

/**
 * Application
 */
export default class WebApplication extends BaseApplication {
  /** Web application config */
  protected config: WebApplicationConfig;

  /** WebSocket */
  private webSocket?: WebSocket;

  /** Web server */
  private webServer?: WebServer;

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

      // Start WebSocket server
      this.webSocket.startServer();
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
}
