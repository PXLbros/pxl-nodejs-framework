import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { WebServerRouteType } from './webserver.interface.js';
import { Logger } from '../logger/index.js';
import { Helper, Loader, Time } from '../util/index.js';
import WebServerUtil from './util.js';
import { WebServerHealthController } from '../index.js';
import { existsSync } from 'fs';
class WebServer {
    logger = Logger;
    applicationConfig;
    options;
    routes;
    redisInstance;
    queueManager;
    eventManager;
    databaseInstance;
    fastifyServer;
    constructor(params) {
        // Define default options
        const defaultOptions = {
            host: '0.0.0.0',
            port: 3001,
            cors: {
                enabled: false,
            },
            errors: {
                verbose: false,
            },
            debug: {
                printRoutes: false,
                simulateSlowConnection: {
                    enabled: false,
                    delay: 250,
                },
            },
            log: {
                startUp: true,
            },
        };
        // Merge default options
        const mergedOptions = Helper.defaultsDeep(params.options, defaultOptions);
        this.applicationConfig = params.applicationConfig;
        this.options = mergedOptions;
        this.routes = params.routes;
        this.redisInstance = params.redisInstance;
        this.queueManager = params.queueManager;
        this.eventManager = params.eventManager;
        this.databaseInstance = params.databaseInstance;
        // Create Fastify server
        this.fastifyServer = Fastify({
            logger: false,
        });
    }
    /**
     * Load web server.
     */
    async load() {
        // Configure hooks
        this.configureHooks();
        // Configure CORS
        this.configureCORS();
        // Configure multipart uploads
        this.configureMultipartUploads();
        // Configure routes
        await this.configureRoutes();
    }
    /**
     * Configure hooks.
     */
    configureHooks() {
        this.fastifyServer.addHook('onListen', async () => this.onListen());
        this.fastifyServer.addHook('onRequest', async (request) => this.onRequest(request));
        this.fastifyServer.addHook('onResponse', async (request, reply) => this.onResponse(request, reply));
        this.fastifyServer.addHook('onError', async (request, reply, error) => this.onError(request, reply, error));
        this.fastifyServer.addHook('onClose', async () => this.onClose());
        // if (process.env.NODE_ENV === 'local') {
        //   this.fastifyServer.addHook('onSend', (request, reply, payload, done) => {
        //     reply.header('Cache-Control', 'no-store');
        //     done();
        //   });
        // }
    }
    async onListen() {
        const address = this.fastifyServer.server.address();
        const port = typeof address === 'string' ? address : address?.port;
        if (this.options.log?.startUp) {
            this.log('Started', {
                Host: this.options.host,
                Port: port,
                // CORS: this.options.cors?.enabled && this.options.cors?..length > 0 ? this.options.corsUrls.join(', ') : 'Disabled',
                CORS: this.options.cors?.enabled ? this.options.cors.urls.join(', ') : 'Disabled',
                'Fastify Version': this.fastifyServer.version,
            });
        }
    }
    async onRequest(request) {
        if (this.options.debug?.simulateSlowConnection?.enabled &&
            this.options.debug?.simulateSlowConnection?.delay &&
            this.options.debug?.simulateSlowConnection?.delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.options.debug?.simulateSlowConnection?.delay));
        }
        const pathsToIgnore = ['/health'];
        if (pathsToIgnore.includes(request.url) || request.method === 'OPTIONS') {
            return;
        }
        else {
            request.startTime = process.hrtime();
        }
    }
    async onResponse(request, reply) {
        if (!request.startTime) {
            return;
        }
        const executionTime = Time.calculateElapsedTime({ startTime: request.startTime });
        const formattedExecutionTime = Time.formatTime({ time: executionTime, numDecimals: 3 });
        const ip = request.headers['x-forwarded-for'] || request.ip;
        const logParams = {
            Method: request.method,
            Path: request.url,
            Status: reply.statusCode,
        };
        if (process.env.NODE_ENV !== 'local') {
            logParams.IP = ip.toString();
        }
        logParams.Time = formattedExecutionTime;
        // if (cluster.isWorker && cluster.worker) {
        //   logParams.Worker = cluster.worker.id;
        // }
        this.log('API Request', logParams);
    }
    async onError(request, reply, error) {
        // Adjusted for Fastify types
        Logger.error(error);
        // Implement any additional logic here
    }
    async onClose() {
        this.log('Stopped');
    }
    configureCORS() {
        if (!this.options.cors?.enabled) {
            return;
        }
        this.fastifyServer.register(cors, {
            origin: this.options.cors.urls,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            preflightContinue: false,
            optionsSuccessStatus: 204,
        });
    }
    configureMultipartUploads() {
        this.fastifyServer.register(multipart, {
            limits: {
                fieldNameSize: 100,
                fieldSize: 1024 * 1024 * 10,
                fields: 10,
                fileSize: 1024 * 1024 * 1024 * 10, // 10GB file size limit
                files: 1,
                headerPairs: 2000,
            },
        });
    }
    /**
     * Configure routes.
     */
    async configureRoutes() {
        // Check if controllers directory exists
        const controllersDirectoryExists = await existsSync(this.options.controllersDirectory);
        if (!controllersDirectoryExists) {
            Logger.warn('Web server controllers directory not found', { Directory: this.options.controllersDirectory });
            return;
        }
        // Load controllers
        const controllers = await Loader.loadModulesInDirectory({
            directory: this.options.controllersDirectory,
            extensions: ['.ts', '.js'],
        });
        // Add health check route
        this.routes.push({
            type: WebServerRouteType.Default,
            method: 'GET',
            path: '/health',
            controller: WebServerHealthController,
            action: 'health',
        });
        // Go through each route
        for (const route of this.routes) {
            let ControllerClass;
            let controllerName;
            if (route.controller) {
                ControllerClass = route.controller;
                controllerName = ControllerClass.name;
            }
            else if (route.controllerName) {
                ControllerClass = controllers[route.controllerName];
                controllerName = route.controllerName;
            }
            else {
                throw new Error('Web server controller config not found');
            }
            if (typeof ControllerClass !== 'function') {
                const controllerPath = `${this.options.controllersDirectory}/${route.controllerName}.ts`;
                Logger.warn('Web server controller not found', {
                    Controller: route.controllerName,
                    Path: controllerPath,
                    Route: `${route.path}`,
                });
                continue;
            }
            // Initialize controller instance
            const controllerInstance = new ControllerClass({
                applicationConfig: this.applicationConfig,
                webServerOptions: this.options,
                redisInstance: this.redisInstance,
                queueManager: this.queueManager,
                eventManager: this.eventManager,
                databaseInstance: this.databaseInstance,
            });
            let routeMethod;
            let routeAction;
            let routePath;
            switch (route.type) {
                case WebServerRouteType.Default: {
                    routeMethod = route.method;
                    routeAction = route.action;
                    routePath = route.path;
                    this.defineRoute({
                        controllerInstance,
                        controllerName,
                        routeMethod,
                        routePath,
                        routeAction,
                        routeValidation: route.validation,
                    });
                    break;
                }
                case WebServerRouteType.Entity: {
                    if (this.applicationConfig.database && this.applicationConfig.database.enabled === true) {
                        const entityModel = await Loader.loadEntityModule({ entitiesDirectory: this.applicationConfig.database.entitiesDirectory, entityName: route.entityName });
                        const entityValidationSchema = entityModel.schema?.describe();
                        const formattedEntityValidationSchema = entityValidationSchema ? {
                            type: 'object',
                            properties: Object.fromEntries(Object.entries(entityValidationSchema.keys).map(([key, value]) => [key, { type: value.type }])),
                            required: Object.keys(entityValidationSchema.keys).filter(key => entityValidationSchema.keys[key].flags?.presence === 'required'),
                        } : {};
                        const entityRouteDefinitions = WebServerUtil.getEntityRouteDefinitions({
                            basePath: route.path,
                            entityValidationSchema: formattedEntityValidationSchema,
                        });
                        for (const entityRouteDefinition of entityRouteDefinitions) {
                            this.defineRoute({
                                controllerInstance,
                                controllerName,
                                routeMethod: entityRouteDefinition.method,
                                routePath: entityRouteDefinition.path,
                                routeAction: entityRouteDefinition.action,
                                routeValidation: entityRouteDefinition.validationSchema,
                            });
                        }
                    }
                    break;
                }
            }
        }
        if (this.options.debug?.printRoutes) {
            this.log('Routes:');
            console.log(this.fastifyServer.printRoutes());
        }
    }
    async defineRoute({ controllerInstance, controllerName, routeMethod, routePath, routeAction, routeValidation, }) {
        // Get controller action handler
        const controllerHandler = controllerInstance[routeAction];
        if (!controllerHandler) {
            Logger.warn('Web server controller action not found', {
                Controller: controllerName,
                Action: routeAction,
            });
            throw new Error('Web server controller action not found');
        }
        // Add route
        this.fastifyServer.route({
            method: routeMethod,
            url: routePath,
            handler: controllerHandler,
            preValidation: async (request, reply) => {
                if (!routeValidation?.schema) {
                    // Logger.warn('Web server route validation schema not found', {
                    //   Controller: controllerName,
                    //   Action: routeAction,
                    // });
                    return;
                }
                const validate = request.compileValidationSchema(routeValidation.schema);
                if (!validate(request[routeValidation.type])) {
                    return reply.code(400).send({
                        error: validate.errors,
                    });
                }
            },
        });
    }
    /**
     * Start web server.
     */
    async start() {
        try {
            await this.fastifyServer.listen({
                host: this.options.host,
                port: this.options.port,
            });
        }
        catch (error) {
            Logger.error(error);
        }
    }
    /**
     * Stop web server.
     */
    async stop() {
        // Close Fastify server
        await this.fastifyServer.close();
    }
    /**
     * Log web server message
     */
    log(message, meta) {
        this.logger.custom('webServer', message, meta);
    }
}
export default WebServer;
//# sourceMappingURL=webserver.js.map