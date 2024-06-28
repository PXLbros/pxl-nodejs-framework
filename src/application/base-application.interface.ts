import { ClusterManagerConfig } from '../cluster/cluster-manager.interface.js';
import { QueueItem } from '../queue/index.interface.js';
import { WebServerDebugOptions, WebServerLogConfig, WebServerOptions, WebServerRoute } from '../webserver/webserver.interface.js';
import { WebSocketOptions, WebSocketRoute } from '../websocket/websocket.interface.js';
import BaseApplication from './base-application.js';
import CommandApplication from './command-application.js';
import WebApplication from './web-application.js';

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

export interface ApplicationWebSocketConfig extends WebSocketOptions {
  isServer?: boolean;

  /** Whether to enable WebSocket */
  enabled: boolean;

  /** WebSocket routes */
  routes: WebSocketRoute[];
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

  /** Root directory */
  rootDirectory: string;

  /** Cluster configuration */
  cluster?: ClusterManagerConfig;

  /** Redis configuration */
  redis: ApplicationRedisConfig;

  /** Cache configuration */
  cache: ApplicationCacheConfig;

  /** Database configuration */
  database: ApplicationDatabaseConfig;

  /** Queue configuration */
  queue: ApplicationQueueConfig;

  /** Log configuration */
  log?: ApplicationLogConfig;
}
