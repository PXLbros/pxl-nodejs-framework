import cluster from 'cluster';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Helper, Loader, Time } from '../util/index.js';
import { DatabaseInstance } from '../database/index.js';
import { QueueManager } from '../queue/index.js';
import { RedisInstance } from '../redis/index.js';
import {
  WebSocketConnectedClientData,
  WebSocketConstructorParams,
  WebSocketMessageHandler,
  WebSocketOptions,
  WebSocketRedisSubscriberEvent,
  WebSocketRoute,
} from './websocket.interface.js';
import { Logger } from '../logger/index.js';
import { WebSocketBaseControllerType } from './controller/base.interface.js';
import { existsSync } from 'fs';

export default class {
  /** WebSocket options */
  private options: WebSocketOptions;

  /** Redis instance */
  private redisInstance: RedisInstance;

  /** Queue manager  */
  private queueManager: QueueManager;

  /** Database instance */
  private databaseInstance: DatabaseInstance;

  /** WebSocket server */
  private server?: WebSocketServer;

  /** WebSocket routes */
  private routes: WebSocketRoute[] = [];

  /** WebSocket route handlers */
  private routeHandlers: Map<string, WebSocketMessageHandler> = new Map();

  /** Connected clients */
  private connectedClients: Map<string, WebSocketConnectedClientData> = new Map();

  /** Redis subscriber events */
  private redisSubscriberEvents: string[] = [
    WebSocketRedisSubscriberEvent.ClientConnected,
    WebSocketRedisSubscriberEvent.ClientDisconnected,
    WebSocketRedisSubscriberEvent.ClientJoined,
    WebSocketRedisSubscriberEvent.SendMessageToAll,
    WebSocketRedisSubscriberEvent.MessageError,
  ];

  /** Worker ID */
  private workerId: number = cluster.isWorker && cluster.worker ? cluster.worker.id : 0;

  /** Check connected clients interval */
  private checkConnectedClientsInterval?: NodeJS.Timeout;

  constructor(params: WebSocketConstructorParams) {
    // Define default options
    const defaultOptions: Partial<WebSocketOptions> = {
      host: '0.0.0.0',
      port: 3002,
      disconnectInactiveClients: {
        enabled: true,
        intervalCheckTime: 1000 * 60 * 5,
        inactiveTime: 1000 * 60 * 10,
        log: false,
      },
    };

    // Merge default options
    const mergedOptions = Helper.defaultsDeep(params.options, defaultOptions);

    this.options = mergedOptions;

    this.redisInstance = params.redisInstance;
    this.queueManager = params.queueManager;
    this.databaseInstance = params.databaseInstance;

    this.routes = params.routes;

    if (this.options.disconnectInactiveClients?.enabled) {
      this.checkConnectedClientsInterval = setInterval(
        () => this.checkInactiveClients(),
        this.options.disconnectInactiveClients.intervalCheckTime,
      );
    }

    // Go through each event and subscribe to it
    this.redisSubscriberEvents.forEach((subscriberEventName) => {
      // Subscribe to event
      this.redisInstance.subscriberClient?.subscribe(subscriberEventName);
    });

    // Handle subscriber message
    this.redisInstance.subscriberClient.on('message', this.handleSubscriberMessage);
  }

  /**
   * Load WebSocket.
   */
  public async load(): Promise<void> {
    await this.configureRoutes();
  }

  /**
   * Configure WebSocket routes.
   */
  private async configureRoutes(): Promise<void> {
    // Check if controllers directory exists
    const controllersDirectoryExists = await existsSync(this.options.controllersDirectory);

    if (!controllersDirectoryExists) {
      Logger.warn('WebSocket controllers directory not found', { Directory: this.options.controllersDirectory });

      return;
    }

    // Load controllers
    const controllers = await Loader.loadModulesInDirectory({
      directory: this.options.controllersDirectory,
      extensions: ['.ts'],
    });

    // Go through each route
    for (const route of this.routes) {
      let ControllerClass: WebSocketBaseControllerType;

      if (route.controller) {
        ControllerClass = route.controller;
      } else if (route.controllerName) {
        ControllerClass = controllers[route.controllerName];
      } else {
        throw new Error('WebSocket controller config not found');
      }

      if (typeof ControllerClass !== 'function') {
        const webSocketPath = `${this.options.controllersDirectory}/${route.controllerName}.ts`;

        Logger.warn('WebSocket controller not found', {
          Controller: route.controllerName,
          Path: webSocketPath,
        });

        continue;
      }

      // Initialize controller instance
      const controllerInstance = new ControllerClass({
        webSocket: this,
        redisInstance: this.redisInstance,
        queueManager: this.queueManager,
        databaseInstance: this.databaseInstance,
      });

      // Get controller action handler
      const controllerHandler = controllerInstance[
        route.action as keyof typeof controllerInstance
      ] as WebSocketMessageHandler;

      // Get route key
      const routeKey = this.getRouteKey({ type: route.type, action: route.action });

      // Register route handler
      this.routeHandlers.set(routeKey, controllerHandler);
    }
  }

