// websocket-server.ts
import {
  RawData,
  WebSocket,
  WebSocketServer as WS,
} from 'ws';
import {
  WebSocketOptions,
  WebSocketRedisSubscriberEvent,
  WebSocketConnectedClientData,
  WebSocketRoute,
  WebSocketType,
} from './websocket.interface.js';
import RedisInstance from '../redis/instance.js';
import QueueManager from '../queue/manager.js';
import DatabaseInstance from '../database/instance.js';
import { WebSocketServerProps } from './websocket-server.interface.js';
import WebSocketClientManager from './websocket-client-manager.js';
import {
  generateClientId,
  log,
  parseServerMessage,
  getRouteKey,
} from './utils.js';
import WebSocketBase from './websocket-base.js';
import { Time } from '../util/index.js';
import { Logger } from '../logger/index.js';
import { ApplicationConfig } from '../application/base-application.interface.js';
import path from 'path';
import { baseDir } from '../index.js';
import WebSocketRoomManager from './websocket-room-manager.js';
import logger from '../logger/logger.js';

export default class WebSocketServer extends WebSocketBase {
  protected defaultRoutes: WebSocketRoute[] = [
    {
      type: 'system',
      action: 'joinRoom',
      controllerName: 'system',
    },
  ];

  private server?: WS;
  // private connectedClients: Map<
  //   string,
  //   WebSocketConnectedClientData
  // > = new Map();
  private checkConnectedClientsInterval?: NodeJS.Timeout;
  private workerId: number | null;
  private applicationConfig: ApplicationConfig;
  private options: WebSocketOptions;
  private clientManager = new WebSocketClientManager();
  private roomManager = new WebSocketRoomManager({ clientManager: this.clientManager });
  private redisInstance: RedisInstance;
  private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance;

  private rooms: Map<string, Set<string>> = new Map();

  /** Redis subscriber events */
  private redisSubscriberEvents: string[] = [
    WebSocketRedisSubscriberEvent.ClientConnected,
    WebSocketRedisSubscriberEvent.ClientJoinedRoom,
    WebSocketRedisSubscriberEvent.ClientLeftRoom,
    WebSocketRedisSubscriberEvent.ClientDisconnected,
    WebSocketRedisSubscriberEvent.SendMessage,
    WebSocketRedisSubscriberEvent.SendMessageToAll,
    WebSocketRedisSubscriberEvent.MessageError,
    WebSocketRedisSubscriberEvent.QueueJobCompleted,
    WebSocketRedisSubscriberEvent.QueueJobError,
  ];

  constructor(props: WebSocketServerProps) {
    super();

    this.applicationConfig = props.applicationConfig;
    this.options = props.options;
    this.redisInstance = props.redisInstance;
    this.queueManager = props.queueManager;
    this.databaseInstance = props.databaseInstance;
    this.routes = props.routes;
    this.workerId = props.workerId;
  }

  public get type(): WebSocketType {
    return 'server';
  }

  public async load(): Promise<void> {
    const libraryControllersDirectory = path.join(
      baseDir,
      'websocket',
      'controllers',
      'server',
    );

    // Configure default routes
    await this.configureRoutes(
      this.defaultRoutes,
      libraryControllersDirectory,
    );

    // Configure custom routes
    await this.configureRoutes(
      this.routes,
      this.options.controllersDirectory,
    );
  }

  public async start(): Promise<{ server: WS }> {
    return new Promise((resolve) => {
      const server = new WS(
        {
          host: this.options.host,
          port: this.options.port,
        },
        () => {
          this.handleServerStart();

          resolve({ server });
        },
      );

      server.on('error', this.handleServerError);
      server.on(
        'connection',
        this.handleServerClientConnection,
      );

      this.server = server;
    });
  }

  public async stop(): Promise<void> {
    if (this.checkConnectedClientsInterval) {
      clearInterval(this.checkConnectedClientsInterval);
    }

    this.server?.close();

    log('Server stopped');
  }

