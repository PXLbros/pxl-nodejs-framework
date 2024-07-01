import { RawData, WebSocket, WebSocketServer as WS } from 'ws';
import { Logger } from '../logger/index.js';
import {
  WebSocketOptions,
  WebSocketRoute,
  WebSocketMessageHandler,
  WebSocketConnectedClientData,
  WebSocketRedisSubscriberEvent,
  WebSocketMessageResponse,
} from './websocket.interface.js';
import { Helper, Str, Time } from '../util/index.js';
import RedisInstance from '../redis/instance.js';
import { existsSync } from 'fs';
import { Loader } from '../util/index.js';
import { WebSocketBaseControllerType } from './controller/base.interface.js';
import { WebSocketServerProps } from './websocket-server.interface.js';
import DatabaseInstance from '../database/instance.js';
import QueueManager from '../queue/manager.js';

export default class WebSocketServer {
  private server?: WS;
  private routes: WebSocketRoute[] = [];
  private routeHandlers: Map<string, WebSocketMessageHandler> = new Map();
  private connectedClients: Map<string, WebSocketConnectedClientData> = new Map();
  private checkConnectedClientsInterval?: NodeJS.Timeout;
  private workerId: number;
  private options: WebSocketOptions;
  /** Redis instance */
  private redisInstance: RedisInstance;

  /** Queue manager  */
  private queueManager: QueueManager;

  /** Database instance */
  private databaseInstance: DatabaseInstance;

  constructor(props: WebSocketServerProps) {
    this.options = props.options;
    this.redisInstance = props.redisInstance;
    this.queueManager = props.queueManager;
    this.databaseInstance = props.databaseInstance;
    this.routes = props.routes;
    this.workerId = props.workerId;

    if (this.options.disconnectInactiveClients?.enabled) {
      this.checkConnectedClientsInterval = setInterval(
        () => this.checkInactiveClients(),
        this.options.disconnectInactiveClients.intervalCheckTime
      );
    }
  }

  public async startServer(): Promise<void> {
    return new Promise((resolve) => {
      this.server = new WS(
        {
          host: this.options.host,
          port: this.options.port,
        },
        () => {
          this.handleServerStart();
          resolve();
        }
      );

      this.server.on('error', this.handleServerError);
      this.server.on('connection', this.handleServerClientConnection);
    });
  }

  public async configureRoutes(): Promise<void> {
    const controllersDirectoryExists = await existsSync(this.options.controllersDirectory);

    if (!controllersDirectoryExists) {
      this.log('Controllers directory not found', { Directory: this.options.controllersDirectory });
      return;
    }

    const controllers = await Loader.loadModulesInDirectory({
      directory: this.options.controllersDirectory,
      extensions: ['.ts'],
    });

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

      const controllerInstance = new ControllerClass({
        webSocketServer: this,
        redisInstance: this.redisInstance,
        queueManager: this.queueManager,
        databaseInstance: this.databaseInstance,
      });

      const controllerHandler = controllerInstance[
        route.action as keyof typeof controllerInstance
      ] as WebSocketMessageHandler;

      const routeKey = this.getRouteKey({ type: route.type, action: route.action });
      this.routeHandlers.set(routeKey, controllerHandler);
    }

