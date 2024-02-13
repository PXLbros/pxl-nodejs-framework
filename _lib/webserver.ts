import * as Sentry from '@sentry/node';
import cors from 'cors';
import express, { Express, Router } from 'express';
import helmet from 'helmet';
import { Server } from 'http';
import path from 'path';
import { DatabaseInstance, RedisInstance, logger } from '~/lib';
import { ControllerType } from '~/lib/controller/BaseController';
import loggerMiddleware from '~/lib/logger/middleware';
import { loaderUtil } from '~/utils';

export enum WebServerRouteMethod {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  DELETE = 'delete',
  OPTIONS = 'options',
}

export interface WebServerRoute {
  path: string;
  method: WebServerRouteMethod;
  controller: string;
  action: string;
}

export interface WebServerConfig {
  port: number;
  routes: WebServerRoute[];
  corsOrigins: string[];
  helmet: {
    enabled: boolean;
  };
}

export class WebServer {
  private config: WebServerConfig;

  private redisInstance: RedisInstance;
  // private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance;

  public expressApp: Express;
  private server?: Server;

  private expressRouter: Router;

  constructor({
    config,
    redisInstance,
    // queueManager,
    databaseInstance,
  }: {
    config: WebServerConfig;
    redisInstance: RedisInstance;
    // queueManager: QueueManager;
    databaseInstance: DatabaseInstance;
  }) {
    this.config = config;

    this.redisInstance = redisInstance;
    // this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;

    this.expressApp = express();

    this.expressRouter = Router();
  }

  public async load(): Promise<void> {
    // Configure middlewares
    this.configureMiddlewares();

    // Configure routes
    await this.configureRoutes();

    if (logger.isSentryInitialized) {
      this.expressApp.use(Sentry.Handlers.errorHandler());
    }

    // 404
    this.expressApp.use((_, res) => {
      res.status(404).send();
    });
  }

  private configureMiddlewares(): void {
    if (logger.isSentryInitialized) {
      this.expressApp.use(Sentry.Handlers.requestHandler());
      this.expressApp.use(Sentry.Handlers.tracingHandler());
    }

    // Enable JSON body parsing
    this.expressApp.use(express.json());

    // CORS configuration
    const corsOptions: cors.CorsOptions = {
      origin: (origin, callback) => {
        if (!origin || this.config.corsOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      optionsSuccessStatus: 200,
    };

    // Enable CORS
    this.expressApp.use(cors(corsOptions));

    // Enable logging
    this.expressApp.use(loggerMiddleware);

    if (this.config.helmet.enabled) {
      // Enable Helmet.js
      this.expressApp.use(helmet());
    }
  }

  private async configureRoutes(): Promise<void> {
    const controllers = await loaderUtil.loadModulesInDirectory({
      directory: path.join(__dirname, '../controllers/webserver'),
      extensions: ['.ts'],
    });

    // Go through each route
    for (const route of this.config.routes) {
      const ControllerClass: ControllerType = controllers[route.controller];

      // Initialize controller instance
      const controllerInstance = new ControllerClass({
        redisInstance: this.redisInstance,
        databaseInstance: this.databaseInstance,
      });

      // Get controller action handler
      const controllerHandler = controllerInstance[route.action as keyof typeof controllerInstance];

      // Define Express route
      this.expressRouter[route.method](route.path, controllerHandler);
    }

    // Set up routes
    this.expressApp.use('/', this.expressRouter);
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.expressApp.listen(this.config.port, () => {
        this.handleServerStart();

        resolve();
      });
    });
  }

  private handleServerStart = (): void => {
    logger.debug('Web server started', {
      Port: this.config.port,
    });
  };

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        return resolve();
      }

      this.server.close(() => {
        logger.debug('Web server stopped', {
          Port: this.config.port,
        });

        resolve();
      });
    });
  }
}
