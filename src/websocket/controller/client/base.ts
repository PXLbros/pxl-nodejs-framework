import DatabaseInstance from '../../../database/instance.js';
import QueueManager from '../../../queue/manager.js';
import { RedisInstance } from '../../../redis/index.js';
import webSocketClient from '../../websocket-client.js';
import { WebSocketClientBaseControllerConstructorParams } from './base.interface.js';

export default abstract class WebSocketServerBaseController {
  protected webSocketClient?: webSocketClient;
  protected redisInstance: RedisInstance;
  protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  constructor({ webSocketClient, redisInstance, queueManager, databaseInstance }: WebSocketClientBaseControllerConstructorParams) {
    this.webSocketClient = webSocketClient;
    this.redisInstance = redisInstance;
    this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;
  }
}
