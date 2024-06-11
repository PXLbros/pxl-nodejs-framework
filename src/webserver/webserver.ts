import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { WebServerConstructorParams, WebServerDebugOptions, WebServerOptions, WebServerRoute } from './webserver.interface.js';
import { Logger } from '../logger/index.js';
import { Helper, Loader, Time } from '../util/index.js';
import { RedisInstance } from '../redis/index.js';
import { DatabaseInstance } from '../database/index.js';
import { WebServerBaseControllerType } from './controller/base.interface.js';
import { QueueManager } from '../queue/index.js';
import { WebServerHealthController } from '../index.js';
import { ApplicationConfig } from '../application/application.interface.js';
import { existsSync } from 'fs';

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: [number, number];
  }
}

class WebServer {
  private applicationConfig: ApplicationConfig;

  private options: WebServerOptions;
  private routes: WebServerRoute[];

  private redisInstance: RedisInstance;
  private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance;

  private fastifyServer: FastifyInstance;

  constructor(params: WebServerConstructorParams) {
    // Define default options
    const defaultOptions: Partial<WebServerOptions> = {
      host: '0.0.0.0',
      port: 3001,
      corsUrls: [],
      debug: {
        printRoutes: false,
      },
    };

    // Merge default options
    const mergedOptions = Helper.defaultsDeep(params.options, defaultOptions);

    this.applicationConfig = params.applicationConfig;

    this.options = mergedOptions;
    this.routes = params.routes;

    this.redisInstance = params.redisInstance;
    this.queueManager = params.queueManager;
    this.databaseInstance = params.databaseInstance;

    // Create Fastify server
    this.fastifyServer = Fastify({
      logger: false,
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
  }

  private async onListen(): Promise<void> {
    const address = this.fastifyServer.server.address();
    const port = typeof address === 'string' ? address : address?.port;

    Logger.debug('Web server started', {
      Host: this.options.host,
      Port: port,
      CORS: this.options.corsUrls && this.options.corsUrls.length > 0 ? this.options.corsUrls.join(', ') : 'Disabled',
    });
  }

  private async onRequest(request: FastifyRequest): Promise<void> {
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

    Logger.debug('API Request', logParams);
  }

  private async onError(request: FastifyRequest, reply: FastifyReply, error: Error): Promise<void> {
    // Adjusted for Fastify types
    Logger.error(error);
    // Implement any additional logic here
  }

  private async onClose(): Promise<void> {
    Logger.debug('Web server stopped');
  }

  private configureCORS(): void {
    this.fastifyServer.register(cors, {
      origin: this.options.corsUrls,
    });
  }

  private configureMultipartUploads(): void {
    this.fastifyServer.register(multipart, {
      limits: {
        fieldNameSize: 100,
        fieldSize: 1024 * 1024 * 10,
        fields: 10,
        fileSize: 1024 * 1024 * 100,
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
      extensions: ['.ts'],
    });

    // Add health check route
    this.routes.push({
      method: 'GET',
      path: '/health',
      controller: WebServerHealthController,
      action: 'health',
    });

    // Go through each route
    for (const route of this.routes) {
      let ControllerClass: WebServerBaseControllerType;

      if (route.controller) {
        ControllerClass = route.controller;
      } else if (route.controllerName) {
        ControllerClass = controllers[route.controllerName];
      } else {
        throw new Error('Web server controller config not found');
      }

      if (typeof ControllerClass !== 'function') {
        const controllerPath = `${this.options.controllersDirectory}/${route.controllerName}.ts`;

        Logger.warn('Web server controller not found', {
          Controller: route.controllerName,
          Path: controllerPath,
          Route: `${route.path} (${route.method})`,
        });

        continue;
      }

      // Initialize controller instance
      const controllerInstance = new ControllerClass({
        applicationConfig: this.applicationConfig,
        redisInstance: this.redisInstance,
        queueManager: this.queueManager,
        databaseInstance: this.databaseInstance,
      });

      // Get controller action handler
      const controllerHandler = controllerInstance[route.action as keyof typeof controllerInstance];

      if (!controllerHandler) {
        Logger.warn('Web server controller action not found', {
          Controller: route.controllerName,
          Action: route.action,
        });

        continue;
      }

      // Add route
      this.fastifyServer.route({
        method: route.method,
        url: route.path,
        handler: controllerHandler,
        preValidation: async (request, reply) => {
          if (!route.validation) {
            return;
          }

          const validate = request.compileValidationSchema(route.validation.schema);

          if (!validate(request[route.validation.type])) {
            return reply.code(400).send({
              error: validate.errors,
            });
          }
        },
      });
    }

    if (this.options.debug.printRoutes) {
      Logger.debug('Web server routes:');

      console.log(this.fastifyServer.printRoutes());
    }
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
}

export default WebServer;
