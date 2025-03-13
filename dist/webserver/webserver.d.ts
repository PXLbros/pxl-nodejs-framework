import { FastifyInstance, HTTPMethods } from 'fastify';
import { WebServerConstructorParams } from './webserver.interface.js';
declare module 'fastify' {
    interface FastifyRequest {
        startTime?: [number, number];
    }
}
declare class WebServer {
    private logger;
    private applicationConfig;
    private options;
    private routes;
    private redisInstance;
    private queueManager;
    private eventManager;
    private databaseInstance;
    fastifyServer: FastifyInstance;
    constructor(params: WebServerConstructorParams);
    /**
     * Load web server.
     */
    load(): Promise<void>;
    /**
     * Configure hooks.
     */
    private configureHooks;
    private onListen;
    private onRequest;
    private onResponse;
    private onError;
    private onClose;
    private configureCORS;
    private configureMultipartUploads;
    /**
     * Configure routes.
     */
    private configureRoutes;
    defineRoute({ controllerInstance, controllerName, routeMethod, routePath, routeAction, routeValidation, }: {
        controllerInstance: any;
        controllerName: string;
        routeMethod: HTTPMethods | HTTPMethods[];
        routePath: string;
        routeAction: string;
        routeValidation?: {
            type: 'body' | 'query' | 'params';
            schema: {
                [key: string]: any;
            };
        };
    }): Promise<void>;
    /**
     * Start web server.
     */
    start(): Promise<void>;
    /**
     * Stop web server.
     */
    stop(): Promise<void>;
    /**
     * Log web server message
     */
    log(message: string, meta?: Record<string, unknown>): void;
}
export default WebServer;
//# sourceMappingURL=webserver.d.ts.map