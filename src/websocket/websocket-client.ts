import WebSocket, { type RawData } from 'ws';
import type { WebSocketOptions, WebSocketRoute, WebSocketType } from './websocket.interface.js';
import type RedisInstance from '../redis/instance.js';
import type QueueManager from '../queue/manager.js';
import type DatabaseInstance from '../database/instance.js';
import type { WebSocketClientProps } from './websocket-client.interface.js';
import { generateClientId, log, parseServerMessage } from './utils.js';
import WebSocketBase from './websocket-base.js';
import type { ApplicationConfig } from '../application/base-application.interface.js';
import path from 'path';
import { safeSerializeError } from '../error/error-reporter.js';
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
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000; // Start with 1 second
  private reconnectTimer?: NodeJS.Timeout;
  private shouldReconnect: boolean = true;

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
    const url = this.options.url;
    // const host = this.options.host;
    // const port = this.options.port;

    return new Promise(resolve => {
      const ws = new WebSocket(url);

      ws.on('open', () => {
        this.clientId = generateClientId();
        this.isConnected = true;

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

      ws.on('close', code => {
        this.isConnected = false;
        log('Connection to server closed', { Code: code });

        if (this.options.events?.onDisconnected) {
          this.options.events.onDisconnected({ clientId: this.clientId });
        }

        // Clean up event listeners to prevent memory leaks
        ws.removeAllListeners();
        this.ws = undefined;
        this.clientId = undefined;

        // Attempt to reconnect if not manually disconnected
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      ws.on('error', error => {
        log('WebSocket error', { error: error.message });

        if (this.options.events?.onError) {
          this.options.events.onError({ error });
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

      this.options.events.onMessage({
        ws: this.ws,
        clientId: this.clientId,
        data: parsedMessage as { type: string; action: string; data: unknown },
        redisInstance: this.redisInstance,
        queueManager: this.queueManager,
        databaseInstance: this.databaseInstance,
      });
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

  public disconnect(): void {
    // Disable auto-reconnect on manual disconnect
    this.shouldReconnect = false;

    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.ws && this.isConnected) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = undefined;
      this.clientId = undefined;
      this.isConnected = false;
      log('WebSocket client disconnected');
    }
  }

  public isClientConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    // Don't reconnect if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log('Max reconnection attempts reached', {
        Attempts: this.reconnectAttempts,
      });

      if (this.options.events?.onReconnectFailed) {
        this.options.events.onReconnectFailed({
          attempts: this.reconnectAttempts,
        });
      }

      return;
    }

    // Calculate delay with exponential backoff (max 30 seconds)
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    log('Scheduling reconnection', {
      Attempt: this.reconnectAttempts,
      Delay: `${delay}ms`,
    });

    if (this.options.events?.onReconnecting) {
      this.options.events.onReconnecting({
        attempt: this.reconnectAttempts,
        delay,
      });
    }

    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }

  /**
   * Attempt to reconnect to the server
   */
  private async attemptReconnect(): Promise<void> {
    try {
      log('Attempting to reconnect...', {
        Attempt: this.reconnectAttempts,
      });

      await this.connectToServer();

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      log('Reconnection successful');

      if (this.options.events?.onReconnected) {
        this.options.events.onReconnected({
          clientId: this.clientId,
        });
      }
    } catch (error) {
      log('Reconnection failed', {
        Error: error instanceof Error ? error.message : safeSerializeError(error),
      });

      // Schedule next attempt
      this.scheduleReconnect();
    }
  }

  /**
   * Enable auto-reconnection
   */
  public enableAutoReconnect(): void {
    this.shouldReconnect = true;
  }

  /**
   * Disable auto-reconnection
   */
  public disableAutoReconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): {
    isConnected: boolean;
    reconnectAttempts: number;
    autoReconnectEnabled: boolean;
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      autoReconnectEnabled: this.shouldReconnect,
    };
  }
}
