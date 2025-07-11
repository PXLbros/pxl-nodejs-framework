import { RawData, WebSocket, WebSocketServer as WS } from 'ws';
import {
  WebSocketOptions,
  WebSocketRedisSubscriberEvent,
  WebSocketRoute,
  WebSocketType,
} from './websocket.interface.js';
import RedisInstance from '../redis/instance.js';
import QueueManager from '../queue/manager.js';
import DatabaseInstance from '../database/instance.js';
import { WebSocketServerProps } from './websocket-server.interface.js';
import WebSocketClientManager from './websocket-client-manager.js';
import { generateClientId, log } from './utils.js';
import WebSocketBase from './websocket-base.js';
import { Logger } from '../logger/index.js';
import path from 'path';
import { baseDir, WebApplicationConfig } from '../index.js';
import WebSocketRoomManager from './websocket-room-manager.js';
import logger from '../logger/logger.js';
import { FastifyInstance } from 'fastify';
import { URL } from 'url';
import Jwt from '../auth/jwt.js';

export default class WebSocketServer extends WebSocketBase {
  protected defaultRoutes: WebSocketRoute[] = [
    {
      type: 'system',
      action: 'joinRoom',
      controllerName: 'system',
    },
    {
      type: 'system',
      action: 'leaveRoom',
      controllerName: 'system',
    },
  ];

  private server?: WS;

  private checkConnectedClientsInterval?: ReturnType<typeof setInterval>;
  private workerId: number | null;
  private uniqueInstanceId: string;
  private applicationConfig: WebApplicationConfig;
  private options: WebSocketOptions;
  public clientManager = new WebSocketClientManager();
  private roomManager = new WebSocketRoomManager({
    clientManager: this.clientManager,
  });

  public get rooms() {
    return this.roomManager.rooms;
  }
  private redisInstance: RedisInstance;
  private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance;

  /** Redis subscriber events */
  private redisSubscriberEvents: string[] = [
    WebSocketRedisSubscriberEvent.ClientConnected,
    WebSocketRedisSubscriberEvent.ClientJoinedRoom,
    WebSocketRedisSubscriberEvent.ClientLeftRoom,
    WebSocketRedisSubscriberEvent.ClientDisconnected,
    WebSocketRedisSubscriberEvent.DisconnectClient,
    WebSocketRedisSubscriberEvent.SendMessage,
    WebSocketRedisSubscriberEvent.SendMessageToAll,
    WebSocketRedisSubscriberEvent.MessageError,
    WebSocketRedisSubscriberEvent.QueueJobCompleted,
    WebSocketRedisSubscriberEvent.QueueJobError,
    WebSocketRedisSubscriberEvent.Custom,
  ];