  /**
   * Get route key.
   */
  private getRouteKey({ type, action }: { type: string; action: string }): string {
    return `${type}:${action}`;
  }

  /**
   * Generate client ID.
   */
  private generateClientId(): string {
    return uuidv4();
  }

  /**
   * Get client ID.
   */
  private getClientId({ client }: { client: WebSocket }): string | undefined {
    return [...this.connectedClients.entries()].find(([_, value]) => value.ws === client)?.[0];
  }

  /**
   * Check inactive clients.
   */
  private checkInactiveClients(): void {
    // Get current time
    const now = Date.now();

    this.connectedClients.forEach((clientInfo, clientId) => {
      if (this.options.disconnectInactiveClients?.enabled && typeof this.options.disconnectInactiveClients.inactiveTime === 'number') {
        // Calculate how long until the client is inactive
        const timeUntilInactive = Math.max(0, this.options.disconnectInactiveClients.inactiveTime - (now - clientInfo.lastActivity));

        // Check if the client is inactive
        const isClientInactive = timeUntilInactive <= 0;

        if (this.options.disconnectInactiveClients.log) {
          Logger.debug('Checking client activity', {
            ID: clientId,
            'Time Until Inactive': Time.formatTime({ time: timeUntilInactive, format: 'auto' }),
          });
        }

        if (isClientInactive) {
          // Disconnect client if inactive
          this.disconnectClient({ clientId });
        }
      }
    });
  }

  /**
   * Disconnect client.
   */
  private disconnectClient({ clientId }: { clientId: string }) {
    const clientInfo = this.connectedClients.get(clientId);

    if (clientInfo?.ws) {
      // Check how long the client was connected for based on the last activity
      const connectedTime = Date.now() - clientInfo.lastActivity;

      // Close client WebSocket connection
      clientInfo.ws.close();

      Logger.info('WebSocket client was disconnected due to inactivity', {
        ID: clientId,
        Worker: this.workerId,
        'Time Connected': Time.formatTime({ time: connectedTime, format: 's' }),
      });
    }
  }

  /**
   * Print connected clients.
   */
  private printConnectedClients(): void {
    Logger.info('Connected clients', {
      Count: this.connectedClients.size,
    });
  }

