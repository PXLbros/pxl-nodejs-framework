import type { ClusterManagerConfig } from '../cluster/cluster-manager.interface.js';
import type DatabaseInstance from '../database/instance.js';
import type { EventDefinition } from '../event/manager.interface.js';
import type { PerformanceMonitorOptions, PerformanceThresholds } from '../performance/performance-monitor.js';
import type { QueueItem } from '../queue/index.interface.js';
import type {
  WebServerDebugOptions,
  WebServerLogConfig,
  WebServerOptions,
  WebServerRoute,
} from '../webserver/webserver.interface.js';
import type WebSocketServer from '../websocket/websocket-server.js';
import type { WebSocketOptions, WebSocketRoute, WebSocketType } from '../websocket/websocket.interface.js';

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

export interface ApplicationEmailConfig {}

export interface ApplicationAuthConfig {
  /** JWT secret key for token verification */
  jwtSecretKey: string;
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
  subscriberEventHandler?: (options: {
    channel: string;
    message: any;
    webSocketServer: WebSocketServer;
    databaseInstance: DatabaseInstance;
  }) => void;
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
  showRequestIdInConsole?: boolean;
}

export interface ApplicationPerformanceConfig extends PerformanceMonitorOptions {
  /** Whether to enable performance monitoring */
  enabled?: boolean;

  /** Performance thresholds for different operations */
  thresholds?: Partial<PerformanceThresholds>;

  /** Whether to monitor HTTP requests */
  monitorHttpRequests?: boolean;

  /** Whether to monitor database operations */
  monitorDatabaseOperations?: boolean;

  /** Whether to monitor WebSocket operations */
  monitorWebSocketOperations?: boolean;

  /** Whether to monitor queue operations */
  monitorQueueOperations?: boolean;

  /** Whether to monitor cache operations */
  monitorCacheOperations?: boolean;

  /** Performance report generation interval in milliseconds */
  reportInterval?: number;

  /** Performance report format: 'simple' for one-line, 'detailed' for multi-line */
  reportFormat?: 'simple' | 'detailed';
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

  /** Performance monitoring configuration */
  performanceMonitoring?: ApplicationPerformanceConfig;

  /** Email configuration */
  email?: ApplicationEmailConfig;

  /** Authentication configuration */
  auth?: ApplicationAuthConfig;
}
