import { ApplicationInstanceProps } from '../application-instance.interface';
import WebServer from '../../webserver/webserver';

export interface ServerApplicationInstanceProps extends ApplicationInstanceProps {
  webServer: WebServer;
}
