import { WebSocket, WebSocketServer } from 'ws';
import DatabaseInstance from '../database/instance.js';
import QueueManager from '../queue/manager.js';
import RedisInstance from '../redis/instance.js';
import { WebSocketBaseControllerType } from './controller/base.interface.js';

export type WebSocketType = 'client' | 'server';

export interface WebSocketDebugOptions {
  printRoutes?: boolean;
  printConnectedClients?: 'simple' | 'table';
}

export interface WebSocketEventsConfig {
  onServerStarted?: ({ webSocketServer }: { webSocketServer: WebSocketServer }) => void;
  onConnected?: ({ ws, clientId, join }: { ws: WebSocket; clientId: string; join({ username }: { username: string }): void }) => void;
  onDisconnected?: ({ clientId }: { clientId?: string }) => void;
  onError?: ({ error }: { error: Error }) => void;
}

export interface WebSocketOptions {
  /** WebSocket type */
  type: WebSocketType;

  /** WebSocket host */
  host: string;

  /** WebSocket port */
  port: number;

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
  controller?: WebSocketBaseControllerType;

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
  ClientJoined = 'clientJoined',
  SendMessage = 'sendMessage',
  SendMessageToAll = 'sendMessageToAll',
  MessageError = 'messageError',
  QueueJobCompleted = 'queueJobCompleted',
  QueueJobError = 'queueJobError',
}
