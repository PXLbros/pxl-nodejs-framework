import DatabaseInstance from '../../../database/instance.js';
import QueueManager from '../../../queue/manager.js';
import { RedisInstance } from '../../../redis/index.js';
import WebSocketServer from '../../websocket-server.js';
import WebSocketBaseController from './base.js';

export interface WebSocketServerBaseControllerConstructorParams {
  // webSocketServer?: WebSocketServer;
  sendMessage: (data: unknown) => void;

  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export type WebSocketServerBaseControllerType = new (params: WebSocketServerBaseControllerConstructorParams) => WebSocketBaseController;