  protected getControllerDependencies(): {
    webSocketServer: WebSocketServer;
    redisInstance: RedisInstance;
    queueManager: QueueManager;
    databaseInstance: DatabaseInstance;
  } {
    return {
      webSocketServer: this,
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

    if (this.options.disconnectInactiveClients?.enabled) {
      this.checkConnectedClientsInterval = setInterval(
        () => this.checkInactiveClients(),
        this.options.disconnectInactiveClients
          .intervalCheckTime,
      );
    }

    // Go through each event and subscribe to it
    this.redisSubscriberEvents.forEach((subscriberEventName) => {
      // Subscribe to event
      this.redisInstance.subscriberClient?.subscribe(subscriberEventName);
    });

    // Handle subscriber message
    this.redisInstance.subscriberClient.on('message', this.handleSubscriberMessage);

    log('Server started', {
      Host: this.options.host,
      Port: this.options.port,
    });

    if (this.options.events?.onServerStarted) {
      this.options.events.onServerStarted({
        webSocketServer: this.server,
      });
    }
  };

  /**
   * Handle subscriber message.
   */
  private handleSubscriberMessage = (channel: string, message: string): void => {
    let parsedMessage: { [key: string]: any };

    try {
      parsedMessage = JSON.parse(message);
    } catch (error) {
        log('Failed to parse subscriber message', {
          Channel: channel,
          Message: message,
          Error: error,
        });

        return;
    }

    const runSameWorker = parsedMessage.runSameWorker === true;
    const isSameWorker = parsedMessage.workerId === this.workerId;

    // Check if message is from the same worker
    if (runSameWorker !== true && isSameWorker) {
      // Ignore the message if it's from the same worker
      return;
    }

    log('Incoming subscriber message', {
      Channel: channel,
      // 'Run Same Worker': parsedMessage.runSameWorker ? 'Yes' : 'No',
      'Client ID': parsedMessage.clientId,
    });

    switch (channel) {
      case WebSocketRedisSubscriberEvent.ClientConnected: {
        this.clientManager.addClient({
          clientId: parsedMessage.clientId,
          ws: null,
          lastActivity: parsedMessage.lastActivity,
        });

        break;
      }
      case WebSocketRedisSubscriberEvent.ClientDisconnected: {
        // this.setDisconnectedClient({ clientId: parsedMessage.clientId });

        // log('Client disconnected', {
        //   ID: parsedMessage.clientId,
        // });

        // this.printConnectedClients();

        break;
      }
      case WebSocketRedisSubscriberEvent.ClientJoinedRoom: {
        this.clientManager.updateClient({
          clientId: parsedMessage.clientId,
          key: 'user',
          data: parsedMessage.user,
        });

        // this.roomManager.addClientToRoom({
        //   roomName: parsedMessage.room,
        //   clientId: parsedMessage.clientId,
        // });

        // log('Client joined room', {
        //   ID: parsedMessage.clientId,
        //   Username: parsedMessage.username,
        //   Room: parsedMessage.room,
        // });

        // this.printConnectedClients();
        // this.roomManager.printRooms();

        break;
      }
      case WebSocketRedisSubscriberEvent.ClientLeftRoom: {
        this.roomManager.removeClientFromRoom({
          roomName: parsedMessage.room,
          clientId: parsedMessage.clientId,
        });

        log('Client left room', {
          ID: parsedMessage.clientId,
          Room: parsedMessage.room,
        });

        // this.printConnectedClients();
        // this.roomManager.printRooms();

        break;
      }
      case WebSocketRedisSubscriberEvent.SendMessage: {
        break;
      }
      case WebSocketRedisSubscriberEvent.SendMessageToAll: {
        this.broadcastToAllClients({ data: parsedMessage });

        break;
      }
      case WebSocketRedisSubscriberEvent.MessageError: {
        // this.sendMessageError({
        //   webSocketClientId: parsedMessage.clientId,
        //   error: parsedMessage.error,
        // });

        break;
      }
      case WebSocketRedisSubscriberEvent.QueueJobCompleted: {
        // const parsedMessage = JSON.parse(message);

        // this.sendJobDoneMessage({ type: 'jobCompleted', ...parsedMessage });

        break;
      }
      case WebSocketRedisSubscriberEvent.QueueJobError: {
        // const parsedMessage = JSON.parse(message);

        // action and data is separate
        // TODO: Instead allow to pass anything
        parsedMessage.data = parsedMessage.error;

        // this.sendJobDoneMessage({ type: 'jobError', ...parsedMessage });

        break;
      }
      default: {
        log('Unknown subscriber message received', {
          Channel: channel,
          Message: message,
        });
      }
    }
  }

  /**
   * Set WebSocket client username.
   */
  // private setClientUsername({ webSocketClientId, username }: { webSocketClientId: string; username: string }) {
  //   const clientData = this.connectedClients.get(webSocketClientId);

  //   if (!clientData) {
  //     log('Client not found when trying to update connected client with username', {
  //       'Client ID': webSocketClientId,
  //     });

  //     return;
  //   }

  //   // Update client data with username
  //   this.connectedClients.set(webSocketClientId, { ...clientData, username });
  // }

  private handleServerError = (error: Error): void => {
    Logger.error(error);
  };

  private handleServerClientConnection = (
    ws: WebSocket,
  ): void => {
    const clientId = generateClientId();

    const lastActivity = Date.now();

    ws.on('message', (message: RawData) =>
      this.handleClientMessage(ws, message),
    );

    ws.on('close', () => {
      this.handleServerClientDisconnection(clientId);

      this.clientManager.removeClient(clientId);
    });

    try {
      // this.setConnectedClient({ clientId, ws, lastActivity });
      this.clientManager.addClient({
        clientId,
        ws,
        lastActivity,
      });

      // Let other workers know that the client has connected
      this.redisInstance.publisherClient.publish(
        WebSocketRedisSubscriberEvent.ClientConnected,
        JSON.stringify({
          clientId,
          lastActivity,
          workerId: this.workerId,
        }),
      );
    } catch (error) {
      logger.error(error);
    }
  };

  // private addConnectedClient({
  //   clientId,
  //   ws,
  // }: {
  //   clientId: string;
  //   ws: WebSocket;
  // }): void {
  //   const lastActivity = Date.now();

  //   this.setConnectedClient({ clientId, ws, lastActivity });

  //   this.redisInstance.publisherClient.publish(
  //     WebSocketRedisSubscriberEvent.ClientConnected,
  //     JSON.stringify({
  //       clientId,
  //       lastActivity,
  //       workerId: this.workerId,
  //     }),
  //   );
  // }

  // private setConnectedClient({
  //   clientId,
  //   ws,
  //   lastActivity,
  // }: {
  //   clientId: string;
  //   ws: WebSocket | null;
  //   lastActivity: number;
  // }): void {
  //   this.connectedClients.set(clientId, {
  //     ws,
  //     lastActivity: lastActivity,
  //   });

  //   log('Client connected', { ID: clientId });

  //   // this.printConnectedClients();
  // }

  // /**
  //  * Set disconnected WebSocket client.
  //  */
  // private setDisconnectedClient({ clientId }: { clientId: string }) {
  //   // Remove client from all rooms
  //   this.roomManager.removeClientFromAllRooms({ clientId });

  //   // Remove client from connected clients list
  //   this.connectedClients.delete(clientId);
  // }

  private leaveAllRooms(ws: WebSocket): void {
    const clientId = this.clientManager.getClientId({ ws });

    if (!clientId) {
      log('Client ID not found when removing client from all rooms');

      return;
    }

    this.rooms.forEach((clients, roomName) => {
      if (clients && clients.has(clientId)) {
        this.leaveRoom({ ws, roomName });
      }
    });
  }

  public leaveRoom({ ws, roomName }: { ws: WebSocket; roomName: string }): void {
    const clientId = this.clientManager.getClientId({ ws });

    if (!clientId) {
      log('Client ID not found when removing client from room');
      return;
    }

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientLeftRoom,
      JSON.stringify({
        clientId,
        runSameWorker: true,
        room: roomName,
        workerId: this.workerId,
      }),
    );

    // this.roomManager.removeClientFromRoom({
    //   roomName,
    //   clientId,
    // });

    // Optionally send a message to the client
    this.sendClientMessage(ws, {
      type: 'user',
      action: 'leftRoom',
      data: {
        roomName,
      },
    });

    // this.clientManager.broadcastClientList('leaveRoom');

    log('Client left room', {
      ID: clientId,
      Room: roomName,
    });

    this.roomManager.printRooms();
  }

