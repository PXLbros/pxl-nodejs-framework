import RedisInstance from '../redis/instance.js';
import DatabaseInstance from '../database/instance.js';
import WebServer from '../webserver/webserver.js';
import QueueManager from '../queue/manager.js';
import BaseApplication from './base-application.js';
import { WebApplicationConfig } from './web-application.interface.js';
import WebSocketServer from '../websocket/websocket-server.js';
import WebSocketClient from '../websocket/websocket-client.js';
import EventManager from '../event/manager.js';
/**
 * Application
 */
export default class WebApplication extends BaseApplication {
    /** Web application config */
    protected config: WebApplicationConfig;
    /** Web server */
    webServer?: WebServer;
    /** WebSocket server */
    webSocketServer?: WebSocketServer;
    /** WebSocket client */
    webSocketClient?: WebSocketClient;
    constructor(config: WebApplicationConfig);
    protected startHandler({ redisInstance, databaseInstance, queueManager, eventManager, }: {
        redisInstance: RedisInstance;
        databaseInstance: DatabaseInstance;
        queueManager: QueueManager;
        eventManager: EventManager;
    }): Promise<void>;
    /**
     * Stop application callback
     */
    protected stopCallback(): Promise<void>;
    /**
     * Application started event
     */
    protected onStarted({ startupTime, }: {
        startupTime: number;
    }): Promise<void>;
    protected onStopped({ runtime, }: {
        runtime: number;
    }): Promise<void>;
}
//# sourceMappingURL=web-application.d.ts.map