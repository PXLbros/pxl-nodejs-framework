import { ClusterManagerConfig } from '../cluster/cluster-manager.interface.js';
import { QueueJob } from '../queue/job.interface.js';
import { QueueManagerOptions } from '../queue/manager.interface.js';
import { WebServerRoute } from '../webserver/webserver.interface.js';
import { WebSocketRoute } from '../websocket/websocket.interface.js';

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
}

export interface ApplicationWebSocketConfig {
  /** Whether to enable WebSocket */
  enabled: boolean;

  /** WebSocket host */
  host: string;

  /** WebSocket port */
  port: number;

  /** WebSocket controllers directory */
  controllersDirectory: string;

  /** WebSocket routes */
  routes: WebSocketRoute[];
}

export interface ApplicationWebServerConfig {
  /** Whether to enable web server */
  enabled: boolean;

  /** Web server host */
  host: string;

  /** Web server port */
  port: number;

  /** Web server controllers directory */
  controllersDirectory: string;

  /** Web server routes */
  routes: WebServerRoute[];
}

export interface ApplicationQueueConfig {
  /** Queue processors directory */
  processorsDirectory: string;

  /** Queue jobs */
  jobs: QueueJob[];
}

export interface ApplicationConfig {
  /** Application name */
  name: string;

  /** Cluster configuration */
  cluster?: ClusterManagerConfig;

  /** Redis configuration */
  redis: ApplicationRedisConfig;

  /** Database configuration */
  database: ApplicationDatabaseConfig;

  /** WebSocket configuration */
  webSocket?: ApplicationWebSocketConfig;

  /** Web server configuration */
  webServer?: ApplicationWebServerConfig;

  /** Queue configuration */
  queue: ApplicationQueueConfig;
}
