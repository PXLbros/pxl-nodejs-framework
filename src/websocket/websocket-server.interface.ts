import DatabaseInstance from '../database/instance.js';
import QueueManager from '../queue/manager.js';
import { RedisInstance } from '../redis/index.js';
import { WebSocketOptions, WebSocketRoute } from './websocket.interface.js';

export interface WebSocketServerProps {
  options: WebSocketOptions;
  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
  routes: WebSocketRoute[];
  workerId: number;
}
