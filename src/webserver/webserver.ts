import Fastify, { FastifyInstance, FastifyReply, FastifyRequest, HTTPMethods } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { WebServerConstructorParams, WebServerDebugOptions, WebServerOptions, WebServerRoute, WebServerRouteType } from './webserver.interface.js';
import { Logger } from '../logger/index.js';
import { Helper, Loader, Time } from '../util/index.js';
import WebServerUtil from './util.js';
import { RedisInstance } from '../redis/index.js';
import { DatabaseInstance } from '../database/index.js';
import { WebServerBaseControllerType } from './controller/base.interface.js';
import { QueueManager } from '../queue/index.js';
import { WebServerHealthController } from '../index.js';
import { ApplicationConfig } from '../application/base-application.interface.js';
import { existsSync } from 'fs';
import EventManager from '../event/manager.js';

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: [number, number];
  }
}

class WebServer {
  private logger: typeof Logger = Logger;

  private applicationConfig: ApplicationConfig;

  private options: WebServerOptions;
  private routes: WebServerRoute[];

  private redisInstance: RedisInstance;
  private queueManager: QueueManager;
  private eventManager: EventManager;
  private databaseInstance: DatabaseInstance;

  public fastifyServer: FastifyInstance;

  constructor(params: WebServerConstructorParams) {
    // Define default options
    const defaultOptions: Partial<WebServerOptions> = {
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
      // body limit = 5gb
      bodyLimit: 5 * 1024 * 1024 * 1024,
      // 30 minutes
      connectionTimeout: 30 * 60 * 1000,
    });
  }

  /**
   * Load web server.
   */
  public async load(): Promise<void> {
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
  private configureHooks(): void {
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

  private async onListen(): Promise<void> {
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

  private async onRequest(request: FastifyRequest): Promise<void> {
    if (
      this.options.debug?.simulateSlowConnection?.enabled &&
      this.options.debug?.simulateSlowConnection?.delay &&
      this.options.debug?.simulateSlowConnection?.delay > 0
    ) {
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          this.options.debug?.simulateSlowConnection?.delay,
        ),
      );
    }

    const pathsToIgnore = ['/health'];

    if (pathsToIgnore.includes(request.url) || request.method === 'OPTIONS') {
      return;
    } else {
      request.startTime = process.hrtime();
    }
  }

  private async onResponse(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.startTime) {
      return;
    }

    const executionTime = Time.calculateElapsedTime({ startTime: request.startTime });
    const formattedExecutionTime = Time.formatTime({ time: executionTime, numDecimals: 3 });

    const ip = request.headers['x-forwarded-for'] || request.ip;

    const logParams: Record<string, unknown> = {
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

  private async onError(request: FastifyRequest, reply: FastifyReply, error: Error): Promise<void> {
    // Adjusted for Fastify types
    Logger.error(error);
    // Implement any additional logic here
  }

  private async onClose(): Promise<void> {
    this.log('Stopped');
  }

  private configureCORS(): void {
    if (!this.options.cors?.enabled) {
      return;
    }

    // Handle wildcard origin for development
    const origin = this.options.cors.urls.includes('*')
      ? true
      : this.options.cors.urls;

    this.fastifyServer.register(cors, {
      origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
      // credentials: true,
    });
  }

  private configureMultipartUploads(): void {
    this.fastifyServer.register(multipart, {
      // attachFieldsToBody: true,
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
  private async configureRoutes(): Promise<void> {
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
      let ControllerClass: WebServerBaseControllerType;

      let controllerName;

      if (route.controller) {
        ControllerClass = route.controller;

        controllerName = ControllerClass.name;
      } else if (route.controllerName) {
        ControllerClass = controllers[route.controllerName];

        controllerName = route.controllerName;
      } else {
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
              properties: Object.fromEntries(
                Object.entries(entityValidationSchema.keys).map(([key, value]) => [key, { type: (value as any).type }])
              ),
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

  public async defineRoute({
    controllerInstance,
    controllerName,
    routeMethod,
    routePath,
    routeAction,
    routeValidation,
  }: {
    controllerInstance: any;
    controllerName: string;
    routeMethod: HTTPMethods | HTTPMethods[];
    routePath: string;
    routeAction: string;
    routeValidation?: { type: 'body' | 'query' | 'params'; schema: { [key: string]: any } };
  }): Promise<void> {
    // Get controller action handler
    const controllerHandler = controllerInstance[routeAction as keyof typeof controllerInstance];

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
  public async start(): Promise<void> {
    try {
      await this.fastifyServer.listen({
        host: this.options.host,
        port: this.options.port,
      });
    } catch (error) {
      Logger.error(error);
    }
  }

  /**
   * Stop web server.
   */
  public async stop(): Promise<void> {
    // Close Fastify server
    await this.fastifyServer.close();
  }

  /**
   * Log web server message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom('webServer', message, meta);
  }
}

export default WebServer;