  constructor(props: WebSocketServerProps) {
    super();

    this.uniqueInstanceId = props.uniqueInstanceId;
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

  private async validateWebSocketAuth(
    url: string,
  ): Promise<{ userId: number; payload: any } | null> {
    try {
      const parsedUrl = new URL(url, 'ws://localhost');
      const token = parsedUrl.searchParams.get('token');

      if (!token) {
        return null; // No token provided, allow unauthenticated connection
      }

      // Get JWT secret key from application config
      const jwtSecretKey = this.applicationConfig.auth?.jwtSecretKey;

      if (!jwtSecretKey) {
        throw new Error('JWT secret key not configured');
      }

      // Import JWT secret key
      const importedJwtSecretKey = await Jwt.importJwtSecretKey({
        jwtSecretKey,
      });

      // Verify JWT token
      const { payload } = await Jwt.jwtVerify(token, importedJwtSecretKey);

      const userId = parseInt(payload.sub as string);

      if (isNaN(userId)) {
        throw new Error('Invalid user ID in token');
      }

      return { userId, payload };
    } catch (error: any) {
      throw new Error(`JWT verification failed: ${error.message}`);
    }
  }

  public async load(): Promise<void> {
    const libraryControllersDirectory = path.join(
      baseDir,
      'websocket',
      'controllers',
      'server',
    );

    // Configure default routes
    await this.configureRoutes(this.defaultRoutes, libraryControllersDirectory);

    // Configure custom routes
    await this.configureRoutes(this.routes, this.options.controllersDirectory);
  }

  public async start({
    fastifyServer,
  }: {
    fastifyServer: FastifyInstance;
  }): Promise<{ server: WS }> {
    return new Promise(resolve => {
      const server = new WS({
        noServer: true, // We're handling the server externally
      });

      this.server = server;

      // Ensure this is called after the server has been properly set up
      this.handleServerStart();

      fastifyServer.server.on('upgrade', async (request, socket, head) => {
        if (request.url?.startsWith('/ws')) {
          try {
            // Validate authentication token if provided
            const authenticatedUser = await this.validateWebSocketAuth(
              request.url,
            );

            server.handleUpgrade(request, socket, head, ws => {
              server.emit('connection', ws, request, authenticatedUser);
            });
          } catch (error: any) {
            log('WebSocket authentication failed', { error: error.message });
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
          }
        } else {
          socket.destroy();
        }
      });

      server.on('error', this.handleServerError);

      server.on(
        'connection',
        (
          ws: WebSocket,
          request: any,
          authenticatedUser: { userId: number; payload: any } | null,
        ) => {
          this.handleServerClientConnection(ws, authenticatedUser);
        },
      );

      // Resolve the promise with the server instance
      resolve({ server });
    });
  }

  public async stop(): Promise<void> {
    if (this.checkConnectedClientsInterval) {
      clearInterval(this.checkConnectedClientsInterval);
      this.checkConnectedClientsInterval = undefined;
    }

    // Clean up Redis subscriber listeners
    this.redisInstance.subscriberClient?.removeListener(
      'message',
      this.handleSubscriberMessage,
    );

    // Unsubscribe from all Redis events
    this.redisSubscriberEvents.forEach(subscriberEventName => {
      this.redisInstance.subscriberClient?.unsubscribe(subscriberEventName);
    });

    // Close all client connections and clean up
    if (this.server) {
      this.server.clients.forEach(client => {
        client.removeAllListeners();
        client.close();
      });

      this.server.removeAllListeners();
      this.server.close();
    }

    // Clean up client manager and room manager
    this.clientManager.cleanup();
    this.roomManager.cleanup();

    // Reset managers
    this.clientManager = new WebSocketClientManager();
    this.roomManager = new WebSocketRoomManager({
      clientManager: this.clientManager,
    });

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
        this.options.disconnectInactiveClients.intervalCheckTime,
      );
    }

    // Go through each event and subscribe to it
    this.redisSubscriberEvents.forEach(subscriberEventName => {
      // Subscribe to event
      this.redisInstance.subscriberClient?.subscribe(subscriberEventName);
    });

    // Handle subscriber message
    this.redisInstance.subscriberClient.on(
      'message',
      this.handleSubscriberMessage,
    );