  private handleServerClientDisconnection = (
    clientId: string,
  ): void => {
    // const clientData = this.connectedClients.get(clientId);

    // if (clientData?.ws) {
    //   this.leaveAllRooms(clientData.ws);
    // }

    // this.redisInstance.publisherClient.publish(
    //   WebSocketRedisSubscriberEvent.ClientDisconnected,
    //   JSON.stringify({
    //     clientId,
    //     workerId: this.workerId,
    //     runSameWorker: true,
    //   }),
    // );

    // log('Client disconnected', { ID: clientId });
  };

  private handleClientMessage = async (
    ws: WebSocket,
    message: RawData,
  ): Promise<void> => {
    try {
      const clientId = this.clientManager.getClientId({ ws });

      if (!clientId) {
        log(
          'Client ID not found when handling server message',
        );

        return;
      }

      // const parsedMessage = JSON.parse(message.toString());

      // TODO: THIS IS WHAT THE CONTROLLERS ARE FOR
      // MAKE SYSTEM VERSION OF user and joinRoom/leaveRoom, instead of doing it in SocialAmp API?
      // if (parsedMessage.action === 'leaveRoom' && parsedMessage.room) {
      //   this.leaveRoom({ ws, room: parsedMessage.room });

      //   return;
      // }

      // Handle server message
      await this.handleServerMessage(ws, message, clientId);
    } catch (error) {
      log('Error handling client message', {
        Error: error,
      });
    }
  };

