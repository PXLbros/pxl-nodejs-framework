import type DatabaseInstance from '../../../database/instance.js';
import type QueueManager from '../../../queue/manager.js';
import type { RedisInstance } from '../../../redis/index.js';
import type WebSocketBaseController from './base.js';

export interface WebSocketClientBaseControllerConstructorParams {
  // webSocketClient?: webSocketClient;
  sendMessage: (data: unknown) => void;

  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export type WebSocketClientBaseControllerType = new (
  params: WebSocketClientBaseControllerConstructorParams,
) => WebSocketBaseController;
