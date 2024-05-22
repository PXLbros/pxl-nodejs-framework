import DatabaseInstance from '../../database/instance.js';
import QueueManager from '../../queue/manager.js';
import RedisInstance from '../../redis/instance.js';
import WebSocketBaseController from './base.js';
import { WebSocket } from '../index.js';

export interface WebSocketBaseControllerConstructorParams {
  webSocket: WebSocket;
  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export type WebSocketBaseControllerType = new (params: WebSocketBaseControllerConstructorParams) => WebSocketBaseController;