  /**
   * Add connected client.
   */
  private addConnectedClient({ clientId, ws }: { clientId: string; ws: WebSocket }): void {
    const lastActivity = Date.now();

    this.setConnectedClient({ clientId, ws, lastActivity });

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientConnected,
      JSON.stringify({ clientId, lastActivity, workerId: this.workerId }),
    );
  }

  /**
   * Set connected client.
   */
  private setConnectedClient({
    clientId,
    ws,
    lastActivity,
  }: {
    clientId: string;
    ws: WebSocket | null;
    lastActivity: number;
  }) {
    this.connectedClients.set(clientId, { ws, lastActivity: lastActivity });

    Logger.info('WebSocket client connected', { ID: clientId });

    this.printConnectedClients();
  }

  /**
   * Set disconnected client.
   */
  private setDisconnectedClient({ clientId }: { clientId: string }) {
    this.connectedClients.delete(clientId);

    this.printConnectedClients();
  }

  /**
   * Start WebSocket server.
   */
  public async startServer(): Promise<void> {
    return new Promise((resolve) => {
      this.server = new WebSocketServer(
        {
          host: this.options.host,
          port: this.options.port,
        },
        () => {
          this.handleServerStart();

          resolve();
        },
      );

      this.server.on('error', this.handleServerError);
      this.server.on('connection', this.handleServerClientConnection);
    });
  }

  /**
   * Handle WebSocket server start.
   */
  private handleServerStart = (): void => {
    Logger.debug('WebSocket server started', {
      Host: this.options.host,
      Port: this.options.port,
    });
  };

  /**
   * Handle WebSocket server error.
   */
  private handleServerError = (error: Error): void => {
    Logger.error(error);
  };

  /**
   * Handle WebSocket client connection.
   */
  private handleServerClientConnection = (ws: WebSocket): void => {
    const clientId = this.generateClientId();

    this.addConnectedClient({ clientId, ws });

    ws.on('message', (message) => {
      try {
        this.handleServerMessage({ ws, message });
      } catch (error) {
        console.log('HANDLE MESSAGE ERROR');
      }
    });

    ws.on('close', () => this.handleServerClientDisconnection(clientId));

    Logger.debug('Client connected', {
      ID: clientId,
    });
  };

  /**
   * Handle WebSocket server client disconnection.
   */
  private handleServerClientDisconnection = (clientId: string): void => {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientDisconnected,
      JSON.stringify({ clientId, workerId: this.workerId, runSameWorker: true }),
    );

    Logger.debug('Client disconnected', {
      ID: clientId,
    });
  };

  /**
   * Parse WebSocket server message.
   */
  private parseServerMessage({ message }: { message: RawData }): {
    parsedMessage: Record<string, unknown>;
    messageHandler: WebSocketMessageHandler;
  } {
    let parsedMessage;

    try {
      // Convert message to JSON
      parsedMessage = JSON.parse(message.toString());
    } catch (error) {
      throw new Error('Failed to parse JSON');
    }

    if (!parsedMessage) {
      throw new Error('Invalid WebSocket message');
    } else if (!parsedMessage.type) {
      throw new Error('Missing WebSocket message type');
    } else if (!parsedMessage.action) {
      throw new Error('Missing WebSocket message action');
    }

    // Get route key
    const routeKey = this.getRouteKey({ type: parsedMessage.type, action: parsedMessage.action });

    console.log('routeKey', routeKey);

    // Get message handler
    const messageHandler = this.routeHandlers.get(routeKey);

    if (!messageHandler) {
      throw new Error('Route handler not found');
    }

    return { parsedMessage, messageHandler };
  }

  /**
   * Handle WebSocket server message.
   */
  private handleServerMessage = async ({ ws, message }: { ws: WebSocket; message: RawData }): Promise<void> => {
    const clientId = this.getClientId({ client: ws });

    if (!clientId) {
      Logger.warn('Client ID not found when handling WebSocket server message');

      return;
    }

    try {
      // Parse message
      const { parsedMessage, messageHandler } = this.parseServerMessage({ message });

      // Handle message (i.e. calling the controller method)
      const messageResponse = await messageHandler(ws, clientId, parsedMessage.data);

      console.log('messageResponse', messageResponse);

      Logger.debug('Incoming WebSocket server message', {
        Message: message.toString(),
      });
    } catch (error) {
      Logger.error(error);
    }
  };

  /**
   * Handle subscriber message.
   */
  private handleSubscriberMessage = (channel: string, message: string): void => {
    const parsedMessage = JSON.parse(message);

    const runSameWorker = parsedMessage.runSameWorker === true;

    // Check if message is from the same worker
    if (runSameWorker !== true && parsedMessage.workerId === this.workerId) {
      // Ignore the message if it's from the same worker
      return;
    }

    switch (channel) {
      case WebSocketRedisSubscriberEvent.ClientConnected: {
        this.setConnectedClient({
          clientId: parsedMessage.clientId,
          ws: null,
          lastActivity: parsedMessage.lastActivity,
        });

        break;
      }
      case WebSocketRedisSubscriberEvent.ClientDisconnected: {
        this.setDisconnectedClient({ clientId: parsedMessage.clientId });

        break;
      }
      case WebSocketRedisSubscriberEvent.ClientJoined: {
        break;
      }
      case WebSocketRedisSubscriberEvent.SendMessageToAll: {
        break;
      }
      case WebSocketRedisSubscriberEvent.MessageError: {
        break;
      }
      case WebSocketRedisSubscriberEvent.QueueJobCompleted: {
        console.log('QUEUE JOB COMPLETED!');

        break;
      }
      case WebSocketRedisSubscriberEvent.QueueJobError: {
        break;
      }
      default: {
        Logger.warn('Unknown subscriber message received', {
          Channel: channel,
          Message: message,
        });
      }
    }
  };

  /**
   * Set client as joined.
   */
  public setClientJoined({ ws, userName }: { ws: WebSocket; userName: string }): void {
    const clientId = this.getClientId({ client: ws });

    if (!clientId) {
      Logger.warn('Client ID not found when setting client joined');

      return;
    }

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientJoined,
      JSON.stringify({ clientId, allowSameWorker: true, userName, workerId: this.workerId }),
    );
  }

  /**
   * Send client message.
   */
  public sendClientMessage = (ws: WebSocket, data: unknown, binary: boolean = false): void => {
    const webSocketMessage = JSON.stringify(data);

    ws.send(webSocketMessage, { binary });
  };
}
