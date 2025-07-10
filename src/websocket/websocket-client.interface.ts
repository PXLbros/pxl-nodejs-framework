import { ApplicationConfig } from '../application/base-application.interface.js';
import DatabaseInstance from '../database/instance.js';
import QueueManager from '../queue/manager.js';
import { RedisInstance } from '../redis/index.js';
import { WebSocketOptions, WebSocketRoute } from './websocket.interface.js';

export interface WebSocketClientProps {
  applicationConfig: ApplicationConfig;
  options: WebSocketOptions;
  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
  routes: WebSocketRoute[];
}
