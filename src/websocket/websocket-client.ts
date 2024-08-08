import WebSocket, { RawData } from 'ws';
import { WebSocketOptions, WebSocketRoute, WebSocketMessageHandler, WebSocketRedisSubscriberEvent, WebSocketType } from './websocket.interface.js';
import RedisInstance from '../redis/instance.js';
import QueueManager from '../queue/manager.js';
import DatabaseInstance from '../database/instance.js';
import { WebSocketClientProps } from './websocket-client.interface.js';
import { generateClientId, log, parseServerMessage, getRouteKey } from './utils.js';
import WebSocketBase from './websocket-base.js';
import { ApplicationConfig } from '../application/base-application.interface.js';
import path from 'path';
import { baseDir } from '../index.js';

export default class WebSocketClient extends WebSocketBase {
  protected defaultRoutes: WebSocketRoute[] = [
    {
      type: 'system',
      action: 'clientList',
      controllerName: 'system',
    },
  ];

  private applicationConfig: ApplicationConfig;
  private options: WebSocketOptions;
  private redisInstance: RedisInstance;
  private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance;
  private ws?: WebSocket;
  private clientId?: string;

  constructor(props: WebSocketClientProps) {
    super();

    this.applicationConfig = props.applicationConfig;
    this.options = props.options;
    this.redisInstance = props.redisInstance;
    this.queueManager = props.queueManager;
    this.databaseInstance = props.databaseInstance;
    this.routes = props.routes;
  }

  public get type(): WebSocketType {
    return 'client';
  }

  public async load(): Promise<void> {
    const libraryControllersDirectory = path.join(baseDir, 'websocket', 'controllers', 'client');

    await this.configureRoutes(this.defaultRoutes, libraryControllersDirectory);

    await this.configureRoutes(this.routes, this.options.controllersDirectory);
  }

  public async connectToServer(): Promise<void> {
    const host = this.options.host;
    const port = this.options.port;

    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://${host}:${port}`);

      ws.on('open', () => {
        this.clientId = generateClientId();

        log('Connected to server', { ID: this.clientId });

        if (this.options.events?.onConnected) {
          this.options.events.onConnected({
            ws,
            clientId: this.clientId,
            joinRoom: ({
              userId,
              userType,
              username,
              roomName,
            }: {
              userId?: string;
              userType?: string;
              username: string;
              roomName: string;
            }) => {
              this.sendClientMessage({
                type: 'system',
                action: 'joinRoom',
                data: {
                  userId,
                  userType,
                  username,
                  roomName,
                },
              });
            },
          });
        }

        resolve();
      });

      ws.on('message', this.handleIncomingMessage);

      ws.on('close', () => {
        log('Connection to server closed');

        if (this.options.events?.onDisconnected) {
          this.options.events.onDisconnected({ clientId: this.clientId });
        }
      });

      ws.on('error', (error) => {
        log('WebSocket error', { error: error.message });

        if (this.options.events?.onError) {
          this.options.events.onError({ error: error });
        }
      });

      this.ws = ws;
    });
  }

  protected getControllerDependencies(): {
    sendMessage: (data: unknown) => void;
    redisInstance: RedisInstance;
    queueManager: QueueManager;
    databaseInstance: DatabaseInstance;
  } {
    return {
      sendMessage: this.sendMessage,
      redisInstance: this.redisInstance,
      queueManager: this.queueManager,
      databaseInstance: this.databaseInstance,
    };
  }
  protected shouldPrintRoutes(): boolean {
    return this.options.debug?.printRoutes ?? false;
  }

  private handleIncomingMessage = async (message: RawData): Promise<void> => {
    if (!this.ws || !this.clientId) {
      log('WebSocket not initialized or client ID not set');

      return;
    }

    if (this.options.events?.onMessage) {
      const parsedMessage = parseServerMessage(message);

      this.options.events.onMessage({ ws: this.ws, clientId: this.clientId, data: parsedMessage });
    }

    await this.handleServerMessage(this.ws, message, this.clientId);
  };

  protected handleMessageError(clientId: string, error: string): void {
    log(error);
  }

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
}
