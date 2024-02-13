import ApplicationInstance from '../application-instance';
import WebServer from '../../webserver/webserver';
import { ServerApplicationInstanceProps } from './server-application-instance.interface';

export default class ServerApplicationInstance extends ApplicationInstance {
  private webServer: WebServer;

  constructor({ redisInstance, webServer }: ServerApplicationInstanceProps) {
    super({ redisInstance });

    this.webServer = webServer;
  }

  protected async stop(): Promise<void> {
    console.log('STOPPING SERVER APP ISNTANCE NOW');
    

    // Stop web server
    await this.webServer.stop();
  }
}
