import DatabaseInstance from '../../../database/instance.js';
import QueueManager from '../../../queue/manager.js';
import { RedisInstance } from '../../../redis/index.js';
import { WebSocketClientBaseControllerConstructorParams } from './base.interface.js';
export default abstract class WebSocketServerBaseController {
    protected sendMessage: (data: unknown) => void;
    protected redisInstance: RedisInstance;
    protected queueManager: QueueManager;
    protected databaseInstance: DatabaseInstance;
    constructor({ sendMessage, redisInstance, queueManager, databaseInstance }: WebSocketClientBaseControllerConstructorParams);
}
//# sourceMappingURL=base.d.ts.map