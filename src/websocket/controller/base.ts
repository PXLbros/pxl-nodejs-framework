import RedisInstance from '../../redis/instance.js';
import QueueManager from '../../queue/manager.js';
import DatabaseInstance from '../../database/instance.js';
import { WebSocketBaseControllerConstructorParams } from './base.interface.js';
import WebSocketServer from '../websocket-server.js';
import WebSocketClient from '../websocket-client.js';

export default abstract class {
  protected webSocketServer?: WebSocketServer;
  protected webSocketClient?: WebSocketClient;
  protected redisInstance: RedisInstance;
  protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  constructor({ webSocketServer, webSocketClient, redisInstance, queueManager, databaseInstance }: WebSocketBaseControllerConstructorParams) {
    this.webSocketServer = webSocketServer;
    this.webSocketClient = webSocketClient;
    this.redisInstance = redisInstance;
    this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;
  }
}
