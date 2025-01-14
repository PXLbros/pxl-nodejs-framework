import { ApplicationConfig } from '../application/base-application.interface.js';
import { RedisInstance } from '../redis/index.js';
import { DatabaseInstance } from '../database/index.js';
import { EventControllerType } from './controller/base.interface.js';
export interface EventDefinition {
    name: string;
    handlerName: string;
    controllerName?: string;
    controller?: EventControllerType;
}
export interface EventManagerOptions {
    controllersDirectory: string;
    log?: {
        startUp?: boolean;
    };
    debug?: {
        printEvents?: boolean;
    };
}
export interface EventManagerConstructorParams {
    applicationConfig: ApplicationConfig;
    options: EventManagerOptions;
    events: EventDefinition[];
    redisInstance: RedisInstance;
    databaseInstance: DatabaseInstance | null;
}
//# sourceMappingURL=manager.interface.d.ts.map