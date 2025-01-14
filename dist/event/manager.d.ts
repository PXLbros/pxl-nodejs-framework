import { EventManagerConstructorParams } from './manager.interface.js';
export default class EventManager {
    private logger;
    private applicationConfig;
    private options;
    private events;
    private redisInstance;
    private databaseInstance;
    private eventHandlers;
    constructor(params: EventManagerConstructorParams);
    load(): Promise<void>;
    run({ name, data }: {
        name: string;
        data: any;
    }): Promise<void>;
    /**
     * Log event message
     */
    log(message: string, meta?: Record<string, unknown>): void;
}
//# sourceMappingURL=manager.d.ts.map