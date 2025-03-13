import { WebSocket, WebSocketServer as WS } from 'ws';
import { WebSocketRoute, WebSocketType } from './websocket.interface.js';
import RedisInstance from '../redis/instance.js';
import QueueManager from '../queue/manager.js';
import DatabaseInstance from '../database/instance.js';
import { WebSocketServerProps } from './websocket-server.interface.js';
import WebSocketClientManager from './websocket-client-manager.js';
import WebSocketBase from './websocket-base.js';
import { FastifyInstance } from 'fastify';
export default class WebSocketServer extends WebSocketBase {
    protected defaultRoutes: WebSocketRoute[];
    private server?;
    private checkConnectedClientsInterval?;
    private workerId;
    private uniqueInstanceId;
    private applicationConfig;
    private options;
    clientManager: WebSocketClientManager;
    private roomManager;
    private redisInstance;
    private queueManager;
    private databaseInstance;
    /** Redis subscriber events */
    private redisSubscriberEvents;
    constructor(props: WebSocketServerProps);
    get type(): WebSocketType;
    load(): Promise<void>;
    start({ fastifyServer }: {
        fastifyServer: FastifyInstance;
    }): Promise<{
        server: WS;
    }>;
    stop(): Promise<void>;
    protected getControllerDependencies(): {
        webSocketServer: WebSocketServer;
        redisInstance: RedisInstance;
        queueManager: QueueManager;
        databaseInstance: DatabaseInstance;
    };
    protected shouldPrintRoutes(): boolean;
    private handleServerStart;
    /**
     * Handle subscriber message.
     */
    private handleSubscriberMessage;
    private handleServerError;
    private handleServerClientConnection;
    leaveRoom({ ws, roomName, }: {
        ws: WebSocket;
        roomName: string;
    }): void;
    private onClientConnect;
    private onClientDisconnect;
    private handleServerClientDisconnection;
    private handleClientMessage;
    protected handleMessageError(clientId: string, error: string): void;
    private checkInactiveClients;
    broadcastToAllClients({ data, excludeClientId, }: {
        data: {
            [key: string]: any;
        };
        excludeClientId?: string;
    }): void;
    sendMessageError({ webSocketClientId, error, }: {
        webSocketClientId: string;
        error: string;
    }): void;
    private onJoinRoom;
    joinRoom({ ws, userId, userType, username, roomName, }: {
        ws: WebSocket;
        userId?: number;
        userType?: string;
        username?: string;
        roomName: string;
    }): Promise<boolean>;
    sendClientMessage: (ws: WebSocket, data: unknown, binary?: boolean) => void;
    sendMessage: ({ data, }: {
        data: unknown;
    }) => void;
    sendMessageToAll: ({ data, }: {
        data: unknown;
    }) => void;
    sendCustomMessage: ({ data, }: {
        data: unknown;
    }) => void;
    getClients({ userType, }: {
        userType?: string;
    }): any[];
}
//# sourceMappingURL=websocket-server.d.ts.map