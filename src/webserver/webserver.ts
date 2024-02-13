import express, { Express, Router } from 'express';
import { Server } from 'http';
import { WebServerConfig } from './webserver.interface';
import RedisInstance from '../redis/redis-instance';

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

  private init(): void {
    this.expressApp = express();
    this.expressRouter = Router();
  }

  public async load(): Promise<void> {
    // ...
  }

  public async start(): Promise<void> {
    // Load web server
    await this.load();
    
    return new Promise((resolve) => {
      this.server = this.expressApp.listen(this.config.port, () => {
        // this.handleServerStart();

        resolve();
      });
    });
  }
}
