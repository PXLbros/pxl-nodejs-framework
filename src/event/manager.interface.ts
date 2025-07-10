// event-manager.interface.ts
import { ApplicationConfig } from '../application/base-application.interface.js';
import { RedisInstance } from '../redis/index.js';
import { DatabaseInstance } from '../database/index.js';
import { EventControllerType } from './controller/base.interface.js';

export interface EventDefinition {
  name: string;
  handlerName: string;
  controllerName?: string;
  controller?: EventControllerType;
}

export interface ApplicationEvents {
  // Application lifecycle events
  'application:started': {
    instanceId: string;
    timestamp: Date;
    config: ApplicationConfig;
  };
  'application:stopping': {
    instanceId: string;
    timestamp: Date;
    reason?: string;
  };
  'application:stopped': {
    instanceId: string;
    timestamp: Date;
    exitCode?: number;
  };

  // Database events
  'database:connected': {
    instanceId: string;
    timestamp: Date;
    connectionInfo: {
      host: string;
      port: number;
      database: string;
    };
  };
  'database:disconnected': {
    instanceId: string;
    timestamp: Date;
    reason?: string;
  };
  'database:error': {
    instanceId: string;
    timestamp: Date;
    error: Error;
  };

  // Redis events
  'redis:connected': {
    instanceId: string;
    timestamp: Date;
    connectionInfo: {
      host: string;
      port: number;
    };
  };
  'redis:disconnected': {
    instanceId: string;
    timestamp: Date;
    reason?: string;
  };
  'redis:error': {
    instanceId: string;
    timestamp: Date;
    error: Error;
  };

  // Queue events
  'queue:job:added': {
    instanceId: string;
    timestamp: Date;
    queueId: string;
    jobId: string;
    data: Record<string, unknown>;
  };
  'queue:job:completed': {
    instanceId: string;
    timestamp: Date;
    queueId: string;
    jobId: string;
    result?: unknown;
    processingTime: number;
  };
  'queue:job:failed': {
    instanceId: string;
    timestamp: Date;
    queueId: string;
    jobId: string;
    error: Error;
    attemptsMade: number;
    attemptsRemaining: number;
  };

  // WebSocket events
  'websocket:client:connected': {
    instanceId: string;
    timestamp: Date;
    clientId: string;
    remoteAddress?: string;
  };
  'websocket:client:disconnected': {
    instanceId: string;
    timestamp: Date;
    clientId: string;
    reason?: string;
  };
  'websocket:message:received': {
    instanceId: string;
    timestamp: Date;
    clientId: string;
    messageType: string;
    action: string;
    data?: Record<string, unknown>;
  };
  'websocket:message:sent': {
    instanceId: string;
    timestamp: Date;
    clientId: string;
    messageType: string;
    action: string;
    data?: Record<string, unknown>;
  };

  // Custom events (extensible)
  [key: string]: Record<string, unknown>;
}

// export type EventControllerType = new (params: EventControllerConstructorParams) => any;

// export interface EventControllerConstructorParams {
//   applicationConfig: ApplicationConfig;
//   redisInstance: RedisInstance;
//   // queueManager: QueueManager;
//   databaseInstance: DatabaseInstance | null;
// }

export interface EventManagerOptions {
  controllersDirectory: string;
  log?: {
    startUp?: boolean;
  };
  debug?: {
    printEvents?: boolean;
  };
}

export interface EventManagerConstructorParams {
  applicationConfig: ApplicationConfig;
  options: EventManagerOptions;
  events: EventDefinition[];
  redisInstance: RedisInstance;
  // queueManager: QueueManager;
  databaseInstance: DatabaseInstance | null;
}
