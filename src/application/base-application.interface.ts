import { ClusterManagerConfig } from '../cluster/cluster-manager.interface.js';
import DatabaseInstance from '../database/instance.js';
import { EventDefinition } from '../event/manager.interface.js';
import { QueueItem } from '../queue/index.interface.js';
import { WebServerDebugOptions, WebServerLogConfig, WebServerOptions, WebServerRoute } from '../webserver/webserver.interface.js';
import WebSocketServer from '../websocket/websocket-server.js';
import { WebSocketOptions, WebSocketRoute, WebSocketType } from '../websocket/websocket.interface.js';

export type OnStartedEvent = ({ startupTime }: { startupTime: number }) => void;
export type OnStoppedEvent = ({ runtime }: { runtime: number }) => void;

export interface ApplicationStartInstanceOptions {
  /** On started event */
  onStarted?: OnStartedEvent;
}
export interface ApplicationStopInstanceOptions {
  /** On stopped event */
  onStopped?: OnStoppedEvent;
}

export interface ApplicationRedisConfig {
  /** Redis host */
  host: string;

  /** Redis port */
  port: number;

  /** Redis password */
  password?: string;
}

export interface ApplicationCacheConfig {}

export interface ApplicationDatabaseConfig {
  /** Whether to enable database */
  enabled: boolean;

  /** Database host */
  host: string;

  /** Database port */
  port: number;

  /** Database username */
  username: string;

  /** Database password */
  password: string;

  /** Database name */
  databaseName: string;

  /** Entities directory */
  entitiesDirectory: string;
}

export interface ApplicationQueueConfig {
  /** Initial queues */
  queues: QueueItem[];

  /** Queue processors directory */
  processorsDirectory: string;

  log?: {
    jobRegistered?: boolean;
    jobAdded?: boolean;
    jobCompleted?: boolean;
    queueRegistered?: boolean;
    queuesRegistered?: boolean;
    queueWaiting?: boolean;
  };
}

export interface ApplicationEventConfig {
  /** Whether to enable event system */
  enabled: boolean;

  /** Event controllers directory */
  controllersDirectory: string;

  /** Event definitions */
  events: EventDefinition[];
}

export interface ApplicationEmailConfig {
}

// this.applicationConfig.webSocket.serverMessageHandler(
//   {
//     ws,
//     clientId,
//     parsedMessage,
//   },
// );

export interface ApplicationWebSocketConfig extends WebSocketOptions {
  /** WebSocket type */
  type: WebSocketType;

  /** Whether to enable WebSocket */
  enabled: boolean;

  /** WebSocket routes */
  routes: WebSocketRoute[];

  /** WebSocket server message handler */
  serverMessageHandler?: (options: { ws: WebSocket; clientId: string; parsedMessage: any }) => void;

  /** WebSocket subscriber event handler */
  subscriberEventHandler?: (options: { channel: string; message: any; webSocketServer: WebSocketServer; databaseInstance: DatabaseInstance }) => void;
}

export interface ApplicationWebServerConfig extends WebServerOptions {
  /** Whether to enable web server */
  enabled: boolean;

  // /** Web server host */
  // host: string;

  // /** Web server port */
  // port: number;

  // /** Web server controllers directory */
  // controllersDirectory: string;

  /** Web server routes */
  routes: WebServerRoute[];

  // /** Web server CORS URLs */
  // corsUrls: string[];

  log?: WebServerLogConfig;

  debug: WebServerDebugOptions;
}

export interface ApplicationCommandsConfig {
  commandsDirectory: string;
}

export interface ApplicationLogConfig {
  startUp?: boolean;
  shutdown?: boolean;
}

export interface ApplicationConfig {
  /** Application name */
  name: string;

  /** Application instance ID */
  instanceId: string;

  /** Root directory */
  rootDirectory: string;

  /** Cluster configuration */
  cluster?: ClusterManagerConfig;

  /** Redis configuration */
  redis: ApplicationRedisConfig;

  /** Cache configuration */
  cache?: ApplicationCacheConfig;

  /** Database configuration */
  database?: ApplicationDatabaseConfig;

  /** Queue configuration */
  queue: ApplicationQueueConfig;

  /** Event configuration */
  event?: ApplicationEventConfig;

  /** Log configuration */
  log?: ApplicationLogConfig;

  /** Email configuration */
  email?: ApplicationEmailConfig;
}
