// websocket-client.ts
import WebSocket from 'ws';
import { WebSocketOptions, WebSocketRoute, WebSocketMessageHandler, WebSocketRedisSubscriberEvent } from './websocket.interface.js';
import RedisInstance from '../redis/instance.js';
import QueueManager from '../queue/manager.js';
import DatabaseInstance from '../database/instance.js';
import { WebSocketClientProps } from './websocket-client.interface.js';
import { generateClientId, log, parseServerMessage, getRouteKey } from './utils.js';
import WebSocketBase from './websocket-base.js';

export default class WebSocketClient extends WebSocketBase {
  private options: WebSocketOptions;
  private redisInstance: RedisInstance;
  private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance;
  private ws?: WebSocket;
  private clientId?: string;

  constructor(props: WebSocketClientProps) {
    super();
    this.options = props.options;
    this.redisInstance = props.redisInstance;
    this.queueManager = props.queueManager;
    this.databaseInstance = props.databaseInstance;
    this.routes = props.routes;
  }

  public async load(): Promise<void> {
    await this.configureRoutes(this.options.controllersDirectory, {}); // Assuming controllers are loaded elsewhere
  }

  public async connectToServer(): Promise<void> {
    const host = this.options.host;
    const port = this.options.port;

    return new Promise((resolve) => {
      this.ws = new WebSocket(`ws://${host}:${port}`);

      this.ws.on('open', () => {
        this.clientId = generateClientId();
        log('Connected to server', { ID: this.clientId });

        if (this.options.events?.onConnected) {
          this.options.events.onConnected({ ws: this.ws, clientId: this.clientId });
        }

        resolve();
      });

      this.ws.on('message', this.handleServerMessage);

      this.ws.on('close', () => {
        log('Connection closed');
      });

      this.ws.on('error', (error) => {
        log('WebSocket error', { error: error.message });
      });
    });
  }

  protected getControllerDependencies(): Record<string, unknown> {
    return {
      webSocketClient: this,
      redisInstance: this.redisInstance,
      queueManager: this.queueManager,
      databaseInstance: this.databaseInstance,
    };
  }

  protected shouldPrintRoutes(): boolean {
    return this.options.debug?.printRoutes ?? false;
  }

  private handleServerMessage = async (message: WebSocket.Data): Promise<void> => {
    if (!this.ws || !this.clientId) {
      log('WebSocket not initialized or client ID not set');
      return;
    }

    try {
      const parsedMessage = parseServerMessage(message);
      const action = parsedMessage.action;
      const type = parsedMessage.type;
      log('Incoming message', { Action: action ?? '-', Type: type ?? '-' });
      const routeKey = getRouteKey(parsedMessage.type as string, parsedMessage.action as string);
      const messageHandler = this.routeHandlers.get(routeKey);
      if (!messageHandler) {
        throw new Error(`Route handler not found (Route: ${routeKey})`);
      }
      const messageResponse = await messageHandler(this.ws, this.clientId, parsedMessage.data);
      if (messageResponse?.error) {
        throw new Error(messageResponse.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(errorMessage);
    }
  };

  public sendClientMessage = (data: unknown, binary: boolean = false): void => {
    if (!this.ws) {
      log('WebSocket not initialized');
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
      log('WebSocket not initialized or client ID not set');
      return;
    }

    this.sendClientMessage({
      type: WebSocketRedisSubscriberEvent.ClientJoined,
      action: 'join',
      data: { username },
    });
  }
}