    if (this.options.debug?.printRoutes) {
      this.log('Routes:');
      console.log(this.printRoutes());
    }
  }

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

  private handleServerError = (error: Error): void => {
    Logger.error(error);
  };

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

    this.log('Client connected', { ID: clientId });
  };

  private generateClientId(): string {
    return Str.generateUniqueId();
  }

  private addConnectedClient({ clientId, ws }: { clientId: string; ws: WebSocket }): void {
    const lastActivity = Date.now();
    this.setConnectedClient({ clientId, ws, lastActivity });

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientConnected,
      JSON.stringify({ clientId, lastActivity, workerId: this.workerId })
    );
  }

  private setConnectedClient({
    clientId,
    ws,
    lastActivity,
  }: {
    clientId: string;
    ws: WebSocket | null;
    lastActivity: number;
  }): void {
    this.connectedClients.set(clientId, { ws, lastActivity: lastActivity });
    // Logger.info('WebSocket client connected', { ID: clientId });
    this.printConnectedClients();
  }

  private handleServerClientDisconnection = (clientId: string): void => {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientDisconnected,
      JSON.stringify({ clientId, workerId: this.workerId, runSameWorker: true })
    );

    this.log('Client disconnected', { ID: clientId });
  };

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
        })
      );
    };

    try {
      const { parsedMessage, messageHandler } = this.parseServerMessage({ message });

      const action = parsedMessage.action;
      const type = parsedMessage.type;

      this.log('Incoming message', {
        'Client ID': clientId,
        Action: action ?? '-',
        Type: type ?? '-',
      });

      const messageResponse = await messageHandler(ws, clientId, parsedMessage.data);

      if (messageResponse?.error) {
        throw new Error(messageResponse.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(errorMessage);
      sendMessageErrorToClient(errorMessage);
    }
  };

  private parseServerMessage({ message }: { message: RawData }): {
    parsedMessage: Record<string, unknown>;
    messageHandler: WebSocketMessageHandler;
  } {
    let parsedMessage;

    try {
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

    const routeKey = this.getRouteKey({ type: parsedMessage.type, action: parsedMessage.action });
    const messageHandler = this.routeHandlers.get(routeKey);

    if (!messageHandler) {
      throw new Error(`Route handler not found (Route: ${routeKey})`);
    }

    return { parsedMessage, messageHandler };
  }

  private checkInactiveClients(): void {
    const now = Date.now();

    if (this.options.disconnectInactiveClients?.enabled && this.options.disconnectInactiveClients.log) {
      this.log('Checking inactive clients...');
    }

    let numInactiveClients = 0;

    this.connectedClients.forEach((clientInfo, clientId) => {
      if (this.options.disconnectInactiveClients?.enabled && typeof this.options.disconnectInactiveClients.inactiveTime === 'number') {
        const timeUntilInactive = Math.max(0, this.options.disconnectInactiveClients.inactiveTime - (now - clientInfo.lastActivity));
        const isClientInactive = timeUntilInactive <= 0;

        if (this.options.disconnectInactiveClients.log) {
          this.log('Checking client activity', {
            ID: clientId,
            'Time Until Inactive': Time.formatTime({ time: timeUntilInactive, format: 'auto' }),
          });
        }

        if (isClientInactive) {
          this.disconnectClient({ clientId });
          numInactiveClients++;
        }
      }
    });

    if (this.options.disconnectInactiveClients?.enabled && this.options.disconnectInactiveClients.log) {
      if (numInactiveClients > 0) {
        this.log('Inactive clients disconnected', { Count: numInactiveClients });
      } else {
        this.log('No inactive clients');
      }
    }
  }

  private disconnectClient({ clientId }: { clientId: string }) {
    const clientInfo = this.connectedClients.get(clientId);

    if (clientInfo?.ws) {
      const connectedTime = Date.now() - clientInfo.lastActivity;
      clientInfo.ws.close();

      Logger.info('WebSocket client was disconnected due to inactivity', {
        ID: clientId,
        Worker: this.workerId,
        'Time Connected': Time.formatTime({ time: connectedTime, format: 's' }),
      });
    }
  }

  public broadcastToAllClients({ data, excludeClientId }: { data: unknown; excludeClientId?: string }): void {
    if (!this.server) {
      this.log('Server not started when broadcasting to all clients');
      return;
    }

    this.server.clients.forEach((client) => {
      let excludeClient = false;

      if (excludeClientId) {
        const clientId = this.getClientId({ client });
        excludeClient = clientId === excludeClientId;
      }

      if (client.readyState === WebSocket.OPEN && !excludeClient) {
        client.send(JSON.stringify(data));
      }
    });
  }

  private getClientId({ client }: { client: WebSocket }): string | undefined {
    return [...this.connectedClients.entries()].find(([_, value]) => value.ws === client)?.[0];
  }

  public setClientJoined({ ws, username }: { ws: WebSocket; username: string }): void {
    const clientId = this.getClientId({ client: ws });

    if (!clientId) {
      this.log('Client ID not found when setting client joined');
      return;
    }

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientJoined,
      JSON.stringify({ clientId, runSameWorker: true, username, workerId: this.workerId })
    );

    this.sendClientMessage(ws, {
      type: 'user',
      action: 'welcome',
    });
  }

  public sendClientMessage = (ws: WebSocket, data: unknown, binary: boolean = false): void => {
    const webSocketMessage = JSON.stringify(data);
    ws.send(webSocketMessage, { binary });
  };

  public sendMessage = (data: unknown): void => {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.SendMessage,
      JSON.stringify(data)
    );
  };

  public sendMessageToAll = (data: unknown): void => {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.SendMessageToAll,
      JSON.stringify(data)
    );
  };

  private setClientUserName({ webSocketClientId, username }: { webSocketClientId: string; username: string }) {
    const clientData = this.connectedClients.get(webSocketClientId);

    if (!clientData) {
      this.log('Client not found when trying to update connected client with username', {
        'Client ID': webSocketClientId,
      });
      return;
    }

    this.connectedClients.set(webSocketClientId, { ...clientData, username });

    this.log('Client username set', {
      'Client ID': webSocketClientId,
      'User Name': username,
    });
  }

  private getRouteKey({ type, action }: { type: string; action: string }): string {
    return `${type}:${action}`;
  }

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

  public printConnectedClients(): void {
    this.log('Connected clients', {
      Count: this.connectedClients.size,
    });
  }

  private log(message: string, meta?: Record<string, unknown>): void {
    Logger.custom('webSocket', message, meta);
  }
}
