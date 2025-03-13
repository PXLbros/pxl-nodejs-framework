import { DatabaseInstance } from '../../database/index.js';
import { RedisInstance } from '../../redis/index.js';
import { EventControllerConstructorParams } from './base.interface.js';
import { Logger } from '../../logger/index.js';
import { ApplicationConfig } from '../../application/base-application.interface.js';
export default abstract class {
    protected logger: typeof Logger;
    protected workerId: number | undefined;
    protected applicationConfig: ApplicationConfig;
    protected redisInstance: RedisInstance;
    protected databaseInstance: DatabaseInstance | null;
    constructor({ applicationConfig, redisInstance, databaseInstance }: EventControllerConstructorParams);
    log(message: string, meta?: Record<string, unknown>): void;
}
//# sourceMappingURL=base.d.ts.map