import { ApplicationRedisConfig } from '../application.interface';
import { WebServerConfig } from '../../webserver/webserver.interface';
import { ClusterManagerConfig } from '../../cluster/cluster-manager.interface';

export interface ServerApplicationConfig {
  redis: ApplicationRedisConfig;

  cluster?: ClusterManagerConfig;

  webServer: WebServerConfig;
}
