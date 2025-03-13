import WebSocket from 'ws';
import { generateClientId, log, parseServerMessage } from './utils.js';
import WebSocketBase from './websocket-base.js';
import path from 'path';
import { baseDir } from '../index.js';
export default class WebSocketClient extends WebSocketBase {
    defaultRoutes = [
        {
            type: 'system',
            action: 'clientList',
            controllerName: 'system',
        },
    ];
    applicationConfig;
    options;
    redisInstance;
    queueManager;
    databaseInstance;
    ws;
    clientId;
    constructor(props) {
        super();
        this.applicationConfig = props.applicationConfig;
        this.options = props.options;
        this.redisInstance = props.redisInstance;
        this.queueManager = props.queueManager;
        this.databaseInstance = props.databaseInstance;
        this.routes = props.routes;
    }
    get type() {
        return 'client';
    }
    async load() {
        const libraryControllersDirectory = path.join(baseDir, 'websocket', 'controllers', 'client');
        await this.configureRoutes(this.defaultRoutes, libraryControllersDirectory);
        await this.configureRoutes(this.routes, this.options.controllersDirectory);
    }
    async connectToServer() {
        const url = this.options.url;
        // const host = this.options.host;
        // const port = this.options.port;
        return new Promise((resolve) => {
            const ws = new WebSocket(url);
            ws.on('open', () => {
                this.clientId = generateClientId();
                log('Connected to server', { ID: this.clientId });
                if (this.options.events?.onConnected) {
                    this.options.events.onConnected({
                        ws,
                        clientId: this.clientId,
                        joinRoom: ({ userId, userType, username, roomName, }) => {
                            this.sendClientMessage({
                                type: 'system',
                                action: 'joinRoom',
                                data: {
                                    userId,
                                    userType,
                                    username,
                                    roomName,
                                },
                            });
                        },
                    });
                }
                resolve();
            });
            ws.on('message', this.handleIncomingMessage);
            ws.on('close', () => {
                log('Connection to server closed');
                if (this.options.events?.onDisconnected) {
                    this.options.events.onDisconnected({ clientId: this.clientId });
                }
            });
            ws.on('error', (error) => {
                log('WebSocket error', { error: error.message });
                if (this.options.events?.onError) {
                    this.options.events.onError({ error: error });
                }
            });
            this.ws = ws;
        });
    }
    getControllerDependencies() {
        return {
            sendMessage: this.sendMessage,
            redisInstance: this.redisInstance,
            queueManager: this.queueManager,
            databaseInstance: this.databaseInstance,
        };
    }
    shouldPrintRoutes() {
        return this.options.debug?.printRoutes ?? false;
    }
    handleIncomingMessage = async (message) => {
        if (!this.ws || !this.clientId) {
            log('WebSocket not initialized or client ID not set');
            return;
        }
        if (this.options.events?.onMessage) {
            const parsedMessage = parseServerMessage(message);
            this.options.events.onMessage({
                ws: this.ws,
                clientId: this.clientId,
                data: parsedMessage,
                redisInstance: this.redisInstance,
                queueManager: this.queueManager,
                databaseInstance: this.databaseInstance,
            });
        }
        await this.handleServerMessage(this.ws, message, this.clientId);
    };
    handleMessageError(clientId, error) {
        log(error);
    }
    sendClientMessage = (data, binary = false) => {
        if (!this.ws) {
            log('WebSocket not initialized');
            return;
        }
        const webSocketMessage = JSON.stringify(data);
        console.log('SENDING LCIENT MESSAGE: ', webSocketMessage);
        this.ws.send(webSocketMessage, { binary });
    };
    sendMessage = (data) => {
        this.sendClientMessage(data);
    };
}
//# sourceMappingURL=websocket-client.js.map