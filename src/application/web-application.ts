import type RedisInstance from '../redis/instance.js';
import type DatabaseInstance from '../database/instance.js';
import WebServer from '../webserver/webserver.js';
import type QueueManager from '../queue/manager.js';
import BaseApplication from './base-application.js';
import type { WebApplicationConfig } from './web-application.interface.js';
import { Helper, Time } from '../util/index.js';
import { Logger } from '../logger/index.js';
import WebSocketServer from '../websocket/websocket-server.js';
import WebSocketClient from '../websocket/websocket-client.js';
import type EventManager from '../event/manager.js';
import { WebServerPerformanceWrapper, WebSocketPerformanceWrapper } from '../performance/index.js';

/**
 * Application
 */
export default class WebApplication extends BaseApplication {
  /** Web application config */
  protected config: WebApplicationConfig;

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

  protected async startHandler({
    redisInstance,
    databaseInstance,
    queueManager,
    eventManager,
  }: {
    redisInstance: RedisInstance;
    databaseInstance: DatabaseInstance;
    queueManager: QueueManager;
    eventManager: EventManager;
  }): Promise<void> {
    if (this.config.webServer?.enabled) {
      const staticRoutes = this.config.webServer.routes;

      // Initialize web server
      this.webServer = new WebServer({
        applicationConfig: this.config,
        options: {
          host: this.config.webServer.host,
          port: this.config.webServer.port,
          controllersDirectory: this.config.webServer.controllersDirectory,
          routesDirectory: this.config.webServer.routesDirectory,
          cors: this.config.webServer.cors,
          security: this.config.webServer.security,
          log: this.config.webServer.log,
          debug: this.config.webServer.debug,
        },

        ...(Array.isArray(staticRoutes) ? { routes: staticRoutes } : {}),

        redisInstance,
        databaseInstance,
        queueManager,
        eventManager,
        lifecycleManager: this.lifecycle,
      });

      // Set up performance monitoring for web server
      if (this.performanceMonitor && this.config.performanceMonitoring?.monitorHttpRequests !== false) {
        WebServerPerformanceWrapper.setPerformanceMonitor(this.performanceMonitor);
      }

      // Load web server
      await this.webServer.load();

      // Start web server
      await this.webServer.start();

      // Register readiness check for web server
      this.lifecycle.addReadinessCheck('webserver', async () => {
        try {
          return this.webServer?.isReady() ?? false;
        } catch {
          return false;
        }
      });
    }

    if (this.config.webSocket?.enabled) {
      if (!this.webServer) {
        throw new Error('WebSocket requires web server to be enabled');
      }

      let webSocketServer: WebSocketServer | undefined;
      let webSocketClient: WebSocketClient | undefined;

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
            workerId: this.workerId,
          });

          // Set up performance monitoring for WebSocket
          if (this.performanceMonitor && this.config.performanceMonitoring?.monitorWebSocketOperations !== false) {
            WebSocketPerformanceWrapper.setPerformanceMonitor(this.performanceMonitor);
          }

          // Load WebSocket client
          await webSocketServer.load();

          // Start WebSocket server
          await webSocketServer.start({
            fastifyServer: this.webServer.fastifyServer,
          });

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
      Logger.info({
        message: 'Application started',
        meta: {
          'Startup Time': Time.formatTime({
            time: startupTime,
            format: 's',
            numDecimals: 2,
            showUnit: true,
          }),
        },
      });
    }

    if (this.config.events?.onStarted) {
      this.config.events.onStarted({
        app: this,
        startupTime,
      });
    }
  }

  protected async onStopped({ runtime }: { runtime: number }): Promise<void> {
    if (this.config.log?.shutdown) {
      Logger.info({
        message: 'Application stopped',
        meta: {
          Name: this.config.name,
          'Instance ID': this.config.instanceId,
          Runtime: Time.formatTime({
            time: runtime,
            format: 's',
            numDecimals: 2,
            showUnit: true,
          }),
        },
      });
    }

    if (this.config.events?.onStopped) {
      this.config.events.onStopped({ app: this, runtime });
    }
  }
}
