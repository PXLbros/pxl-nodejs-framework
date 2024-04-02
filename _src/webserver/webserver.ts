import cors from 'cors';
import express, { Express, Router } from 'express';
import { Server } from 'http';
import { WebServerConfig } from './webserver.interface';
import RedisInstance from '../redis/redis-instance';
import logger from '../logger/logger';

export default class WebServer {
  private readonly config: WebServerConfig;

  private redisInstance: RedisInstance;

  private expressApp: Express;
  private expressRouter = Router();

  private server?: Server;

  constructor({ config, redisInstance }: { config: WebServerConfig; redisInstance: RedisInstance }) {
    this.config = config;

    this.redisInstance = redisInstance;

    this.init();
  }

  /**
   * Initialize web server
   */
  private init(): void {
    this.expressApp = express();
    this.expressRouter = Router();
  }

  /**
   * Configure web server middlewares
   */
  private configureMiddlewares(): void {
    // if (logger.isSentryInitialized) {
    //   this.expressApp.use(Sentry.Handlers.requestHandler());
    //   this.expressApp.use(Sentry.Handlers.tracingHandler());
    // }

    // Enable JSON body parsing
    this.expressApp.use(express.json());

    // CORS configuration
    const corsOptions: cors.CorsOptions = {
      origin: (origin, callback) => {
        const corsOrigins = this.config.corsOrigins || [];

        if (!origin || corsOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      optionsSuccessStatus: 200,
    };

    // Enable CORS
    this.expressApp.use(cors(corsOptions));

    // // Enable logging
    // this.expressApp.use(loggerMiddleware);

    // if (this.config.helmet.enabled) {
    //   // Enable Helmet.js
    //   this.expressApp.use(helmet());
    // }
  }

  private async configureRoutes(): Promise<void> {
    // const controllers = await Loader.loadModulesInDirectory({
    //   directory: path.join(__dirname, '../controllers/webserver'),
    //   extensions: ['.ts'],
    // });

    // // Go through each route
    // for (const route of this.config.routes) {
    //   const ControllerClass: ControllerType = controllers[route.controller];

    //   // Initialize controller instance
    //   const controllerInstance = new ControllerClass({
    //     redisInstance: this.redisInstance,
    //     databaseInstance: this.databaseInstance,
    //   });

    //   // Get controller action handler
    //   const controllerHandler = controllerInstance[route.action as keyof typeof controllerInstance];

    //   // Define Express route
    //   this.expressRouter[route.method](route.path, controllerHandler);
    // }

    // Set up routes
    this.expressApp.use('/', this.expressRouter);
  }

  public async start(): Promise<void> {
    // Configure middlewares
    this.configureMiddlewares();

    // Configure routes
    await this.configureRoutes();

    // if (logger.isSentryInitialized) {
    //   this.expressApp.use(Sentry.Handlers.errorHandler());
    // }

    // 404
    this.expressApp.use((_, res) => {
      res.status(404).send();
    });

    return new Promise((resolve) => {
      this.server = this.expressApp.listen(this.config.port, () => {
        this.handleServerStart();

        resolve();
      });
    });
  }

  /**
   * Handle server start
   */
  private handleServerStart = (): void => {
    logger.debug('Web server started', {
      Port: this.config.port,
    });
  };

  /**
   * Stop web server
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        return resolve();
      }

      this.server.close(() => {
        logger.debug('Web server stopped');

        resolve();
      });
    });
  }
}
