import crypto from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest, type HTTPMethods } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import {
  type WebServerConstructorParams,
  type WebServerOptions,
  type WebServerRoute,
  WebServerRouteType,
} from './webserver.interface.js';
import { Logger } from '../logger/index.js';
import { File, Helper, Loader, Time } from '../util/index.js';
import WebServerUtil from './util.js';
import type { RedisInstance } from '../redis/index.js';
import type { DatabaseInstance } from '../database/index.js';
import type { WebServerBaseControllerType } from './controller/base.interface.js';
import type { QueueManager } from '../queue/index.js';
import { WebServerHealthController } from '../index.js';
import type { LifecycleManager } from '../lifecycle/lifecycle-manager.js';
import type { ApplicationConfig } from '../application/base-application.interface.js';
import type EventManager from '../event/manager.js';
import { enterRequestContext } from '../request-context/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
    requestId?: string;
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

  private lifecycleManager: LifecycleManager;
  private _isReady = false;

  constructor(params: WebServerConstructorParams & { lifecycleManager: LifecycleManager }) {
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
    this.routes = [...(params.routes ?? [])];

    this.redisInstance = params.redisInstance;
    this.queueManager = params.queueManager;
    this.eventManager = params.eventManager;
    this.databaseInstance = params.databaseInstance;
    this.lifecycleManager = params.lifecycleManager;

    // Create Fastify server
    const defaultBodyLimit = 25 * 1024 * 1024; // 25MB (safer default)
    const defaultConnectionTimeout = 10 * 1000; // 10 seconds (safer default)

    this.fastifyServer = Fastify({
      logger: false,
      bodyLimit: this.options.bodyLimit ?? defaultBodyLimit,
      connectionTimeout: this.options.connectionTimeout ?? defaultConnectionTimeout,
    });
  }

  /**
   * Load web server.
   */
  public async load(): Promise<void> {
    // Configure security (helmet, rate limiting)
    await this.configureSecurity();

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
   * Configure security features (Helmet, Rate Limiting)
   */
  private async configureSecurity(): Promise<void> {
    const security = this.options.security ?? {};

    // Configure Helmet for security headers
    const helmetConfig = security.helmet ?? { enabled: true };
    if (helmetConfig.enabled !== false) {
      await this.fastifyServer.register(helmet, {
        contentSecurityPolicy: helmetConfig.contentSecurityPolicy !== false,
        crossOriginEmbedderPolicy: helmetConfig.crossOriginEmbedderPolicy !== false,
        crossOriginOpenerPolicy: helmetConfig.crossOriginOpenerPolicy !== false,
        crossOriginResourcePolicy: helmetConfig.crossOriginResourcePolicy !== false,
        dnsPrefetchControl: helmetConfig.dnsPrefetchControl !== false,
        frameguard: helmetConfig.frameguard !== false,
        hidePoweredBy: helmetConfig.hidePoweredBy !== false,
        hsts: helmetConfig.hsts !== false,
        ieNoOpen: helmetConfig.ieNoOpen !== false,
        noSniff: helmetConfig.noSniff !== false,
        originAgentCluster: helmetConfig.originAgentCluster !== false,
        permittedCrossDomainPolicies: helmetConfig.permittedCrossDomainPolicies !== false,
        referrerPolicy: helmetConfig.referrerPolicy !== false,
        xssFilter: helmetConfig.xssFilter !== false,
      });
    }

    // Configure rate limiting
    const rateLimitConfig = security.rateLimit ?? { enabled: true };
    if (rateLimitConfig.enabled !== false) {
      await this.fastifyServer.register(rateLimit, {
        max: rateLimitConfig.max ?? 1000,
        timeWindow: rateLimitConfig.timeWindow ?? '1 minute',
        ban: rateLimitConfig.ban,
        cache: rateLimitConfig.cache ?? 5000,
      });
    }

    // Warn about wildcard CORS in production
    if (process.env.NODE_ENV === 'production' && this.options.cors?.enabled) {
      const corsConfig = this.options.cors as { enabled: true; urls: string[] };
      if (corsConfig.urls?.includes('*')) {
        this.logger.warn({
          message: 'Wildcard CORS (*) is enabled in production - this is a security risk',
          meta: {
            recommendation: 'Specify allowed origins explicitly',
          },
        });
      }
    }
  }

  /**
   * Configure hooks.
   */
  private configureHooks(): void {
    this.fastifyServer.addHook('onListen', async () => this.onListen());
    this.fastifyServer.addHook('onRequest', async request => this.onRequest(request));
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
      await new Promise(resolve => setTimeout(resolve, this.options.debug?.simulateSlowConnection?.delay));
    }

    // Generate or use existing request ID for correlation
    const requestId = (request.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID();
    request.requestId = requestId;

    const pathsToIgnore = ['/health/live', '/health/ready'];

    if (pathsToIgnore.includes(request.url) || request.method === 'OPTIONS') {
      // ...
    } else {
      const startTime = Time.now();
      request.startTime = startTime;

      // Initialize AsyncLocalStorage context for this request
      // Using enterWith() to set context for the current async execution
      enterRequestContext({ requestId, startTime });
    }
  }

  private async onResponse(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Add request ID to response headers for client-side correlation
    if (request.requestId) {
      reply.header('X-Request-ID', request.requestId);
    }

    if (!request.startTime) {
      return;
    }

    const executionTime = Time.calculateElapsedTimeMs({
      startTime: request.startTime,
    });
    const formattedExecutionTime = Time.formatTime({
      time: executionTime,
      numDecimals: 3,
    });

    const ip = request.headers['x-forwarded-for'] ?? request.ip;

    const logParams: Record<string, unknown> = {
      Method: request.method,
      Path: request.url,
      Status: reply.statusCode,
    };

    if (process.env.NODE_ENV !== 'development') {
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
    Logger.error({ error });
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
    const origin = this.options.cors.urls.includes('*') ? true : this.options.cors.urls;

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
    await this.loadRoutesFromDirectory();

    // Check if controllers directory exists
    const controllersDirectoryExists = await File.pathExists(this.options.controllersDirectory);

    if (!controllersDirectoryExists) {
      Logger.warn({
        message: 'Web server controllers directory not found',
        meta: {
          Directory: this.options.controllersDirectory,
        },
      });

      return;
    }

    // Load controllers
    const controllers = await Loader.loadModulesInDirectory({
      directory: this.options.controllersDirectory,
      extensions: ['.ts', '.js'],
    });

    // Add health check routes
    this.routes.push(
      {
        type: WebServerRouteType.Default,
        method: 'GET',
        path: '/health/live',
        controller: WebServerHealthController,
        action: 'live',
      },
      {
        type: WebServerRouteType.Default,
        method: 'GET',
        path: '/health/ready',
        controller: WebServerHealthController,
        action: 'ready',
      },
    );

    // Go through each route
    for (const route of this.routes) {
      let ControllerClass: WebServerBaseControllerType;

      let controllerName;

      if (route.controller) {
        ControllerClass = route.controller;

        controllerName = ControllerClass.name;
      } else if (route.controllerName) {
        ControllerClass = controllers[route.controllerName] as WebServerBaseControllerType;

        controllerName = route.controllerName;
      } else {
        throw new Error('Web server controller config not found');
      }

      if (typeof ControllerClass !== 'function') {
        const controllerPath = `${this.options.controllersDirectory}/${route.controllerName}.ts`;

        Logger.warn({
          message: 'Web server controller not found',
          meta: {
            Controller: route.controllerName,
            Path: controllerPath,
            Route: `${route.path}`,
          },
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
        lifecycleManager: this.lifecycleManager,
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
            const entityModel = await Loader.loadEntityModule({
              entitiesDirectory: this.applicationConfig.database.entitiesDirectory,
              entityName: route.entityName,
            });

            const entityValidationSchema = (
              entityModel as { schema?: { describe: () => unknown } }
            ).schema?.describe() as
              | {
                  keys: Record<string, { type: string; flags?: { presence?: string }; [key: string]: unknown }>;
                  [key: string]: unknown;
                }
              | undefined;

            const formattedEntityValidationSchema = entityValidationSchema
              ? {
                  type: 'object',
                  properties: Object.fromEntries(
                    Object.entries(entityValidationSchema.keys).map(([key, value]) => [key, { type: value.type }]),
                  ),
                  required: Object.keys(entityValidationSchema.keys).filter(
                    // Dynamic schema inspection of joi describe output; keys are from trusted entity definitions
                    // eslint-disable-next-line security/detect-object-injection
                    key => entityValidationSchema.keys[key].flags?.presence === 'required',
                  ),
                }
              : {};

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

  private async loadRoutesFromDirectory(): Promise<void> {
    const { routesDirectory } = this.options;

    if (!routesDirectory) {
      return;
    }

    const directoryExists = await File.pathExists(routesDirectory);

    if (!directoryExists) {
      this.logger.warn({
        message: 'Web server routes directory not found',
        meta: {
          Directory: routesDirectory,
        },
      });

      return;
    }

    const routeModules = await Loader.loadModulesInDirectory<
      WebServerRoute | WebServerRoute[] | { routes?: WebServerRoute[] }
    >({
      directory: routesDirectory,
      extensions: ['.ts', '.js'],
    });

    const loadedRoutes: WebServerRoute[] = [];

    for (const [moduleName, exportedRoutes] of Object.entries(routeModules)) {
      const normalizedRoutes = this.normalizeRouteExport(exportedRoutes, moduleName);

      if (normalizedRoutes.length === 0) {
        continue;
      }

      loadedRoutes.push(...normalizedRoutes);
    }

    if (loadedRoutes.length > 0) {
      this.routes.push(...loadedRoutes);
    }
  }

  private normalizeRouteExport(exportedValue: unknown, moduleName: string): WebServerRoute[] {
    const ensureRouteArray = (value: unknown): WebServerRoute[] => {
      if (Array.isArray(value)) {
        return value;
      }

      if (value && typeof value === 'object') {
        const maybeRoute = value as { routes?: unknown };

        if (Array.isArray(maybeRoute.routes)) {
          return maybeRoute.routes as WebServerRoute[];
        }
      }

      return value ? [value as WebServerRoute] : [];
    };

    const routeCandidates = ensureRouteArray(exportedValue);
    const validRoutes: WebServerRoute[] = [];

    for (const [index, candidate] of routeCandidates.entries()) {
      if (this.isValidRoute(candidate)) {
        validRoutes.push(candidate);
      } else {
        this.logger.warn({
          message: 'Invalid web server route definition skipped',
          meta: {
            Module: moduleName,
            Index: index,
          },
        });
      }
    }

    if (validRoutes.length === 0 && routeCandidates.length > 0) {
      this.logger.warn({
        message: 'No valid routes exported from module',
        meta: {
          Module: moduleName,
        },
      });
    }

    return validRoutes;
  }

  private isValidRoute(route: unknown): route is WebServerRoute {
    if (!route || typeof route !== 'object') {
      return false;
    }

    const candidate = route as Record<string, unknown>;
    const routePath = candidate.path;

    if (typeof routePath !== 'string' || routePath.length === 0) {
      return false;
    }

    const routeType = candidate.type ?? WebServerRouteType.Default;

    const controllerProvided =
      typeof candidate.controller === 'function' || typeof candidate.controllerName === 'string';

    if (routeType === WebServerRouteType.Entity || routeType === 'entity') {
      return controllerProvided && typeof candidate.entityName === 'string' && candidate.entityName.length > 0;
    }

    if (!controllerProvided) {
      return false;
    }

    const method = candidate.method;
    const action = candidate.action;

    const isValidMethod =
      typeof method === 'string' ||
      (Array.isArray(method) && method.length > 0 && method.every(m => typeof m === 'string'));

    const isValidAction = typeof action === 'string' && action.length > 0;

    return isValidMethod && isValidAction;
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
    routeValidation?: {
      type: 'body' | 'query' | 'params';
      schema: { [key: string]: any };
    };
  }): Promise<void> {
    // Get controller action handler
    // Validate action name to avoid prototype access
    if (!/^[A-Za-z0-9_]+$/.test(routeAction) || ['__proto__', 'prototype', 'constructor'].includes(routeAction)) {
      throw new Error('Invalid controller action name');
    }
    // Dynamic access guarded by regex + deny list (keys validated above)
    const controllerHandler = controllerInstance[routeAction as keyof typeof controllerInstance];

    if (!controllerHandler) {
      Logger.warn({
        message: 'Web server controller action not found',
        meta: {
          Controller: controllerName,
          Action: routeAction,
        },
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

        // Avoid dynamic request[...] access for security lint; map explicitly
        let dataToValidate: any;
        switch (routeValidation.type) {
          case 'body':
            dataToValidate = request.body;
            break;
          case 'query':
            dataToValidate = request.query;
            break;
          case 'params':
            dataToValidate = request.params;
            break;
          default:
            dataToValidate = undefined;
        }

        if (!validate(dataToValidate)) {
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
      this._isReady = true;
    } catch (error) {
      Logger.error({ error });
      throw error;
    }
  }

  /**
   * Stop web server.
   */
  public async stop(): Promise<void> {
    this._isReady = false;
    // Close Fastify server
    await this.fastifyServer.close();
  }

  /**
   * Check if web server is ready to accept traffic.
   */
  public isReady(): boolean {
    return this._isReady && this.fastifyServer.server?.listening === true;
  }

  /**
   * Log web server message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom({ level: 'webServer', message, meta });
  }
}

export default WebServer;
