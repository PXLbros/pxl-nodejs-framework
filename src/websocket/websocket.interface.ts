import { WebSocket } from 'ws';
import DatabaseInstance from '../database/instance.js';
import QueueManager from '../queue/manager.js';
import RedisInstance from '../redis/instance.js';

export interface WebSocketOptions {
  host: string;
  port: number;
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

export interface WebSocketConnectedClientData {
  ws: WebSocket | null;
  lastActivity: number;
  userName?: string;
}
