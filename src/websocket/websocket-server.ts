// websocket-server.ts
import { RawData, WebSocket, WebSocketServer as WS } from 'ws';
import { WebSocketOptions, WebSocketRedisSubscriberEvent, WebSocketConnectedClientData, WebSocketRoute, WebSocketType } from './websocket.interface.js';
import RedisInstance from '../redis/instance.js';
import QueueManager from '../queue/manager.js';
import DatabaseInstance from '../database/instance.js';
import { WebSocketServerProps } from './websocket-server.interface.js';
import WebSocketClientManager from './websocket-client-manager.js';
import { generateClientId, log, parseServerMessage, getRouteKey } from './utils.js';
import WebSocketBase from './websocket-base.js';
import { Time } from '../util/index.js';
import { Logger } from '../logger/index.js';
import { ApplicationConfig } from '../application/base-application.interface.js';
import path from 'path';
import { baseDir } from '../index.js';

export default class WebSocketServer extends WebSocketBase {
  protected defaultRoutes: WebSocketRoute[] = [
    {
      type: 'system',
      action: 'clientJoin',
      controllerName: 'system',
    },
  ];

  private server?: WS;
  private connectedClients: Map<string, WebSocketConnectedClientData> = new Map();
  private checkConnectedClientsInterval?: NodeJS.Timeout;
  private workerId: number;
  private applicationConfig: ApplicationConfig;
  private options: WebSocketOptions;
  private clientManager = new WebSocketClientManager();
  private redisInstance: RedisInstance;
  private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance;

  constructor(props: WebSocketServerProps) {
    super();

    this.applicationConfig = props.applicationConfig;
    this.options = props.options;
    this.redisInstance = props.redisInstance;
    this.queueManager = props.queueManager;
    this.databaseInstance = props.databaseInstance;
    this.routes = props.routes;
    this.workerId = props.workerId;

    if (this.options.disconnectInactiveClients?.enabled) {
      this.checkConnectedClientsInterval = setInterval(() => this.checkInactiveClients(), this.options.disconnectInactiveClients.intervalCheckTime);
    }
  }

  public get type(): WebSocketType {
    return 'server';
  }

  public async load(): Promise<void> {
    const libraryControllersDirectory = path.join(baseDir, 'websocket', 'controllers', 'server');

    // Configure default routes
    await this.configureRoutes(this.defaultRoutes, libraryControllersDirectory);

    // Configure custom routes
    await this.configureRoutes(this.routes, this.options.controllersDirectory);
  }

  public async startServer(): Promise<{ server: WS }> {
    return new Promise((resolve) => {
      const server = new WS({ host: this.options.host, port: this.options.port }, () => {
        this.handleServerStart();

        resolve({ server });
      });

      server.on('error', this.handleServerError);
      server.on('connection', this.handleServerClientConnection);

      this.server = server;
    });
  }

  protected getControllerDependencies(): { sendMessage: (data: unknown) => void; redisInstance: RedisInstance; queueManager: QueueManager; databaseInstance: DatabaseInstance } {
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

  private handleServerStart = (): void => {
    if (!this.server) {
      throw new Error('WebSocket server not started');
    }

    log('Server started', { Host: this.options.host, Port: this.options.port });

    if (this.options.events?.onServerStarted) {
      this.options.events.onServerStarted({ webSocketServer: this.server });
    }
  };

  private handleServerError = (error: Error): void => {
    Logger.error(error);
  };

  private handleServerClientConnection = (ws: WebSocket): void => {
    const clientId = generateClientId();

    this.addConnectedClient({ clientId, ws });

    this.clientManager.addClient(clientId, 'clientType', ws);

    ws.on('message', (message: RawData) => this.handleClientMessage(ws, message));

    ws.on('close', () => {
      this.handleServerClientDisconnection(clientId);

      this.clientManager.removeClient(clientId);
    });

    log('Client connected', { ID: clientId });
  };

  private addConnectedClient({ clientId, ws }: { clientId: string; ws: WebSocket }): void {
    const lastActivity = Date.now();

    this.setConnectedClient({ clientId, ws, lastActivity });

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientConnected,
      JSON.stringify({ clientId, lastActivity, workerId: this.workerId })
    );
  }

  private setConnectedClient({ clientId, ws, lastActivity }: { clientId: string; ws: WebSocket | null; lastActivity: number }): void {
    this.connectedClients.set(clientId, { ws, lastActivity: lastActivity });

    // log('Client connected', { ID: clientId });

    // this.printConnectedClients();
  }

  private handleServerClientDisconnection = (clientId: string): void => {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientDisconnected,
      JSON.stringify({ clientId, workerId: this.workerId, runSameWorker: true })
    );

    log('Client disconnected', { ID: clientId });
  };

  private handleClientMessage = async (ws: WebSocket, message: RawData): Promise<void> => {
    const clientId = this.getClientId({ client: ws });

    if (!clientId) {
      log('Client ID not found when handling server message');

      return;
    }

    await this.handleServerMessage(ws, message, clientId);
  };

  protected handleMessageError(clientId: string, error: string): void {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.MessageError,
      JSON.stringify({ runSameWorker: true, clientId, error })
    );
  }

  private checkInactiveClients(): void {
    const now = Date.now();

    if (this.options.disconnectInactiveClients?.enabled && this.options.disconnectInactiveClients.log) {
      log('Checking inactive clients...');
    }

    let numInactiveClients = 0;
    this.connectedClients.forEach((clientInfo, clientId) => {
      if (this.options.disconnectInactiveClients?.enabled && typeof this.options.disconnectInactiveClients.inactiveTime === 'number') {
        const timeUntilInactive = Math.max(0, this.options.disconnectInactiveClients.inactiveTime - (now - clientInfo.lastActivity));
        const isClientInactive = timeUntilInactive <= 0;

        if (this.options.disconnectInactiveClients.log) {
          log('Checking client activity', { ID: clientId, 'Time Until Inactive': Time.formatTime({ time: timeUntilInactive, format: 'auto' }) });
        }

        if (isClientInactive) {
          this.disconnectClient({ clientId });

          numInactiveClients++;
        }
      }
    });

    if (this.options.disconnectInactiveClients?.enabled && this.options.disconnectInactiveClients.log) {
      if (numInactiveClients > 0) {
        log('Inactive clients disconnected', { Count: numInactiveClients });
      } else {
        log('No inactive clients');
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
      log('Server not started when broadcasting to all clients');

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
      log('Client ID not found when setting client joined');

      return;
    }

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientJoined,
      JSON.stringify({ clientId, runSameWorker: true, username, workerId: this.workerId })
    );

    // Send welcome message back to client
    this.sendClientMessage(ws, { type: 'user', action: 'welcome' });

    this.clientManager.broadcastClientList();

    Logger.info('Client joined', { ID: clientId, Username: username });
  }

  public sendClientMessage = (ws: WebSocket, data: unknown, binary: boolean = false): void => {
    const webSocketMessage = JSON.stringify(data);

    ws.send(webSocketMessage, { binary });
  };

  public sendMessage = (data: unknown): void => {
    this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.SendMessage, JSON.stringify(data));
  };

  public sendMessageToAll = (data: unknown): void => {
    this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.SendMessageToAll, JSON.stringify(data));
  };

  public printConnectedClients(): void {
    log('Connected clients', { Count: this.connectedClients.size });
  }
}
