import WebServer from '../webserver/webserver.js';
import BaseApplication from './base-application.js';
import { Helper, Time } from '../util/index.js';
import { Logger } from '../logger/index.js';
import WebSocketServer from '../websocket/websocket-server.js';
import WebSocketClient from '../websocket/websocket-client.js';
/**
 * Application
 */
export default class WebApplication extends BaseApplication {
    /** Web application config */
    config;
    /** Web server */
    webServer;
    /** WebSocket server */
    webSocketServer;
    /** WebSocket client */
    webSocketClient;
    constructor(config) {
        super(config);
        const defaultConfig = {
            log: {
                startUp: true,
            },
        };
        const mergedConfig = Helper.defaultsDeep(config, defaultConfig);
        this.config = mergedConfig;
    }
    async startHandler({ redisInstance, databaseInstance, queueManager, eventManager, }) {
        if (this.config.webServer?.enabled) {
            // Initialize web server
            this.webServer = new WebServer({
                applicationConfig: this.config,
                // config: this.config.webServer,
                options: {
                    host: this.config.webServer.host,
                    port: this.config.webServer.port,
                    controllersDirectory: this.config.webServer.controllersDirectory,
                    cors: this.config.webServer.cors,
                    log: this.config.webServer.log,
                    debug: this.config.webServer.debug,
                },
                routes: this.config.webServer.routes,
                redisInstance,
                databaseInstance,
                queueManager,
                eventManager,
            });
            // Load web server
            await this.webServer.load();
            // Start web server
            // await this.webServer.start({ webSocketServer: this.webSocketServer?.server });
            await this.webServer.start();
        }
        if (this.config.webSocket?.enabled) {
            if (!this.webServer) {
                throw new Error('WebSocket requires web server to be enabled');
            }
            let webSocketServer;
            let webSocketClient;
            switch (this.config.webSocket.type) {
                case 'server': {
                    // Initialize WebSocket server
                    webSocketServer = new WebSocketServer({
                        uniqueInstanceId: this.uniqueInstanceId,
                        applicationConfig: this.config,
                        options: this.config.webSocket,
                        redisInstance,
                        databaseInstance,
                        queueManager,
                        routes: this.config.webSocket.routes,
                        workerId: this.workerId,
                    });
                    // Load WebSocket client
                    await webSocketServer.load();
                    // Start WebSocket server
                    await webSocketServer.start({
                        fastifyServer: this.webServer.fastifyServer,
                    });
                    break;
                }
                case 'client': {
                    // Initialize WebSocket client
                    webSocketClient = new WebSocketClient({
                        applicationConfig: this.config,
                        options: this.config.webSocket,
                        redisInstance,
                        databaseInstance,
                        queueManager,
                        routes: this.config.webSocket.routes,
                    });
                    // Load WebSocket client
                    await webSocketClient.load();
                    // Connect to WebSocket server
                    await webSocketClient.connectToServer();
                    break;
                }
                default: {
                    if (!this.config.webSocket.type) {
                        throw new Error('WebSocket type is required');
                    }
                    else {
                        throw new Error(`WebSocket type is not supported (Type: ${this.config.webSocket.type})`);
                    }
                }
            }
            this.webSocketServer = webSocketServer;
            this.webSocketClient = webSocketClient;
        }
    }
    /**
     * Stop application callback
     */
    async stopCallback() {
        if (this.webServer) {
            // Stop web server
            await this.webServer.stop();
        }
        if (this.webSocketServer) {
            // Stop WebSocket server
            await this.webSocketServer.stop();
        }
    }
    /**
     * Application started event
     */
    async onStarted({ startupTime, }) {
        if (this.config.log?.startUp) {
            Logger.info('Application started', {
                Name: this.config.name,
                'Instance ID': this.config.instanceId,
                'PXL Framework Version': this.applicationVersion,
                'Startup Time': Time.formatTime({
                    time: startupTime,
                    format: 's',
                    numDecimals: 2,
                    showUnit: true,
                }),
            });
        }
        if (this.config.events?.onStarted) {
            this.config.events.onStarted({
                app: this,
                startupTime,
            });
        }
    }
    async onStopped({ runtime, }) {
        if (this.config.log?.shutdown) {
            Logger.info('Application stopped', {
                Name: this.config.name,
                'Instance ID': this.config.instanceId,
                Runtime: Time.formatTime({
                    time: runtime,
                    format: 's',
                    numDecimals: 2,
                    showUnit: true,
                }),
            });
        }
        if (this.config.events?.onStopped) {
            this.config.events.onStopped({ app: this, runtime });
        }
    }
}
//# sourceMappingURL=web-application.js.map