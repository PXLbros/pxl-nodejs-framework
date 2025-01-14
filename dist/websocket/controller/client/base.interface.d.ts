import DatabaseInstance from '../../../database/instance.js';
import QueueManager from '../../../queue/manager.js';
import { RedisInstance } from '../../../redis/index.js';
import WebSocketBaseController from './base.js';
export interface WebSocketClientBaseControllerConstructorParams {
    sendMessage: (data: unknown) => void;
    redisInstance: RedisInstance;
    queueManager: QueueManager;
    databaseInstance: DatabaseInstance;
}
export type WebSocketClientBaseControllerType = new (params: WebSocketClientBaseControllerConstructorParams) => WebSocketBaseController;
//# sourceMappingURL=base.interface.d.ts.map