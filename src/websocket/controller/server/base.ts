import DatabaseInstance from '../../../database/instance.js';
import QueueManager from '../../../queue/manager.js';
import { RedisInstance } from '../../../redis/index.js';
import WebSocketServer from '../../websocket-server.js';
import { WebSocketServerBaseControllerConstructorParams } from './base.interface.js';

export default abstract class WebSocketServerBaseController {
  protected sendMessage: (data: unknown) => void;

  protected redisInstance: RedisInstance;
  protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  constructor({ sendMessage, redisInstance, queueManager, databaseInstance }: WebSocketServerBaseControllerConstructorParams) {
    this.sendMessage = sendMessage;

    this.redisInstance = redisInstance;
    this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;
  }
}
