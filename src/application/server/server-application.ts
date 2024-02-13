import Application from '../application';
import { ServerApplicationConfig } from './server-application.interface';

export default class ServerApplication extends Application {
  private config: ServerApplicationConfig;

  constructor(config: ServerApplicationConfig) {
    super();

    this.config = config;
  }

  /**
   * Start server application
   */
  public async startServer(): Promise<void> {
    console.log('START SERVER APP v3');
  }

  /**
   * Stop server application
   */
  public async stopServer(): Promise<void> {
  }
}
