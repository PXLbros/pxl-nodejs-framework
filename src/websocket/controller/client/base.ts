import type DatabaseInstance from '../../../database/instance.js';
import type QueueManager from '../../../queue/manager.js';
import type { RedisInstance } from '../../../redis/index.js';
import type { WebSocketClientBaseControllerConstructorParams } from './base.interface.js';

export default abstract class WebSocketClientBaseController {
  protected sendMessage: (data: unknown) => void;

  protected redisInstance: RedisInstance;
  protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  constructor({
    sendMessage,
    redisInstance,
    queueManager,
    databaseInstance,
  }: WebSocketClientBaseControllerConstructorParams) {
    this.sendMessage = sendMessage;

    this.redisInstance = redisInstance;
    this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;
  }
}
