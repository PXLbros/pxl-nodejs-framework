import RedisInstance from '../../redis/instance.js';
import QueueManager from '../../queue/manager.js';
import DatabaseInstance from '../../database/instance.js';
import { WebSocketBaseControllerConstructorParams } from './base.interface.js';
import { WebSocket } from '../index.js';

export default abstract class {
  protected webSocket: WebSocket;
  protected redisInstance: RedisInstance;
  protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  constructor({ webSocket, redisInstance, queueManager, databaseInstance }: WebSocketBaseControllerConstructorParams) {
    this.webSocket = webSocket;
    this.redisInstance = redisInstance;
    this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;
  }
}
