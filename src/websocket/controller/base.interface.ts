import DatabaseInstance from '../../database/instance.js';
import QueueManager from '../../queue/manager.js';
import RedisInstance from '../../redis/instance.js';
import WebSocketBaseController from './base.js';
import WebSocketServer from '../websocket-server.js';
import WebSocketClient from '../websocket-client.js';

export interface WebSocketBaseControllerConstructorParams {
  webSocketServer?: WebSocketServer;
  webSocketClient?: WebSocketClient;
  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export type WebSocketBaseControllerType = new (params: WebSocketBaseControllerConstructorParams) => WebSocketBaseController;
