import type DatabaseInstance from '../../../database/instance.js';
import type QueueManager from '../../../queue/manager.js';
import type { RedisInstance } from '../../../redis/index.js';
import type WebSocketServer from '../../websocket-server.js';
import type { WebSocketServerBaseControllerConstructorParams } from './base.interface.js';

/**
 * Base WebSocket Server Controller
 *
 * ⚠️ IMPORTANT MEMORY MANAGEMENT:
 *
 * WebSocket controllers are LONG-LIVED SINGLETONS - one instance handles
 * ALL client connections and messages throughout the application lifetime.
 *
 * ❌ WRONG - Memory Leak:
 * ```typescript
 * class MyController extends WebSocketServerBaseController {
 *   private em = this.databaseInstance.getEntityManager(); // LEAK!
 *   async handleMessage(ws, data) {
 *     await this.em.findOne('User', { id: data.userId }); // Identity map grows forever
 *   }
 * }
 * ```
 *
 * ✅ CORRECT - Per-message EntityManager:
 * ```typescript
 * class MyController extends WebSocketServerBaseController {
 *   async handleMessage(ws, data) {
 *     await this.databaseInstance.withEntityManager(async (em) => {
 *       const user = await em.findOne('User', { id: data.userId });
 *       // em automatically cleaned up after this block
 *     });
 *   }
 * }
 * ```
 *
 * @see DatabaseInstance.withEntityManager for safe EntityManager usage
 */
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
