import DatabaseInstance from '../database/instance.js';
import QueueManager from '../queue/manager.js';
import RedisInstance from '../redis/instance.js';

export interface WebSocketOptions {
  port: number;
  routes: WebSocketRoute[];
}

export interface WebSocketRoute {
  type: string;
  controllerName: string;
  action: string;
}

export interface WebSocketConstructorParams {
  options: WebSocketOptions;
  routes: WebSocketRoute[];

  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}
