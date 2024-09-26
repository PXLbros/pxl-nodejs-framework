// event-manager.interface.ts
import { ApplicationConfig } from '../application/base-application.interface.js';
import { RedisInstance } from '../redis/index.js';
import { QueueManager } from '../queue/index.js';
import { DatabaseInstance } from '../database/index.js';
import { Logger } from '../logger/logger.js';
import { EventControllerType } from './controller/base.interface.js';

export interface EventDefinition {
  name: string;
  handlerName: string;
  controllerName?: string;
  controller?: EventControllerType;
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
