import type { WebSocket, WebSocketServer } from 'ws';
import type DatabaseInstance from '../database/instance.js';
import type QueueManager from '../queue/manager.js';
import type RedisInstance from '../redis/instance.js';
import type { WebSocketServerBaseControllerType } from './controller/server/base.interface.js';
import type { WebSocketClientBaseControllerType } from './controller/client/base.interface.js';

export type WebSocketType = 'server' | 'client';

export interface WebSocketDebugOptions {
  printRoutes?: boolean;
  printConnectedClients?: 'simple' | 'table';
}

export interface WebSocketEventsConfig {
  onServerStarted?: ({ webSocketServer }: { webSocketServer: WebSocketServer }) => void;
  onConnected?: ({
    ws,
    clientId,
    joinRoom,
  }: {
    ws: WebSocket;
    clientId: string;
    joinRoom({
      userId,
      userType,
      username,
      roomName,
    }: {
      userId?: string;
      userType?: string;
      username?: string;
      roomName: string;
    }): void;
  }) => void;
  onDisconnected?: ({ clientId }: { clientId?: string }) => void;
  onError?: ({ error }: { error: Error }) => void;
  onMessage?: ({
    ws,
    clientId,
    data,
    redisInstance,
    queueManager,
    databaseInstance,
  }: {
    ws: WebSocket;
    clientId: string;
    data: any;
    redisInstance: RedisInstance;
    queueManager: QueueManager;
    databaseInstance: DatabaseInstance;
  }) => void;
}

export interface WebSocketOptions {
  /** WebSocket type */
  type: WebSocketType;

  /** WebSocket host */
  host?: string;

  /** WebSocket URL */
  url: string;

  /** WebSocket controllers directory */
  controllersDirectory: string;

  /** Disconnect inactive WebSocket clients configuration  */
  disconnectInactiveClients?: {
    /** Whether to enable disconnection of inactive WebSocket clients */
    enabled?: boolean;

    /** Interval check time in milliseconds */
    intervalCheckTime?: number;

    /** Inactive time in milliseconds */
    inactiveTime?: number;

    /** Whether to log disconnection of inactive WebSocket clients */
    log?: boolean;
  };

  rooms?: {
    enabled?: boolean;
    clientCanJoinMultipleRooms?: boolean;
  };

  /** WebSocket debug options */
  debug?: WebSocketDebugOptions;

  /** WebSocket events */
  events?: WebSocketEventsConfig;
}

export interface WebSocketRoute {
  /** WebSocket route type */
  type: string;

  /** WebSocket route controller name */
  controllerName: string;

  /** WebSocket route controller */
  controller?: WebSocketServerBaseControllerType | WebSocketClientBaseControllerType;

  /** WebSocket route action */
  action: string;
}

export interface WebSocketConstructorParams {
  /** WebSocket options */
  options: WebSocketOptions;

  /** WebSocket routes */
  routes: WebSocketRoute[];

  /** Redis instance */
  redisInstance: RedisInstance;

  /** Queue manager */
  queueManager: QueueManager;

  /** Database instance */
  databaseInstance: DatabaseInstance;
}

export interface WebSocketConnectedClientData {
  /** WebSocket client */
  ws: WebSocket | null;

  /** Last activity time */
  lastActivity: number;

  /** Client username */
  username?: string;
}

export interface WebSocketMessageResponse {
  error?: string;
}

export interface WebSocketMessageHandler {
  (ws: WebSocket, clientId: string, data: any): WebSocketMessageResponse;
}

export enum WebSocketRedisSubscriberEvent {
  ClientConnected = 'clientConnected',
  ClientDisconnected = 'clientDisconnected',
  DisconnectClient = 'disconnectClient',
  ClientJoinedRoom = 'clientJoinedRoom',
  ClientLeftRoom = 'clientLeftRoom',
  SendMessage = 'sendMessage',
  SendMessageToAll = 'sendMessageToAll',
  MessageError = 'messageError',
  QueueJobCompleted = 'queueJobCompleted',
  QueueJobError = 'queueJobError',
  Custom = 'custom',
}
