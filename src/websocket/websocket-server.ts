import { type RawData, WebSocketServer as WS, WebSocket } from 'ws';
import {
  type WebSocketOptions,
  WebSocketRedisSubscriberEvent,
  type WebSocketRoute,
  type WebSocketSubscriberDefinition,
  type WebSocketSubscriberHandlerContext,
  type WebSocketSubscriberMatcher,
  type WebSocketType,
} from './websocket.interface.js';
import type RedisInstance from '../redis/instance.js';
import type QueueManager from '../queue/manager.js';
import type DatabaseInstance from '../database/instance.js';
import type { WebSocketServerProps } from './websocket-server.interface.js';
import WebSocketClientManager from './websocket-client-manager.js';
import { generateClientId, log } from './utils.js';
import WebSocketBase from './websocket-base.js';
import { Logger } from '../logger/index.js';
import path from 'path';
import { type WebApplicationConfig, baseDir } from '../index.js';
import WebSocketRoomManager from './websocket-room-manager.js';
import logger from '../logger/logger.js';
import type { FastifyInstance } from 'fastify';
import { WebSocketAuthService } from './websocket-auth.js';
import { File, Loader } from '../util/index.js';
import { executeWithMiddleware } from './subscriber-middleware.js';
import { runWithContextAsync } from '../request-context/index.js';

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

  private abortController = new AbortController();
  private workerId: number | null;
  private uniqueInstanceId: string;
  private applicationConfig: WebApplicationConfig;
  private options: WebSocketOptions;
  public clientManager = new WebSocketClientManager();
  private roomManager = new WebSocketRoomManager({
    clientManager: this.clientManager,
  });
  private authService: WebSocketAuthService;

  public get rooms() {
    return this.roomManager.rooms;
  }
  private redisInstance: RedisInstance;
  private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance;
  private subscriberHandlersByChannel: Map<string, WebSocketSubscriberDefinition[]> = new Map();
  private subscriberMatcherHandlers: WebSocketSubscriberDefinition[] = [];
  private wildcardSubscriberHandlers: WebSocketSubscriberDefinition[] = [];

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
    this.authService = new WebSocketAuthService(props.applicationConfig);
  }

  public get type(): WebSocketType {
    return 'server';
  }

  private async validateWebSocketAuth(
    url: string,
  ): Promise<{ userId: number; payload: Record<string, unknown> } | null> {
    return this.authService.validateAuth(url);
  }

  public async load(): Promise<void> {
    const libraryControllersDirectory = path.join(baseDir, 'websocket', 'controllers', 'server');

    // Configure default routes
    await this.configureRoutes(this.defaultRoutes, libraryControllersDirectory);

    // Configure custom routes
    await this.configureRoutes(this.routes, this.options.controllersDirectory);

    await this.loadSubscriberHandlers();
  }

  private async loadSubscriberHandlers(): Promise<void> {
    this.subscriberHandlersByChannel.clear();
    this.subscriberMatcherHandlers = [];
    this.wildcardSubscriberHandlers = [];

    const config = this.options.subscriberHandlers;

    if (!config) {
      return;
    }

    const definitions: WebSocketSubscriberDefinition[] = [];

    if (config.directory) {
      const directoryExists = await File.pathExists(config.directory);

      if (!directoryExists) {
        logger.warn('WebSocket subscriber handlers directory not found', {
          Directory: config.directory,
        });
      } else {
        const modules = await Loader.loadModulesInDirectory<unknown>({
          directory: config.directory,
          extensions: ['.ts', '.js'],
        });

        for (const [moduleName, moduleExport] of Object.entries(modules)) {
          definitions.push(
            ...this.normalizeSubscriberExport(moduleExport, {
              source: 'file',
              moduleName,
              directory: config.directory,
            }),
          );
        }
      }
    }

    if (Array.isArray(config.handlers)) {
      for (const handler of config.handlers) {
        definitions.push(
          ...this.normalizeSubscriberExport(handler, {
            source: 'inline',
          }),
        );
      }
    }

    for (const definition of definitions) {
      this.registerSubscriberDefinition(definition);
    }

    if (definitions.length > 0) {
      logger.info('WebSocket subscriber handlers loaded', {
        Channels: Array.from(this.subscriberHandlersByChannel.keys()),
        Matchers: this.subscriberMatcherHandlers.length,
        Wildcards: this.wildcardSubscriberHandlers.length,
      });
    }
  }

  private normalizeSubscriberExport(
    value: unknown,
    metadata: { source: 'file' | 'inline'; moduleName?: string; directory?: string },
  ): WebSocketSubscriberDefinition[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.flatMap(entry => this.normalizeSubscriberExport(entry, metadata));
    }

    if (typeof value === 'function') {
      const moduleChannel = metadata.moduleName ?? value.name ?? 'anonymous';

      return [
        {
          name: metadata.moduleName ?? value.name,
          channels: [moduleChannel],
          handle: async context => {
            await value(context);
          },
        },
      ];
    }

    if (typeof value === 'object') {
      const definition = this.normalizeSubscriberObject(value as Record<string, unknown>, metadata);
      if (definition) {
        return [definition];
      }

      return Object.values(value as Record<string, unknown>).flatMap(entry =>
        this.normalizeSubscriberExport(entry, metadata),
      );
    }

    return [];
  }

  private normalizeSubscriberObject(
    value: Record<string, unknown>,
    metadata: { source: 'file' | 'inline'; moduleName?: string },
  ): WebSocketSubscriberDefinition | null {
    const handle = value.handle;

    if (typeof handle !== 'function') {
      return null;
    }

    let channelSource: unknown;
    if (Object.prototype.hasOwnProperty.call(value, 'channel')) {
      channelSource = value.channel;
    } else if (Object.prototype.hasOwnProperty.call(value, 'channels')) {
      channelSource = value.channels;
    }

    const channels = this.normalizeChannels(channelSource);

    let matcherSource: unknown;
    if (Object.prototype.hasOwnProperty.call(value, 'match')) {
      matcherSource = value.match;
    } else if (Object.prototype.hasOwnProperty.call(value, 'matcher')) {
      matcherSource = value.matcher;
    } else if (Object.prototype.hasOwnProperty.call(value, 'matchers')) {
      matcherSource = value.matchers;
    }

    const matchers = this.normalizeMatchers(matcherSource);

    if (channels.length === 0 && matchers.length === 0) {
      logger.warn('Skipping WebSocket subscriber handler without channels or matchers', {
        Source: metadata.source,
        Module: metadata.moduleName,
      });

      return null;
    }

    const definition: WebSocketSubscriberDefinition = {
      name: typeof value.name === 'string' ? value.name : metadata.moduleName,
      description: typeof value.description === 'string' ? value.description : undefined,
      priority: typeof value.priority === 'number' ? value.priority : undefined,
      channels,
      matchers,
      handle: handle as (context: WebSocketSubscriberHandlerContext) => unknown | Promise<unknown>,
    };

    return definition;
  }

  private normalizeChannels(input: unknown): string[] {
    if (typeof input === 'string') {
      const trimmed = input.trim();
      return trimmed.length > 0 ? [trimmed] : [];
    }

    if (Array.isArray(input)) {
      return input
        .filter((channel): channel is string => typeof channel === 'string')
        .map(channel => channel.trim())
        .filter(channel => channel.length > 0);
    }

    return [];
  }

  private normalizeMatchers(input: unknown): WebSocketSubscriberMatcher[] {
    if (!input) {
      return [];
    }

    const matchers: WebSocketSubscriberMatcher[] = [];
    const addMatcher = (matcher: unknown) => {
      if (matcher instanceof RegExp || typeof matcher === 'function') {
        matchers.push(matcher as WebSocketSubscriberMatcher);
      } else if (typeof matcher === 'string') {
        const trimmed = matcher.trim();
        if (trimmed.length > 0) {
          matchers.push(trimmed as WebSocketSubscriberMatcher);
        }
      }
    };

    if (Array.isArray(input)) {
      input.forEach(addMatcher);
    } else {
      addMatcher(input);
    }

    return matchers;
  }

  private registerSubscriberDefinition(definition: WebSocketSubscriberDefinition): void {
    const normalizedPriority = definition.priority ?? 0;
    const channels = definition.channels?.map(channel => channel.trim()).filter(Boolean) ?? [];

    const normalizedDefinition: WebSocketSubscriberDefinition = {
      ...definition,
      priority: normalizedPriority,
      channels,
      matchers: definition.matchers ?? [],
    };

    if (channels.length === 0 && normalizedDefinition.matchers?.length === 0) {
      logger.warn('Skipping WebSocket subscriber handler registration due to missing filters', {
        Handler: definition.name ?? '(anonymous)',
      });

      return;
    }

    if (channels.length > 0) {
      for (const channel of channels) {
        if (channel === '*') {
          this.wildcardSubscriberHandlers.push(normalizedDefinition);
          continue;
        }

        const channelHandlers = this.subscriberHandlersByChannel.get(channel) ?? [];
        channelHandlers.push(normalizedDefinition);
        this.subscriberHandlersByChannel.set(channel, channelHandlers);
      }
    }

    if (normalizedDefinition.matchers && normalizedDefinition.matchers.length > 0) {
      this.subscriberMatcherHandlers.push(normalizedDefinition);
    }
  }

  private doesDefinitionMatch(
    definition: WebSocketSubscriberDefinition,
    context: WebSocketSubscriberHandlerContext,
  ): boolean {
    if (!definition.matchers || definition.matchers.length === 0) {
      return false;
    }

    return definition.matchers.some(matcher => this.evaluateMatcher(matcher, context));
  }

  private evaluateMatcher(matcher: WebSocketSubscriberMatcher, context: WebSocketSubscriberHandlerContext): boolean {
    if (typeof matcher === 'string') {
      if (matcher === '*') {
        return true;
      }

      return matcher === context.channel;
    }

    if (matcher instanceof RegExp) {
      return matcher.test(context.channel);
    }

    try {
      return Boolean(matcher(context));
    } catch (error) {
      logger.error({
        error,
        message: 'WebSocket subscriber matcher threw an error',
        meta: {
          Channel: context.channel,
          Matcher: String(matcher),
        },
      });

      return false;
    }
  }

  private async executeSubscriberHandlers(channel: string, message: any): Promise<void> {
    if (
      this.subscriberHandlersByChannel.size === 0 &&
      this.subscriberMatcherHandlers.length === 0 &&
      this.wildcardSubscriberHandlers.length === 0
    ) {
      return;
    }

    const context: WebSocketSubscriberHandlerContext = {
      channel,
      message,
      webSocketServer: this,
      databaseInstance: this.databaseInstance,
      redisInstance: this.redisInstance,
      queueManager: this.queueManager,
    };

    const candidates = new Set<WebSocketSubscriberDefinition>();

    const channelHandlers = this.subscriberHandlersByChannel.get(channel);

    if (channelHandlers) {
      channelHandlers.forEach(handler => candidates.add(handler));
    }

    this.wildcardSubscriberHandlers.forEach(handler => candidates.add(handler));

    for (const definition of this.subscriberMatcherHandlers) {
      if (this.doesDefinitionMatch(definition, context)) {
        candidates.add(definition);
      }
    }

    if (candidates.size === 0) {
      return;
    }

    const orderedHandlers = Array.from(candidates).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    for (const handlerDef of orderedHandlers) {
      try {
        // Execute handler with middleware if available
        if (handlerDef.middleware && handlerDef.middleware.length > 0) {
          await executeWithMiddleware(handlerDef.handle, handlerDef.middleware, context);
        } else {
          await handlerDef.handle(context);
        }
      } catch (error) {
        logger.error({
          error,
          message: 'WebSocket subscriber handler failed',
          meta: {
            Handler: handlerDef.name ?? '(anonymous)',
            Channel: channel,
          },
        });
      }
    }
  }

  public async start({ fastifyServer }: { fastifyServer: FastifyInstance }): Promise<{ server: WS }> {
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
            const authenticatedUser = await this.validateWebSocketAuth(request.url);

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
        (ws: WebSocket, request: any, authenticatedUser: { userId: number; payload: any } | null) => {
          this.handleServerClientConnection(ws, authenticatedUser);
        },
      );

      // Resolve the promise with the server instance
      resolve({ server });
    });
  }

  public async stop(): Promise<void> {
    // Abort all ongoing operations (intervals, etc.)
    this.abortController.abort();

    // Clean up Redis subscriber listeners
    this.redisInstance.subscriberClient?.removeListener('message', this.handleSubscriberMessage);

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

    // Create new AbortController for potential restart
    this.abortController = new AbortController();

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

    if (this.options.disconnectInactiveClients?.enabled && this.options.disconnectInactiveClients.intervalCheckTime) {
      // Note: setInterval with signal option requires Node.js 15+
      // TypeScript types may not reflect this, so we use type assertion
      (setInterval as (fn: () => void, ms: number, options?: { signal: AbortSignal }) => NodeJS.Timeout)(
        () => this.checkInactiveClients(),
        this.options.disconnectInactiveClients.intervalCheckTime,
        { signal: this.abortController.signal },
      );
    }

    // Go through each event and subscribe to it
    this.redisSubscriberEvents.forEach(subscriberEventName => {
      // Subscribe to event
      this.redisInstance.subscriberClient?.subscribe(subscriberEventName);
    });

    // Handle subscriber message
    this.redisInstance.subscriberClient.on('message', this.handleSubscriberMessage);

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
  private handleSubscriberMessage = async (channel: string, message: string): Promise<void> => {
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

    const includeSender = parsedMessage.includeSender === true;

    const isSameWorker = parsedMessage.workerId === this.workerId;

    // Check if message is from the same worker
    if (includeSender !== true && isSameWorker) {
      // Ignore the message if it's from the same worker
      return;
    }

    log('Incoming subscriber message', {
      Channel: channel,
      // 'Run Same Worker': parsedMessage.includeSender ? 'Yes' : 'No',
      'Client ID': parsedMessage.clientId ?? '-',
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

        if (clientToDisconnect) {
          this.clientManager.disconnectClient({
            clientId: parsedMessage.clientId,
          });

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

        break;
      }
      case WebSocketRedisSubscriberEvent.QueueJobError: {
        // For queue job errors, merge error information into data field
        parsedMessage.data = {
          ...(parsedMessage.data ?? {}),
          error: parsedMessage.error,
        };

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

    await this.executeSubscriberHandlers(channel, parsedMessage);
  };

  private handleServerError = (error: Error): void => {
    Logger.error({ error });
  };

  private handleServerClientConnection = (
    ws: WebSocket,
    authenticatedUser?: { userId: number; payload: any } | null,
  ): void => {
    const clientId = generateClientId();

    const lastActivity = Date.now();

    ws.on('message', (message: RawData) => this.handleClientMessage(ws, message));

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
      logger.error({ error });
    }
  };

  public leaveRoom({ ws, roomName }: { ws: WebSocket; roomName: string }): void {
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

  private handleClientMessage = async (ws: WebSocket, message: RawData): Promise<void> => {
    // Run without request context to prevent inheriting HTTP upgrade requestId
    return runWithContextAsync(undefined, async () => {
      try {
        const clientId = this.clientManager.getClientId({
          ws,
        });

        if (!clientId) {
          log('Client ID not found when handling server message');

          return;
        }

        // Handle server message
        const serverMessageResponse = await this.handleServerMessage(ws, message, clientId);

        if (serverMessageResponse) {
          this.sendClientMessage(ws, {
            type: serverMessageResponse.type,
            action: serverMessageResponse.action,
            response: serverMessageResponse?.response,
          });

          if (
            serverMessageResponse?.response &&
            typeof serverMessageResponse.response === 'object' &&
            'error' in serverMessageResponse.response
          ) {
            // Log error but don't throw to prevent connection disruption
            Logger.error({
              error: serverMessageResponse.response.error,
              meta: {
                clientId,
                type: serverMessageResponse.type,
                action: serverMessageResponse.action,
              },
            });
          }
        }
      } catch (error) {
        Logger.error({ error });

        log('Error handling client message', {
          Error: error,
        });
      }
    });
  };

  protected handleMessageError(clientId: string, error: string): void {
    this.redisInstance.publisherClient.publish(
      WebSocketRedisSubscriberEvent.MessageError,
      JSON.stringify({
        includeSender: true,
        clientId,
        error,
      }),
    );
  }

  /**
   * Check and disconnect inactive clients based on configuration
   * This helps prevent stale connections from accumulating
   */
  private checkInactiveClients(): void {
    const config = this.options.disconnectInactiveClients;

    if (!config?.enabled || !config.inactiveTime) {
      return;
    }

    if (config.log) {
      log('Checking inactive clients...');
    }

    const now = Date.now();
    const clients = this.clientManager.getClients();

    for (const client of clients) {
      const inactiveTime = now - client.lastActivity;

      if (inactiveTime > config.inactiveTime) {
        this.clientManager.disconnectClient(client.clientId);

        if (config.log) {
          log('Disconnected inactive client', {
            'Client ID': client.clientId,
            'Inactive Time': `${inactiveTime}ms`,
          });
        }
      }
    }
  }

  /**
   * Broadcast a message to all connected WebSocket clients
   * @param data - The data to broadcast (will be JSON stringified)
   * @param excludeClientId - Optional client ID to exclude from broadcast
   * @param predicate - Optional function to filter clients
   */
  public broadcastToAllClients({
    data,
    excludeClientId,
    predicate,
  }: {
    data: { [key: string]: any };
    excludeClientId?: string;
    predicate?: (clientData: { clientId: string; userData: any }) => boolean;
  }): void {
    if (!this.server) {
      log('Server not started when broadcasting to all clients');
      return;
    }

    for (const client of this.server.clients) {
      if (client.readyState !== WebSocket.OPEN) {
        continue;
      }

      const clientId = this.clientManager.getClientId({ ws: client });

      // Skip excluded client if specified
      if (excludeClientId && clientId === excludeClientId) {
        continue;
      }

      // Apply custom predicate filter
      if (predicate && clientId) {
        const clientData = this.clientManager.getClient({ clientId });
        if (!clientData || !predicate({ clientId, userData: clientData.user })) {
          continue;
        }
      }

      client.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast a message to all clients in a specific room
   * @param roomName - The room to broadcast to
   * @param data - The data to broadcast
   * @param excludeClientId - Optional client ID to exclude from broadcast
   */
  public broadcastToRoom({
    roomName,
    data,
    excludeClientId,
  }: {
    roomName: string;
    data: { [key: string]: any };
    excludeClientId?: string;
  }): void {
    if (!this.server) {
      log('Server not started when broadcasting to room', { roomName });
      return;
    }

    const room = this.roomManager.rooms.get(roomName);
    if (!room) {
      log('Room not found when broadcasting', { roomName });
      return;
    }

    for (const clientId of room) {
      if (excludeClientId && clientId === excludeClientId) {
        continue;
      }

      const client = this.clientManager.getClient({ clientId });
      if (!client?.ws || client.ws.readyState !== WebSocket.OPEN) {
        continue;
      }

      client.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast a message to specific users
   * @param userIds - Array of user IDs to broadcast to
   * @param data - The data to broadcast
   */
  public broadcastToUsers({ userIds, data }: { userIds: (string | number)[]; data: { [key: string]: any } }): void {
    if (!this.server) {
      log('Server not started when broadcasting to users');
      return;
    }

    const userIdSet = new Set(userIds.map(id => String(id)));

    for (const client of this.server.clients) {
      if (client.readyState !== WebSocket.OPEN) {
        continue;
      }

      const clientId = this.clientManager.getClientId({ ws: client });
      const clientData = clientId ? this.clientManager.getClient({ clientId }) : null;

      if (!clientData?.user) {
        continue;
      }

      const clientUserId = String(clientData.user.id ?? clientData.user.userId);

      if (userIdSet.has(clientUserId)) {
        client.send(JSON.stringify(data));
      }
    }
  }

  /**
   * Broadcast a message to a specific client
   * @param clientId - The client ID to send to
   * @param data - The data to send
   */
  public broadcastToClient({ clientId, data }: { clientId: string; data: { [key: string]: any } }): void {
    const client = this.clientManager.getClient({ clientId });

    if (!client?.ws || client.ws.readyState !== WebSocket.OPEN) {
      log('Client not found or not connected when broadcasting to specific client', {
        clientId,
      });
      return;
    }

    client.ws.send(JSON.stringify(data));
  }

  public sendMessageError({ webSocketClientId, error }: { webSocketClientId: string; error: string }): void {
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

  private onJoinRoom({ clientId, roomName, userData }: { clientId: string; roomName: string; userData: any }): void {
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

    // Check if client can join multiple rooms
    const canJoinMultipleRooms = this.options.rooms?.clientCanJoinMultipleRooms ?? true;

    if (!canJoinMultipleRooms && client.roomName) {
      // Remove client from current room before joining new one
      this.roomManager.removeClientFromRoom({
        roomName: client.roomName,
        clientId,
        broadcast: false, // Don't broadcast here, will broadcast after adding to new room
      });
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
      // throw new Error('Client ID not found when joining room');

      logger.warn({
        message: 'Client ID not found when joining room',
        meta: {
          // 'WebSocket ID': ws?.id || '-',
          'Room Name': roomName,
        },
      });

      return;
    }

    // Check if client is already in room
    const isClientInRoom = this.roomManager.isClientInRoom({
      clientId,
      roomName,
    });

    if (isClientInRoom) {
      // throw new Error('Client already in room when joining');

      logger.warn({
        message: 'Client already in room when joining',
        meta: {
          // 'WebSocket ID': ws?. || '-',
          'Room Name': roomName,
          'Client ID': clientId,
        },
      });

      return;
    }

    let userData: any = {};

    // // Get WebSocket client ID
    // const webSocketId = this.clientManager.getClientId({ ws });

    if (userId) {
      // Get user email from database
      const dbEntityManager = this.databaseInstance.getEntityManager();

      const getUserQuery = 'SELECT email FROM users WHERE id = ?';
      const getUserParams = [userId];

      const getUserResult = await dbEntityManager.execute(getUserQuery, getUserParams);

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

  public sendClientMessage = (ws: WebSocket, data: unknown, binary: boolean = false): void => {
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

    this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.Custom, JSON.stringify(formattedData));
  };

  public getClients({ userType }: { userType?: string }): any[] {
    return this.clientManager.getClients({ userType });
  }
}