  protected handleMessageError(
    clientId: string,
    error: string,
  ): void {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.MessageError,
      JSON.stringify({
        runSameWorker: true,
        clientId,
        error,
      }),
    );
  }

  private checkInactiveClients(): void {
    const now = Date.now();

    if (
      this.options.disconnectInactiveClients?.enabled &&
      this.options.disconnectInactiveClients.log
    ) {
      log('Checking inactive clients...');
    }

    let numInactiveClients = 0;

    // this.connectedClients.forEach(
    //   (clientInfo, clientId) => {
    //     if (
    //       this.options.disconnectInactiveClients?.enabled &&
    //       typeof this.options.disconnectInactiveClients
    //         .inactiveTime === 'number'
    //     ) {
    //       const timeUntilInactive = Math.max(
    //         0,
    //         this.options.disconnectInactiveClients
    //           .inactiveTime -
    //           (now - clientInfo.lastActivity),
    //       );
    //       const isClientInactive = timeUntilInactive <= 0;

    //       if (this.options.disconnectInactiveClients.log) {
    //         log('Checking client activity', {
    //           ID: clientId,
    //           'Time Until Inactive': Time.formatTime({
    //             time: timeUntilInactive,
    //             format: 'auto',
    //           }),
    //         });
    //       }

    //       if (isClientInactive) {
    //         this.disconnectClient({ clientId });

    //         numInactiveClients++;
    //       }
    //     }
    //   },
    // );

    // if (
    //   this.options.disconnectInactiveClients?.enabled &&
    //   this.options.disconnectInactiveClients.log
    // ) {
    //   if (numInactiveClients > 0) {
    //     log('Inactive clients disconnected', {
    //       Count: numInactiveClients,
    //     });
    //   } else {
    //     log('No inactive clients');
    //   }
    // }
  }

  // private disconnectClient({
  //   clientId,
  // }: {
  //   clientId: string;
  // }) {
  //   const clientInfo = this.connectedClients.get(clientId);

  //   if (clientInfo?.ws) {
  //     const connectedTime =
  //       Date.now() - clientInfo.lastActivity;

  //     clientInfo.ws.close();

  //     Logger.info(
  //       'WebSocket client was disconnected due to inactivity',
  //       {
  //         ID: clientId,
  //         Worker: this.workerId,
  //         'Time Connected': Time.formatTime({
  //           time: connectedTime,
  //           format: 's',
  //         }),
  //       },
  //     );
  //   }
  // }

  public broadcastToAllClients({
    data,
    excludeClientId,
  }: {
    data: { [key: string]: any };
    excludeClientId?: string;
  }): void {
    if (!this.server) {
      log(
        'Server not started when broadcasting to all clients',
      );

      return;
    }

    this.server.clients.forEach((client) => {
      let excludeClient = false;

      if (excludeClientId) {
        const clientId = this.clientManager.getClientId({ ws: client });

        excludeClient = clientId === excludeClientId;
      }

      if (
        client.readyState === WebSocket.OPEN &&
        !excludeClient
      ) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // private getClientId({
  //   client,
  // }: {
  //   client: WebSocket;
  // }): string | undefined {
  //   return [...this.connectedClients.entries()].find(
  //     ([_, value]) => value.ws === client,
  //   )?.[0];
  // }

  public async joinRoom({
    ws,
    userId,
    roomName,
  }: {
    ws: WebSocket;
    userId: number;
    roomName: string;
  }): Promise<void> {
    const clientId = this.clientManager.getClientId({ ws });

    if (!clientId) {
      log('Client ID not found when setting client joined');

      return;
    }

    // Get user email from database
    const dbEntityManager = this.databaseInstance.getEntityManager();

    const getUserQuery = 'SELECT email FROM users WHERE id = ?';
    const getUserParams = [userId];

    const getUserResult = await dbEntityManager.execute(getUserQuery, getUserParams);

    if (!getUserResult || getUserResult.length === 0) {
      log('User not found in database', {
        'User ID': userId,
      });

      return;
    }

    const user = getUserResult[0];

    const userData = {
      id: userId,
      ...user,
    };

    // Update client with user in client manager (DO BOTH)
    this.clientManager.updateClient({
      clientId,
      key: 'user',
      data: userData,
    });

    this.roomManager.addClientToRoom({
      clientId,
      user: userData,
      roomName,
    });

    // Let other workers know that the client has joined the room
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientJoinedRoom,
      JSON.stringify({
        clientId,
        user: userData,
        roomName,
        workerId: this.workerId,
      }),
    );

    // Send welcome message back to client
    this.sendClientMessage(ws, {
      type: 'ack',
      action: 'joinRoom',
      data: {},
    });
  }

  public sendClientMessage = (
    ws: WebSocket,
    data: unknown,
    binary: boolean = false,
  ): void => {
    const webSocketMessage = JSON.stringify(data);

    ws.send(webSocketMessage, { binary });
  };

  public sendMessage = (data: unknown): void => {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.SendMessage,
      JSON.stringify(data),
    );
  };

  public sendMessageToAll = (data: unknown): void => {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.SendMessageToAll,
      JSON.stringify(data),
    );
  };
}
