import ApplicationInstance from '../application-instance';
import WebServer from '../../webserver/webserver';
import { ServerApplicationInstanceProps } from './server-application-instance.interface';

export default class ServerApplicationInstance extends ApplicationInstance {
  private webServer: WebServer;

  constructor({ redisInstance, events, webServer }: ServerApplicationInstanceProps) {
    super({ redisInstance, events });

    this.webServer = webServer;
  }

  protected async stop(): Promise<void> {
    // Stop web server
    await this.webServer.stop();
  }
}
