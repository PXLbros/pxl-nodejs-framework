import WebSocket from 'ws';
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
import QueueManager from '../queue/manager.js';
import DatabaseInstance from '../database/instance.js';
import { WebSocketClientProps } from './websocket-client.interface.js';

export default class WebSocketClient {
  private options: WebSocketOptions;
  private redisInstance: RedisInstance;
  private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance;
  private routes: WebSocketRoute[] = [];
  private routeHandlers: Map<string, WebSocketMessageHandler> = new Map();
  private ws?: WebSocket;
  private clientId?: string;

  constructor(props: WebSocketClientProps) {
    this.options = props.options;
    this.redisInstance = props.redisInstance;
    this.queueManager = props.queueManager;
    this.databaseInstance = props.databaseInstance;
    this.routes = props.routes;
  }

  public async load(): Promise<void> {
    await this.configureRoutes();
  }

  public async connectToServer(): Promise<void> {
    const host = this.options.host;
    const port = this.options.port;

    return new Promise((resolve) => {
      this.ws = new WebSocket(`ws://${host}:${port}`);

      this.ws.on('open', () => {
        this.clientId = this.generateClientId();
        this.log('Connected to server', { ID: this.clientId });

        if (this.options.events?.onConnected) {
          this.options.events.onConnected({ ws: this.ws, clientId: this.clientId });
        }

        resolve();
      });

      this.ws.on('message', this.handleServerMessage);

      this.ws.on('close', () => {
        this.log('Connection closed');
      });

      this.ws.on('error', (error) => {
        this.log('WebSocket error', { error: error.message });
      });
    });
  }

  private async configureRoutes(): Promise<void> {
    for (const route of this.routes) {
      if (!route.controller) {
        throw new Error('WebSocket controller not found');
      }

      const controllerInstance = new route.controller({
        webSocketClient: this,
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

  private handleServerMessage = async (message: WebSocket.Data): Promise<void> => {
    if (!this.ws || !this.clientId) {
      this.log('WebSocket not initialized or client ID not set');
      return;
    }

    try {
      const { parsedMessage, messageHandler } = this.parseServerMessage(message);

      const action = parsedMessage.action;
      const type = parsedMessage.type;

      this.log('Incoming message', {
        Action: action ?? '-',
        Type: type ?? '-',
      });

      const messageResponse = await messageHandler(this.ws, this.clientId, parsedMessage.data);

      if (messageResponse?.error) {
        throw new Error(messageResponse.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(errorMessage);
    }
  };

  private parseServerMessage(message: WebSocket.Data): {
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

  public sendClientMessage = (data: unknown, binary: boolean = false): void => {
    if (!this.ws) {
      this.log('WebSocket not initialized');
      return;
    }

    const webSocketMessage = JSON.stringify(data);
    this.ws.send(webSocketMessage, { binary });
  };

  public sendMessage = (data: unknown): void => {
    this.sendClientMessage(data);
  };

  public setClientJoined(username: string): void {
    if (!this.ws || !this.clientId) {
      this.log('WebSocket not initialized or client ID not set');
      return;
    }

    this.sendClientMessage({
      type: WebSocketRedisSubscriberEvent.ClientJoined,
      action: 'join',
      data: { username },
    });
  }

  private generateClientId(): string {
    return Str.generateUniqueId();
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

  private log(message: string, meta?: Record<string, unknown>): void {
    Logger.custom('webSocket', message, meta);
  }
}
