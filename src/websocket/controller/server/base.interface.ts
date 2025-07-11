import type DatabaseInstance from '../../../database/instance.js';
import type QueueManager from '../../../queue/manager.js';
import type { RedisInstance } from '../../../redis/index.js';
import type WebSocketServer from '../../websocket-server.js';
import type WebSocketBaseController from './base.js';

export interface WebSocketServerBaseControllerConstructorParams {
  webSocketServer: WebSocketServer;
  // sendMessage: (data: unknown) => void;
  // setClientJoined: ({
  //   ws,
  //   username,
  // }: {
  //   ws: WebSocket;
  //   username: string;
  // }) => void;

  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export type WebSocketServerBaseControllerType = new (
  params: WebSocketServerBaseControllerConstructorParams,
) => WebSocketBaseController;