    log('Server started', {
      Host: this.options.host,
      URL: this.options.url,
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
  private handleSubscriberMessage = async (
    channel: string,
    message: string,
  ): Promise<void> => {
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
      'Client ID': parsedMessage.clientId || '-',
    });

    switch (channel) {
      case WebSocketRedisSubscriberEvent.ClientConnected: {
        this.onClientConnect({
          clientId: parsedMessage.clientId,
          lastActivity: parsedMessage.lastActivity,
          user: parsedMessage.user,
        });

        break;
      }
      case WebSocketRedisSubscriberEvent.ClientDisconnected: {
        this.onClientDisconnect({
          clientId: parsedMessage.clientId,
        });

        break;
      }
      case WebSocketRedisSubscriberEvent.DisconnectClient: {
        const clientToDisconnect = this.clientManager.getClient({
          clientId: parsedMessage.clientId,
          // requireWs: true,
        });

        log(
          `GOT A REQUEST TO POTENTIALLY DISCONNECT LCIENT IF THIS CLIENT IS CONNETED HERE, GET CLIENT ------------------------- ${clientToDisconnect ? clientToDisconnect : 'NO CLIENT'}`,
        );

        console.log(
          'clientToDisconnect',
          clientToDisconnect,
          'workerId: ',
          this.workerId,
        );

        if (clientToDisconnect) {
          this.clientManager.disconnectClient({
            clientId: parsedMessage.clientId,
          });

          // this.onClientDisconnect({
          //   clientId: parsedMessage.clientId,
          // });

          // Remove client from rooms
          this.roomManager.removeClientFromAllRooms({
            clientId: parsedMessage.clientId,
          });
        }

        break;
      }
      case WebSocketRedisSubscriberEvent.ClientJoinedRoom: {
        this.onJoinRoom({
          clientId: parsedMessage.clientId,
          roomName: parsedMessage.roomName,
          userData: parsedMessage.user,
        });

        break;
      }
      case WebSocketRedisSubscriberEvent.ClientLeftRoom: {
        this.roomManager.removeClientFromRoom({
          roomName: parsedMessage.room,
          clientId: parsedMessage.clientId,
        });

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
        this.sendMessageError({
          webSocketClientId: parsedMessage.clientId,
          error: parsedMessage.error,
        });

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
      case WebSocketRedisSubscriberEvent.Custom: {
        // Custom logic is being handled in the app

        break;
      }
      default: {
        log('Unknown subscriber message received', {
          Channel: channel,
          Message: message,
        });
      }
    }

    if (
      typeof this.applicationConfig.webSocket?.subscriberEventHandler ===
      'function'
    ) {
      // Execute custom application subscriber event handler
      this.applicationConfig.webSocket.subscriberEventHandler({
        channel,
        message: parsedMessage,
        webSocketServer: this,
        databaseInstance: this.databaseInstance,
      });
    }
  };

  private handleServerError = (error: Error): void => {
    Logger.error(error);
  };

  private handleServerClientConnection = (
    ws: WebSocket,
    authenticatedUser?: { userId: number; payload: any } | null,
  ): void => {
    const clientId = generateClientId();

    const lastActivity = Date.now();

    ws.on('message', (message: RawData) =>
      this.handleClientMessage(ws, message),
    );

    ws.on('close', () => {
      this.handleServerClientDisconnection(clientId);
      this.clientManager.removeClient(clientId);

      // Clean up event listeners to prevent memory leaks
      ws.removeAllListeners();
    });

    try {
      this.clientManager.addClient({
        clientId,
        ws,
        lastActivity,
        user: authenticatedUser,
      });

      // Let other workers know that the client has connected
      this.redisInstance.publisherClient.publish(
        WebSocketRedisSubscriberEvent.ClientConnected,
        JSON.stringify({
          clientId,
          lastActivity,
          workerId: this.workerId,
          user: authenticatedUser,
        }),
      );

      // Send authentication success message if user is authenticated
      if (authenticatedUser) {
        this.sendClientMessage(ws, {
          type: 'auth',
          action: 'authenticated',
          data: {
            userId: authenticatedUser.userId,
            message: 'Authentication successful',
          },
        });
      }
    } catch (error) {
      logger.error(error);
    }
  };

  public leaveRoom({
    ws,
    roomName,
  }: {
    ws: WebSocket;
    roomName: string;
  }): void {
    const clientId = this.clientManager.getClientId({ ws });

    if (!clientId) {
      log('Client ID not found when removing client from room');

      return;
    }

    // Check if client is in room
    const clientInRoom = this.roomManager.isClientInRoom({
      clientId,
      roomName,
    });

    if (!clientInRoom) {
      log('Client not in room when removing client from room', {
        'Client ID': clientId || '-',
        'Room Name': roomName,
      });

      return;
    }

    this.roomManager.removeClientFromRoom({
      roomName,
      clientId,
    });

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientLeftRoom,
      JSON.stringify({
        clientId,
        room: roomName,
        workerId: this.workerId,
      }),
    );

    // Optionally send a message to the client
    this.sendClientMessage(ws, {
      type: 'user',
      action: 'leftRoom',
      data: {
        roomName,
      },
    });
  }

