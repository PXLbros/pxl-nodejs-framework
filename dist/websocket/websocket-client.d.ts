import { WebSocketRoute, WebSocketType } from './websocket.interface.js';
import RedisInstance from '../redis/instance.js';
import QueueManager from '../queue/manager.js';
import DatabaseInstance from '../database/instance.js';
import { WebSocketClientProps } from './websocket-client.interface.js';
import WebSocketBase from './websocket-base.js';
export default class WebSocketClient extends WebSocketBase {
    protected defaultRoutes: WebSocketRoute[];
    private applicationConfig;
    private options;
    private redisInstance;
    private queueManager;
    private databaseInstance;
    private ws?;
    private clientId?;
    constructor(props: WebSocketClientProps);
    get type(): WebSocketType;
    load(): Promise<void>;
    connectToServer(): Promise<void>;
    protected getControllerDependencies(): {
        sendMessage: (data: unknown) => void;
        redisInstance: RedisInstance;
        queueManager: QueueManager;
        databaseInstance: DatabaseInstance;
    };
    protected shouldPrintRoutes(): boolean;
    private handleIncomingMessage;
    protected handleMessageError(clientId: string, error: string): void;
    sendClientMessage: (data: unknown, binary?: boolean) => void;
    sendMessage: (data: unknown) => void;
}
//# sourceMappingURL=websocket-client.d.ts.map