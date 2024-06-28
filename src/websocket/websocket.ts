import Table from 'cli-table3';
import cluster from 'cluster';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { Helper, Loader, Str, Time } from '../util/index.js';
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
  /** WebSocket logger */
  private logger: typeof Logger = Logger;

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
    WebSocketRedisSubscriberEvent.SendMessage,
    WebSocketRedisSubscriberEvent.SendMessageToAll,
    WebSocketRedisSubscriberEvent.MessageError,
    WebSocketRedisSubscriberEvent.QueueJobCompleted,
    WebSocketRedisSubscriberEvent.QueueJobError,
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
      debug: {
        printRoutes: false,
        printConnectedClients: undefined,
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
      this.log('Controllers directory not found', { Directory: this.options.controllersDirectory });

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

        this.log('Controller not found', {
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

    if (this.options.debug?.printRoutes) {
      this.log('Routes:');
      this.log(this.printRoutes());
    }
  }

  /**
   * Print WebSocket routes.
   */
  private printRoutes(): string {
    let routesString = '';
    const routeKeys = Array.from(this.routeHandlers.keys());

    routeKeys.forEach((routeKey, index) => {
      const [type, action] = routeKey.split(':');

      routesString += `Type: ${type} -> Action: ${action}`;

      if (index !== routeKeys.length - 1) {
        routesString += '\n';
      }
    });

    return routesString;
  }

  /**
   * Get WebSocket route key.
   */
  private getRouteKey({ type, action }: { type: string; action: string }): string {
    return `${type}:${action}`;
  }

  /**
   * Generate WebSocket client ID.
   */
  private generateClientId(): string {
    return Str.generateUniqueId();
  }

  /**
   * Get WebSocket client ID.
   */
  private getClientId({ client }: { client: WebSocket }): string | undefined {
    return [...this.connectedClients.entries()].find(([_, value]) => value.ws === client)?.[0];
  }

  /**
   * Check inactive WebSocket clients.
   */
  private checkInactiveClients(): void {
    // Get current time
    const now = Date.now();

    if (this.options.disconnectInactiveClients?.enabled && this.options.disconnectInactiveClients.log) {
      this.log('Checking inactive clients...');
    }

    let numInactiveClients = 0;

    this.connectedClients.forEach((clientInfo, clientId) => {
      if (this.options.disconnectInactiveClients?.enabled && typeof this.options.disconnectInactiveClients.inactiveTime === 'number') {
        // Calculate how long until the client is inactive
        const timeUntilInactive = Math.max(0, this.options.disconnectInactiveClients.inactiveTime - (now - clientInfo.lastActivity));

        // Check if the client is inactive
        const isClientInactive = timeUntilInactive <= 0;

        if (this.options.disconnectInactiveClients.log) {
          this.log('Checking client activity', {
            ID: clientId,
            'Time Until Inactive': Time.formatTime({ time: timeUntilInactive, format: 'auto' }),
          });
        }

        if (isClientInactive) {
          // Disconnect client if inactive
          this.disconnectClient({ clientId });

          numInactiveClients++;
        }
      }
    });

    if (this.options.disconnectInactiveClients?.enabled && this.options.disconnectInactiveClients.log) {
      if (numInactiveClients > 0) {
        this.log('Inactive clients disconnected', {
          Count: numInactiveClients,
        });
      } else {
        this.log('No inactive clients');
      }
    }
  }

  /**
   * Disconnect WebSocket client.
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

  private printConnectedClients = () => {
    if (this.options.debug?.printConnectedClients === 'simple') {
      this.printConnectedClientsSimpleLog();
    } else if (this.options.debug?.printConnectedClients === 'table') {
      this.printConnectedClientsTable();
    }
  }

  private printConnectedClientsTable(): void {
    const table = new Table({
      head: ['Client ID', 'Username', 'Last Activity', 'Connected Time'],
      colWidths: [36, 20, 25, 20]
    });

    if (this.connectedClients.size === 0) {
      table.push([{ colSpan: 4, content: 'No connected clients.' }]);
    } else {
      const now = Date.now();

      this.connectedClients.forEach((clientInfo, clientId) => {
        const username = clientInfo.username || 'N/A';
        // TODO: userType
        const lastActivity = new Date(clientInfo.lastActivity).toISOString();
        const connectedTime = Time.formatTime({ time: now - clientInfo.lastActivity, format: 'auto' });

        table.push([clientId, username, lastActivity, connectedTime]);
      });
    }

    this.log(`\n${table.toString()}`);
  }

  /**
   * Print connected WebSocket clients.
   */
  private printConnectedClientsSimpleLog(): void {
    Logger.info('Connected clients', {
      Count: this.connectedClients.size,
    });
  }

  /**
   * Add connected WebSocket client.
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
   * Set connected WebSocket client.
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
   * Set disconnected WebSocket client.
   */
  private setDisconnectedClient({ clientId }: { clientId: string }) {
    this.connectedClients.delete(clientId);
  }

  /**
   * Get connected WebSocket client.
   */
  public getConnectedClient({ clientId }: { clientId: string }): WebSocketConnectedClientData | undefined {
    return this.connectedClients.get(clientId);
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
   * Connect to WebSocket server.
   */
  public async connectToServer(): Promise<void> {
    const host = this.options.host;
    const port = this.options.port;

    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://${host}:${port}`);

      ws.on('open', () => {
        if (this.options.events?.onConnected) {
          this.options.events.onConnected({ ws, clientId: '123' });
        }

        // this.handleServerStart();

        resolve();
      });

      ws.on('message', (message) => {
        // this.handleServerMessage({ ws, message });
      });

      ws.on('close', () => {
        this.log('Connection closed');
      });
    });
  }


  /**
   * Handle WebSocket server start.
   */
  private handleServerStart = (): void => {
    if (!this.server) {
      throw new Error('WebSocket server not started');
    }

    this.log('Server started', {
      Host: this.options.host,
      Port: this.options.port,
    });

    if (this.options.events?.onServerStarted) {
      this.options.events.onServerStarted({ webSocketServer: this.server });
    }
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

    this.log('Client connected', {
      ID: clientId,
    });

    this.printConnectedClients();
  };

  /**
   * Handle WebSocket server client disconnection.
   */
  private handleServerClientDisconnection = (clientId: string): void => {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientDisconnected,
      JSON.stringify({ clientId, workerId: this.workerId, runSameWorker: true }),
    );

    this.log('Client disconnected', {
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

    // Get message handler
    const messageHandler = this.routeHandlers.get(routeKey);

    if (!messageHandler) {
      throw new Error(`Route handler not found (Route: ${routeKey})`);
    }

    return { parsedMessage, messageHandler };
  }

  /**
   * Handle WebSocket server message.
   */
  private handleServerMessage = async ({ ws, message }: { ws: WebSocket; message: RawData }): Promise<void> => {
    const clientId = this.getClientId({ client: ws });

    if (!clientId) {
      this.log('Client ID not found when handling server message');

      return;
    }

    const sendMessageErrorToClient = (error: string) => {
      this.redisInstance.publisherClient.publish(
        WebSocketRedisSubscriberEvent.MessageError,
        JSON.stringify({
          runSameWorker: true,
          clientId,
          error,
        }),
      );
    };

    try {
      // Parse message
      const { parsedMessage, messageHandler } = this.parseServerMessage({ message });

      const action = parsedMessage.action;
      const type = parsedMessage.type;

      this.log('Incoming message', {
        'Client ID': clientId,
        Action: action ?? '-',
        Type: type ?? '-',
      });

      // Handle message (i.e. calling the controller method)
      const messageResponse = await messageHandler(ws, clientId, parsedMessage.data);

      if (messageResponse?.error) {
        // Send error message to client
        throw new Error(messageResponse.error);
      }
    } catch (error) {
      // Send error message to client
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.log(errorMessage);

      sendMessageErrorToClient(errorMessage);
    }
  };

  /**
   * Send WebSocket message error.
   */
  private sendMessageError({
    webSocketClientId,
    error,
  }: {
    webSocketClientId: string;
    error: string;
  }): void {
    const clientInfo = this.connectedClients.get(webSocketClientId);

    if (!clientInfo) {
      this.log('Client not found when trying to send message error to client', {
        'Client ID': webSocketClientId,
      });

      return;
    } else if (!clientInfo.ws) {
      return; // This is expected in many cases to return here (as only one worker will have the client connected)
    } else if (clientInfo.ws.readyState !== WebSocket.OPEN) {
      this.log('Client connection not open when trying to send message error to client', {
        'Client ID': webSocketClientId,
        State: clientInfo.ws.readyState,
      });

      return;
    }

    // Send WebSocket client message
    this.sendClientMessage(clientInfo.ws, {
      type: WebSocketRedisSubscriberEvent.MessageError,
      error,
    });
  }

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

        this.log('Client disconnected', {
          ID: parsedMessage.clientId,
        });

        this.printConnectedClients();

        break;
      }
      case WebSocketRedisSubscriberEvent.ClientJoined: {
        this.setClientUserName({
          webSocketClientId: parsedMessage.clientId,
          username: parsedMessage.username
        });

        this.log('Client joined', {
          ID: parsedMessage.clientId,
          Username: parsedMessage.username,
        });

        this.printConnectedClients();

        break;
      }
      case WebSocketRedisSubscriberEvent.SendMessage: {
        break;
      }
      case WebSocketRedisSubscriberEvent.SendMessageToAll: {
        this.broadcastToAllClients(parsedMessage);

        break;
      }
      case WebSocketRedisSubscriberEvent.MessageError: {
        this.sendMessageError({
          webSocketClientId: parsedMessage.clientId,
          error: parsedMessage.error,
        });

        break;
      }
      case WebSocketRedisSubscriberEvent.QueueJobCompleted: {
        const parsedMessage = JSON.parse(message);

        this.sendJobDoneMessage({ type: 'jobCompleted', ...parsedMessage });

        break;
      }
      case WebSocketRedisSubscriberEvent.QueueJobError: {
        const parsedMessage = JSON.parse(message);

        // action and data is separate

        // TODO: Instead allow to pass anything
        parsedMessage.data = parsedMessage.error;

        this.sendJobDoneMessage({ type: 'jobError', ...parsedMessage });

        break;
      }
      default: {
        this.log('Unknown subscriber message received', {
          Channel: channel,
          Message: message,
        });
      }
    }
  };

  /**
   * Set WebSocket client as joined.
   */
  public setClientJoined({ ws, username }: { ws: WebSocket; username: string }): void {
    const clientId = this.getClientId({ client: ws });

    if (!clientId) {
      this.log('Client ID not found when setting client joined');

      return;
    }

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientJoined,
      JSON.stringify({ clientId, runSameWorker: true, username, workerId: this.workerId }),
    );

    // Send welcome message to user
    this.sendClientMessage(ws, {
      type: 'user',
      action: 'welcome',
    });
  }

  /**
   * Send WebSocket client message.
   */
  public sendClientMessage = (ws: WebSocket, data: unknown, binary: boolean = false): void => {
    const webSocketMessage = JSON.stringify(data);

    ws.send(webSocketMessage, { binary });
  };

  /**
   * Send WebSocket message.
   */
  public sendMessage = (data: unknown): void => {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.SendMessage,
      JSON.stringify(data),
    );
  }

  /**
   * Send WebSocket message to all clients.
   */
  public sendMessageToAll = (data: unknown): void => {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.SendMessageToAll,
      JSON.stringify(data),
    );
  }

  /**
   * Set WebSocket client username.
   */
  private setClientUserName({ webSocketClientId, username }: { webSocketClientId: string; username: string }) {
    const clientData = this.connectedClients.get(webSocketClientId);

    if (!clientData) {
      this.log('Client not found when trying to update connected client with username', {
        'Client ID': webSocketClientId,
      });

      return;
    }

    // Update client data with username
    this.connectedClients.set(webSocketClientId, { ...clientData, username });

    this.log('Client username set', {
      'Client ID': webSocketClientId,
      'User Name': username,
    });
  }

  /**
   * Broadcast to all WebSocket clients.
   */
  public broadcastToAllClients({ data, excludeClientId }: { data: unknown; excludeClientId?: string }): void {
    if (!this.server) {
      this.log('Server not started when broadcasting to all clients');

      return;
    }

    // Go through each client
    this.server.clients.forEach((client) => {
      let excludeClient = false;

      if (excludeClientId) {
        const clientId = this.getClientId({ client });

        excludeClient = clientId === excludeClientId;
      }

      if (client.readyState === WebSocket.OPEN) {
        if (!excludeClient) {
          client.send(JSON.stringify(data));
        }
      }
    });
  }

  private sendJobDoneMessage({
    type,
    webSocketClientId,
    action,
    data,
  }: {
    type: string;
    webSocketClientId: string;
    action: string;
    data: any;
  }): void {
    const clientInfo = this.connectedClients.get(webSocketClientId);

    if (!clientInfo) {
      this.log('Client not found when trying to send job completed message to client', {
        'Client ID': webSocketClientId,
      });

      return;
    } else if (!clientInfo.ws) {
      return; // This is expected in many cases to return here (because only one worker will have the client connected)
    } else if (clientInfo.ws.readyState !== WebSocket.OPEN) {
      this.log('Client not open when trying to send job completed message to client', {
        'Client ID': webSocketClientId,
        State: clientInfo.ws.readyState,
      });

      return;
    }

    // Send WebSocket client message
    this.sendClientMessage(clientInfo.ws, {
      type,
      action,
      data,
    });
  }

  /**
   * Log WebSocket message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom('webSocket', message, meta);
  }
}
