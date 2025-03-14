import { ApplicationConfig } from '../../application/base-application.interface.js';
import { DatabaseInstance } from '../../database/index.js';
import EventManager from '../../event/manager.js';
import { QueueManager } from '../../queue/index.js';
import { RedisInstance } from '../../redis/index.js';
import { WebServerOptions } from '../webserver.interface.js';
import WebServerBaseController from './base.js';
export interface WebServerBaseControllerConstructorParams {
    applicationConfig: ApplicationConfig;
    webServerOptions: WebServerOptions;
    redisInstance: RedisInstance;
    queueManager: QueueManager;
    eventManager: EventManager;
    databaseInstance: DatabaseInstance;
}
export type WebServerBaseControllerType = new (params: WebServerBaseControllerConstructorParams) => WebServerBaseController;
//# sourceMappingURL=base.interface.d.ts.map