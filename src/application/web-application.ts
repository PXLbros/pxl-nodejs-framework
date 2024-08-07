import cluster from 'cluster';
import RedisInstance from '../redis/instance.js';
import DatabaseInstance from '../database/instance.js';
import WebServer from '../webserver/webserver.js';
import QueueManager from '../queue/manager.js';
import WebSocket from '../websocket/websocket.js';
import BaseApplication from './base-application.js';
import { WebApplicationConfig } from './web-application.interface.js';
import { Helper, Time } from '../util/index.js';
import { Logger } from '../logger/index.js';
import WebSocketServer from '../websocket/websocket-server.js';
import WebSocketClient from '../websocket/websocket-client.js';

/**
 * Application
 */
export default class WebApplication extends BaseApplication {
  /** Web application config */
  protected config: WebApplicationConfig;

  // /** WebSocket */
  // public webSocket?: WebSocket;

  /** Web server */
  public webServer?: WebServer;

  /** WebSocket server */
  public webSocketServer?: WebSocketServer;

  /** WebSocket client */
  public webSocketClient?: WebSocketClient;

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
      let webSocketServer: WebSocketServer | undefined;
      let webSocketClient: WebSocketClient | undefined;

      const workerId = cluster.isWorker && cluster.worker ? cluster.worker.id : null;

      switch (this.config.webSocket.type) {
        case 'server': {
          // Initialize WebSocket server
          webSocketServer = new WebSocketServer({
            uniqueInstanceId: this.uniqueInstanceId,
            applicationConfig: this.config,
            options: this.config.webSocket,
            redisInstance,
            databaseInstance,
            queueManager,
            routes: this.config.webSocket.routes,
            workerId,
          });

          // Load WebSocket client
          await webSocketServer.load();

          // Start WebSocket server
          await webSocketServer.start();

          break;
        }
        case 'client': {
          // Initialize WebSocket client
          webSocketClient = new WebSocketClient({
            applicationConfig: this.config,
            options: this.config.webSocket,
            redisInstance,
            databaseInstance,
            queueManager,
            routes: this.config.webSocket.routes,
          });

          // Load WebSocket client
          await webSocketClient.load();

          // Connect to WebSocket server
          await webSocketClient.connectToServer();

          break;
        }
        default: {
          if (!this.config.webSocket.type) {
            throw new Error('WebSocket type is required');
          } else {
            throw new Error(`WebSocket type is not supported (Type: ${this.config.webSocket.type})`);
          }
        }
      }

      this.webSocketServer = webSocketServer;
      this.webSocketClient = webSocketClient;
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

    if (this.webSocketServer) {
      // Stop WebSocket server
      await this.webSocketServer.stop();
    }
  }

  /**
   * Application started event
   */
  protected async onStarted({ startupTime }: { startupTime: number }): Promise<void> {
    if (this.config.log?.startUp) {
      Logger.info('Application started', {
        Name: this.config.name,
        'Instance ID': this.config.instanceId,
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
        'Instance ID': this.config.instanceId,
        'Runtime': Time.formatTime({ time: runtime, format: 's', numDecimals: 2, showUnit: true }),
      });
    }

    if (this.config.events?.onStopped) {
      this.config.events.onStopped({ app: this, runtime });
    }
  }
}
