import { WebSocket, WebSocketServer as WS, } from 'ws';
import { WebSocketRedisSubscriberEvent, } from './websocket.interface.js';
import WebSocketClientManager from './websocket-client-manager.js';
import { generateClientId, log } from './utils.js';
import WebSocketBase from './websocket-base.js';
import { Logger } from '../logger/index.js';
import path from 'path';
import { baseDir } from '../index.js';
import WebSocketRoomManager from './websocket-room-manager.js';
import logger from '../logger/logger.js';
export default class WebSocketServer extends WebSocketBase {
    defaultRoutes = [
        {
            type: 'system',
            action: 'joinRoom',
            controllerName: 'system',
        },
        {
            type: 'system',
            action: 'leaveRoom',
            controllerName: 'system',
        },
    ];
    server;
    checkConnectedClientsInterval;
    workerId;
    uniqueInstanceId;
    applicationConfig;
    options;
    clientManager = new WebSocketClientManager();
    roomManager = new WebSocketRoomManager({
        clientManager: this.clientManager,
    });
    redisInstance;
    queueManager;
    databaseInstance;
    /** Redis subscriber events */
    redisSubscriberEvents = [
        WebSocketRedisSubscriberEvent.ClientConnected,
        WebSocketRedisSubscriberEvent.ClientJoinedRoom,
        WebSocketRedisSubscriberEvent.ClientLeftRoom,
        WebSocketRedisSubscriberEvent.ClientDisconnected,
        WebSocketRedisSubscriberEvent.DisconnectClient,
        WebSocketRedisSubscriberEvent.SendMessage,
        WebSocketRedisSubscriberEvent.SendMessageToAll,
        WebSocketRedisSubscriberEvent.MessageError,
        WebSocketRedisSubscriberEvent.QueueJobCompleted,
        WebSocketRedisSubscriberEvent.QueueJobError,
        WebSocketRedisSubscriberEvent.Custom,
    ];
    constructor(props) {
        super();
        this.uniqueInstanceId = props.uniqueInstanceId;
        this.applicationConfig = props.applicationConfig;
        this.options = props.options;
        this.redisInstance = props.redisInstance;
        this.queueManager = props.queueManager;
        this.databaseInstance = props.databaseInstance;
        this.routes = props.routes;
        this.workerId = props.workerId;
    }
    get type() {
        return 'server';
    }
    async load() {
        const libraryControllersDirectory = path.join(baseDir, 'websocket', 'controllers', 'server');
        // Configure default routes
        await this.configureRoutes(this.defaultRoutes, libraryControllersDirectory);
        // Configure custom routes
        await this.configureRoutes(this.routes, this.options.controllersDirectory);
    }
    async start({ fastifyServer }) {
        return new Promise((resolve) => {
            const server = new WS({
                noServer: true, // We're handling the server externally
            });
            this.server = server;
            // Ensure this is called after the server has been properly set up
            this.handleServerStart();
            fastifyServer.server.on('upgrade', (request, socket, head) => {
                if (request.url === '/ws') {
                    server.handleUpgrade(request, socket, head, (ws) => {
                        server.emit('connection', ws, request);
                    });
                }
                else {
                    socket.destroy();
                }
            });
            server.on('error', this.handleServerError);
            server.on('connection', this.handleServerClientConnection);
            // Resolve the promise with the server instance
            resolve({ server });
        });
    }
    async stop() {
        if (this.checkConnectedClientsInterval) {
            clearInterval(this.checkConnectedClientsInterval);
        }
        this.server?.close();
        log('Server stopped');
    }
    getControllerDependencies() {
        return {
            webSocketServer: this,
            redisInstance: this.redisInstance,
            queueManager: this.queueManager,
            databaseInstance: this.databaseInstance,
        };
    }
    shouldPrintRoutes() {
        return this.options.debug?.printRoutes ?? false;
    }
    handleServerStart = () => {
        if (!this.server) {
            throw new Error('WebSocket server not started');
        }
        if (this.options.disconnectInactiveClients?.enabled) {
            this.checkConnectedClientsInterval = setInterval(() => this.checkInactiveClients(), this.options.disconnectInactiveClients
                .intervalCheckTime);
        }
        // Go through each event and subscribe to it
        this.redisSubscriberEvents.forEach((subscriberEventName) => {
            // Subscribe to event
            this.redisInstance.subscriberClient?.subscribe(subscriberEventName);
        });
        // Handle subscriber message
        this.redisInstance.subscriberClient.on('message', this.handleSubscriberMessage);
        log('Server started', {
            Host: this.options.host,
            Port: this.options.port || '-',
        });
        if (this.options.events?.onServerStarted) {
            this.options.events.onServerStarted({
                webSocketServer: this.server,
            });
        }
    };
    /**
     * Handle subscriber message.
     */
    handleSubscriberMessage = async (channel, message) => {
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message);
        }
        catch (error) {
            log('Failed to parse subscriber message', {
                Channel: channel,
                Message: message,
                Error: error,
            });
            return;
        }
        const runSameWorker = parsedMessage.runSameWorker === true;
        const isSameWorker = parsedMessage.workerId === this.workerId;
        // Check if message is from the same worker
        if (runSameWorker !== true && isSameWorker) {
            // Ignore the message if it's from the same worker
            return;
        }
        log('Incoming subscriber message', {
            Channel: channel,
            // 'Run Same Worker': parsedMessage.runSameWorker ? 'Yes' : 'No',
            'Client ID': parsedMessage.clientId || '-',
        });
        switch (channel) {
            case WebSocketRedisSubscriberEvent.ClientConnected: {
                this.onClientConnect({
                    clientId: parsedMessage.clientId,
                    lastActivity: parsedMessage.lastActivity,
                });
                break;
            }
            case WebSocketRedisSubscriberEvent.ClientDisconnected: {
                this.onClientDisconnect({
                    clientId: parsedMessage.clientId,
                });
                break;
            }
            case WebSocketRedisSubscriberEvent.DisconnectClient: {
                const clientToDisconnect = this.clientManager.getClient({
                    clientId: parsedMessage.clientId,
                    // requireWs: true,
                });
                log(`GOT A REQUEST TO POTENTIALLY DISCONNECT LCIENT IF THIS CLIENT IS CONNETED HERE, GET CLIENT ------------------------- ${clientToDisconnect ? clientToDisconnect : 'NO CLIENT'}`);
                console.log('clientToDisconnect', clientToDisconnect, 'workerId: ', this.workerId);
                if (clientToDisconnect) {
                    this.clientManager.disconnectClient({
                        clientId: parsedMessage.clientId,
                    });
                    // this.onClientDisconnect({
                    //   clientId: parsedMessage.clientId,
                    // });
                    // Remove client from rooms
                    this.roomManager.removeClientFromAllRooms({
                        clientId: parsedMessage.clientId,
                    });
                }
                break;
            }
            case WebSocketRedisSubscriberEvent.ClientJoinedRoom: {
                this.onJoinRoom({
                    clientId: parsedMessage.clientId,
                    roomName: parsedMessage.roomName,
                    userData: parsedMessage.user,
                });
                break;
            }
            case WebSocketRedisSubscriberEvent.ClientLeftRoom: {
                this.roomManager.removeClientFromRoom({
                    roomName: parsedMessage.room,
                    clientId: parsedMessage.clientId,
                });
                break;
            }
            case WebSocketRedisSubscriberEvent.SendMessage: {
                break;
            }
            case WebSocketRedisSubscriberEvent.SendMessageToAll: {
                this.broadcastToAllClients({ data: parsedMessage });
                break;
            }
            case WebSocketRedisSubscriberEvent.MessageError: {
                this.sendMessageError({
                    webSocketClientId: parsedMessage.clientId,
                    error: parsedMessage.error,
                });
                break;
            }
            case WebSocketRedisSubscriberEvent.QueueJobCompleted: {
                // const parsedMessage = JSON.parse(message);
                // this.sendJobDoneMessage({ type: 'jobCompleted', ...parsedMessage });
                break;
            }
            case WebSocketRedisSubscriberEvent.QueueJobError: {
                // const parsedMessage = JSON.parse(message);
                // action and data is separate
                // TODO: Instead allow to pass anything
                parsedMessage.data = parsedMessage.error;
                // this.sendJobDoneMessage({ type: 'jobError', ...parsedMessage });
                break;
            }
            case WebSocketRedisSubscriberEvent.Custom: {
                // Custom logic is being handled in the app
                break;
            }
            default: {
                log('Unknown subscriber message received', {
                    Channel: channel,
                    Message: message,
                });
            }
        }
        if (typeof this.applicationConfig.webSocket
            ?.subscriberEventHandler === 'function') {
            // Execute custom application subscriber event handler
            this.applicationConfig.webSocket.subscriberEventHandler({
                channel,
                message: parsedMessage,
                webSocketServer: this,
                databaseInstance: this.databaseInstance,
            });
        }
    };
    handleServerError = (error) => {
        Logger.error(error);
    };
    handleServerClientConnection = (ws) => {
        const clientId = generateClientId();
        const lastActivity = Date.now();
        ws.on('message', (message) => this.handleClientMessage(ws, message));
        ws.on('close', () => {
            this.handleServerClientDisconnection(clientId);
            this.clientManager.removeClient(clientId);
        });
        try {
            this.clientManager.addClient({
                clientId,
                ws,
                lastActivity,
            });
            // Let other workers know that the client has connected
            this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.ClientConnected, JSON.stringify({
                clientId,
                lastActivity,
                workerId: this.workerId,
            }));
        }
        catch (error) {
            logger.error(error);
        }
    };
    leaveRoom({ ws, roomName, }) {
        const clientId = this.clientManager.getClientId({ ws });
        if (!clientId) {
            log('Client ID not found when removing client from room');
            return;
        }
        // Check if client is in room
        const clientInRoom = this.roomManager.isClientInRoom({
            clientId,
            roomName,
        });
        if (!clientInRoom) {
            log('Client not in room when removing client from room', {
                'Client ID': clientId || '-',
                'Room Name': roomName,
            });
            return;
        }
        this.roomManager.removeClientFromRoom({
            roomName,
            clientId,
        });
        this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.ClientLeftRoom, JSON.stringify({
            clientId,
            room: roomName,
            workerId: this.workerId,
        }));
        // Optionally send a message to the client
        this.sendClientMessage(ws, {
            type: 'user',
            action: 'leftRoom',
            data: {
                roomName,
            },
        });
    }
    onClientConnect({ clientId, lastActivity, }) {
        this.clientManager.addClient({
            clientId,
            ws: null,
            lastActivity,
        });
    }
    onClientDisconnect({ clientId, }) {
        // Set client as disconnected
        this.clientManager.removeClient(clientId);
        // Remove client from rooms
        this.roomManager.removeClientFromAllRooms({ clientId });
    }
    handleServerClientDisconnection = (clientId) => {
        const client = this.clientManager.getClient({
            clientId,
        });
        if (!client) {
            log('Client not found when handling server client disconnection', {
                'Client ID': clientId || '-',
            });
            return;
        }
        this.onClientDisconnect({ clientId });
        this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.ClientDisconnected, JSON.stringify({
            clientId,
            workerId: this.workerId,
        }));
        // log('Client disconnected', { ID: clientId });
    };
    handleClientMessage = async (ws, message) => {
        try {
            const clientId = this.clientManager.getClientId({
                ws,
            });
            if (!clientId) {
                log('Client ID not found when handling server message');
                return;
            }
            // Handle server message
            const serverMessageResponse = await this.handleServerMessage(ws, message, clientId);
            if (serverMessageResponse) {
                this.sendClientMessage(ws, {
                    type: serverMessageResponse.type,
                    action: serverMessageResponse.action,
                    response: serverMessageResponse?.response,
                });
                if (serverMessageResponse?.response?.error) {
                    // throw new Error(serverMessageResponse?.response?.error);
                    Logger.error(serverMessageResponse.response.error);
                }
            }
        }
        catch (error) {
            Logger.error(error);
            log('Error handling client message', {
                Error: error,
            });
        }
    };
    handleMessageError(clientId, error) {
        this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.MessageError, JSON.stringify({
            runSameWorker: true,
            clientId,
            error,
        }));
    }
    checkInactiveClients() {
        const now = Date.now();
        if (this.options.disconnectInactiveClients?.enabled &&
            this.options.disconnectInactiveClients.log) {
            log('Checking inactive clients...');
        }
        let numInactiveClients = 0;
        // this.connectedClients.forEach(
        //   (clientInfo, clientId) => {
        //     if (
        //       this.options.disconnectInactiveClients?.enabled &&
        //       typeof this.options.disconnectInactiveClients
        //         .inactiveTime === 'number'
        //     ) {
        //       const timeUntilInactive = Math.max(
        //         0,
        //         this.options.disconnectInactiveClients
        //           .inactiveTime -
        //           (now - clientInfo.lastActivity),
        //       );
        //       const isClientInactive = timeUntilInactive <= 0;
        //       if (this.options.disconnectInactiveClients.log) {
        //         log('Checking client activity', {
        //           ID: clientId,
        //           'Time Until Inactive': Time.formatTime({
        //             time: timeUntilInactive,
        //             format: 'auto',
        //           }),
        //         });
        //       }
        //       if (isClientInactive) {
        //         this.disconnectClient({ clientId });
        //         numInactiveClients++;
        //       }
        //     }
        //   },
        // );
        // if (
        //   this.options.disconnectInactiveClients?.enabled &&
        //   this.options.disconnectInactiveClients.log
        // ) {
        //   if (numInactiveClients > 0) {
        //     log('Inactive clients disconnected', {
        //       Count: numInactiveClients,
        //     });
        //   } else {
        //     log('No inactive clients');
        //   }
        // }
    }
    // private disconnectClient({
    //   clientId,
    // }: {
    //   clientId: string;
    // }) {
    //   const clientInfo = this.connectedClients.get(clientId);
    //   if (clientInfo?.ws) {
    //     const connectedTime =
    //       Date.now() - clientInfo.lastActivity;
    //     clientInfo.ws.close();
    //     Logger.info(
    //       'WebSocket client was disconnected due to inactivity',
    //       {
    //         ID: clientId,
    //         Worker: this.workerId,
    //         'Time Connected': Time.formatTime({
    //           time: connectedTime,
    //           format: 's',
    //         }),
    //       },
    //     );
    //   }
    // }
    broadcastToAllClients({ data, excludeClientId, }) {
        if (!this.server) {
            log('Server not started when broadcasting to all clients');
            return;
        }
        this.server.clients.forEach((client) => {
            let excludeClient = false;
            if (excludeClientId) {
                const clientId = this.clientManager.getClientId({
                    ws: client,
                });
                excludeClient = clientId === excludeClientId;
            }
            if (client.readyState === WebSocket.OPEN &&
                !excludeClient) {
                client.send(JSON.stringify(data));
            }
        });
    }
    sendMessageError({ webSocketClientId, error, }) {
        const client = this.clientManager.getClient({
            clientId: webSocketClientId,
        });
        if (!client) {
            log('Client not found when sending message error', {
                'Client ID': webSocketClientId || '-',
                Error: error,
            });
            return;
        }
        else if (!client.ws) {
            log('Client WebSocket not found when sending message error', {
                'Client ID': webSocketClientId || '-',
                Error: error,
            });
            return;
        }
        this.sendClientMessage(client.ws, {
            type: 'error',
            action: 'message',
            data: {
                error,
            },
        });
    }
    // private getClientId({
    //   client,
    // }: {
    //   client: WebSocket;
    // }): string | undefined {
    //   return [...this.connectedClients.entries()].find(
    //     ([_, value]) => value.ws === client,
    //   )?.[0];
    // }
    onJoinRoom({ clientId, roomName, userData, }) {
        // TODO: If config clientCanJoinMultipleRooms !== true, then it should remove the user from existing room first
        const client = this.clientManager.getClient({
            clientId,
        });
        if (!client) {
            log('Client not found when joining room', {
                'Client ID': clientId || '-',
                'Room Name': roomName,
            });
            return;
        }
        const clientCanJoinMultipleRooms = false;
        if (clientCanJoinMultipleRooms !== true) {
            if (client.roomName) {
                // Remove client from current room
                this.roomManager.removeClientFromRoom({
                    roomName: client.roomName,
                    clientId,
                });
            }
        }
        // Update client with user in client manager
        this.clientManager.updateClient({
            clientId,
            key: 'user',
            data: userData,
        });
        this.roomManager.addClientToRoom({
            clientId,
            user: userData,
            roomName,
        });
    }
    async joinRoom({ ws, userId, userType, username, roomName, }) {
        const clientId = this.clientManager.getClientId({ ws });
        if (!clientId) {
            throw new Error('Client ID not found when joining room');
        }
        // Check if client is already in room
        const isClientInRoom = this.roomManager.isClientInRoom({
            clientId,
            roomName,
        });
        if (isClientInRoom) {
            throw new Error('Client already in room when joining');
        }
        let userData = {};
        // // Get WebSocket client ID
        // const webSocketId = this.clientManager.getClientId({ ws });
        if (userId) {
            // Get user email from database
            const dbEntityManager = this.databaseInstance.getEntityManager();
            const getUserQuery = 'SELECT email FROM users WHERE id = ?';
            const getUserParams = [userId];
            const getUserResult = await dbEntityManager.execute(getUserQuery, getUserParams);
            if (!getUserResult || getUserResult.length === 0) {
                throw new Error('User not found in database');
            }
            const user = getUserResult[0];
            userData = {
                id: userId,
                ...user,
            };
        }
        // userData.uniqueId = webSocketId;
        if (username) {
            userData.username = username;
        }
        userData.userType = userType;
        // if user with same email is already connected, disconnect the previous connection
        // const existingClient =
        //   this.clientManager.getClientByKey({
        //     key: 'user.email',
        //     value: user.email,
        //   });
        // if (existingClient) {
        //   if (existingClient.ws) {
        //     this.clientManager.disconnectClient({
        //       clientId: existingClient.clientId,
        //     });
        //   } else {
        //     // Publish to Redis that we should disconnect this client
        //     this.redisInstance.publisherClient.publish(
        //       WebSocketRedisSubscriberEvent.DisconnectClient,
        //       JSON.stringify({
        //         clientId,
        //         workerId: this.workerId,
        //       }),
        //     );
        //   }
        // }
        this.onJoinRoom({
            clientId,
            roomName,
            userData,
        });
        // Let other workers know that the client has joined the room
        this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.ClientJoinedRoom, JSON.stringify({
            clientId,
            user: userData,
            roomName,
            workerId: this.workerId,
        }));
        return true;
    }
    sendClientMessage = (ws, data, binary = false) => {
        const webSocketMessage = JSON.stringify(data);
        ws.send(webSocketMessage, { binary });
    };
    sendMessage = ({ data, }) => {
        const formattedData = {
            ...data,
            workerId: this.workerId,
        };
        this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.SendMessage, JSON.stringify(formattedData));
    };
    sendMessageToAll = ({ data, }) => {
        const formattedData = {
            ...data,
            workerId: this.workerId,
        };
        this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.SendMessageToAll, JSON.stringify(formattedData));
    };
    sendCustomMessage = ({ data, }) => {
        const formattedData = {
            ...data,
            workerId: this.workerId,
        };
        console.log('SEND CUSTOM MESSAGE:', formattedData);
        this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.Custom, JSON.stringify(formattedData));
    };
    getClients({ userType, }) {
        return this.clientManager.getClients({ userType });
    }
}
//# sourceMappingURL=websocket-server.js.map