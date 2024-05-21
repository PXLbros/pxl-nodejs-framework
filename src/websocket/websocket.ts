import { Server, RawData, WebSocket } from 'ws';
import { Helper } from '../util/index.js';
import { DatabaseInstance } from '../database/index.js';
import { QueueManager } from '../queue/index.js';
import { RedisInstance } from '../redis/index.js';
import { WebSocketConstructorParams, WebSocketOptions } from './websocket.interface.js';
import { Logger } from '../logger/index.js';

class WebSocket {
  private options: WebSocketOptions;

  private redisInstance: RedisInstance;
  private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance;

  private server?: Server;

  constructor(params: WebSocketConstructorParams) {
    // Define default options
    const defaultOptions: Partial<WebSocketOptions> = {
      port: 3002,
      routes: [],
    };

    // Merge default options
    const mergedOptions = Helper.defaultsDeep(params.options, defaultOptions);

    this.options = mergedOptions;

    this.redisInstance = params.redisInstance;
    this.queueManager = params.queueManager;
    this.databaseInstance = params.databaseInstance;
  }

  /**
   * Start web socket.
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = new Server({ port: this.options.port }, () => {
        this.handleServerStart();

        resolve();
      });

      this.server.on('error', this.handleError);
      // this.server.on('connection', this.handleClientConnection);
    });
  }

  private handleServerStart = (): void => {
    Logger.info('WebSocket server started', {
      Port: this.options.port,
    });
  };

  private handleError = (error: Error): void => {
    Logger.error(error);
  };
}

export default WebSocket;
