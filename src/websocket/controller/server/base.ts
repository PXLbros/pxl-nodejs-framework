import type DatabaseInstance from '../../../database/instance.js';
import type QueueManager from '../../../queue/manager.js';
import type { RedisInstance } from '../../../redis/index.js';
import type WebSocketServer from '../../websocket-server.js';
import type { WebSocketServerBaseControllerConstructorParams } from './base.interface.js';

export default abstract class WebSocketServerBaseController {
  protected webSocketServer: WebSocketServer;
  protected redisInstance: RedisInstance;
  protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  constructor({
    webSocketServer,
    redisInstance,
    queueManager,
    databaseInstance,
  }: WebSocketServerBaseControllerConstructorParams) {
    this.webSocketServer = webSocketServer;
    this.redisInstance = redisInstance;
    this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;
  }
}