  private onClientConnect({
    clientId,
    lastActivity,
    user,
  }: {
    clientId: string;
    lastActivity: number;
    user?: { userId: number; payload: any } | null;
  }): void {
    this.clientManager.addClient({
      clientId,
      ws: null,
      lastActivity,
      user,
    });
  }

  private onClientDisconnect({ clientId }: { clientId: string }): void {
    // Set client as disconnected
    this.clientManager.removeClient(clientId);

    // Remove client from rooms
    this.roomManager.removeClientFromAllRooms({ clientId });
  }

  private handleServerClientDisconnection = (clientId: string): void => {
    const client = this.clientManager.getClient({
      clientId,
    });

    if (!client) {
      log('Client not found when handling server client disconnection', {
        'Client ID': clientId || '-',
      });

      return;
    }

    this.onClientDisconnect({ clientId });

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.ClientDisconnected,
      JSON.stringify({
        clientId,
        workerId: this.workerId,
      }),
    );

    // log('Client disconnected', { ID: clientId });
  };

  private handleClientMessage = async (
    ws: WebSocket,
    message: RawData,
  ): Promise<void> => {
    try {
      const clientId = this.clientManager.getClientId({
        ws,
      });

      if (!clientId) {
        log('Client ID not found when handling server message');

        return;
      }

      // Handle server message
      const serverMessageResponse = await this.handleServerMessage(
        ws,
        message,
        clientId,
      );

      if (serverMessageResponse) {
        this.sendClientMessage(ws, {
          type: serverMessageResponse.type,
          action: serverMessageResponse.action,
          response: serverMessageResponse?.response,
        });

        if (serverMessageResponse?.response?.error) {
          // throw new Error(serverMessageResponse?.response?.error);

          Logger.error(serverMessageResponse.response.error);
        }
      }
    } catch (error) {
      Logger.error(error);

      log('Error handling client message', {
        Error: error,
      });
    }
  };

  protected handleMessageError(clientId: string, error: string): void {
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
    // const now = Date.now();

    if (
      this.options.disconnectInactiveClients?.enabled &&
      this.options.disconnectInactiveClients.log
    ) {
      log('Checking inactive clients...');
    }

    // const numInactiveClients = 0;

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
      log('Server not started when broadcasting to all clients');

      return;
    }

    this.server.clients.forEach(client => {
      let excludeClient = false;

      if (excludeClientId) {
        const clientId = this.clientManager.getClientId({
          ws: client,
        });

        excludeClient = clientId === excludeClientId;
      }

      if (client.readyState === WebSocket.OPEN && !excludeClient) {
        client.send(JSON.stringify(data));
      }
    });
  }

  public sendMessageError({
    webSocketClientId,
    error,
  }: {
    webSocketClientId: string;
    error: string;
  }): void {
    const client = this.clientManager.getClient({
      clientId: webSocketClientId,
    });

    if (!client) {
      log('Client not found when sending message error', {
        'Client ID': webSocketClientId || '-',
        Error: error,
      });

      return;
    } else if (!client.ws) {
      log('Client WebSocket not found when sending message error', {
        'Client ID': webSocketClientId || '-',
        Error: error,
      });

      return;
    }

    this.sendClientMessage(client.ws, {
      type: 'error',
      action: 'message',
      data: {
        error,
      },
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

  private onJoinRoom({
    clientId,
    roomName,
    userData,
  }: {
    clientId: string;
    roomName: string;
    userData: any;
  }): void {
    // TODO: If config clientCanJoinMultipleRooms !== true, then it should remove the user from existing room first
    const client = this.clientManager.getClient({
      clientId,
    });

    if (!client) {
      log('Client not found when joining room', {
        'Client ID': clientId || '-',
        'Room Name': roomName,
      });

      return;
    }

    const clientCanJoinMultipleRooms: any = false;

    if (clientCanJoinMultipleRooms !== true) {
      if (client.roomName) {
        // Remove client from current room
        this.roomManager.removeClientFromRoom({
          roomName: client.roomName,
          clientId,
        });
      }
    }

    // Update client with user in client manager
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
  }

  public async joinRoom({
    ws,
    userId,
    userType,
    username,
    roomName,
  }: {
    ws: WebSocket;
    userId?: number;
    userType?: string;
    username?: string;
    roomName: string;
  }) {
    const clientId = this.clientManager.getClientId({ ws });

    if (!clientId) {
      throw new Error('Client ID not found when joining room');
    }

    // Check if client is already in room
    const isClientInRoom = this.roomManager.isClientInRoom({
      clientId,
      roomName,
    });

    if (isClientInRoom) {
      throw new Error('Client already in room when joining');
    }

    let userData: any = {};

    // // Get WebSocket client ID
    // const webSocketId = this.clientManager.getClientId({ ws });

    if (userId) {
      // Get user email from database
      const dbEntityManager = this.databaseInstance.getEntityManager();

      const getUserQuery = 'SELECT email FROM users WHERE id = ?';
      const getUserParams = [userId];

      const getUserResult = await dbEntityManager.execute(
        getUserQuery,
        getUserParams,
      );

      if (!getUserResult || getUserResult.length === 0) {
        throw new Error('User not found in database');
      }

      const user = getUserResult[0];

      userData = {
        id: userId,
        ...user,
      };
    }

    // userData.uniqueId = webSocketId;

    if (username) {
      userData.username = username;
    }

    userData.userType = userType;

    // if user with same email is already connected, disconnect the previous connection
    // const existingClient =
    //   this.clientManager.getClientByKey({
    //     key: 'user.email',
    //     value: user.email,
    //   });

    // if (existingClient) {
    //   if (existingClient.ws) {
    //     this.clientManager.disconnectClient({
    //       clientId: existingClient.clientId,
    //     });
    //   } else {
    //     // Publish to Redis that we should disconnect this client
    //     this.redisInstance.publisherClient.publish(
    //       WebSocketRedisSubscriberEvent.DisconnectClient,
    //       JSON.stringify({
    //         clientId,
    //         workerId: this.workerId,
    //       }),
    //     );
    //   }
    // }

    this.onJoinRoom({
      clientId,
      roomName,
      userData,
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

    return true;
  }

  public sendClientMessage = (
    ws: WebSocket,
    data: unknown,
    binary: boolean = false,
  ): void => {
    const webSocketMessage = JSON.stringify(data);

    ws.send(webSocketMessage, { binary });
  };

  public sendMessage = ({ data }: { data: unknown }): void => {
    const formattedData = {
      ...(data as object),
      workerId: this.workerId,
    };

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.SendMessage,
      JSON.stringify(formattedData),
    );
  };

  public sendMessageToAll = ({ data }: { data: unknown }): void => {
    const formattedData = {
      ...(data as object),
      workerId: this.workerId,
    };

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.SendMessageToAll,
      JSON.stringify(formattedData),
    );
  };

  public sendCustomMessage = ({ data }: { data: unknown }): void => {
    const formattedData = {
      ...(data as object),
      workerId: this.workerId,
    };

    console.log('SEND CUSTOM MESSAGE:', formattedData);

    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.Custom,
      JSON.stringify(formattedData),
    );
  };

  public getClients({ userType }: { userType?: string }): any[] {
    return this.clientManager.getClients({ userType });
  }
}
