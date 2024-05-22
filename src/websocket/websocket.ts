import cluster from 'cluster';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Helper, Loader } from '../util/index.js';
import { DatabaseInstance } from '../database/index.js';
import { QueueManager } from '../queue/index.js';
import { RedisInstance } from '../redis/index.js';
import { WebSocketConnectedClientData, WebSocketConstructorParams, WebSocketOptions, WebSocketRoute } from './websocket.interface.js';
import { Logger } from '../logger/index.js';
import { WebSocketBaseControllerType } from './controller/base.interface.js';

/** Redis subscriber event */
enum redisSubscriberEvent {
  ClientConnected = 'clientConnected',
  ClientDisconnected = 'clientDisconnected',
  ClientJoined = 'clientJoined',
  SendMessageToAll = 'sendMessageToAll',
  MessageError = 'messageError',
}

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

  /** Connected clients */
  private connectedClients: Map<string, WebSocketConnectedClientData> = new Map();

  /** Redis subscriber events */
  private redisSubscriberEvents: string[] = [
    redisSubscriberEvent.ClientConnected,
    redisSubscriberEvent.ClientDisconnected,
    redisSubscriberEvent.ClientJoined,
    redisSubscriberEvent.SendMessageToAll,
    redisSubscriberEvent.MessageError,
  ];

  /** Worker ID */
  private workerId: number = cluster.isWorker && cluster.worker ? cluster.worker.id : 0;

  constructor(params: WebSocketConstructorParams) {
    // Define default options
    const defaultOptions: Partial<WebSocketOptions> = {
      host: '0.0.0.0',
      port: 3002,
    };

    // Merge default options
    const mergedOptions = Helper.defaultsDeep(params.options, defaultOptions);

    this.options = mergedOptions;

    this.redisInstance = params.redisInstance;
    this.queueManager = params.queueManager;
    this.databaseInstance = params.databaseInstance;

    this.routes = params.routes;

    // this.checkConnectedClientsInterval = setInterval(
    //   () => this.checkInactiveClients(),
    //   this.checkConnectedClientsIntervalTime,
    // );

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
    // const controllers = await loadControllers({ dir: path.join(__dirname, '../controllers/websocket') });

    // for (const route of this.options.routes) {
    //   const ControllerClass: ControllerType = controllers[route.controller];

    //   // Initialize controller instance
    //   const controllerInstance = new ControllerClass(
    //     this,
    //     this.redisInstance,
    //     this.queueManager,
    //     this.databaseInstance,
    //   );

    //   // Get controller action handler
    //   const controllerHandler = controllerInstance[
    //     route.action as keyof typeof controllerInstance
    //   ] as WebSocketMessageHandler;

    //   // Get route key
    //   const routeKey = this.getRouteKey({ type: route.type, action: route.action });

    //   // Register route handler
    //   this.routeHandlers.set(routeKey, controllerHandler);
    // }

    // Load controllers
    const controllers = await Loader.loadModulesInDirectory({
      directory: this.options.controllersDirectory,
      extensions: ['.ts'],
    });

    console.log('controllers', controllers);

    // Go through each route
    for (const route of this.routes) {
      console.log('route', route);

      let ControllerClass: WebSocketBaseControllerType;

      if (route.controller) {
        ControllerClass = route.controller;
      } else if (route.controllerName) {
        ControllerClass = controllers[route.controllerName];
      } else {
        throw new Error('Controller config not found');
      }

      if (typeof ControllerClass !== 'function') {
        Logger.warn('Controller not found', {
          Controller: route.controllerName,
          Directory: this.options.controllersDirectory,
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
    }
  }

  /**
   * Generate client ID.
   */
  private generateClientId(): string {
    return uuidv4();
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
      'clientConnected',
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
      this.server = new WebSocketServer({
        host: this.options.host,
        port: this.options.port,
      }, () => {
        this.handleServerStart();

        resolve();
      });

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
        this.handleServerMessage({ ws, message })
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
      'clientDisconnected',
      JSON.stringify({ clientId, workerId: this.workerId, runSameWorker: true }),
    );

    Logger.debug('Client disconnected', {
      ID: clientId,
    });
  };

  /**
   * Handle WebSocket server message.
   */
  private handleServerMessage = async ({ ws, message }: { ws: WebSocket; message: RawData }): Promise<void> => {
    Logger.debug('Incoming WebSocket server message', {
      Message: message.toString(),
    });
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
      case redisSubscriberEvent.ClientConnected: {
        this.setConnectedClient({
          clientId: parsedMessage.clientId,
          ws: null,
          lastActivity: parsedMessage.lastActivity,
        });

        break;
      }
      case redisSubscriberEvent.ClientDisconnected: {
        this.setDisconnectedClient({ clientId: parsedMessage.clientId });

        break;
      }
      case redisSubscriberEvent.ClientJoined: {
        break;
      }
      case redisSubscriberEvent.SendMessageToAll: {
        break;
      }
      case redisSubscriberEvent.MessageError: {
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
}
