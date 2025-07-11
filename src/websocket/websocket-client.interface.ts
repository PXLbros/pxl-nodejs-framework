import type { ApplicationConfig } from '../application/base-application.interface.js';
import type DatabaseInstance from '../database/instance.js';
import type QueueManager from '../queue/manager.js';
import type { RedisInstance } from '../redis/index.js';
import type { WebSocketOptions, WebSocketRoute } from './websocket.interface.js';

export interface WebSocketClientProps {
  applicationConfig: ApplicationConfig;
  options: WebSocketOptions;
  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
  routes: WebSocketRoute[];
}
